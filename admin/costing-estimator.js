// costing-estimator.js
// Phase 2: the Estimator (build an order, see cost, suggested price and margin) and saved Estimates.
import { state, $, $$, esc, toast, registerPage, registerAction, byName, uid, fmtDate, todayISO, pricingCtx, pricingSettings, showCostingPage, rerender, db } from './costing.js';
import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import * as U from './costing-units.js';
import * as P from './costing-pricing.js';

const draft = { id: null, name: '', requestId: '', customerLabel: '', notes: '', items: [] };
let requestsCache = null; // [{id, label, customer_id}]

function activeProducts() { return [...state.products.values()].filter(p => p.active !== false).sort(byName); }
function recipesOf(...cats) { return [...state.recipes.values()].filter(r => cats.includes(r.category)).sort(byName); }
function opts(list, selected, labelFn = x => x.name, valueFn = x => x.id, none = null) {
    return (none != null ? `<option value="">${esc(none)}</option>` : '') + list.map(x => `<option value="${esc(valueFn(x))}" ${valueFn(x) === selected ? 'selected' : ''}>${esc(labelFn(x))}</option>`).join('');
}
function newItemFor(product) {
    if (!product) return null;
    if (product.family === 'cake') return { productId: product.id, qty: 1, tiers: [{ sizeId: product.refSizeId || (product.sizes?.[0]?.id), flavorRecipeId: product.defaultFlavorRecipeId || '', fillingRecipeId: product.defaultFillingRecipeId || '', outerRecipeId: product.defaultOuterRecipeId || '', extraLayers: 0 }], drip: false, fondantFigures: 0, topper: null, decor: [], custom: [] };
    if (product.family === 'cupcake') return { productId: product.id, qty: Math.max(1, U.num(product.minimumQty) || 1), tierId: product.tiers?.[0]?.id, flavorRecipeId: product.defaultFlavorRecipeId || '', frostingRecipeId: product.defaultFrostingRecipeId || '', decor: [], custom: [] };
    return { productId: product.id, qty: Math.max(1, U.num(product.minimumQty) || 1), tierId: product.tiers?.[0]?.id, characters: 0, decor: [], custom: [] };
}

async function loadRequests() {
    if (requestsCache) return requestsCache;
    try {
        const snap = await getDocs(query(collection(db, 'requests'), orderBy('created_at', 'desc'), limit(150)));
        requestsCache = snap.docs.map(d => { const r = d.data(); const s1 = r.step1_data || {}; return { id: d.id, customer_id: r.customer_id || '', label: `${d.id} · ${s1.name || r.customer_id || 'customer'} · ${s1.event_date || 'no date'} · ${s1.category || ''}`.trim(), status: r.status || '' }; });
    } catch (e) { console.error(e); requestsCache = []; }
    return requestsCache;
}

