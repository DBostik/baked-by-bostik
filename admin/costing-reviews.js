// costing-reviews.js
// Phase 4: Price Reviews inbox (proposals from the monthly price bot and receipt scans: approve, edit, dismiss),
// receipt upload into the scan queue, the "proposals waiting" count on Costing Home and the Analytics tile, and the
// "Price bot and receipts" card on Costing Settings (last runs, fallback instructions).
// Registers page `costing-reviews`. Proposals are written by scripts/pricebot/pricebot.mjs (run by the scheduled
// tasks); this file never creates a proposal. Approve goes through recordPrices() like every other price entry.
import {
    state, $, $$, esc, toast, registerPage, registerAction, registerExtension, byName, fmtDate, todayISO, uid,
    rerender, db, recordPrices, showCostingPage
} from './costing.js';
import { collection, doc, setDoc, updateDoc, deleteDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import * as U from './costing-units.js';

const V = { unsubs: [], loaded: false, filter: 'pending', urls: new Map(), uploading: false, draft: {} };
state.proposals = new Map();
state.receipts = new Map();
state.botRuns = [];

// ------------------------------------------------------------------ data
function subscribe() {
    if (V.subscribed) return;
    V.subscribed = true; // set before the first onSnapshot: its callback can fire synchronously and rerender
    V.unsubs.push(onSnapshot(query(collection(db, 'price_proposals'), orderBy('createdAt', 'desc'), limit(400)), snap => {
        state.proposals = new Map();
        snap.forEach(d => state.proposals.set(d.id, { id: d.id, ...d.data() }));
        V.loaded = true;
        rerender();
    }, err => { console.error('price_proposals', err); V.loaded = true; }));
    V.unsubs.push(onSnapshot(query(collection(db, 'receipt_queue'), orderBy('uploadedAt', 'desc'), limit(100)), snap => {
        state.receipts = new Map();
        snap.forEach(d => state.receipts.set(d.id, { id: d.id, ...d.data() }));
        if (state.page === 'costing-reviews') rerender();
    }, err => console.error('receipt_queue', err)));
    V.unsubs.push(onSnapshot(query(collection(db, 'bot_runs'), orderBy('startedAt', 'desc'), limit(8)), snap => {
        const list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        state.botRuns = list;
        if (state.page === 'costing-settings') rerender();
    }, err => console.error('bot_runs', err)));
}
function unsubscribe() { V.unsubs.forEach(u => { try { u(); } catch (e) { } }); V.unsubs = []; V.subscribed = false; state.proposals = new Map(); state.receipts = new Map(); state.botRuns = []; V.loaded = false; }
export function pendingProposals() { return [...state.proposals.values()].filter(p => p.status === 'pending'); }

function sourceOf(p) { const ing = state.ingredients.get(p.ingredientId); const src = ing ? (ing.sources || []).find(s => s.id === p.sourceId) : null; return { ing, src }; }
function sourceLabel(s) { return [s?.brand, s?.store, (U.num(s?.packageQty) != null && s?.packageUnit) ? `${U.fmtQty(s.packageQty)} ${U.UNIT_LABELS[s.packageUnit] || s.packageUnit}` : ''].filter(Boolean).join(' · '); }
function pctBadge(pct) {
    if (pct == null) return '';
    const cls = pct > 0 ? 'c-badge-up' : pct < 0 ? 'c-badge-down' : 'c-badge-flat';
    return `<span class="c-badge ${cls}">${pct > 0 ? '+' : ''}${pct}%</span>`;
}
async function fileUrl(path) {
    if (!path) return '';
    if (V.urls.has(path)) return V.urls.get(path);
    try { const u = await getDownloadURL(ref(getStorage(), path)); V.urls.set(path, u); return u; } catch (e) { console.error(e); V.urls.set(path, ''); return ''; }
}

// ------------------------------------------------------------------ REVIEWS page
function renderReviews(body) {
    const all = [...state.proposals.values()];
    const counts = { pending: 0, approved: 0, dismissed: 0 };
    all.forEach(p => { if (counts[p.status] != null) counts[p.status]++; });
    const list = (V.filter === 'all' ? all : all.filter(p => p.status === V.filter)).sort((a, b) => (b.foundAt || '').localeCompare(a.foundAt || '') || String(a.ingredientName || '').localeCompare(String(b.ingredientName || '')));
    const stores = state.settings.stores || [];
    const d = V.draft;
    body.innerHTML = `
    <div class="c-card">
      <div class="c-card-head"><h3>Proposals</h3><span class="c-muted c-small">${counts.pending} waiting · ${counts.approved} approved · ${counts.dismissed} dismissed</span></div>
      <p class="c-small c-muted">Prices found by the monthly price bot and by receipt scans. Nothing changes until you approve it. Fix the number first if the bot got it wrong; Approve records it as a dated price entry on that source.</p>
      <div class="c-toolbar">
        <select class="c-input" id="rv-filter">${[['pending', 'Waiting'], ['approved', 'Approved'], ['dismissed', 'Dismissed'], ['all', 'All']].map(([v, l]) => `<option value="${v}" ${V.filter === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${counts.pending > 1 && V.filter === 'pending' ? '<button class="btn-secondary btn-sm" data-action="rv-dismiss-all">Dismiss all waiting</button>' : ''}
      </div>
      ${!V.loaded ? '<p class="c-muted">Loading…</p>' : list.length ? list.map(proposalRow).join('') : `<p class="c-muted">${V.filter === 'pending' ? 'Nothing waiting. The price bot runs on the 1st of each month; receipts are scanned every morning.' : 'Nothing here.'}</p>`}
    </div>
    <div class="c-two-col">
      <div class="c-card" id="rv-upload">
        <h3>Upload a receipt</h3>
        <p class="c-small c-muted">A photo or PDF of a store receipt. It is scanned the next morning; matched lines show up above as proposals with the receipt beside them. Bad photo? Retake it flat and well lit; the whole line (item and price) needs to be readable.</p>
        <div class="c-form-grid">
          <label>Receipt file<input class="c-input" id="rv-file" type="file" accept="image/*,application/pdf"></label>
          <label>Store<select class="c-input" id="rv-store"><option value="">Not sure</option>${stores.map(s => `<option value="${esc(s)}" ${d.store === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
          <label>Receipt date<input class="c-input" id="rv-date" type="date" value="${esc(d.date || todayISO())}"></label>
          <label>Note <span class="c-hint">optional</span><input class="c-input" id="rv-note" value="${esc(d.note || '')}" placeholder="Weekly Costco run"></label>
        </div>
        <button class="btn-primary btn-sm" data-action="rv-upload" ${V.uploading ? 'disabled' : ''}>${V.uploading ? 'Uploading…' : 'Upload receipt'}</button>
      </div>
      <div class="c-card">
        <div class="c-card-head"><h3>Receipt queue</h3><span class="c-muted c-small">${[...state.receipts.values()].filter(r => r.status === 'pending').length} waiting</span></div>
        <div id="rv-receipts">${[...state.receipts.values()].length ? [...state.receipts.values()].map(receiptRow).join('') : '<p class="c-muted c-small">No receipts uploaded yet.</p>'}</div>
      </div>
    </div>`;
    $('#rv-filter', body).addEventListener('change', e => { V.filter = e.target.value; renderReviews(body); });
    $('#rv-store', body).addEventListener('change', e => { d.store = e.target.value; });
    $('#rv-date', body).addEventListener('change', e => { d.date = e.target.value; });
    $('#rv-note', body).addEventListener('input', e => { d.note = e.target.value; });
    fillThumbnails(body);
}
function proposalRow(p) {
    const { ing, src } = sourceOf(p);
    const name = ing ? ing.name : (p.ingredientName || p.ingredientId);
    const onFile = src && U.num(src.currentPrice) != null ? src.currentPrice : (U.num(p.currentPrice) != null ? p.currentPrice : null);
    const onFileDate = src?.currentPriceDate || p.currentPriceDate || null;
    const pct = (onFile > 0 && U.num(p.price) != null) ? Math.round((p.price - onFile) / onFile * 1000) / 10 : null;
    const pkgSeen = (U.num(p.packageQty) != null && p.packageUnit) ? `${U.fmtQty(p.packageQty)} ${U.UNIT_LABELS[p.packageUnit] || p.packageUnit}` : '';
    const pkgOnFile = src ? `${U.fmtQty(src.packageQty)} ${U.UNIT_LABELS[src.packageUnit] || src.packageUnit || ''}`.trim() : '';
    const pkgMismatch = pkgSeen && pkgOnFile && pkgSeen !== pkgOnFile;
    const rawLink = p.foundUrl || src?.productUrl || '';
    const link = /^https?:\/\//i.test(rawLink) ? rawLink : ''; // only web links; never javascript: or data:
    const pending = p.status === 'pending';
    return `<div class="c-proposal ${pending ? '' : 'c-proposal-done'}" data-id="${esc(p.id)}">
      <div class="c-proposal-main">
        <div><a href="#" data-action="open-ingredient" data-id="${esc(p.ingredientId)}"><strong>${esc(name)}</strong></a> <span class="c-badge c-badge-kind">${esc(p.method || 'bot')}</span>${!src ? ' <span class="c-badge c-badge-warn">source missing</span>' : ''}</div>
        <div class="c-muted c-small">${esc(src ? sourceLabel(src) : (p.sourceLabel || p.sourceId))}${p.foundAt ? ` · found ${esc(fmtDate(p.foundAt))}` : ''}${link ? ` · <a href="${esc(link)}" target="_blank" rel="noopener">source page</a>` : ''}${p.receiptId ? ` · <a href="#" data-action="rv-view-receipt" data-id="${esc(p.receiptId)}" data-path="${esc(p.receiptPath || '')}">receipt</a>` : ''}</div>
        ${p.lineText ? `<div class="c-small">Receipt line: <span class="c-mono">${esc(p.lineText)}</span>${U.num(p.qty) != null && p.qty !== 1 ? ` · ${esc(U.fmtQty(p.qty))} bought` : ''}</div>` : ''}
        ${p.note ? `<div class="c-small c-muted">${esc(p.note)}${p.confidence ? ` (${esc(p.confidence)} confidence)` : ''}</div>` : ''}
        ${pkgMismatch ? `<div class="c-small c-warntext">Bot saw a ${esc(pkgSeen)} package; the source on file is ${esc(pkgOnFile)}. Approve only if that is the same package, or fix the source first.</div>` : ''}
      </div>
      <div class="c-proposal-nums">
        <div><span class="c-label">On file</span>${onFile != null ? U.fmtMoney(onFile) : '—'}<br><span class="c-muted c-small">${onFileDate ? esc(fmtDate(onFileDate)) : ''}</span></div>
        <div><span class="c-label">Found</span>${U.fmtMoney(p.price)} ${pctBadge(pct)}</div>
      </div>
      <div class="c-proposal-actions">
        ${pending ? `<input class="c-input c-price-in" type="number" step="0.01" min="0" inputmode="decimal" data-f="price" value="${esc(p.price)}"><button class="btn-primary btn-sm" data-action="rv-approve" data-id="${esc(p.id)}" ${src ? '' : 'disabled title="The source no longer exists"'}>Approve</button><button class="btn-secondary btn-sm" data-action="rv-dismiss" data-id="${esc(p.id)}">Dismiss</button>`
            : `<span class="c-badge ${p.status === 'approved' ? 'c-badge-ok' : 'c-badge-stale'}">${esc(p.status)}${p.status === 'approved' && U.num(p.approvedPrice) != null && p.approvedPrice !== p.price ? ' at ' + U.fmtMoney(p.approvedPrice) : ''}</span>`}
      </div>
    </div>`;
}
function receiptRow(r) {
    const st = { pending: ['c-badge-stale', 'waiting for scan'], done: ['c-badge-ok', `${r.proposalsCount ?? 0} proposal${r.proposalsCount === 1 ? '' : 's'}`], nothing: ['c-badge-warn', 'nothing matched'], failed: ['c-badge-warn', 'could not read'] }[r.status] || ['c-badge-kind', r.status || ''];
    const isPdf = /pdf/i.test(r.contentType || '') || /\.pdf$/i.test(r.path || '');
    return `<div class="c-receipt" data-path="${esc(r.path || '')}">
      <div class="c-receipt-thumb" data-thumb="${esc(r.path || '')}">${isPdf ? '<span class="c-muted c-small">PDF</span>' : ''}</div>
      <div class="c-receipt-text">
        <div><strong>${esc(r.store || 'Store not set')}</strong> · ${esc(fmtDate(r.date))} <span class="c-badge ${st[0]}">${esc(st[1])}</span></div>
        <div class="c-muted c-small">${esc(r.note || '')}${r.unmatched?.length ? ` · not matched: ${esc(r.unmatched.slice(0, 4).join('; '))}${r.unmatched.length > 4 ? '…' : ''}` : ''}${r.botNote ? ` · ${esc(r.botNote)}` : ''}</div>
        <div class="c-small"><a href="#" data-action="rv-view-receipt" data-id="${esc(r.id)}" data-path="${esc(r.path || '')}">open</a>${r.status === 'pending' ? ` · <a href="#" data-action="rv-remove-receipt" data-id="${esc(r.id)}" data-path="${esc(r.path || '')}">remove</a>` : ''}</div>
      </div>
    </div>`;
}
async function fillThumbnails(body) {
    for (const el of $$('[data-thumb]', body)) {
        const path = el.dataset.thumb; if (!path || /\.pdf$/i.test(path)) continue;
        const url = await fileUrl(path);
        if (url && el.isConnected) el.innerHTML = `<img src="${esc(url)}" alt="receipt">`;
    }
}

// ------------------------------------------------------------------ actions
async function approve(id, el) {
    const p = state.proposals.get(id); if (!p) return;
    const { ing, src } = sourceOf(p);
    if (!ing || !src) { toast('That source no longer exists; fix the item first', 'err'); return; }
    const row = el.closest('.c-proposal');
    const price = U.num($('[data-f="price"]', row)?.value);
    if (price == null || price < 0) { toast('Enter the price first', 'err'); return; }
    const date = p.foundAt || todayISO();
    const note = p.method === 'receipt' ? `Receipt${p.receiptId ? ' ' + p.receiptId : ''}${p.lineText ? ': ' + p.lineText : ''}` : `Price bot${p.foundUrl ? ': ' + p.foundUrl : ''}`;
    await recordPrices([{ ingredientId: ing.id, sourceId: src.id, price, date, method: p.method === 'receipt' ? 'receipt' : 'bot', note, qty: p.method === 'receipt' ? (U.num(p.qty) ?? 1) : null }]);
    await updateDoc(doc(db, 'price_proposals', id), { status: 'approved', approvedPrice: price, reviewedAt: serverTimestamp(), reviewedBy: state.user?.email || null });
    const newer = src.currentPriceDate && U.toDate(src.currentPriceDate) > U.toDate(date);
    toast(newer ? `Recorded ${U.fmtMoney(price)} for ${ing.name} in history (a newer price is already on file)` : `${ing.name}: ${U.fmtMoney(price)} approved`);
}
async function dismiss(id) {
    await updateDoc(doc(db, 'price_proposals', id), { status: 'dismissed', reviewedAt: serverTimestamp(), reviewedBy: state.user?.email || null });
}
async function uploadReceipt(el) {
    const input = $('#rv-file'); const file = input?.files?.[0];
    if (!file) { toast('Choose a photo or PDF first', 'err'); return; }
    if (file.size > 15 * 1024 * 1024) { toast('That file is over 15 MB; take a smaller photo', 'err'); return; }
    const date = $('#rv-date').value || todayISO();
    const store = $('#rv-store').value; const note = $('#rv-note').value.trim();
    const ext = /pdf/i.test(file.type) ? 'pdf' : (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const id = `${date}-${uid(6)}`;
    const path = `receipts/${id}.${ext}`;
    V.uploading = true; el.disabled = true; el.textContent = 'Uploading…';
    try {
        await uploadBytes(ref(getStorage(), path), file, { contentType: file.type || 'application/octet-stream' });
        await setDoc(doc(db, 'receipt_queue', id), { path, contentType: file.type || '', originalName: file.name || '', size: file.size, store, note, date, status: 'pending', uploadedAt: serverTimestamp(), uploadedBy: state.user?.email || null });
        V.draft = {}; toast('Receipt uploaded; it is scanned the next morning');
    } finally { V.uploading = false; }
    rerender();
}
async function removeReceipt(id, path) {
    if (!confirm('Remove this receipt from the queue?')) return;
    await deleteDoc(doc(db, 'receipt_queue', id));
    if (path) { try { await deleteObject(ref(getStorage(), path)); } catch (e) { console.error(e); } }
    toast('Removed');
}

// ------------------------------------------------------------------ Home card and Settings card
function homeHtml() {
    const n = pendingProposals().length;
    if (!n) return '';
    return `<div class="c-card c-reviews-home"><div class="c-card-head"><h3>Price reviews</h3><span class="c-muted c-small">${n} waiting</span></div>
        <p class="c-small">${n} proposed price${n === 1 ? '' : 's'} from the price bot or a receipt scan ${n === 1 ? 'is' : 'are'} waiting for your approval.</p>
        <button class="btn-primary btn-sm" data-action="go" data-page="costing-reviews">Open Price Reviews</button></div>`;
}
function settingsHtml() {
    const runs = state.botRuns || [];
    const fmtTs = ts => { const d = U.toDate(ts); return d ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''; };
    return `<div class="c-card" id="c-settings-bot">
        <h3>Price bot and receipts</h3>
        <p class="c-small">Two scheduled tasks on Dave's Claude account do the looking up, using the limited "pricebot" login: <strong>BBB monthly price check</strong> runs on the 1st of each month at 7 am and proposes a price for every source that has a product link or a named store and brand; <strong>BBB receipt scanner</strong> runs every morning at 7 am and reads any receipt waiting in the queue. Both need the Mac mini to be on. Proposals land in Price Reviews; nothing changes until you approve it.</p>
        <p class="c-small"><strong>If a receipt cannot wait, or the upload misbehaves:</strong> share the photo with Claude in the Claude app and say "Log this receipt for Baked By Bostik". It ends up in the same inbox.</p>
        <p class="c-small"><strong>What the bot searches:</strong> the product link on each source first; without a link it searches the web for the brand, item and package size at that store. Costco warehouse prices are often not published, Walmart prices vary by store and Amazon changes hourly, so expect "not found" on some staples and good catches on the big movers (butter, eggs, chocolate, sugar). Add product links on the item page to help it.</p>
        <div class="c-section-head"><h3>Last runs</h3></div>
        ${runs.length ? `<div class="c-table-wrap"><table class="c-table c-table-sm"><thead><tr><th>When</th><th>Task</th><th>Result</th></tr></thead><tbody>${runs.map(r => `<tr><td>${esc(fmtTs(r.startedAt))}</td><td>${esc(r.kind || '')}</td><td>${esc(r.summary || r.status || '')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="c-muted c-small">No runs yet.</p>'}
    </div>`;
}

// ------------------------------------------------------------------ registration
registerPage('costing-reviews', renderReviews);
registerExtension('home', () => homeHtml());
registerExtension('settings', () => settingsHtml());
registerExtension('dataChanged', () => {
    if (state.user && !V.subscribed) subscribe();
    if (!state.user && V.subscribed) unsubscribe();
});
registerAction('rv-approve', async (el) => { el.disabled = true; try { await approve(el.dataset.id, el); } finally { if (el.isConnected) el.disabled = false; } });
registerAction('rv-dismiss', (el) => dismiss(el.dataset.id));
registerAction('rv-dismiss-all', async () => {
    const list = pendingProposals();
    if (!list.length || !confirm(`Dismiss all ${list.length} waiting proposals?`)) return;
    for (const p of list) await dismiss(p.id);
    toast(`Dismissed ${list.length}`);
});
registerAction('rv-upload', (el) => uploadReceipt(el));
registerAction('rv-remove-receipt', (el, e) => { e.preventDefault(); return removeReceipt(el.dataset.id, el.dataset.path); });
registerAction('rv-view-receipt', async (el, e) => {
    e.preventDefault();
    const url = await fileUrl(el.dataset.path);
    if (url) window.open(url, '_blank', 'noopener'); else toast('Could not open that receipt', 'err');
});
