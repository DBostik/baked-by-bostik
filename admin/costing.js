// costing.js
// Baked By Bostik admin: Costing module (Phase 1).
// Screens: Costing Home, Ingredients & Supplies, Log Prices, Recipes, Costing Settings.
// Loads alongside admin.js; reuses the same Firebase app and login. All math lives in costing-units.js.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc,
    query, orderBy, limit, serverTimestamp, writeBatch, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig } from '../js/firebase-config.js';
import * as U from './costing-units.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const COSTING_VERSION = '1.0.0';
const PAGES = ['costing-home', 'costing-ingredients', 'costing-log', 'costing-recipes', 'costing-settings'];
const RECIPE_CATEGORIES = ['cake', 'cupcake', 'cookie', 'frosting', 'filling', 'other'];
const KINDS = ['ingredient', 'supply'];
const DEFAULT_SETTINGS = { staleDaysDefault: 60, stores: ['Costco', 'Walmart', 'Amazon', "Pete's Fresh Market", 'Tap'], wasteAllowancePct: 5 };

const state = {
    user: null,
    ingredients: new Map(),
    recipes: new Map(),
    settings: { ...DEFAULT_SETTINGS },
    loaded: { ingredients: false, recipes: false, settings: false },
    page: null,
    unsubs: [],
    ingFilter: { q: '', kind: '', category: '' },
    recFilter: { q: '', category: '' },
    tripDraft: { store: '', date: todayISO(), prices: {} },
};

// ------------------------------------------------------------------ helpers
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function fmtDate(iso) { const d = U.toDate(iso); return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }
function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item'; }
function uid(n = 6) { return Math.random().toString(36).slice(2, 2 + n); }
function byName(a, b) { return String(a.name || '').localeCompare(String(b.name || '')); }
function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
function staleDaysFor(ing) { return U.num(ing.staleDays) ?? U.num(state.settings.staleDaysDefault) ?? 60; }

function toast(msg, kind = 'ok') {
    let host = $('#costing-toasts');
    if (!host) { host = document.createElement('div'); host.id = 'costing-toasts'; document.body.appendChild(host); }
    const t = document.createElement('div');
    t.className = `costing-toast ${kind}`;
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500);
}

// Status of an ingredient's preferred source
function ingredientStatus(ing) {
    const src = U.preferredSource(ing);
    if (!src) return { code: 'nosource', label: 'No source', cls: 'c-badge-warn' };
    if (U.num(src.currentPrice) == null) return { code: 'noprice', label: 'No price', cls: 'c-badge-warn' };
    const cost = U.sourceUnitCost(src, ing);
    if (!cost.ok) return { code: 'nopkg', label: 'Package?', cls: 'c-badge-warn' };
    const days = U.daysSince(src.currentPriceDate);
    if (days == null) return { code: 'nodate', label: 'No date', cls: 'c-badge-warn' };
    if (days > staleDaysFor(ing)) return { code: 'stale', label: `Stale ${days}d`, cls: 'c-badge-stale' };
    return { code: 'ok', label: `${days}d ago`, cls: 'c-badge-ok' };
}

function openFlags(obj) { return (obj.reviewFlags || []).filter(f => !(typeof f === 'object' && f.resolved)); }
function flagText(f) { return typeof f === 'string' ? f : f.text; }

// ------------------------------------------------------------------ data
function subscribe() {
    unsubscribeAll();
    state.unsubs.push(onSnapshot(collection(db, 'ingredients'), snap => {
        state.ingredients = new Map();
        snap.forEach(d => state.ingredients.set(d.id, { id: d.id, ...d.data() }));
        state.loaded.ingredients = true;
        rerender();
    }, err => { console.error('ingredients', err); toast('Could not load ingredients: ' + err.message, 'err'); }));
    state.unsubs.push(onSnapshot(collection(db, 'recipes'), snap => {
        state.recipes = new Map();
        snap.forEach(d => state.recipes.set(d.id, { id: d.id, ...d.data() }));
        state.loaded.recipes = true;
        rerender();
    }, err => { console.error('recipes', err); toast('Could not load recipes: ' + err.message, 'err'); }));
    state.unsubs.push(onSnapshot(doc(db, 'costing_settings', 'global'), snap => {
        state.settings = { ...DEFAULT_SETTINGS, ...(snap.exists() ? snap.data() : {}) };
        state.loaded.settings = true;
        rerender();
    }, err => { console.error('settings', err); }));
}
function unsubscribeAll() { state.unsubs.forEach(u => { try { u(); } catch (e) { } }); state.unsubs = []; }

async function saveIngredient(ing) {
    const id = ing.id || (slug(ing.name) + '-' + uid(4));
    const data = { ...ing };
    delete data.id;
    data.nameLower = String(data.name || '').toLowerCase();
    data.updatedAt = serverTimestamp();
    if (!data.createdAt) data.createdAt = serverTimestamp();
    await setDoc(doc(db, 'ingredients', id), data, { merge: true });
    return id;
}
async function deleteIngredient(id) { await deleteDoc(doc(db, 'ingredients', id)); }

async function saveRecipe(rec) {
    const id = rec.id || (slug(rec.name) + '-' + uid(4));
    const data = { ...rec };
    delete data.id;
    data.nameLower = String(data.name || '').toLowerCase();
    data.updatedAt = serverTimestamp();
    if (!data.createdAt) data.createdAt = serverTimestamp();
    await setDoc(doc(db, 'recipes', id), data, { merge: true });
    return id;
}
async function deleteRecipe(id) { await deleteDoc(doc(db, 'recipes', id)); }