// ------------------------------------------------------------------ estimator page
function renderEstimator(body) {
    const products = activeProducts();
    if (!products.length) { body.innerHTML = '<div class="c-card c-empty"><h3>No products yet</h3><p>Load the Phase 2 starter data from Costing Settings, or add a product in Products &amp; Sizes.</p></div>'; return; }
    const ctx = pricingCtx(); const ps = pricingSettings();
    const est = P.priceEstimate(draft, ctx, ps);
    const reqOpts = (requestsCache || []).map(r => `<option value="${esc(r.id)}" ${r.id === draft.requestId ? 'selected' : ''}>${esc(r.label)}</option>`).join('');
    body.innerHTML = `
    <div class="c-est-layout">
      <div class="c-est-main">
        <div class="c-card">
          <div class="c-form-grid c-form-grid-4">
            <label class="c-span2">Estimate name<input class="c-input" data-e="name" value="${esc(draft.name)}" placeholder="Emma's 8-inch unicorn cake"></label>
            <label class="c-span2">Link to request<select class="c-input" data-e="requestId"><option value="">none</option>${reqOpts}</select>${requestsCache ? '' : '<span class="c-hint">loading requests…</span>'}</label>
            <label class="c-span2">Customer<input class="c-input" data-e="customerLabel" value="${esc(draft.customerLabel)}" placeholder="name or email"></label>
            <label class="c-span2">Notes<input class="c-input" data-e="notes" value="${esc(draft.notes)}"></label>
          </div>
        </div>
        ${draft.items.map((it, idx) => itemCard(it, idx, products, est.items[idx])).join('')}
        <div class="c-inline"><select class="c-input" id="est-add-product" style="width:auto">${opts(products, null, p => p.name, p => p.id, 'Add an item…')}</select><button class="btn-secondary btn-sm" data-action="est-add-item">+ Add</button></div>
      </div>
      <div class="c-est-side">
        <div class="c-card c-breakdown">
          <h3>Breakdown</h3>
          ${est.items.map(i => `<div class="c-bd-item"><strong>${esc(i.label)}</strong>${i.qty > 1 ? ` <span class="c-muted">x${i.qty}</span>` : ''}
            ${i.lines.map(l => `<div class="c-bd-line ${l.ok ? '' : 'c-bd-bad'}"><span>${esc(l.label)}<span class="c-muted c-small"> ${esc(l.detail)}${l.minutes ? ` · ${l.minutes} min` : ''}</span></span><span class="num">${U.fmtMoney(l.cost)}</span></div>`).join('')}
          </div>`).join('') || '<p class="c-muted c-small">Add an item to see the numbers.</p>'}
          ${draft.items.length ? `
          <div class="c-bd-totals">
            <div><span>Ingredients</span><span class="num">${U.fmtMoney(est.totals.ingredients)}</span></div>
            <div><span>Supplies</span><span class="num">${U.fmtMoney(est.totals.supplies)}</span></div>
            <div><span>Waste ${esc(ps.wasteAllowancePct)}%</span><span class="num">${U.fmtMoney(est.totals.waste)}</span></div>
            <div class="c-bd-sub"><span>Materials</span><span class="num">${U.fmtMoney(est.totals.materials)}</span></div>
            <div><span>Labor ${est.totals.hours} h at ${U.fmtMoney(ps.hourlyRate)}</span><span class="num">${U.fmtMoney(est.totals.labor)}</span></div>
            <div><span>Overhead ${ps.overheadType === 'flat' ? 'flat' : ps.overheadValue + '%'}</span><span class="num">${U.fmtMoney(est.totals.overhead)}</span></div>
            <div class="c-bd-sub"><span>Cost basis</span><span class="num">${U.fmtMoney(est.totals.costBasis)}</span></div>
            <div class="c-bd-big"><span>Suggested price <span class="c-muted c-small">${esc(ps.profitPct)}% profit</span></span><span class="num">${U.fmtMoney(est.totals.suggested)}</span></div>
            <div><span>Menu price</span><span class="num">${U.fmtMoney(est.totals.menu)}</span></div>
            <div><span>Margin at menu</span><span class="num"><span class="c-badge ${est.totals.belowAlert ? 'c-badge-warn' : 'c-badge-ok'}">${est.totals.marginPct == null ? '—' : est.totals.marginPct + '%'} (${U.fmtMoney(est.totals.marginAtMenu)})</span></span></div>
          </div>
          ${est.problems.length ? `<div class="c-warnbox c-small" style="margin-top:.75rem">Fix before trusting this number: ${est.problems.map(esc).join('; ')}</div>` : ''}
          <div class="c-inline" style="margin-top:1rem">
            <button class="btn-primary btn-sm" data-action="est-save">${draft.id ? 'Save changes' : 'Save estimate'}</button>
            ${draft.id ? '<button class="btn-secondary btn-sm" data-action="est-save-copy">Save as new</button>' : ''}
            <button class="btn-secondary btn-sm" data-action="est-clear">Clear</button>
          </div>
          ${draft.id ? `<p class="c-muted c-small" style="margin-top:.5rem">Editing a saved estimate. Saving stores today's numbers as its new snapshot.</p>` : ''}` : ''}
        </div>
      </div>
    </div>`;
    // wire inputs: change events re-read the form and re-render
    $$('[data-e],[data-i],[data-tier],[data-decor],[data-custom]', body).forEach(el => el.addEventListener('change', () => { readForm(body); rerender(); }));
    if (!requestsCache) loadRequests().then(() => rerender());
    const reqSel = $('[data-e="requestId"]', body);
    if (reqSel) reqSel.addEventListener('change', () => { const r = (requestsCache || []).find(x => x.id === reqSel.value); if (r && !draft.customerLabel) draft.customerLabel = r.customer_id; if (r && !draft.name) draft.name = r.label.split(' · ').slice(0, 2).join(' · '); rerender(); });
}

