// costing-inventory.js
// Phase 6: inventory. On-hand counts and reorder points per item (supplies first, ingredients when she flips
// Track on), an Inventory screen (count, adjust, history, undo), stock in from shopping trips and approved
// receipts, stock out when a request is completed (or "Made this" on an estimate), low-stock alerts on Costing
// Home and the Analytics tile. Every movement is a document in `inventory_moves`; on-hand lives on the item as
// `stock: {track, onHand, reorderPoint, countedAt, updatedAt}`. Math is in costing-inventory-math.js (pure).
import {
    state, $, $$, esc, toast, registerPage, registerAction, registerExtension, byName, fmtDate, todayISO, uid,
    openModal, closeModal, getModalCtx, rerender, db, saveSettings, pricingCtx, pricingSettings
} from './costing.js';
import { collection, doc, setDoc, updateDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, writeBatch, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import * as U from './costing-units.js';
import * as I from './costing-inventory-math.js';

const UNDO_DAYS = 30;
const REASONS = [['spoilage', 'Spoiled or thrown out'], ['used', 'Used (no order)'], ['correction', 'Correction'], ['gift', 'Given away'], ['other', 'Other']];
const V = { subscribed: false, unsubs: [], moves: [], movesLoaded: false, completed: new Map(), completedSeen: null, filter: 'tracked', q: '', kind: '' };
state.moves = [];

// ------------------------------------------------------------------ settings and data
function invSettings() { return { startedAt: null, ...(state.settings.inventory || {}) }; }
function inventoryOn() { return !!invSettings().startedAt; }
function trackedItems() { return [...state.ingredients.values()].filter(i => I.stockOf(i).track).sort(byName); }
function subscribe() {
    if (V.subscribed) return;
    V.subscribed = true;
    V.unsubs.push(onSnapshot(query(collection(db, 'inventory_moves'), orderBy('at', 'desc'), limit(250)), snap => {
        const list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        state.moves = V.moves = list; V.movesLoaded = true;
        if (state.page === 'costing-inventory') rerender();
    }, err => { console.error('inventory_moves', err); V.movesLoaded = true; }));
    V.unsubs.push(onSnapshot(query(collection(db, 'requests'), where('status', '==', 'COMPLETED')), snap => {
        const now = new Map();
        snap.forEach(d => { const r = d.data(); if (r.status === 'COMPLETED') now.set(d.id, { id: d.id, ...r }); });
        const first = V.completedSeen === null;
        const newly = first ? [] : [...now.keys()].filter(id => !V.completedSeen.has(id));
        V.completed = now; V.completedSeen = new Set(now.keys());
        if (!first && newly.length) newly.forEach(id => autoTakeForRequest(now.get(id)).catch(e => console.error('auto stock-out', e)));
        if (state.page === 'costing-home' || state.page === 'costing-inventory') rerender();
    }, err => console.error('completed requests', err)));
}
function unsubscribe() { V.unsubs.forEach(u => { try { u(); } catch (e) { } }); V.unsubs = []; V.subscribed = false; V.moves = []; state.moves = []; V.movesLoaded = false; V.completed = new Map(); V.completedSeen = null; }

// One movement: writes the move and bumps the item's on-hand in the same batch. moves: [{item, delta, type, note, refType, refId, groupId, setTo}]
async function recordMoves(moves, extra = {}) {
    const batch = writeBatch(db);
    const at = serverTimestamp(); const by = state.user?.email || null; const ids = [];
    for (const m of moves) {
        const s = I.stockOf(m.item);
        const before = s.onHand; const after = m.setTo != null ? m.setTo : before + m.delta; const delta = after - before;
        const id = m.id || `${m.type}-${todayISO()}-${uid(6)}`; ids.push(id);
        batch.set(doc(db, 'inventory_moves', id), { itemId: m.item.id, itemName: m.item.name || '', baseUnit: m.item.baseUnit || 'each', delta: U.round2(delta), before: U.round2(before), after: U.round2(after), type: m.type, note: m.note || '', refType: m.refType || null, refId: m.refId || null, groupId: m.groupId || null, at, by, date: todayISO() });
        const patch = { 'stock.onHand': m.setTo != null ? U.round2(after) : increment(U.round2(delta)), 'stock.updatedAt': at, 'stock.track': true };
        if (m.type === 'count') patch['stock.countedAt'] = todayISO();
        batch.update(doc(db, 'ingredients', m.item.id), patch);
    }
    Object.entries(extra).forEach(([path, data]) => { const [col, id] = path.split('/'); batch.set(doc(db, col, id), data, { merge: true }); });
    await batch.commit();
    return ids;
}

// ------------------------------------------------------------------ stock in (trips and receipts)
registerExtension('afterPrices', (entries) => {
    if (!inventoryOn()) return;
    const moves = [];
    for (const e of entries) {
        const item = state.ingredients.get(e.ingredientId); if (!item || !I.stockOf(item).track) continue;
        const src = (item.sources || []).find(s => s.id === e.sourceId); if (!src) continue;
        const qty = I.stockInFromPrice(item, src, e.qty); if (!qty) continue;
        moves.push({ item, delta: qty, type: e.method === 'receipt' ? 'in-receipt' : 'in-trip', note: `${U.fmtQty(e.qty)} x ${U.fmtQty(src.packageQty)} ${U.UNIT_LABELS[src.packageUnit] || src.packageUnit}${e.note ? ' · ' + e.note : ''}`, refType: 'price', refId: `${e.ingredientId}|${e.sourceId}|${e.date || todayISO()}` });
    }
    if (!moves.length) return;
    recordMoves(moves).then(() => toast(`Stock in: ${moves.length} item${moves.length === 1 ? '' : 's'}`)).catch(err => { console.error(err); toast('Prices saved, but stock could not be updated: ' + err.message, 'err'); });
});

// ------------------------------------------------------------------ stock out (completed orders, Made this)
function estimatesForRequest(requestId) { return [...state.estimates.values()].filter(e => e.requestId === requestId); }
function tsMs(v) { const d = U.toDate(v); return d ? d.getTime() : 0; }
function eligibleCompleted() {
    // completed after inventory was switched on, with at least one estimate not yet taken from stock
    const started = tsMs(invSettings().startedAt); if (!started) return [];
    const out = [];
    V.completed.forEach(r => {
        if (tsMs(r.updated_at) < started) return;
        const ests = estimatesForRequest(r.id).filter(e => !e.stockOut);
        if (ests.length) out.push({ request: r, estimates: ests });
    });
    return out.sort((a, b) => tsMs(b.request.updated_at) - tsMs(a.request.updated_at));
}
async function autoTakeForRequest(req) {
    if (!inventoryOn() || tsMs(req.updated_at) < tsMs(invSettings().startedAt)) return;
    for (const e of estimatesForRequest(req.id)) { if (!e.stockOut) await takeFromStock(e, { auto: true, requestId: req.id }); }
}
// Take an estimate's materials off the counts. Returns {taken, skipped, problems}.
export async function takeFromStock(estimate, opts = {}) {
    const fresh = state.estimates.get(estimate.id) || estimate;
    if (fresh.stockOut) return { taken: 0, skipped: 0, problems: ['Already taken from stock'] };
    const x = I.explodeEstimate(fresh, pricingCtx(), pricingSettings());
    const groupId = `out-${fresh.id}`;
    const moves = []; let skipped = 0;
    x.needs.forEach((qty, itemId) => {
        const item = state.ingredients.get(itemId); if (!item) return;
        if (!I.stockOf(item).track) { skipped++; return; }
        moves.push({ item, delta: -qty, type: 'out-order', note: `${fresh.name || 'Estimate'}${opts.requestId ? ' · request ' + opts.requestId : ''}`, refType: 'estimate', refId: fresh.id, groupId });
    });
    const stamp = { at: serverTimestamp(), groupId, items: moves.length, auto: !!opts.auto, problems: x.problems };
    if (moves.length) await recordMoves(moves, { [`estimates/${fresh.id}`]: { stockOut: stamp } });
    else await setDoc(doc(db, 'estimates', fresh.id), { stockOut: stamp }, { merge: true });
    const msg = `${fresh.name || 'Estimate'}: ${moves.length} item${moves.length === 1 ? '' : 's'} taken from stock${skipped ? `, ${skipped} not tracked` : ''}${x.problems.length ? ' (some quantities unknown; see Inventory)' : ''}`;
    toast(msg, x.problems.length ? 'err' : 'ok');
    return { taken: moves.length, skipped, problems: x.problems };
}
async function undoGroup(groupId) {
    const moves = V.moves.filter(m => m.groupId === groupId && !m.undone && m.type !== 'undo');
    if (!moves.length) { toast('Nothing to undo', 'err'); return; }
    const reversals = moves.map(m => { const item = state.ingredients.get(m.itemId); return item ? { item, delta: -m.delta, type: 'undo', note: `Undo: ${m.note || m.type}`, refType: 'move', refId: m.id, groupId: `undo-${groupId}` } : null; }).filter(Boolean);
    const extra = {};
    const estId = moves[0].refType === 'estimate' ? moves[0].refId : null;
    if (estId) extra[`estimates/${estId}`] = { stockOut: null };
    await recordMoves(reversals, extra);
    const batch = writeBatch(db); moves.forEach(m => batch.update(doc(db, 'inventory_moves', m.id), { undone: true })); await batch.commit();
    toast(`Undone: ${reversals.length} movement${reversals.length === 1 ? '' : 's'}`);
}
async function undoMove(moveId) {
    const m = V.moves.find(x => x.id === moveId); if (!m || m.undone) return;
    if (m.groupId && m.type === 'out-order') return undoGroup(m.groupId);
    const item = state.ingredients.get(m.itemId); if (!item) return;
    await recordMoves([{ item, delta: -m.delta, type: 'undo', note: `Undo: ${m.note || m.type}`, refType: 'move', refId: m.id }]);
    await updateDoc(doc(db, 'inventory_moves', m.id), { undone: true });
    toast('Undone');
}

// ------------------------------------------------------------------ INVENTORY page
const TYPE_LABEL = { 'in-trip': 'Shopping trip', 'in-receipt': 'Receipt', 'out-order': 'Order', count: 'Count', adjust: 'Adjustment', undo: 'Undo' };
function fmtWhen(m) { const d = U.toDate(m.at) || U.toDate(m.date); return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''; }
function deltaText(m) { const item = state.ingredients.get(m.itemId); const sign = m.delta > 0 ? '+' : ''; return `${sign}${I.fmtStock(m.delta, item || { baseUnit: m.baseUnit })}`; }
function canUndo(m) { if (m.undone || m.type === 'undo') return false; const d = U.toDate(m.at) || U.toDate(m.date); return d && (Date.now() - d.getTime()) < UNDO_DAYS * 86400000; }

function renderInventory(body) {
    if (!state.ingredients.size) { body.innerHTML = '<div class="c-card c-empty"><h3>Nothing to count yet</h3><p>Load the starter data from Costing Settings first.</p></div>'; return; }
    if (!inventoryOn()) {
        const supplies = [...state.ingredients.values()].filter(i => i.kind === 'supply');
        body.innerHTML = `<div class="c-card c-empty"><h3>Inventory is off</h3>
            <p>Turn it on to keep on-hand counts for your ${supplies.length} supplies (boxes, boards, bags, shred). After that: a shopping trip on Log Prices adds what you bought, an approved receipt does the same, and a request moved to Completed takes its estimate's packaging off the counts. Ingredients by weight can be added later, one at a time.</p>
            <p class="c-small c-muted">Orders completed before you turn this on are ignored. Your first job afterwards is a one-time count.</p>
            <button class="btn-primary btn-sm" data-action="inv-start">Turn on for all supplies</button></div>`;
        return;
    }
    const all = [...state.ingredients.values()].sort(byName);
    let list = all;
    if (V.filter === 'tracked') list = list.filter(i => I.stockOf(i).track);
    if (V.filter === 'low') list = list.filter(i => ['low', 'out', 'uncounted'].includes(I.stockStatus(i).code));
    if (V.kind) list = list.filter(i => (i.kind || 'ingredient') === V.kind);
    if (V.q) { const q = V.q.toLowerCase(); list = list.filter(i => (i.name || '').toLowerCase().includes(q)); }
    const lastMoveOf = id => V.moves.find(m => m.itemId === id);
    const pending = eligibleCompleted();
    const recent = V.moves.slice(0, 15);
    body.innerHTML = `
    ${pending.length ? `<div class="c-card c-warnbox"><strong>${pending.length} completed order${pending.length === 1 ? '' : 's'} not yet taken from stock.</strong> ${pending.map(p => p.estimates.map(e => `<a href="#" data-action="inv-take" data-id="${esc(e.id)}" data-req="${esc(p.request.id)}">${esc(e.name)}</a>`).join(', ')).join('; ')}. Click one to take it now.</div>` : ''}
    <div class="c-toolbar">
        <input type="search" class="c-input" id="inv-search" placeholder="Search items…" value="${esc(V.q)}">
        <select class="c-input" id="inv-filter"><option value="tracked" ${V.filter === 'tracked' ? 'selected' : ''}>Tracked items</option><option value="low" ${V.filter === 'low' ? 'selected' : ''}>Low, out or uncounted</option><option value="all" ${V.filter === 'all' ? 'selected' : ''}>All items</option></select>
        <select class="c-input" id="inv-kind"><option value="">Supplies and ingredients</option><option value="supply" ${V.kind === 'supply' ? 'selected' : ''}>Supplies</option><option value="ingredient" ${V.kind === 'ingredient' ? 'selected' : ''}>Ingredients</option></select>
    </div>
    <div class="c-table-wrap"><table class="c-table">
      <thead><tr><th>Item</th><th>On hand</th><th class="num">Reorder at</th><th>Status</th><th>Last movement</th><th></th></tr></thead>
      <tbody>
      ${list.map(i => { const s = I.stockOf(i); const st = I.stockStatus(i); const lm = lastMoveOf(i.id); return `<tr data-id="${esc(i.id)}">
          <td><strong>${esc(i.name)}</strong>${i.kind === 'supply' ? ' <span class="c-badge c-badge-kind">supply</span>' : ''}<br><span class="c-muted c-small">${esc(i.category || '')}</span></td>
          <td>${s.track ? esc(I.fmtStock(s.onHand, i)) : '<span class="c-muted">—</span>'}</td>
          <td class="num">${s.track ? `<input class="c-input c-inv-reorder" type="number" min="0" step="any" data-id="${esc(i.id)}" value="${s.reorderPoint ?? ''}" placeholder="none" title="Alert when on hand is at or below this (${esc(i.baseUnit || 'each')})">` : ''}</td>
          <td><span class="c-badge ${st.cls}">${esc(st.label)}</span></td>
          <td class="c-small">${lm ? `${esc(fmtWhen(lm))} · ${esc(TYPE_LABEL[lm.type] || lm.type)} ${esc(deltaText(lm))}` : '<span class="c-muted">none</span>'}</td>
          <td class="c-inv-actions">${s.track ? `<button class="btn-secondary btn-sm" data-action="inv-count" data-id="${esc(i.id)}">Count</button> <button class="btn-secondary btn-sm" data-action="inv-adjust" data-id="${esc(i.id)}">Adjust</button> <button class="btn-text" data-action="inv-history" data-id="${esc(i.id)}">History</button> <button class="btn-text c-remove" data-action="inv-track" data-id="${esc(i.id)}" data-on="0">Stop tracking</button>` : `<button class="btn-secondary btn-sm" data-action="inv-track" data-id="${esc(i.id)}" data-on="1">Track</button>`}</td>
        </tr>`; }).join('')}
      ${list.length ? '' : '<tr><td colspan="6" class="c-muted">No items match.</td></tr>'}
      </tbody></table></div>
    <p class="c-muted c-small">On hand is in each item's own unit; packs use the preferred source's package size. Reorder at is in the same unit (each, grams or ml); leave it blank for no alert. Counts move automatically: shopping trips and approved receipts add, completed orders with an estimate subtract.</p>
    <div class="c-card"><div class="c-card-head"><h3>Recent movements</h3><span class="c-muted c-small">${V.movesLoaded ? `${V.moves.length} on record` : 'Loading…'}</span></div>
      ${recent.length ? `<div class="c-table-wrap"><table class="c-table c-table-sm"><thead><tr><th>When</th><th>Item</th><th>What</th><th class="num">Change</th><th class="num">After</th><th></th></tr></thead><tbody>
      ${recent.map(m => `<tr class="${m.undone ? 'c-move-undone' : ''}"><td>${esc(fmtWhen(m))}</td><td>${esc(m.itemName)}</td><td>${esc(TYPE_LABEL[m.type] || m.type)}${m.note ? ` <span class="c-muted c-small">${esc(m.note)}</span>` : ''}</td><td class="num">${esc(deltaText(m))}</td><td class="num">${esc(I.fmtStock(m.after, state.ingredients.get(m.itemId) || { baseUnit: m.baseUnit }))}</td><td>${m.undone ? '<span class="c-badge c-badge-kind">undone</span>' : canUndo(m) ? `<button class="btn-text" data-action="inv-undo" data-id="${esc(m.id)}">Undo</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="c-muted c-small">No movements yet. Start with a count.</p>'}
    </div>`;
    $('#inv-search', body).addEventListener('input', e => { V.q = e.target.value; renderInventory(body); const el = $('#inv-search', body); if (el) { el.focus(); const v = el.value; el.value = ''; el.value = v; } });
    $('#inv-filter', body).addEventListener('change', e => { V.filter = e.target.value; renderInventory(body); });
    $('#inv-kind', body).addEventListener('change', e => { V.kind = e.target.value; renderInventory(body); });
    $$('.c-inv-reorder', body).forEach(inp => inp.addEventListener('change', async e => {
        const id = e.target.dataset.id; const v = U.num(e.target.value);
        try { await updateDoc(doc(db, 'ingredients', id), { 'stock.reorderPoint': v, 'stock.updatedAt': serverTimestamp() }); toast('Reorder point saved'); } catch (err) { console.error(err); toast(err.message, 'err'); }
    }));
}

function packOption(item) {
    const pref = U.preferredSource(item);
    const base = I.packsToBase(1, item);
    if (!pref || !base || (item.baseUnit === 'each' && base === 1)) return null;
    return { label: `packs of ${U.fmtQty(pref.packageQty)} ${U.UNIT_LABELS[pref.packageUnit] || pref.packageUnit}`, base };
}
function openCountModal(id) {
    const item = state.ingredients.get(id); if (!item) return;
    const s = I.stockOf(item); const pk = packOption(item);
    openModal(`<div class="modal-header c-modal-header"><h2>Count: ${esc(item.name)}</h2><button class="close-modal" data-action="close-modal">&times;</button></div>
      <p class="c-small c-muted">On hand now: <strong>${esc(I.fmtStock(s.onHand, item))}</strong>${s.counted ? '' : ' (never counted)'}. Type what you actually have; the difference is recorded as a count correction.</p>
      <div class="c-form-grid">
        <label>Counted amount<input class="c-input" id="inv-amount" type="number" min="0" step="any" value="${s.counted ? s.onHand : ''}" placeholder="0"></label>
        <label>Unit<select class="c-input" id="inv-unit"><option value="base">${esc(item.baseUnit === 'each' ? 'each' : item.baseUnit)}</option>${pk ? `<option value="pack">${esc(pk.label)}</option>` : ''}</select></label>
        <label class="c-span2">Note <span class="c-hint">optional</span><input class="c-input" id="inv-note" placeholder="Counted the shelf"></label>
      </div>
      <div class="c-modal-actions"><span></span><div><button class="btn-secondary btn-sm" data-action="close-modal">Cancel</button> <button class="btn-primary btn-sm" data-action="inv-count-save" data-id="${esc(id)}">Save count</button></div></div>`, { item, pk });
    $('#inv-amount')?.focus();
}
function openAdjustModal(id) {
    const item = state.ingredients.get(id); if (!item) return;
    const s = I.stockOf(item); const pk = packOption(item);
    openModal(`<div class="modal-header c-modal-header"><h2>Adjust: ${esc(item.name)}</h2><button class="close-modal" data-action="close-modal">&times;</button></div>
      <p class="c-small c-muted">On hand now: <strong>${esc(I.fmtStock(s.onHand, item))}</strong>. Use this for things that are not a shopping trip or an order: something spoiled, was used for a test bake, or the count was off.</p>
      <div class="c-form-grid">
        <label>Direction<select class="c-input" id="inv-dir"><option value="-1">Remove</option><option value="1">Add</option></select></label>
        <label>Amount<input class="c-input" id="inv-amount" type="number" min="0" step="any" placeholder="0"></label>
        <label>Unit<select class="c-input" id="inv-unit"><option value="base">${esc(item.baseUnit === 'each' ? 'each' : item.baseUnit)}</option>${pk ? `<option value="pack">${esc(pk.label)}</option>` : ''}</select></label>
        <label>Reason<select class="c-input" id="inv-reason">${REASONS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
        <label class="c-span2">Note <span class="c-hint">optional</span><input class="c-input" id="inv-note"></label>
      </div>
      <div class="c-modal-actions"><span></span><div><button class="btn-secondary btn-sm" data-action="close-modal">Cancel</button> <button class="btn-primary btn-sm" data-action="inv-adjust-save" data-id="${esc(id)}">Save adjustment</button></div></div>`, { item, pk });
    $('#inv-amount')?.focus();
}
function readAmount() {
    const ctx = getModalCtx(); const amt = U.num($('#inv-amount')?.value);
    if (amt == null || amt < 0) return null;
    return $('#inv-unit')?.value === 'pack' && ctx.pk ? amt * ctx.pk.base : amt;
}
function openHistoryModal(id) {
    const item = state.ingredients.get(id); if (!item) return;
    const list = V.moves.filter(m => m.itemId === id);
    openModal(`<div class="modal-header c-modal-header"><h2>${esc(item.name)}: movements</h2><button class="close-modal" data-action="close-modal">&times;</button></div>
      <p class="c-small c-muted">On hand: <strong>${esc(I.fmtStock(I.stockOf(item).onHand, item))}</strong>. Showing the last ${list.length} of the most recent 250 movements overall.</p>
      ${list.length ? `<div class="c-table-wrap"><table class="c-table c-table-sm"><thead><tr><th>When</th><th>What</th><th class="num">Change</th><th class="num">After</th><th></th></tr></thead><tbody>
      ${list.map(m => `<tr class="${m.undone ? 'c-move-undone' : ''}"><td>${esc(fmtWhen(m))}</td><td>${esc(TYPE_LABEL[m.type] || m.type)}${m.note ? ` <span class="c-muted c-small">${esc(m.note)}</span>` : ''}</td><td class="num">${esc(deltaText(m))}</td><td class="num">${esc(I.fmtStock(m.after, item))}</td><td>${m.undone ? '<span class="c-badge c-badge-kind">undone</span>' : canUndo(m) ? `<button class="btn-text" data-action="inv-undo" data-id="${esc(m.id)}">Undo</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="c-muted">No movements yet.</p>'}
      <div class="c-modal-actions"><span></span><button class="btn-secondary btn-sm" data-action="close-modal">Close</button></div>`, { item });
}

// ------------------------------------------------------------------ Home card, Analytics count, Estimates buttons
export function lowStockItems() { return inventoryOn() ? trackedItems().filter(i => ['low', 'out'].includes(I.stockStatus(i).code)) : []; }
function homeHtml() {
    if (!inventoryOn()) return '';
    const low = lowStockItems(); const uncounted = trackedItems().filter(i => I.stockStatus(i).code === 'uncounted').length;
    const pending = eligibleCompleted();
    if (!low.length && !pending.length && !uncounted) return '';
    return `<div class="c-card" id="c-home-stock"><div class="c-card-head"><h3>Stock</h3><span class="c-muted c-small">${low.length} low or out${uncounted ? `, ${uncounted} never counted` : ''}</span></div>
        ${low.length ? `<div class="c-list">${low.map(i => `<div class="c-list-row" data-action="go" data-page="costing-inventory"><div><strong>${esc(i.name)}</strong><br><span class="c-muted c-small">${esc(I.fmtStock(I.stockOf(i).onHand, i))}${I.stockOf(i).reorderPoint != null ? ` · reorder at ${esc(I.fmtStock(I.stockOf(i).reorderPoint, i))}` : ''}</span></div><span class="c-badge ${I.stockStatus(i).cls}">${esc(I.stockStatus(i).label)}</span></div>`).join('')}</div>` : ''}
        ${pending.length ? `<p class="c-small" style="margin-top:.6rem"><strong>${pending.length} completed order${pending.length === 1 ? '' : 's'} not yet taken from stock:</strong> ${pending.map(p => p.estimates.map(e => `<a href="#" data-action="inv-take" data-id="${esc(e.id)}" data-req="${esc(p.request.id)}">${esc(e.name)}</a>`).join(', ')).join('; ')}</p>` : ''}
        ${uncounted ? `<p class="c-small c-muted" style="margin-top:.6rem">${uncounted} tracked item${uncounted === 1 ? ' has' : 's have'} never been counted. <a href="#" data-action="go" data-page="costing-inventory">Open Inventory</a></p>` : ''}
    </div>`;
}
function decorateEstimates() {
    const body = $('#page-costing-estimates .costing-body'); if (!body || !inventoryOn()) return;
    $$('[data-action="est-open"]', body).forEach(btn => {
        if (btn.parentElement.querySelector('[data-action="inv-take"],[data-action="inv-undo-group"]')) return;
        const e = state.estimates.get(btn.dataset.id); if (!e) return;
        const b = document.createElement('button');
        if (e.stockOut) { b.className = 'btn-text'; b.dataset.action = 'inv-undo-group'; b.dataset.group = e.stockOut.groupId || `out-${e.id}`; b.textContent = 'Taken from stock (undo)'; b.title = e.stockOut.at ? 'Taken ' + fmtDate(e.stockOut.at) : ''; }
        else { b.className = 'btn-secondary btn-sm'; b.dataset.action = 'inv-take'; b.dataset.id = e.id; b.textContent = 'Made this'; b.title = 'Take its packaging and tracked ingredients off the counts'; }
        btn.parentElement.appendChild(document.createTextNode(' ')); btn.parentElement.appendChild(b);
    });
}

// ------------------------------------------------------------------ registration
registerPage('costing-inventory', renderInventory);
registerExtension('home', () => homeHtml());
registerExtension('rendered', name => { if (name === 'costing-estimates') decorateEstimates(); });
registerExtension('dataChanged', () => {
    if (state.user && !V.subscribed) subscribe();
    if (!state.user && V.subscribed) unsubscribe();
});
registerAction('inv-start', async el => {
    const supplies = [...state.ingredients.values()].filter(i => i.kind === 'supply');
    if (!confirm(`Turn on inventory for ${supplies.length} supplies? You can stop tracking any item later, and add ingredients one by one.`)) return;
    el.disabled = true;
    const batch = writeBatch(db);
    supplies.forEach(i => batch.update(doc(db, 'ingredients', i.id), { 'stock.track': true, 'stock.onHand': U.num(i.stock?.onHand) ?? 0, 'stock.updatedAt': serverTimestamp() }));
    await batch.commit();
    await saveSettings({ inventory: { ...invSettings(), startedAt: serverTimestamp() } });
    toast('Inventory is on. Count each item once to start.');
});
registerAction('inv-track', async el => {
    const item = state.ingredients.get(el.dataset.id); if (!item) return;
    const on = el.dataset.on === '1';
    if (!on && !confirm(`Stop tracking ${item.name}? Its count and history stay on file.`)) return;
    await updateDoc(doc(db, 'ingredients', item.id), { 'stock.track': on, 'stock.onHand': U.num(item.stock?.onHand) ?? 0, 'stock.updatedAt': serverTimestamp() });
    toast(on ? `Tracking ${item.name}; count it once` : `Stopped tracking ${item.name}`);
});
registerAction('inv-count', el => openCountModal(el.dataset.id));
registerAction('inv-adjust', el => openAdjustModal(el.dataset.id));
registerAction('inv-history', el => openHistoryModal(el.dataset.id));
registerAction('inv-count-save', async el => {
    const { item } = getModalCtx(); const amt = readAmount();
    if (amt == null) { toast('Enter the counted amount', 'err'); return; }
    const note = $('#inv-note')?.value.trim();
    await recordMoves([{ item, setTo: amt, delta: 0, type: 'count', note: note || 'Counted' }]);
    closeModal(); toast(`${item.name}: ${I.fmtStock(amt, item)} on hand`);
});
registerAction('inv-adjust-save', async el => {
    const { item } = getModalCtx(); const amt = readAmount();
    if (amt == null || amt === 0) { toast('Enter an amount', 'err'); return; }
    const dir = Number($('#inv-dir').value) || -1;
    const reason = $('#inv-reason').value; const note = $('#inv-note')?.value.trim();
    await recordMoves([{ item, delta: dir * amt, type: 'adjust', note: [REASONS.find(r => r[0] === reason)?.[1] || reason, note].filter(Boolean).join(': ') }]);
    closeModal(); toast(`${item.name} adjusted`);
});
registerAction('inv-take', async (el, e) => {
    e.preventDefault();
    const est = state.estimates.get(el.dataset.id); if (!est) return;
    if (est.stockOut) { toast('Already taken from stock', 'err'); return; }
    if (el.disabled) return; el.disabled = true; // a double click must not take the order twice
    try { await takeFromStock(est, { requestId: el.dataset.req || est.requestId || null }); } finally { if (el.isConnected) el.disabled = false; }
});
registerAction('inv-undo', el => undoMove(el.dataset.id));
registerAction('inv-undo-group', async el => { if (!confirm('Put this order\'s materials back on the counts?')) return; await undoGroup(el.dataset.group); });