async function saveSettings(patch) {
    await setDoc(doc(db, 'costing_settings', 'global'), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}

// Record a price for a source: history entry + source's current price. entries: [{ingredientId, sourceId, price, date, note, method}]
async function recordPrices(entries) {
    const batch = writeBatch(db);
    const touched = new Map();
    for (const e of entries) {
        const ing = state.ingredients.get(e.ingredientId);
        if (!ing) continue;
        const sources = (touched.get(ing.id) || ing.sources || []).map(s => ({ ...s }));
        const src = sources.find(s => s.id === e.sourceId);
        if (!src) continue;
        const price = U.num(e.price);
        if (price == null) continue;
        const date = e.date || todayISO();
        const last = U.toDate(src.currentPriceDate);
        const isNewer = !last || U.toDate(date) >= last;
        if (isNewer) { src.currentPrice = price; src.currentPriceDate = date; src.currentMethod = e.method || 'edit'; }
        touched.set(ing.id, sources);
        const pref = doc(collection(db, 'ingredients', ing.id, 'prices'));
        batch.set(pref, {
            sourceId: src.id, price, date, method: e.method || 'edit', note: e.note || '',
            packageQty: U.num(src.packageQty), packageUnit: src.packageUnit || null,
            enteredBy: state.user?.email || null, createdAt: serverTimestamp()
        });
    }
    for (const [id, sources] of touched) batch.update(doc(db, 'ingredients', id), { sources, updatedAt: serverTimestamp() });
    await batch.commit();
    return touched.size;
}

async function loadPriceHistory(ingredientId) {
    const q = query(collection(db, 'ingredients', ingredientId, 'prices'), orderBy('date', 'desc'), limit(200));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ------------------------------------------------------------------ navigation
function currentPageEl() { return state.page ? $('#page-' + state.page) : null; }

function showCostingPage(name) {
    state.page = name;
    render(name);
}

function rerender() { if (state.page) render(state.page); }

function render(name) {
    const el = $('#page-' + name);
    if (!el) return;
    const body = $('.costing-body', el);
    if (!body) return;
    if (!state.user) { body.innerHTML = '<p class="c-muted">Sign in to use Costing.</p>'; return; }
    if (!state.loaded.ingredients || !state.loaded.recipes) { body.innerHTML = '<p class="c-muted">Loading…</p>'; return; }
    switch (name) {
        case 'costing-home': renderHome(body); break;
        case 'costing-ingredients': renderIngredients(body); break;
        case 'costing-log': renderLog(body); break;
        case 'costing-recipes': renderRecipes(body); break;
        case 'costing-settings': renderSettings(body); break;
    }
}

// ------------------------------------------------------------------ HOME
function renderHome(body) {
    const ings = [...state.ingredients.values()];
    const recs = [...state.recipes.values()];
    const stale = ings.filter(i => ['stale'].includes(ingredientStatus(i).code));
    const missing = ings.filter(i => ['noprice', 'nopkg', 'nosource', 'nodate'].includes(ingredientStatus(i).code));
    const flags = [];
    ings.forEach(i => openFlags(i).forEach(f => flags.push({ type: 'ingredient', id: i.id, name: i.name, text: flagText(f) })));
    recs.forEach(r => openFlags(r).forEach(f => flags.push({ type: 'recipe', id: r.id, name: r.name, text: flagText(f) })));
    const priority = flags.filter(f => /TOP PRIORITY/i.test(f.text));
    const rest = flags.filter(f => !/TOP PRIORITY/i.test(f.text));

    if (!ings.length && !recs.length) {
        body.innerHTML = `
        <div class="c-card c-empty">
            <h3>Nothing here yet</h3>
            <p>Load the starter data from Kristen's sheet (ingredients, sources, prices and all recipes), then review the flagged items.</p>
            <button class="btn-primary btn-sm" data-action="go" data-page="costing-settings">Open Costing Settings</button>
        </div>`;
        return;
    }

    const recipeCosts = recs.map(r => ({ r, c: U.costRecipe(r, state.ingredients, state.recipes) }));
    const problems = recipeCosts.filter(x => !x.c.ok);

    body.innerHTML = `
    <div class="stats-row c-stats">
        <div class="stat-card" data-action="go" data-page="costing-ingredients" data-filter="stale"><div><span class="stat-label">Stale prices</span><span class="stat-number">${stale.length}</span></div></div>
        <div class="stat-card" data-action="go" data-page="costing-ingredients" data-filter="missing"><div><span class="stat-label">Missing price or size</span><span class="stat-number">${missing.length}</span></div></div>
        <div class="stat-card"><div><span class="stat-label">Review items</span><span class="stat-number">${flags.length}</span></div></div>
        <div class="stat-card" data-action="go" data-page="costing-recipes"><div><span class="stat-label">Recipes</span><span class="stat-number">${recs.length}</span></div></div>
    </div>
    ${problems.length ? `<div class="c-card c-warnbox"><strong>${problems.length} recipe${problems.length > 1 ? 's' : ''} cannot be fully costed yet:</strong> ${problems.map(x => `<a href="#" data-action="open-recipe" data-id="${esc(x.r.id)}">${esc(x.r.name)}</a>`).join(', ')}. Open one to see which line needs attention.</div>` : ''}
    <div class="c-two-col">
      <div class="c-card">
        <div class="c-card-head"><h3>Review list</h3><span class="c-muted">${flags.length} open</span></div>
        ${flags.length ? '' : '<p class="c-muted">Nothing to review. Nice.</p>'}
        ${priority.map(f => flagRow(f, true)).join('')}
        ${rest.map(f => flagRow(f, false)).join('')}
      </div>
      <div class="c-card">
        <div class="c-card-head"><h3>Prices to update</h3><span class="c-muted">${stale.length + missing.length} items</span></div>
        ${(stale.length + missing.length) ? '' : '<p class="c-muted">Every price is current.</p>'}
        <div class="c-list">
        ${[...missing, ...stale].sort(byName).slice(0, 40).map(i => {
        const st = ingredientStatus(i); const src = U.preferredSource(i);
        return `<div class="c-list-row" data-action="open-ingredient" data-id="${esc(i.id)}">
                <div><strong>${esc(i.name)}</strong><br><span class="c-muted">${src ? esc([src.brand, src.store, pkgLabel(src)].filter(Boolean).join(' · ')) : 'no source'}</span></div>
                <span class="c-badge ${st.cls}">${esc(st.label)}</span></div>`;
    }).join('')}
        </div>
      </div>
    </div>`;
}
function flagRow(f, priority) {
    return `<div class="c-flag ${priority ? 'c-flag-priority' : ''}">
        <div class="c-flag-text"><a href="#" data-action="${f.type === 'recipe' ? 'open-recipe' : 'open-ingredient'}" data-id="${esc(f.id)}">${esc(f.name)}</a><span>${esc(f.text)}</span></div>
        <button class="btn-secondary btn-sm" data-action="resolve-flag" data-type="${f.type}" data-id="${esc(f.id)}" data-text="${esc(f.text)}">Done</button>
    </div>`;
}
async function resolveFlag(type, id, text) {
    const map = type === 'recipe' ? state.recipes : state.ingredients;
    const obj = map.get(id);
    if (!obj) return;
    const flags = (obj.reviewFlags || []).map(f => typeof f === 'string' ? { text: f, resolved: false } : { ...f });
    const target = flags.find(f => f.text === text && !f.resolved);
    if (target) { target.resolved = true; target.resolvedAt = todayISO(); }
    await updateDoc(doc(db, type === 'recipe' ? 'recipes' : 'ingredients', id), { reviewFlags: flags, updatedAt: serverTimestamp() });
    toast('Marked as done');
}

// ------------------------------------------------------------------ INGREDIENTS
function pkgLabel(src) {
    const q = U.num(src?.packageQty);
    if (q == null || !src?.packageUnit) return '';
    return `${U.fmtQty(q)} ${U.UNIT_LABELS[src.packageUnit] || src.packageUnit}`;
}
function ingredientCategories() {
    const set = new Set();
    state.ingredients.forEach(i => { if (i.category) set.add(i.category); });
    return [...set].sort();
}
function renderIngredients(body) {
    const f = state.ingFilter;
    let list = [...state.ingredients.values()].sort(byName);
    if (f.kind) list = list.filter(i => (i.kind || 'ingredient') === f.kind);
    if (f.category) list = list.filter(i => i.category === f.category);
    if (f.status === 'stale') list = list.filter(i => ingredientStatus(i).code === 'stale');
    if (f.status === 'missing') list = list.filter(i => ['noprice', 'nopkg', 'nosource', 'nodate'].includes(ingredientStatus(i).code));
    if (f.q) { const q = f.q.toLowerCase(); list = list.filter(i => (i.name || '').toLowerCase().includes(q) || (i.aliases || []).some(a => a.toLowerCase().includes(q)) || (i.sources || []).some(s => (s.brand || '').toLowerCase().includes(q) || (s.store || '').toLowerCase().includes(q))); }

    body.innerHTML = `
    <div class="c-toolbar">
        <input type="search" class="c-input" id="ing-search" placeholder="Search name, brand, store…" value="${esc(f.q)}">
        <select class="c-input" id="ing-kind"><option value="">All kinds</option>${KINDS.map(k => `<option value="${k}" ${f.kind === k ? 'selected' : ''}>${k === 'supply' ? 'Supplies' : 'Ingredients'}</option>`).join('')}</select>
        <select class="c-input" id="ing-cat"><option value="">All categories</option>${ingredientCategories().map(c => `<option value="${esc(c)}" ${f.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <select class="c-input" id="ing-status"><option value="">Any status</option><option value="stale" ${f.status === 'stale' ? 'selected' : ''}>Stale</option><option value="missing" ${f.status === 'missing' ? 'selected' : ''}>Missing price or size</option></select>
        <button class="btn-primary btn-sm" data-action="new-ingredient">+ New item</button>
    </div>
    <div class="c-table-wrap"><table class="c-table">
        <thead><tr><th>Item</th><th>Preferred source</th><th class="num">Package price</th><th class="num">Cost per unit</th><th>Status</th></tr></thead>
        <tbody>
        ${list.map(i => {
        const src = U.preferredSource(i); const st = ingredientStatus(i); const uc = U.ingredientUnitCost(i);
        return `<tr data-action="open-ingredient" data-id="${esc(i.id)}">
            <td><strong>${esc(i.name)}</strong>${i.kind === 'supply' ? ' <span class="c-badge c-badge-kind">supply</span>' : ''}<br><span class="c-muted">${esc(i.category || '')}${openFlags(i).length ? ` · <span class="c-flagcount">${openFlags(i).length} to review</span>` : ''}</span></td>
            <td>${src ? `${esc(src.brand || '')}${src.brand ? ' · ' : ''}${esc(src.store || '')}<br><span class="c-muted">${esc(pkgLabel(src))}${src.needsPackage ? ' (confirm size)' : ''}</span>` : '<span class="c-muted">none</span>'}</td>
            <td class="num">${src && U.num(src.currentPrice) != null ? U.fmtMoney(src.currentPrice) : '—'}<br><span class="c-muted">${src?.currentPriceDate ? fmtDate(src.currentPriceDate) : ''}</span></td>
            <td class="num">${uc.ok ? U.fmtUnitCost(uc.unitCost, i.baseUnit) : '—'}</td>
            <td><span class="c-badge ${st.cls}">${esc(st.label)}</span></td>
        </tr>`;
    }).join('')}
        ${list.length ? '' : '<tr><td colspan="5" class="c-muted">No items match.</td></tr>'}
        </tbody></table></div>
    <p class="c-muted c-small">${list.length} of ${state.ingredients.size} items. Cost per unit is per 100 g, per 100 ml, or each, from the preferred source.</p>`;

    $('#ing-search', body).addEventListener('input', e => { state.ingFilter.q = e.target.value; renderIngredients(body); restoreFocus('#ing-search', body); });
    $('#ing-kind', body).addEventListener('change', e => { state.ingFilter.kind = e.target.value; renderIngredients(body); });
    $('#ing-cat', body).addEventListener('change', e => { state.ingFilter.category = e.target.value; renderIngredients(body); });
    $('#ing-status', body).addEventListener('change', e => { state.ingFilter.status = e.target.value; renderIngredients(body); });
}
function restoreFocus(sel, root) { const el = $(sel, root); if (el) { el.focus(); const v = el.value; el.value = ''; el.value = v; } }

// Ingredient editor modal
async function openIngredientModal(id) {
    const existing = id ? state.ingredients.get(id) : null;
    const ing = existing ? JSON.parse(JSON.stringify(existing)) : {
        name: '', kind: 'ingredient', category: '', baseUnit: 'g', gramsPerCup: null, gramsPerEach: null, gramsPerMl: null,
        aliases: [], notes: '', staleDays: null, sources: [], reviewFlags: [], preferredSourceId: null
    };
    if (!ing.sources) ing.sources = [];
    let history = [];
    if (existing) { try { history = await loadPriceHistory(existing.id); } catch (e) { console.error(e); } }
    const usedIn = existing ? [...state.recipes.values()].filter(r => (r.lines || []).some(l => l.ingredientId === existing.id)) : [];

    const stores = uniqueStores();
    const html = `
    <div class="modal-header c-modal-header"><h2>${existing ? 'Edit item' : 'New item'}</h2><button class="close-modal" data-action="close-modal">&times;</button></div>
    <div class="c-form-grid">
        <label>Name<input class="c-input" id="f-name" value="${esc(ing.name)}" placeholder="Unsalted butter"></label>
        <label>Kind<select class="c-input" id="f-kind">${KINDS.map(k => `<option value="${k}" ${ing.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        <label>Category<input class="c-input" id="f-category" list="c-categories" value="${esc(ing.category || '')}" placeholder="Dairy & eggs"><datalist id="c-categories">${ingredientCategories().map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
        <label>Base unit <span class="c-hint">g for solids, ml for liquids, each for countables</span><select class="c-input" id="f-baseUnit">${['g', 'ml', 'each'].map(u => `<option value="${u}" ${ing.baseUnit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
        <label>Grams per cup <span class="c-hint">for recipes written in cups/tsp</span><input class="c-input" id="f-gramsPerCup" type="number" step="0.1" value="${ing.gramsPerCup ?? ''}" placeholder="${U.suggestGramsPerCup(ing.name) ?? ''}"></label>
        <label>Grams per each <span class="c-hint">eggs 50, lemons 100</span><input class="c-input" id="f-gramsPerEach" type="number" step="0.1" value="${ing.gramsPerEach ?? ''}"></label>
        <label>Grams per ml <span class="c-hint">liquids only; water 1, oil 0.92</span><input class="c-input" id="f-gramsPerMl" type="number" step="0.01" value="${ing.gramsPerMl ?? ''}"></label>
        <label>Stale after (days) <span class="c-hint">blank = default ${esc(state.settings.staleDaysDefault)}</span><input class="c-input" id="f-staleDays" type="number" value="${ing.staleDays ?? ''}"></label>
        <label class="c-span2">Also known as <span class="c-hint">comma separated; helps recipe lines match</span><input class="c-input" id="f-aliases" value="${esc((ing.aliases || []).join(', '))}"></label>
        <label class="c-span2">Notes<textarea class="c-input" id="f-notes" rows="2">${esc(ing.notes || '')}</textarea></label>
    </div>

    <div class="c-section-head"><h3>Sources</h3><button class="btn-secondary btn-sm" data-action="add-source">+ Add source</button></div>
    <div id="f-sources">${ing.sources.map((s, idx) => sourceCard(s, idx, ing, stores, history)).join('') || '<p class="c-muted">No sources yet. Add where you buy it.</p>'}</div>

    ${openFlags(ing).length ? `<div class="c-section-head"><h3>To review</h3></div><ul class="c-flaglist">${openFlags(ing).map(f => `<li>${esc(flagText(f))}</li>`).join('')}</ul>` : ''}
    ${usedIn.length ? `<p class="c-muted c-small">Used in: ${usedIn.map(r => esc(r.name)).join(', ')}</p>` : ''}
    <div class="c-modal-actions">
        ${existing ? `<button class="btn-secondary btn-sm btn-danger" data-action="delete-ingredient" ${usedIn.length ? 'disabled title="Remove it from recipes first"' : ''}>Delete</button>` : '<span></span>'}
        <div><button class="btn-secondary btn-sm" data-action="close-modal">Cancel</button> <button class="btn-primary btn-sm" data-action="save-ingredient">Save</button></div>
    </div>`;
    openModal(html, { ing, existing, history });
}
function uniqueStores() {
    const set = new Set(state.settings.stores || []);
    state.ingredients.forEach(i => (i.sources || []).forEach(s => { if (s.store) set.add(s.store); }));
    return [...set];
}
function sourceCard(s, idx, ing, stores, history) {
    const isPref = (ing.preferredSourceId ? ing.preferredSourceId === s.id : !!s.preferred);
    const hist = history.filter(h => h.sourceId === s.id);
    const cost = U.sourceUnitCost({ ...s }, ing);
    return `<div class="c-source" data-idx="${idx}">
        <div class="c-form-grid c-form-grid-4">
            <label>Brand<input class="c-input" data-f="brand" value="${esc(s.brand || '')}"></label>
            <label>Store<input class="c-input" data-f="store" list="c-stores" value="${esc(s.store || '')}"><datalist id="c-stores">${stores.map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
            <label>Package size<div class="c-inline"><input class="c-input" data-f="packageQty" type="number" step="any" value="${s.packageQty ?? ''}" placeholder="4"><select class="c-input" data-f="packageUnit">${U.PACKAGE_UNITS.map(u => `<option value="${u}" ${s.packageUnit === u ? 'selected' : ''}>${U.UNIT_LABELS[u]}</option>`).join('')}</select></div></label>
            <label>Product link <span class="c-hint">for the price bot</span><input class="c-input" data-f="productUrl" value="${esc(s.productUrl || '')}" placeholder="https://"></label>
        </div>
        <div class="c-source-row">
            <label class="c-check"><input type="radio" name="pref-source" data-f="preferred" ${isPref ? 'checked' : ''}> Preferred</label>
            <label class="c-check"><input type="checkbox" data-f="needsPackage" ${s.needsPackage ? 'checked' : ''}> Confirm package size</label>
            <span class="c-muted">Current: ${U.num(s.currentPrice) != null ? `<strong>${U.fmtMoney(s.currentPrice)}</strong> on ${fmtDate(s.currentPriceDate)}` : 'no price yet'}${cost.ok ? ` · ${U.fmtUnitCost(cost.unitCost, ing.baseUnit)}` : ''}</span>
            <button class="btn-text c-remove" data-action="remove-source" data-idx="${idx}">Remove</button>
        </div>
        <div class="c-price-update">
            <span class="c-label">Update price</span>
            <input class="c-input" data-f="newPrice" type="number" step="0.01" min="0" placeholder="$">
            <input class="c-input" data-f="newDate" type="date" value="${todayISO()}">
            <input class="c-input" data-f="newNote" placeholder="note (optional)">
        </div>
        ${hist.length ? `<details class="c-history"><summary>Price history (${hist.length})</summary><table class="c-table c-table-sm"><thead><tr><th>Date</th><th class="num">Price</th><th>How</th><th>Note</th></tr></thead><tbody>
            ${hist.map(h => `<tr><td>${fmtDate(h.date)}</td><td class="num">${U.fmtMoney(h.price)}</td><td>${esc(h.method || '')}</td><td class="c-muted">${esc(h.note || '')}</td></tr>`).join('')}</tbody></table></details>` : ''}
    </div>`;
}
function readIngredientForm(ctx) {
    const m = $('#costing-modal');
    const ing = ctx.ing;
    ing.name = $('#f-name', m).value.trim();
    ing.kind = $('#f-kind', m).value;
    ing.category = $('#f-category', m).value.trim();
    ing.baseUnit = $('#f-baseUnit', m).value;
    ing.gramsPerCup = U.num($('#f-gramsPerCup', m).value);
    ing.gramsPerEach = U.num($('#f-gramsPerEach', m).value);
    ing.gramsPerMl = U.num($('#f-gramsPerMl', m).value);
    ing.staleDays = U.num($('#f-staleDays', m).value);
    ing.aliases = $('#f-aliases', m).value.split(',').map(s => s.trim()).filter(Boolean);
    ing.notes = $('#f-notes', m).value.trim();
    const newPrices = [];
    $$('.c-source', m).forEach((card, idx) => {
        const s = ing.sources[idx]; if (!s) return;
        const g = f => $(`[data-f="${f}"]`, card);
        s.brand = g('brand').value.trim(); s.store = g('store').value.trim();
        s.packageQty = U.num(g('packageQty').value); s.packageUnit = g('packageUnit').value;
        s.productUrl = g('productUrl').value.trim();
        s.needsPackage = g('needsPackage').checked;
        s.preferred = g('preferred').checked;
        if (s.preferred) ing.preferredSourceId = s.id;
        const np = U.num(g('newPrice').value);
        if (np != null) newPrices.push({ sourceId: s.id, price: np, date: g('newDate').value || todayISO(), note: g('newNote').value.trim(), method: 'edit' });
    });
    if (!ing.sources.some(s => s.preferred) && ing.sources.length) { ing.sources[0].preferred = true; ing.preferredSourceId = ing.sources[0].id; }
    return { ing, newPrices };
}

// ------------------------------------------------------------------ LOG PRICES (shopping trip)
function renderLog(body) {
    const d = state.tripDraft;
    const stores = uniqueStores();
    if (!d.store && stores.length) d.store = stores[0];
    const rows = [];
    [...state.ingredients.values()].sort(byName).forEach(i => (i.sources || []).forEach(s => {
        if ((s.store || '').toLowerCase() === (d.store || '').toLowerCase()) rows.push({ i, s });
    }));
    const filled = Object.values(d.prices).filter(v => U.num(v) != null).length;
    body.innerHTML = `
    <div class="c-card">
      <div class="c-toolbar">
        <label class="c-inline-label">Store <select class="c-input" id="trip-store">${stores.map(s => `<option value="${esc(s)}" ${s === d.store ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
        <label class="c-inline-label">Date <input class="c-input" id="trip-date" type="date" value="${esc(d.date)}"></label>
        <button class="btn-primary btn-sm" data-action="save-trip" ${filled ? '' : 'disabled'}>Save ${filled || ''} price${filled === 1 ? '' : 's'}</button>
      </div>
      <p class="c-muted c-small">Type the package price for what you bought. Leave the rest blank. Package sizes are shown so you know what the price is for; fix a size from the item's page if it is wrong.</p>
      <div class="c-table-wrap"><table class="c-table">
        <thead><tr><th>Item</th><th>Package</th><th class="num">Last price</th><th class="num">New price</th></tr></thead>
        <tbody>
        ${rows.map(({ i, s }) => {
        const key = i.id + '|' + s.id;
        return `<tr>
            <td><strong>${esc(i.name)}</strong><br><span class="c-muted">${esc(s.brand || '')}</span></td>
            <td>${esc(pkgLabel(s)) || '<span class="c-badge c-badge-warn">size?</span>'}${s.needsPackage ? ' <span class="c-muted">(confirm)</span>' : ''}</td>
            <td class="num">${U.num(s.currentPrice) != null ? U.fmtMoney(s.currentPrice) : '—'}<br><span class="c-muted">${s.currentPriceDate ? fmtDate(s.currentPriceDate) : ''}</span></td>
            <td class="num"><input class="c-input c-price-in" type="number" step="0.01" min="0" inputmode="decimal" data-key="${esc(key)}" value="${esc(d.prices[key] ?? '')}" placeholder="$"></td>
        </tr>`;
    }).join('')}
        ${rows.length ? '' : `<tr><td colspan="4" class="c-muted">No items have a source at ${esc(d.store || 'this store')} yet. Add the store on an item's page first.</td></tr>`}
        </tbody></table></div>
    </div>`;
    $('#trip-store', body).addEventListener('change', e => { d.store = e.target.value; renderLog(body); });
    $('#trip-date', body).addEventListener('change', e => { d.date = e.target.value; });
    $$('.c-price-in', body).forEach(inp => inp.addEventListener('input', e => {
        const k = e.target.dataset.key; if (e.target.value === '') delete d.prices[k]; else d.prices[k] = e.target.value;
        const n = Object.values(d.prices).filter(v => U.num(v) != null).length;
        const btn = $('[data-action="save-trip"]', body); btn.disabled = !n; btn.textContent = `Save ${n || ''} price${n === 1 ? '' : 's'}`;
    }));
}
async function saveTrip() {
    const d = state.tripDraft;
    const entries = Object.entries(d.prices).map(([k, v]) => { const [ingredientId, sourceId] = k.split('|'); return { ingredientId, sourceId, price: U.num(v), date: d.date, method: 'trip', note: `Shopping trip, ${d.store}` }; }).filter(e => e.price != null);
    if (!entries.length) return;
    const n = await recordPrices(entries);
    d.prices = {};
    toast(`Saved ${entries.length} price${entries.length === 1 ? '' : 's'} across ${n} item${n === 1 ? '' : 's'}`);
}

// ------------------------------------------------------------------ RECIPES
function recipeCost(r) { return U.costRecipe(r, state.ingredients, state.recipes); }
function perUnitLabel(r, c) {
    const per = U.perUnitCosts(r, c);
    const parts = [];
    if (per.perCount != null) parts.push(`${U.fmtMoney(per.perCount)} per ${esc(per.countLabel || 'each')}`);
    if (per.perCup != null) parts.push(`${U.fmtMoney(per.perCup)} per cup`);
    if (per.perGram != null && r.yield?.type === 'batter') parts.push(`${U.fmtMoney(per.perGram * 100)} per 100 g batter`);
    return parts.join('<br>') || '—';
}
function renderRecipes(body) {
    const f = state.recFilter;
    let list = [...state.recipes.values()].sort(byName);
    if (f.category) list = list.filter(r => r.category === f.category);
    if (f.q) { const q = f.q.toLowerCase(); list = list.filter(r => (r.name || '').toLowerCase().includes(q) || (r.creator || '').toLowerCase().includes(q)); }
    body.innerHTML = `
    <div class="c-toolbar">
        <input type="search" class="c-input" id="rec-search" placeholder="Search recipes…" value="${esc(f.q)}">
        <select class="c-input" id="rec-cat"><option value="">All categories</option>${RECIPE_CATEGORIES.map(c => `<option value="${c}" ${f.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        <button class="btn-primary btn-sm" data-action="new-recipe">+ New recipe</button>
    </div>
    <div class="c-table-wrap"><table class="c-table">
        <thead><tr><th>Recipe</th><th>Yield</th><th class="num">Batch cost</th><th class="num">Per unit</th><th>Prices as of</th></tr></thead>
        <tbody>
        ${list.map(r => {
        const c = recipeCost(r);
        const od = c.oldestPriceDate; const days = od ? U.daysSince(od) : null;
        const staleCls = days == null ? 'c-badge-warn' : days > (U.num(state.settings.staleDaysDefault) ?? 60) ? 'c-badge-stale' : 'c-badge-ok';
        return `<tr data-action="open-recipe" data-id="${esc(r.id)}">
            <td><strong>${esc(r.name)}</strong> <span class="c-badge c-badge-kind">${esc(r.category || '')}</span><br><span class="c-muted">${esc(r.creator || '')}${openFlags(r).length ? ` · <span class="c-flagcount">${openFlags(r).length} to review</span>` : ''}</span></td>
            <td>${esc(r.yield?.label || '')}${c.gramsComplete && c.grams ? `<br><span class="c-muted">${Math.round(c.grams)} g</span>` : ''}</td>
            <td class="num">${c.ok ? U.fmtMoney(c.total) : `<span class="c-badge c-badge-warn" title="${esc(c.problems.join('\n'))}">${c.problems.length} problem${c.problems.length > 1 ? 's' : ''}</span><br>${U.fmtMoney(c.total)}+`}</td>
            <td class="num">${perUnitLabel(r, c)}</td>
            <td>${od ? `<span class="c-badge ${staleCls}">${fmtDate(od)}</span>` : '<span class="c-muted">—</span>'}</td>
        </tr>`;
    }).join('')}
        ${list.length ? '' : '<tr><td colspan="5" class="c-muted">No recipes match.</td></tr>'}
        </tbody></table></div>
    <p class="c-muted c-small">Batch cost uses each ingredient's preferred source at its current price. "Prices as of" is the oldest price date among the recipe's ingredients.</p>`;
    $('#rec-search', body).addEventListener('input', e => { state.recFilter.q = e.target.value; renderRecipes(body); restoreFocus('#rec-search', body); });
    $('#rec-cat', body).addEventListener('change', e => { state.recFilter.category = e.target.value; renderRecipes(body); });
}

// Match a parsed line name to an ingredient or recipe
function normName(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function matchIngredient(name) {
    const n = normName(name);
    if (!n) return null;
    const candidates = [...state.ingredients.values()];
    // exact name or alias
    for (const i of candidates) {
        if (normName(i.name) === n) return { ingredientId: i.id, score: 100 };
        if ((i.aliases || []).some(a => normName(a) === n)) return { ingredientId: i.id, score: 95 };
    }
    // alias contained in the text (longest alias wins)
    let best = null;
    for (const i of candidates) {
        for (const a of [i.name, ...(i.aliases || [])]) {
            const an = normName(a);
            if (an.length >= 3 && (n.includes(an) || an.includes(n))) {
                const score = 50 + Math.min(an.length, 40);
                if (!best || score > best.score) best = { ingredientId: i.id, score };
            }
        }
    }
    if (best) return best;
    // token overlap
    const tokens = n.split(' ').filter(t => t.length > 2);
    for (const i of candidates) {
        const words = new Set(normName([i.name, ...(i.aliases || [])].join(' ')).split(' '));
        const hits = tokens.filter(t => words.has(t)).length;
        if (hits && (!best || hits * 10 > best.score)) best = { ingredientId: i.id, score: hits * 10 };
    }
    return best;
}
function matchRecipe(name) {
    const n = normName(name);
    for (const r of state.recipes.values()) if (normName(r.name) === n || n.includes(normName(r.name))) return r.id;
    return null;
}

function openRecipeModal(id) {
    const existing = id ? state.recipes.get(id) : null;
    const rec = existing ? JSON.parse(JSON.stringify(existing)) : { name: '', category: 'cake', creator: '', sourceUrl: '', notes: '', yield: { type: 'batter', label: '' }, lines: [], reviewFlags: [] };
    if (!rec.lines) rec.lines = [];
    if (!rec.yield) rec.yield = { type: 'batter' };
    const usedBy = existing ? [...state.recipes.values()].filter(r => (r.lines || []).some(l => l.recipeId === existing.id)) : [];
    const html = `
    <div class="modal-header c-modal-header"><h2>${existing ? 'Edit recipe' : 'New recipe'}</h2><button class="close-modal" data-action="close-modal">&times;</button></div>
    <div class="c-form-grid">
        <label>Name<input class="c-input" id="r-name" value="${esc(rec.name)}"></label>
        <label>Category<select class="c-input" id="r-category">${RECIPE_CATEGORIES.map(c => `<option value="${c}" ${rec.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label>Creator / source<input class="c-input" id="r-creator" value="${esc(rec.creator || '')}"></label>
        <label>Link<input class="c-input" id="r-url" value="${esc(rec.sourceUrl || '')}" placeholder="https://"></label>
        <label class="c-span2">Notes<textarea class="c-input" id="r-notes" rows="2">${esc(rec.notes || '')}</textarea></label>
    </div>
    <div class="c-section-head"><h3>Yield</h3></div>
    <div class="c-form-grid c-form-grid-4">
        <label>Type<select class="c-input" id="y-type">
            <option value="batter" ${rec.yield.type === 'batter' ? 'selected' : ''}>Batter (by weight)</option>
            <option value="volume" ${rec.yield.type === 'volume' ? 'selected' : ''}>Volume (cups)</option>
            <option value="count" ${rec.yield.type === 'count' ? 'selected' : ''}>Count (cookies, cupcakes)</option></select></label>
        <label>Amount<input class="c-input" id="y-value" type="number" step="any" value="${rec.yield.value ?? ''}" placeholder="${rec.yield.type === 'count' ? '24' : '5'}"></label>
        <label>Unit<input class="c-input" id="y-unit" value="${esc(rec.yield.unit || (rec.yield.type === 'count' ? 'cookie' : 'cup'))}"></label>
        <label>Label <span class="c-hint">shown in lists</span><input class="c-input" id="y-label" value="${esc(rec.yield.label || '')}" placeholder="Two 8-inch rounds"></label>
    </div>
    <div class="c-section-head"><h3>Ingredients</h3><div><button class="btn-secondary btn-sm" data-action="add-line">+ Add line</button> <button class="btn-secondary btn-sm" data-action="toggle-paste">Paste lines</button></div></div>
    <div id="r-paste" class="hidden c-paste">
        <textarea class="c-input" id="r-paste-text" rows="5" placeholder="One ingredient per line, as written in the recipe:&#10;2 1/4 cups all-purpose flour&#10;1/2 cup unsalted butter, softened&#10;3 eggs"></textarea>
        <div class="c-inline"><button class="btn-primary btn-sm" data-action="parse-paste">Add these lines</button><span class="c-muted c-small">Each line is read and matched to an ingredient. Check the matches after.</span></div>
    </div>
    <div class="c-table-wrap"><table class="c-table c-lines" id="r-lines"><thead><tr><th class="num">Qty</th><th>Unit</th><th>Ingredient or recipe</th><th>Note</th><th class="num">Cost</th><th></th></tr></thead><tbody></tbody></table></div>
    <div class="c-totals" id="r-totals"></div>
    ${openFlags(rec).length ? `<div class="c-section-head"><h3>To review</h3></div><ul class="c-flaglist">${openFlags(rec).map(f => `<li>${esc(flagText(f))}</li>`).join('')}</ul>` : ''}
    ${usedBy.length ? `<p class="c-muted c-small">Used inside: ${usedBy.map(r => esc(r.name)).join(', ')}</p>` : ''}
    <div class="c-modal-actions">
        ${existing ? `<button class="btn-secondary btn-sm btn-danger" data-action="delete-recipe" ${usedBy.length ? 'disabled title="Remove it from the recipes that use it first"' : ''}>Delete</button>` : '<span></span>'}
        <div><button class="btn-secondary btn-sm" data-action="close-modal">Cancel</button> <button class="btn-primary btn-sm" data-action="save-recipe">Save</button></div>
    </div>`;
    openModal(html, { rec, existing });
    renderLines();
    $('#y-type').addEventListener('change', e => { const t = e.target.value; $('#y-unit').value = t === 'count' ? 'cookie' : 'cup'; });
}
function lineTargetOptions(line) {
    const ings = [...state.ingredients.values()].sort(byName);
    const recs = [...state.recipes.values()].sort(byName).filter(r => r.id !== modalCtx?.rec?.id);
    return `<option value="">— choose —</option>
        <optgroup label="Ingredients">${ings.map(i => `<option value="i:${esc(i.id)}" ${line.ingredientId === i.id ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}</optgroup>
        <optgroup label="Recipes (as a component)">${recs.map(r => `<option value="r:${esc(r.id)}" ${line.recipeId === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</optgroup>`;
}
function renderLines() {
    const ctx = modalCtx; if (!ctx?.rec) return;
    readRecipeForm(false);
    const rec = ctx.rec;
    const tbody = $('#r-lines tbody');
    const cost = U.costRecipe(rec, state.ingredients, state.recipes);
    tbody.innerHTML = rec.lines.map((l, idx) => {
        const lc = cost.lines[idx] || {};
        return `<tr data-idx="${idx}">
            <td class="num"><input class="c-input c-qty" data-f="qty" type="number" step="any" value="${l.qty ?? ''}"></td>
            <td><select class="c-input" data-f="unit">${U.RECIPE_LINE_UNITS.map(u => `<option value="${u}" ${l.unit === u ? 'selected' : ''}>${U.UNIT_LABELS[u]}</option>`).join('')}</select></td>
            <td><select class="c-input" data-f="target">${lineTargetOptions(l)}</select>${l.text && !l.ingredientId && !l.recipeId ? `<div class="c-muted c-small">as written: ${esc(l.text)}</div>` : ''}</td>
            <td><input class="c-input" data-f="note" value="${esc(l.note || '')}" placeholder="note"></td>
            <td class="num">${lc.ok ? U.fmtMoney(lc.cost) : `<span class="c-badge c-badge-warn" title="${esc(lc.reason || '')}">${esc(lc.reason || 'check')}</span>`}</td>
            <td><button class="btn-text c-remove" data-action="remove-line" data-idx="${idx}">✕</button></td>
        </tr>`;
    }).join('') || '<tr><td colspan="6" class="c-muted">No lines yet. Add a line or paste the ingredient list.</td></tr>';
    const per = U.perUnitCosts(rec, cost);
    $('#r-totals').innerHTML = `
        <div><span class="c-label">Batch cost</span><strong>${U.fmtMoney(cost.total)}</strong>${cost.ok ? '' : ` <span class="c-badge c-badge-warn">${cost.problems.length} to fix</span>`}</div>
        <div><span class="c-label">Weight</span>${cost.gramsComplete && cost.grams ? Math.round(cost.grams) + ' g' : '<span class="c-muted">needs every line in grams</span>'}</div>
        <div><span class="c-label">Per unit</span>${perUnitLabel(rec, cost)}</div>
        ${cost.oldestPriceDate ? `<div><span class="c-label">Oldest price</span>${fmtDate(cost.oldestPriceDate)}</div>` : ''}`;
    $$('#r-lines [data-f]').forEach(el => el.addEventListener('change', () => renderLines()));
}
function readRecipeForm(includeMeta = true) {
    const ctx = modalCtx; if (!ctx?.rec) return;
    const rec = ctx.rec;
    if (includeMeta) {
        rec.name = $('#r-name').value.trim();
        rec.category = $('#r-category').value;
        rec.creator = $('#r-creator').value.trim();
        rec.sourceUrl = $('#r-url').value.trim();
        rec.notes = $('#r-notes').value.trim();
        rec.yield = { ...(rec.yield || {}), type: $('#y-type').value, value: U.num($('#y-value').value), unit: $('#y-unit').value.trim(), label: $('#y-label').value.trim() };
    }
    $$('#r-lines tbody tr[data-idx]').forEach(tr => {
        const idx = Number(tr.dataset.idx); const l = rec.lines[idx]; if (!l) return;
        const g = f => $(`[data-f="${f}"]`, tr);
        l.qty = U.num(g('qty').value); l.unit = g('unit').value; l.note = g('note').value.trim();
        const t = g('target').value;
        delete l.ingredientId; delete l.recipeId;
        if (t.startsWith('i:')) l.ingredientId = t.slice(2); else if (t.startsWith('r:')) l.recipeId = t.slice(2);
        if (!l.text) l.text = `${U.fmtQty(l.qty)} ${U.UNIT_LABELS[l.unit] || l.unit} ${targetName(l)}`.trim();
    });
}
function targetName(l) { return l.ingredientId ? (state.ingredients.get(l.ingredientId)?.name || '') : l.recipeId ? (state.recipes.get(l.recipeId)?.name || '') : ''; }
function addParsedLines(text) {
    const ctx = modalCtx; if (!ctx?.rec) return 0;
    let added = 0;
    text.split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach(raw => {
        const p = U.parseLine(raw);
        const line = { text: raw, qty: p.qty, unit: p.unit || 'each', note: p.note || '' };
        const rid = /\bbatch\b/i.test(raw) ? matchRecipe(p.name) : null;
        if (rid) { line.recipeId = rid; line.unit = 'batch'; }
        else { const m = matchIngredient(p.name); if (m && m.score >= 50) line.ingredientId = m.ingredientId; }
        if (p.flags.length) line.note = [line.note, ...p.flags].filter(Boolean).join('; ');
        ctx.rec.lines.push(line); added++;
    });
    return added;
}

// ------------------------------------------------------------------ SETTINGS
function renderSettings(body) {
    const s = state.settings;
    const empty = state.ingredients.size === 0 && state.recipes.size === 0;
    body.innerHTML = `
    <div class="c-two-col">
      <div class="c-card">
        <h3>Defaults</h3>
        <div class="c-form-grid">
          <label>Flag a price as stale after (days)<input class="c-input" id="s-stale" type="number" min="1" value="${esc(s.staleDaysDefault)}"></label>
          <label>Waste allowance % <span class="c-hint">used by the estimator in Phase 2</span><input class="c-input" id="s-waste" type="number" min="0" step="0.5" value="${esc(s.wasteAllowancePct ?? 5)}"></label>
          <label class="c-span2">Stores <span class="c-hint">comma separated</span><input class="c-input" id="s-stores" value="${esc((s.stores || []).join(', '))}"></label>
        </div>
        <button class="btn-primary btn-sm" data-action="save-settings">Save defaults</button>
      </div>
      <div class="c-card">
        <h3>Data</h3>
        <p class="c-small">Starter data comes from Kristen's Google Sheet "Recipes + Cost Break Down": every ingredient, where it is bought, the dated prices, and all recipes. Items the sheet was unsure about carry a note on the Costing Home review list.</p>
        <button class="btn-primary btn-sm" data-action="import-seed" ${empty ? '' : 'disabled title="Only available while Costing is empty"'}>Load starter data</button>
        ${empty ? '' : '<p class="c-muted c-small">Already loaded. To start over, ask Dave; it is a one-line reset.</p>'}
        <hr class="c-hr">
        <p class="c-small">Export everything as CSV files you can open in Excel or Google Sheets.</p>
        <div class="c-inline"><button class="btn-secondary btn-sm" data-action="export-ingredients">Ingredients &amp; prices</button> <button class="btn-secondary btn-sm" data-action="export-recipes">Recipes</button> <button class="btn-secondary btn-sm" data-action="export-history">Price history</button></div>
        <p class="c-muted c-small" style="margin-top:1rem">Costing module ${COSTING_VERSION}</p>
      </div>
    </div>`;
}

async function importSeed() {
    const res = await fetch('/admin/costing-seed.json?v=' + Date.now());
    if (!res.ok) throw new Error('Could not load costing-seed.json');
    const seed = await res.json();
    if (state.ingredients.size || state.recipes.size) throw new Error('Costing already has data; import is only for an empty start.');
    // ingredients (chunk batches to stay under 500 writes)
    let batch = writeBatch(db), n = 0;
    const flush = async () => { if (n) { await batch.commit(); batch = writeBatch(db); n = 0; } };
    for (const i of seed.ingredients) {
        const sources = i.sources.map(s => {
            const sorted = (s.prices || []).slice().sort((a, b) => a.date.localeCompare(b.date));
            const last = sorted[sorted.length - 1];
            const { prices, ...rest } = s;
            return { ...rest, active: true, currentPrice: last ? last.price : null, currentPriceDate: last ? last.date : null, currentMethod: last ? 'import' : null };
        });
        const pref = sources.find(s => s.preferred) || sources[0];
        const { id, sources: _s, ...rest } = i;
        batch.set(doc(db, 'ingredients', id), {
            ...rest, sources, preferredSourceId: pref ? pref.id : null,
            reviewFlags: (i.reviewFlags || []).map(t => ({ text: t, resolved: false })),
            nameLower: String(i.name).toLowerCase(), createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        }); n++;
        for (const s of i.sources) for (const p of (s.prices || [])) {
            batch.set(doc(collection(db, 'ingredients', id, 'prices')), {
                sourceId: s.id, price: p.price, date: p.date, method: 'import', note: p.note || '',
                packageQty: s.packageQty, packageUnit: s.packageUnit, enteredBy: 'seed', createdAt: serverTimestamp()
            }); n++;
            if (n >= 400) await flush();
        }
        if (n >= 400) await flush();
    }
    for (const r of seed.recipes) {
        const { id, ...rest } = r;
        batch.set(doc(db, 'recipes', id), { ...rest, reviewFlags: (r.reviewFlags || []).map(t => ({ text: t, resolved: false })), nameLower: String(r.name).toLowerCase(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); n++;
        if (n >= 400) await flush();
    }
    batch.set(doc(db, 'costing_settings', 'global'), { ...DEFAULT_SETTINGS, ...(seed.settings || {}), seededAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }); n++;
    await flush();
    return { ingredients: seed.ingredients.length, recipes: seed.recipes.length };
}

function download(filename, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportIngredients() {
    const rows = [['Ingredient', 'Kind', 'Category', 'Base unit', 'Grams per cup', 'Grams per each', 'Grams per ml', 'Source id', 'Brand', 'Store', 'Package qty', 'Package unit', 'Preferred', 'Current price', 'Price date', 'Cost per base unit', 'Product link', 'Open review notes']];
    [...state.ingredients.values()].sort(byName).forEach(i => (i.sources || []).forEach(s => {
        const uc = U.sourceUnitCost(s, i);
        rows.push([i.name, i.kind, i.category, i.baseUnit, i.gramsPerCup, i.gramsPerEach, i.gramsPerMl, s.id, s.brand, s.store, s.packageQty, s.packageUnit, (i.preferredSourceId === s.id || s.preferred) ? 'yes' : '', s.currentPrice, s.currentPriceDate, uc.ok ? uc.unitCost.toFixed(6) : '', s.productUrl, openFlags(i).map(flagText).join(' | ')]);
    }));
    download(`bbb-ingredients-${todayISO()}.csv`, U.toCSV(rows));
}
function exportRecipes() {
    const rows = [['Recipe', 'Category', 'Yield', 'Batch cost', 'Line', 'Qty', 'Unit', 'Ingredient / recipe', 'Line cost', 'Note', 'As written']];
    [...state.recipes.values()].sort(byName).forEach(r => {
        const c = recipeCost(r);
        (r.lines || []).forEach((l, idx) => rows.push([r.name, r.category, r.yield?.label || '', c.total.toFixed(2), idx + 1, l.qty, l.unit, targetName(l), (c.lines[idx]?.cost || 0).toFixed(4), l.note || '', l.text || '']));
    });
    download(`bbb-recipes-${todayISO()}.csv`, U.toCSV(rows));
}
async function exportHistory() {
    const rows = [['Ingredient', 'Source id', 'Brand', 'Store', 'Date', 'Price', 'Package qty', 'Package unit', 'How', 'Note']];
    for (const i of [...state.ingredients.values()].sort(byName)) {
        const hist = await loadPriceHistory(i.id);
        hist.forEach(h => { const s = (i.sources || []).find(x => x.id === h.sourceId) || {}; rows.push([i.name, h.sourceId, s.brand || '', s.store || '', h.date, h.price, h.packageQty, h.packageUnit, h.method, h.note]); });
    }
    download(`bbb-price-history-${todayISO()}.csv`, U.toCSV(rows));
}

// ------------------------------------------------------------------ modal plumbing
let modalCtx = null;
function ensureModal() {
    let m = $('#costing-modal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'costing-modal';
    m.className = 'modal hidden';
    m.innerHTML = '<div class="modal-content c-modal-content" id="costing-modal-body"></div>';
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) closeModal(); });
    return m;
}
function openModal(html, ctx) {
    const m = ensureModal();
    modalCtx = ctx || {};
    $('#costing-modal-body', m).innerHTML = html;
    m.classList.remove('hidden');
    document.body.classList.add('c-modal-open');
}
function closeModal() {
    const m = $('#costing-modal'); if (!m) return;
    m.classList.add('hidden'); $('#costing-modal-body', m).innerHTML = ''; modalCtx = null;
    document.body.classList.remove('c-modal-open');
}

// ------------------------------------------------------------------ actions (event delegation)
async function handleAction(el, e) {
    const a = el.dataset.action;
    try {
        switch (a) {
            case 'go': {
                const page = el.dataset.page; const filter = el.dataset.filter;
                if (filter) state.ingFilter.status = filter; else state.ingFilter.status = '';
                const link = $(`.nav-links a[data-page="${page}"]`); if (link) link.click(); else showCostingPage(page);
                break;
            }
            case 'open-ingredient': e.preventDefault(); await openIngredientModal(el.dataset.id); break;
            case 'new-ingredient': await openIngredientModal(null); break;
            case 'open-recipe': e.preventDefault(); openRecipeModal(el.dataset.id); break;
            case 'new-recipe': openRecipeModal(null); break;
            case 'close-modal': closeModal(); break;
            case 'resolve-flag': await resolveFlag(el.dataset.type, el.dataset.id, el.dataset.text); break;
            case 'add-source': {
                const { ing } = readIngredientForm(modalCtx);
                ing.sources.push({ id: 's-' + uid(5), brand: '', store: '', packageQty: null, packageUnit: 'lb', productUrl: '', preferred: !ing.sources.length, active: true, currentPrice: null, currentPriceDate: null });
                modalCtx.ing = ing; await reopenIngredient(); break;
            }
            case 'remove-source': {
                const { ing } = readIngredientForm(modalCtx);
                ing.sources.splice(Number(el.dataset.idx), 1);
                if (!ing.sources.some(s => s.preferred) && ing.sources[0]) ing.sources[0].preferred = true;
                modalCtx.ing = ing; await reopenIngredient(); break;
            }
            case 'save-ingredient': {
                const { ing, newPrices } = readIngredientForm(modalCtx);
                if (!ing.name) { toast('Give it a name first', 'err'); return; }
                if (ing.baseUnit === 'g' && !ing.gramsPerCup) { const sug = U.suggestGramsPerCup(ing.name); if (sug) ing.gramsPerCup = sug; }
                const id = await saveIngredient(ing);
                if (newPrices.length) {
                    // make sure state has the saved doc before recording prices
                    state.ingredients.set(id, { ...ing, id });
                    await recordPrices(newPrices.map(p => ({ ...p, ingredientId: id })));
                }
                closeModal(); toast('Saved ' + ing.name); break;
            }
            case 'delete-ingredient': {
                const ing = modalCtx.existing; if (!ing) return;
                if (!confirm(`Delete "${ing.name}" and its price history? This cannot be undone.`)) return;
                await deleteIngredient(ing.id); closeModal(); toast('Deleted'); break;
            }
            case 'save-trip': el.disabled = true; await saveTrip(); rerender(); break;
            case 'add-line': readRecipeForm(); modalCtx.rec.lines.push({ text: '', qty: 1, unit: 'cup', note: '' }); renderLines(); break;
            case 'remove-line': readRecipeForm(); modalCtx.rec.lines.splice(Number(el.dataset.idx), 1); renderLines(); break;
            case 'toggle-paste': $('#r-paste').classList.toggle('hidden'); break;
            case 'parse-paste': {
                readRecipeForm();
                const n = addParsedLines($('#r-paste-text').value);
                $('#r-paste-text').value = ''; $('#r-paste').classList.add('hidden');
                renderLines(); toast(`Added ${n} line${n === 1 ? '' : 's'}; check the matches`); break;
            }
            case 'save-recipe': {
                readRecipeForm();
                const rec = modalCtx.rec;
                if (!rec.name) { toast('Give it a name first', 'err'); return; }
                rec.lines = rec.lines.filter(l => l.qty != null || l.ingredientId || l.recipeId);
                await saveRecipe(rec); closeModal(); toast('Saved ' + rec.name); break;
            }
            case 'delete-recipe': {
                const r = modalCtx.existing; if (!r) return;
                if (!confirm(`Delete "${r.name}"? This cannot be undone.`)) return;
                await deleteRecipe(r.id); closeModal(); toast('Deleted'); break;
            }
            case 'save-settings': {
                const stale = U.num($('#s-stale').value) || 60;
                const waste = U.num($('#s-waste').value) ?? 5;
                const stores = $('#s-stores').value.split(',').map(s => s.trim()).filter(Boolean);
                await saveSettings({ staleDaysDefault: stale, wasteAllowancePct: waste, stores }); toast('Defaults saved'); break;
            }
            case 'import-seed': {
                if (!confirm('Load the starter data from the sheet? This only works while Costing is empty.')) return;
                el.disabled = true; el.textContent = 'Loading…';
                const r = await importSeed(); toast(`Loaded ${r.ingredients} items and ${r.recipes} recipes`);
                break;
            }
            case 'export-ingredients': exportIngredients(); break;
            case 'export-recipes': exportRecipes(); break;
            case 'export-history': el.disabled = true; await exportHistory(); el.disabled = false; break;
        }
    } catch (err) {
        console.error(err);
        toast(err.message || String(err), 'err');
        if (a === 'import-seed') { el.disabled = false; el.textContent = 'Load starter data'; }
    }
}
async function reopenIngredient() {
    // re-render the modal with the current draft (keeps unsaved edits)
    const ctx = modalCtx; const ing = ctx.ing;
    const stores = uniqueStores();
    const wrap = $('#f-sources');
    wrap.innerHTML = ing.sources.map((s, idx) => sourceCard(s, idx, ing, stores, ctx.history || [])).join('') || '<p class="c-muted">No sources yet. Add where you buy it.</p>';
}

document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    // ignore clicks on inputs inside rows that open modals
    if (['open-ingredient', 'open-recipe'].includes(el.dataset.action) && e.target.closest('input,select,button,a') && e.target !== el && !e.target.closest('a[data-action]')) return;
    handleAction(el, e);
});

// Sidebar links for costing pages (admin.js handles show/hide; we render)
document.addEventListener('DOMContentLoaded', () => {
    $$('.nav-links a[data-page^="costing-"]').forEach(a => a.addEventListener('click', () => showCostingPage(a.dataset.page)));
});
if (document.readyState !== 'loading') {
    $$('.nav-links a[data-page^="costing-"]').forEach(a => a.addEventListener('click', () => showCostingPage(a.dataset.page)));
}

onAuthStateChanged(auth, user => {
    state.user = user;
    if (user) subscribe(); else { unsubscribeAll(); state.loaded = { ingredients: false, recipes: false, settings: false }; }
    rerender();
});

// Expose a little for debugging in the console
window.BBBCosting = { state, U, version: COSTING_VERSION };