function itemCard(it, idx, products, priced) {
    const p = state.products.get(it.productId);
    if (!p) return `<div class="c-card"><p class="c-muted">Product missing.</p><button class="btn-text c-remove" data-action="est-remove-item" data-idx="${idx}">Remove</button></div>`;
    let body = '';
    if (p.family === 'cake') {
        body = `
        ${(it.tiers || []).map((t, ti) => `<div class="c-source" data-tier="${idx}:${ti}">
            <div class="c-form-grid c-form-grid-4">
                <label>${it.tiers.length > 1 ? `Tier ${ti + 1} size` : 'Size'}<select class="c-input" data-tf="sizeId">${opts(p.sizes || [], t.sizeId, s => `${s.label} (${U.fmtMoney(s.menuPrice)})`)}</select></label>
                <label>Cake<select class="c-input" data-tf="flavorRecipeId">${opts(recipesOf('cake'), t.flavorRecipeId)}</select></label>
                <label>Filling<select class="c-input" data-tf="fillingRecipeId">${opts(recipesOf('frosting', 'filling'), t.fillingRecipeId, r => r.name + ((p.premiumFillingIds || []).includes(r.id) ? ' (premium)' : ''))}</select></label>
                <label>Outer frosting<select class="c-input" data-tf="outerRecipeId">${opts(recipesOf('frosting'), t.outerRecipeId)}</select></label>
                <label>Extra layers<input class="c-input" data-tf="extraLayers" type="number" min="0" step="1" value="${t.extraLayers || 0}"></label>
                <label>Labor hours override<span class="c-hint">blank = size default</span><input class="c-input" data-tf="laborHoursOverride" type="number" step="0.25" value="${t.laborHoursOverride ?? ''}"></label>
            </div>
            ${it.tiers.length > 1 ? `<button class="btn-text c-remove" data-action="est-remove-tier" data-idx="${idx}" data-tier-idx="${ti}">Remove tier</button>` : ''}
        </div>`).join('')}
        <div class="c-inline" style="margin:.5rem 0 1rem"><button class="btn-secondary btn-sm" data-action="est-add-tier" data-idx="${idx}">+ Add a tier</button></div>
        <div class="c-form-grid c-form-grid-4">
            <label class="c-check"><input type="checkbox" data-i="drip" ${it.drip ? 'checked' : ''}> Ganache drip</label>
            <label>Fondant figures<input class="c-input" data-i="fondantFigures" type="number" min="0" step="1" value="${it.fondantFigures || 0}"></label>
            <label class="c-check"><input type="checkbox" data-i="topperOn" ${it.topper ? 'checked' : ''}> Topper</label>
            <label>Topper cost ($)<input class="c-input" data-i="topperCost" type="number" step="0.5" value="${it.topper?.cost ?? ''}" placeholder="${p.addons?.topperDefaultCost ?? ''}" ${it.topper ? '' : 'disabled'}></label>
            <label>Cakes (quantity)<input class="c-input" data-i="qty" type="number" min="1" step="1" value="${it.qty || 1}"></label>
        </div>`;
    } else if (p.family === 'cupcake') {
        body = `<div class="c-form-grid c-form-grid-4">
            <label>Dozens<input class="c-input" data-i="qty" type="number" min="0.5" step="0.5" value="${it.qty || 1}"></label>
            <label>Tier<select class="c-input" data-i="tierId">${opts(p.tiers || [], it.tierId, t => `${t.label} (${U.fmtMoney(t.menuPricePerDozen)}/doz)`)}</select></label>
            <label>Batter<select class="c-input" data-i="flavorRecipeId">${opts(recipesOf('cake', 'cupcake'), it.flavorRecipeId)}</select></label>
            <label>Frosting<select class="c-input" data-i="frostingRecipeId">${opts(recipesOf('frosting'), it.frostingRecipeId)}</select></label>
            <label>Labor hours override<input class="c-input" data-i="laborHoursOverride" type="number" step="0.25" value="${it.laborHoursOverride ?? ''}"></label>
        </div>`;
    } else {
        body = `<div class="c-form-grid c-form-grid-4">
            <label>Dozens<input class="c-input" data-i="qty" type="number" min="0.5" step="0.5" value="${it.qty || 1}"></label>
            <label>Tier<select class="c-input" data-i="tierId">${opts(p.tiers || [], it.tierId, t => `${t.label} (${U.fmtMoney(t.menuPricePerDozen)}/doz)`)}</select></label>
            <label>Character add-ons<input class="c-input" data-i="characters" type="number" min="0" step="1" value="${it.characters || 0}"></label>
            <label>Labor hours override<input class="c-input" data-i="laborHoursOverride" type="number" step="0.25" value="${it.laborHoursOverride ?? ''}"></label>
        </div>`;
    }
    const decorItems = [...state.ingredients.values()].sort(byName);
    return `<div class="c-card c-est-item" data-item="${idx}">
        <div class="c-card-head"><h3>${esc(p.name)}</h3><span>${priced ? `<strong>${U.fmtMoney(priced.ingredients + priced.supplies)}</strong> materials · ${Math.round(priced.hours * 100) / 100} h` : ''} <button class="btn-text c-remove" data-action="est-remove-item" data-idx="${idx}">Remove</button></span></div>
        ${body}
        <details class="c-history"><summary>Decor, extras and custom lines (${(it.decor || []).length + (it.custom || []).length})</summary>
            <div class="c-kit">
            ${(it.decor || []).map((d, di) => `<div class="c-kit-row" data-decor="${idx}:${di}"><select class="c-input" data-df="itemId">${opts(decorItems, d.itemId, x => x.name + (x.kind === 'supply' ? ' (supply)' : ''), x => x.id, 'item')}</select><input class="c-input c-qty" data-df="qty" type="number" step="any" value="${d.qty ?? 1}"><select class="c-input" data-df="unit" style="width:6rem">${U.RECIPE_LINE_UNITS.filter(u => u !== 'batch').map(u => `<option value="${u}" ${d.unit === u ? 'selected' : ''}>${U.UNIT_LABELS[u]}</option>`).join('')}</select><input class="c-input c-qty" data-df="minutes" type="number" step="1" value="${d.minutes ?? 0}" title="minutes"><button class="btn-text c-remove" data-action="est-remove-decor" data-idx="${idx}" data-di="${di}">✕</button></div>`).join('')}
            ${(it.custom || []).map((c, ci) => `<div class="c-kit-row" data-custom="${idx}:${ci}"><input class="c-input" data-cf="name" value="${esc(c.name || '')}" placeholder="Custom item"><input class="c-input c-qty" data-cf="cost" type="number" step="0.01" value="${c.cost ?? 0}" title="cost $"><input class="c-input c-qty" data-cf="minutes" type="number" step="1" value="${c.minutes ?? 0}" title="minutes"><button class="btn-text c-remove" data-action="est-remove-custom" data-idx="${idx}" data-ci="${ci}">✕</button></div>`).join('')}
            <div class="c-inline"><button class="btn-secondary btn-sm" data-action="est-add-decor" data-idx="${idx}">+ Ingredient or supply</button> <button class="btn-secondary btn-sm" data-action="est-add-custom" data-idx="${idx}">+ Custom line (cost + minutes)</button></div>
            </div>
        </details>
    </div>`;
}

function readForm(body) {
    $$('[data-e]', body).forEach(el => { draft[el.dataset.e] = el.value.trim(); });
    $$('.c-est-item', body).forEach(card => {
        const idx = Number(card.dataset.item); const it = draft.items[idx]; if (!it) return;
        const p = state.products.get(it.productId);
        $$('[data-i]', card).forEach(el => {
            const k = el.dataset.i;
            if (k === 'topperOn') { if (el.checked && !it.topper) it.topper = { cost: null, name: '' }; if (!el.checked) it.topper = null; return; }
            if (k === 'topperCost') { if (it.topper) it.topper.cost = U.num(el.value); return; }
            if (el.type === 'checkbox') it[k] = el.checked; else if (el.type === 'number') it[k] = U.num(el.value); else it[k] = el.value;
        });
        if (p?.family === 'cake') {
            $$('[data-tier]', card).forEach(tc => { const ti = Number(tc.dataset.tier.split(':')[1]); const t = it.tiers[ti]; if (!t) return; $$('[data-tf]', tc).forEach(el => { t[el.dataset.tf] = el.type === 'number' ? U.num(el.value) : el.value; }); });
        }
        $$('[data-decor]', card).forEach(row => { const di = Number(row.dataset.decor.split(':')[1]); const d = it.decor[di]; if (!d) return; $$('[data-df]', row).forEach(el => { d[el.dataset.df] = el.type === 'number' ? U.num(el.value) : el.value; }); });
        $$('[data-custom]', card).forEach(row => { const ci = Number(row.dataset.custom.split(':')[1]); const c = it.custom[ci]; if (!c) return; $$('[data-cf]', row).forEach(el => { c[el.dataset.cf] = el.type === 'number' ? U.num(el.value) : el.value; }); });
    });
}

function resetDraft() { draft.id = null; draft.name = ''; draft.requestId = ''; draft.customerLabel = ''; draft.notes = ''; draft.items = []; }
export function loadDraftFromEstimate(e) {
    resetDraft();
    draft.id = e.id; draft.name = e.name || ''; draft.requestId = e.requestId || ''; draft.customerLabel = e.customerLabel || ''; draft.notes = e.notes || '';
    draft.items = JSON.parse(JSON.stringify(e.items || []));
}
export function startDraftForRequest(requestId, customerLabel) { resetDraft(); draft.requestId = requestId || ''; draft.customerLabel = customerLabel || ''; }

async function saveDraft(asNew) {
    const body = $('#page-costing-estimator .costing-body'); if (body) readForm(body);
    if (!draft.items.length) { toast('Add an item first', 'err'); return; }
    const ctx = pricingCtx(); const ps = pricingSettings();
    const est = P.priceEstimate(draft, ctx, ps);
    const id = (asNew || !draft.id) ? ('est-' + todayISO().replace(/-/g, '') + '-' + uid(4)) : draft.id;
    const name = draft.name || est.items.map(i => i.label).join(' + ');
    const data = {
        name, requestId: draft.requestId || null, customerLabel: draft.customerLabel || '', notes: draft.notes || '',
        items: JSON.parse(JSON.stringify(draft.items)),
        snapshot: { totals: est.totals, items: est.items.map(i => ({ label: i.label, qty: i.qty, ingredients: U.round2(i.ingredients), supplies: U.round2(i.supplies), hours: i.hours, menu: i.menu, lines: i.lines.map(l => ({ kind: l.kind, label: l.label, detail: l.detail, cost: U.round2(l.cost), minutes: l.minutes })) })), settingsUsed: est.settingsUsed, at: todayISO() },
        updatedAt: serverTimestamp(), createdAt: (draft.id && !asNew) ? (state.estimates.get(draft.id)?.createdAt || serverTimestamp()) : serverTimestamp(),
    };
    await setDoc(doc(db, 'estimates', id), data, { merge: false });
    draft.id = id; draft.name = name;
    toast(asNew ? 'Saved as a new estimate' : 'Estimate saved');
    rerender();
}

// ------------------------------------------------------------------ estimates list
function renderEstimates(body) {
    const list = [...state.estimates.values()];
    const ctx = pricingCtx(); const ps = pricingSettings();
    if (!list.length) { body.innerHTML = '<div class="c-card c-empty"><h3>No saved estimates</h3><p>Build one in the Estimator and save it; it shows up here with its numbers at the time and at today\'s prices.</p><button class="btn-primary btn-sm" data-action="go" data-page="costing-estimator">Open the Estimator</button></div>'; return; }
    body.innerHTML = `
    <div class="c-toolbar"><input type="search" class="c-input" id="est-search" placeholder="Search name, customer, request…"><button class="btn-primary btn-sm" data-action="est-new">+ New estimate</button></div>
    <div class="c-table-wrap"><table class="c-table"><thead><tr><th>Estimate</th><th>Request</th><th class="num">Saved: suggested</th><th class="num">Today: suggested</th><th class="num">Menu</th><th class="num">Margin today</th><th></th></tr></thead><tbody>
    ${list.map(e => {
        const now = P.priceEstimate(e, ctx, ps); const then = e.snapshot?.totals || {};
        const moved = then.suggested != null && Math.abs(now.totals.suggested - then.suggested) >= 5;
        return `<tr><td><strong>${esc(e.name)}</strong><br><span class="c-muted c-small">${esc(e.customerLabel || '')}${e.snapshot?.at ? ' · saved ' + fmtDate(e.snapshot.at) : ''}</span></td>
            <td>${e.requestId ? `<code>${esc(e.requestId)}</code>` : '<span class="c-muted">—</span>'}</td>
            <td class="num">${U.fmtMoney(then.suggested)}</td>
            <td class="num">${U.fmtMoney(now.totals.suggested)}${moved ? ` <span class="c-badge ${now.totals.suggested > then.suggested ? 'c-badge-stale' : 'c-badge-ok'}">${now.totals.suggested > then.suggested ? 'up' : 'down'}</span>` : ''}</td>
            <td class="num">${U.fmtMoney(now.totals.menu)}</td>
            <td class="num"><span class="c-badge ${now.totals.belowAlert ? 'c-badge-warn' : 'c-badge-ok'}">${now.totals.marginPct == null ? '—' : now.totals.marginPct + '%'}</span></td>
            <td><button class="btn-secondary btn-sm" data-action="est-open" data-id="${esc(e.id)}">Open</button> <button class="btn-secondary btn-sm" data-action="est-duplicate" data-id="${esc(e.id)}">Duplicate</button> <button class="btn-text c-remove" data-action="est-delete" data-id="${esc(e.id)}">Delete</button></td></tr>`;
    }).join('')}
    </tbody></table></div>
    <p class="c-muted c-small">"Today" recomputes each estimate from current prices and settings; "Saved" is what it was when stored.</p>`;
    $('#est-search', body).addEventListener('input', e => { const q = e.target.value.toLowerCase(); $$('tbody tr', body).forEach(tr => { tr.style.display = tr.innerText.toLowerCase().includes(q) ? '' : 'none'; }); });
}

// ------------------------------------------------------------------ request modal hook: show estimates for the open request
function installRequestHook() {
    const mb = document.getElementById('modal-body'); if (!mb) return;
    const obs = new MutationObserver(() => {
        if ($('.c-req-estimates', mb)) return;
        const hero = $('.hero-id', mb); if (!hero) return;
        const reqId = hero.textContent.replace(/^#/, '').trim(); if (!reqId) return;
        const ests = [...state.estimates.values()].filter(e => e.requestId === reqId);
        const strip = document.createElement('div');
        strip.className = 'c-req-estimates';
        strip.innerHTML = `<span><strong>Costing:</strong> ${ests.length ? ests.map(e => `${esc(e.name)} (${U.fmtMoney(e.snapshot?.totals?.suggested)})`).join(', ') : 'no estimate yet'}</span> <button class="btn-secondary btn-sm" data-action="est-for-request" data-req="${esc(reqId)}">${ests.length ? 'Open estimate' : 'New estimate'}</button>`;
        hero.closest('.modal-hero')?.after(strip) || mb.prepend(strip);
    });
    obs.observe(mb, { childList: true, subtree: false });
}

// ------------------------------------------------------------------ actions
registerPage('costing-estimator', renderEstimator);
registerPage('costing-estimates', renderEstimates);
registerAction('est-add-item', () => { const body = $('#page-costing-estimator .costing-body'); readForm(body); const sel = $('#est-add-product'); const p = state.products.get(sel.value); const it = newItemFor(p); if (!it) { toast('Pick a product', 'err'); return; } draft.items.push(it); rerender(); });
registerAction('est-remove-item', el => { readForm($('#page-costing-estimator .costing-body')); draft.items.splice(Number(el.dataset.idx), 1); rerender(); });
registerAction('est-add-tier', el => { readForm($('#page-costing-estimator .costing-body')); const it = draft.items[Number(el.dataset.idx)]; const p = state.products.get(it.productId); it.tiers.push({ sizeId: p.sizes?.[0]?.id, flavorRecipeId: p.defaultFlavorRecipeId || '', fillingRecipeId: p.defaultFillingRecipeId || '', outerRecipeId: p.defaultOuterRecipeId || '', extraLayers: 0 }); rerender(); });
registerAction('est-remove-tier', el => { readForm($('#page-costing-estimator .costing-body')); draft.items[Number(el.dataset.idx)].tiers.splice(Number(el.dataset.tierIdx), 1); rerender(); });
registerAction('est-add-decor', el => { readForm($('#page-costing-estimator .costing-body')); const it = draft.items[Number(el.dataset.idx)]; it.decor = it.decor || []; it.decor.push({ itemId: '', qty: 1, unit: 'each', minutes: 0 }); rerender(); });
registerAction('est-remove-decor', el => { readForm($('#page-costing-estimator .costing-body')); draft.items[Number(el.dataset.idx)].decor.splice(Number(el.dataset.di), 1); rerender(); });
registerAction('est-add-custom', el => { readForm($('#page-costing-estimator .costing-body')); const it = draft.items[Number(el.dataset.idx)]; it.custom = it.custom || []; it.custom.push({ name: '', cost: 0, minutes: 0 }); rerender(); });
registerAction('est-remove-custom', el => { readForm($('#page-costing-estimator .costing-body')); draft.items[Number(el.dataset.idx)].custom.splice(Number(el.dataset.ci), 1); rerender(); });
registerAction('est-save', () => saveDraft(false));
registerAction('est-save-copy', () => saveDraft(true));
registerAction('est-clear', () => { if (draft.items.length && !confirm('Clear this estimate?')) return; resetDraft(); rerender(); });
registerAction('est-new', () => { resetDraft(); goEstimator(); });
registerAction('est-open', el => { const e = state.estimates.get(el.dataset.id); if (!e) return; loadDraftFromEstimate(e); goEstimator(); });
registerAction('est-duplicate', el => { const e = state.estimates.get(el.dataset.id); if (!e) return; loadDraftFromEstimate(e); draft.id = null; draft.name = (e.name || '') + ' (copy)'; goEstimator(); });
registerAction('est-delete', async el => { const e = state.estimates.get(el.dataset.id); if (!e) return; if (!confirm(`Delete "${e.name}"?`)) return; await deleteDoc(doc(db, 'estimates', e.id)); if (draft.id === e.id) resetDraft(); toast('Deleted'); });
registerAction('est-for-request', el => {
    const reqId = el.dataset.req;
    const existing = [...state.estimates.values()].find(e => e.requestId === reqId);
    if (existing) loadDraftFromEstimate(existing); else { const r = (requestsCache || []).find(x => x.id === reqId); startDraftForRequest(reqId, r ? r.customer_id : ''); }
    const closeBtn = document.querySelector('#detail-modal .close-modal'); if (closeBtn) closeBtn.click();
    goEstimator();
});
function goEstimator() { const link = $('.nav-links a[data-page="costing-estimator"]'); if (link) link.click(); else showCostingPage('costing-estimator'); }

if (document.readyState !== 'loading') installRequestHook(); else document.addEventListener('DOMContentLoaded', installRequestHook);
