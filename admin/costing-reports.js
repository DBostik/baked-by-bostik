// costing-reports.js
// Phase 3: Reports (price history charts, biggest movers, recipe and product cost over time), price-jump alerts
// on Costing Home, the Costing tile on the Analytics page, and the cost_snapshots collection that feeds the
// cost-over-time views. Registers page `costing-reports` and its actions through costing.js. Math is in
// costing-history.js (pure, unit tested); charts use Chart.js, which admin/index.html already loads.
import {
    state, $, $$, esc, toast, registerPage, registerAction, registerExtension, byName, fmtDate, todayISO,
    pricingCtx, pricingSettings, showCostingPage, rerender, db, saveSettings, loadPriceHistory, ingredientStatus, marginRows, closeModal
} from './costing.js';
import { collection, doc, setDoc, query, orderBy, limit, onSnapshot, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import * as U from './costing-units.js';
import * as H from './costing-history.js';

const MOVER_DAYS = 30;          // "biggest movers" and price-jump alerts look back this far
const DISMISS_KEEP_DAYS = 90;   // dismissed alert keys older than this are dropped from settings
const SNAPSHOT_MAX_AGE_DAYS = 7; // opening Home or Reports writes a fresh snapshot when the newest is older than this
const DEFAULT_ALERTS = { priceJumpPct: 10, dismissed: [] };

const R = {
    snapshots: [], snapsLoaded: false, unsub: null, unsubUser: null,
    history: new Map(), historyLoaded: false, historyPromise: null,
    charts: {}, touchedThisSession: false,
    view: { ingredientId: '', kind: 'recipes', key: '', months: 6, showDismissed: false },
};

// ------------------------------------------------------------------ settings helpers
export function alertSettings() { return { ...DEFAULT_ALERTS, ...(state.settings.alerts || {}) }; }
function sinceIso() { return H.addDays(todayISO(), -MOVER_DAYS); }

// ------------------------------------------------------------------ data: price history cache
async function ensureHistory(force = false) {
    if (R.historyLoaded && !force) return R.history;
    if (R.historyPromise && !force) return R.historyPromise;
    R.historyPromise = (async () => {
        const ids = [...state.ingredients.keys()];
        const map = new Map();
        await Promise.all(ids.map(async id => { try { map.set(id, await loadPriceHistory(id)); } catch (e) { console.error('history', id, e); map.set(id, []); } }));
        R.history = map; R.historyLoaded = true; R.historyPromise = null;
        return map;
    })();
    return R.historyPromise;
}
async function reloadHistoryFor(ids) {
    if (!R.historyLoaded) return;
    await Promise.all(ids.map(async id => { try { R.history.set(id, await loadPriceHistory(id)); } catch (e) { console.error(e); } }));
}

// ------------------------------------------------------------------ data: cost snapshots
function subscribeSnapshots() {
    if (R.unsub) return;
    R.unsub = onSnapshot(query(collection(db, 'cost_snapshots'), orderBy('date', 'asc'), limit(600)), snap => {
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        R.snapshots = list.sort((a, b) => a.date.localeCompare(b.date));
        R.snapsLoaded = true;
        R.unsubUser = state.user;
        if (state.page === 'costing-reports' || state.page === 'costing-settings') rerender();
        else if (state.page === 'costing-home') ensureFreshSnapshot();
    }, err => { console.error('cost_snapshots', err); R.snapsLoaded = true; });
}
function unsubscribeSnapshots() { if (R.unsub) { try { R.unsub(); } catch (e) { } R.unsub = null; R.snapshots = []; R.snapsLoaded = false; } }
function latestSnapshot() { return R.snapshots.length ? R.snapshots[R.snapshots.length - 1] : null; }
function liveSnapshot(trigger = 'live') { return H.buildSnapshot(pricingCtx(), pricingSettings(), todayISO(), { trigger }); }

async function writeTodaySnapshot(trigger) {
    if (!state.user || !state.loaded.ingredients || !state.loaded.recipes) return null;
    const snap = liveSnapshot(trigger);
    await setDoc(doc(db, 'cost_snapshots', snap.date), { ...snap, at: serverTimestamp() });
    return snap;
}
// Called when Home or Reports opens: make sure there is a recent snapshot so the cost charts keep moving
function ensureFreshSnapshot() {
    if (!R.snapsLoaded || R.touchedThisSession || !state.user) return;
    const last = latestSnapshot();
    if (last && last.date >= H.addDays(todayISO(), -SNAPSHOT_MAX_AGE_DAYS)) return;
    if (!state.ingredients.size) return;
    R.touchedThisSession = true;
    writeTodaySnapshot('open').catch(e => console.error('snapshot', e));
}

// Rebuild monthly history from the price history (Dave's call: reconstructed points, labeled as such)
async function rebuildHistory(el) {
    const hist = await ensureHistory(true);
    let earliest = null;
    hist.forEach(list => list.forEach(e => { if (e.date && (!earliest || e.date < earliest)) earliest = e.date; }));
    if (!earliest) throw new Error('No price history yet');
    const today = todayISO();
    const dates = H.monthEnds(earliest, H.addDays(today, -1));
    const keep = new Set(R.snapshots.filter(s => !s.reconstructed).map(s => s.date));
    const settings = pricingSettings();
    let batch = writeBatch(db), n = 0, written = 0;
    for (const date of dates) {
        if (keep.has(date)) continue; // a real snapshot exists for that day; leave it
        const ings = H.ingredientsAsOf(state.ingredients, hist, date, { carryBack: true });
        const snap = H.buildSnapshot({ ingredients: ings, recipes: state.recipes, products: state.products }, settings, date, { trigger: 'backfill', reconstructed: true });
        batch.set(doc(db, 'cost_snapshots', date), { ...snap, at: serverTimestamp() }); n++; written++;
        if (n >= 200) { await batch.commit(); batch = writeBatch(db); n = 0; }
    }
    const live = liveSnapshot('rebuild');
    batch.set(doc(db, 'cost_snapshots', live.date), { ...live, at: serverTimestamp() }); n++;
    await batch.commit();
    return { written, from: earliest, months: dates.length };
}

// ------------------------------------------------------------------ charts
const PALETTE = ['#1a2a3a', '#b3324e', '#3f7a47', '#a56b14', '#5b6bd6', '#0e7c86', '#8b5cf6', '#c2410c'];
function primaryColor() { try { return getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || PALETTE[0]; } catch (e) { return PALETTE[0]; } }
function makeChart(id, config) {
    const canvas = $('#' + id);
    if (!canvas) return null;
    if (!window.Chart) { const p = canvas.parentElement; if (p) p.innerHTML = '<p class="c-muted c-small">Charts did not load (Chart.js is blocked or offline). The tables below still work.</p>'; return null; }
    if (R.charts[id]) { try { R.charts[id].destroy(); } catch (e) { } }
    R.charts[id] = new window.Chart(canvas, config);
    return R.charts[id];
}
function moneyAxis(prefix = '$', digits = 2) { return { ticks: { callback: v => prefix + Number(v).toFixed(digits) }, beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }; }
function shortDate(iso) { const d = U.toDate(iso); return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : iso; }
function pctBadge(pct) {
    if (pct == null) return '<span class="c-muted">—</span>';
    const cls = pct > 0 ? 'c-badge-up' : pct < 0 ? 'c-badge-down' : 'c-badge-flat';
    return `<span class="c-badge ${cls}">${pct > 0 ? '+' : ''}${pct}%</span>`;
}
function unitScale(baseUnit) { return baseUnit === 'each' ? 1 : 100; }
function unitWord(baseUnit) { return baseUnit === 'each' ? 'each' : `per 100 ${baseUnit}`; }

// ------------------------------------------------------------------ REPORTS page
function ingredientOptions(selected) {
    const list = [...state.ingredients.values()].sort(byName);
    const group = (kind, label) => { const items = list.filter(i => (i.kind || 'ingredient') === kind); return items.length ? `<optgroup label="${label}">${items.map(i => `<option value="${esc(i.id)}" ${i.id === selected ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}</optgroup>` : ''; };
    return group('ingredient', 'Ingredients') + group('supply', 'Supplies');
}
function defaultIngredientId() {
    if (R.view.ingredientId && state.ingredients.has(R.view.ingredientId)) return R.view.ingredientId;
    // the ingredient whose single source has the longest history, so the first chart is not a single dot
    let best = null, bestN = -1;
    state.ingredients.forEach(i => {
        const perSource = {}; (R.history.get(i.id) || []).forEach(e => { perSource[e.sourceId] = (perSource[e.sourceId] || 0) + 1; });
        const n = Math.max(0, ...Object.values(perSource)) + ((i.kind || 'ingredient') === 'ingredient' ? 0.5 : 0);
        if (n > bestN || (n === bestN && best && byName(i, best) < 0)) { best = i; bestN = n; }
    });
    return best ? best.id : '';
}
function productKeys() {
    const out = [];
    [...state.products.values()].filter(p => p.active !== false).sort(byName).forEach(p => {
        const opts = p.family === 'cake' ? (p.sizes || []) : (p.tiers || []);
        opts.forEach(o => out.push({ key: `${p.id}|${o.id}`, label: `${p.name} · ${o.label || o.id}` }));
    });
    return out;
}
function costKeys(kind) {
    if (kind === 'products') return productKeys();
    return [...state.recipes.values()].sort(byName).map(r => ({ key: r.id, label: r.name }));
}

function renderReports(body) {
    ensureFreshSnapshot();
    const v = R.view;
    if (!state.ingredients.size) { body.innerHTML = '<div class="c-card c-empty"><h3>Nothing to report yet</h3><p>Load the starter data from Costing Settings first. Reports fill in as prices are logged.</p></div>'; return; }
    const keys = costKeys(v.kind);
    if (!keys.some(k => k.key === v.key)) v.key = keys[0]?.key || '';
    body.innerHTML = `
    <div class="c-card" id="rp-history">
      <div class="c-card-head"><h3>Price history</h3><span class="c-muted c-small">cost per unit, one line per source</span></div>
      <div class="c-toolbar"><select class="c-input" id="rp-ing">${ingredientOptions(v.ingredientId)}</select></div>
      <div class="c-chart"><canvas id="rp-price-chart"></canvas></div>
      <div id="rp-price-table"><p class="c-muted c-small">Loading price history…</p></div>
    </div>
    <div class="c-two-col">
      <div class="c-card" id="rp-movers">
        <div class="c-card-head"><h3>Biggest movers</h3><span class="c-muted c-small">last ${MOVER_DAYS} days</span></div>
        <div id="rp-movers-body"><p class="c-muted c-small">Loading…</p></div>
      </div>
      <div class="c-card" id="rp-jumps">
        <div class="c-card-head"><h3>Price jumps</h3><span class="c-muted c-small">moves over ${esc(alertSettings().priceJumpPct)}%, last ${MOVER_DAYS} days</span></div>
        <div id="rp-jumps-body"><p class="c-muted c-small">Loading…</p></div>
      </div>
    </div>
    <div class="c-card" id="rp-cost">
      <div class="c-card-head"><h3>Cost over time</h3><span class="c-muted c-small">${R.snapshots.length} snapshot${R.snapshots.length === 1 ? '' : 's'} on file${latestSnapshot() ? ', newest ' + esc(fmtDate(latestSnapshot().date)) : ''}</span></div>
      <div class="c-toolbar">
        <select class="c-input" id="rp-kind"><option value="recipes" ${v.kind === 'recipes' ? 'selected' : ''}>Recipes (batch cost)</option><option value="products" ${v.kind === 'products' ? 'selected' : ''}>Products (cost basis, standard version)</option></select>
        <select class="c-input" id="rp-key">${keys.map(k => `<option value="${esc(k.key)}" ${k.key === v.key ? 'selected' : ''}>${esc(k.label)}</option>`).join('')}</select>
        <div class="c-range">${[3, 6, 12].map(m => `<button class="btn-secondary btn-sm ${v.months === m ? 'active' : ''}" data-action="report-range" data-months="${m}">${m} mo</button>`).join('')}</div>
      </div>
      <div class="c-chart"><canvas id="rp-cost-chart"></canvas></div>
      <p class="c-muted c-small" id="rp-cost-note"></p>
      <div id="rp-change-table"></div>
    </div>`;
    $('#rp-ing', body).addEventListener('change', e => { v.ingredientId = e.target.value; fillPriceHistory(); });
    $('#rp-kind', body).addEventListener('change', e => { v.kind = e.target.value; v.key = ''; renderReports(body); });
    $('#rp-key', body).addEventListener('change', e => { v.key = e.target.value; fillCost(); });
    fillCost();
    ensureHistory().then(() => { if (!$('#rp-history')) return; if (!v.ingredientId) v.ingredientId = defaultIngredientId(); const sel = $('#rp-ing'); if (sel) sel.value = v.ingredientId; fillPriceHistory(); fillMovers(); fillJumps(); });
}

function fillPriceHistory() {
    const ing = state.ingredients.get(R.view.ingredientId);
    const host = $('#rp-price-table'); if (!host || !ing) return;
    const lines = H.unitCostSeries(ing, R.history.get(ing.id) || []);
    const scale = unitScale(ing.baseUnit);
    const dates = [...new Set(lines.flatMap(l => l.points.map(p => p.date)))].sort();
    const datasets = lines.map((l, k) => ({
        label: [l.source.brand, l.source.store].filter(Boolean).join(' · ') || l.source.id,
        data: dates.map(d => { const p = l.points.filter(x => x.date === d).pop(); return p && p.unitCost != null ? U.round2(p.unitCost * scale) : null; }),
        borderColor: PALETTE[k % PALETTE.length], backgroundColor: PALETTE[k % PALETTE.length], spanGaps: true, tension: 0.15, pointRadius: 4, borderWidth: 2,
    }));
    makeChart('rp-price-chart', {
        type: 'line', data: { labels: dates.map(shortDate), datasets },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: datasets.length > 1 }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${U.fmtMoney(c.parsed.y)} ${unitWord(ing.baseUnit)}` } } }, scales: { y: { ...moneyAxis(), title: { display: true, text: `Cost ${unitWord(ing.baseUnit)}` } } } }
    });
    const rows = lines.flatMap(l => l.points.map(p => ({ ...p, source: l.source }))).sort((a, b) => b.date.localeCompare(a.date));
    host.innerHTML = rows.length ? `<div class="c-table-wrap"><table class="c-table c-table-sm"><thead><tr><th>Date</th><th>Source</th><th class="num">Package price</th><th class="num">${esc(unitWord(ing.baseUnit))}</th><th class="num">Bought</th><th>How</th><th>Note</th></tr></thead><tbody>
        ${rows.map(p => `<tr><td>${esc(fmtDate(p.date))}</td><td>${esc([p.source.brand, p.source.store].filter(Boolean).join(' · '))}</td><td class="num">${U.fmtMoney(p.price)}</td><td class="num">${p.unitCost == null ? '—' : U.fmtMoney(p.unitCost * scale)}</td><td class="num">${p.qty != null ? esc(U.fmtQty(p.qty)) : ''}</td><td>${esc(p.method)}</td><td class="c-muted">${esc(p.note)}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="c-muted c-small">No price entries for this item yet.</p>';
}

function usedInText(ingredientId) {
    const recs = H.recipesUsing(ingredientId, state.recipes);
    if (!recs.length) return '';
    const names = recs.map(r => r.name);
    return names.length <= 3 ? names.join(', ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}
function moverRowsHtml(list, opts = {}) {
    return list.map(m => `<tr>
        <td><a href="#" data-action="open-ingredient" data-id="${esc(m.ingredientId)}"><strong>${esc(m.name)}</strong></a>${m.preferred ? '' : ' <span class="c-muted c-small">(not preferred)</span>'}<br><span class="c-muted c-small">${esc(m.source)}${opts.usedIn ? (usedInText(m.ingredientId) ? ' · used in ' + esc(usedInText(m.ingredientId)) : '') : ''}</span></td>
        <td class="num">${U.fmtMoney(m.before)}<br><span class="c-muted c-small">${esc(fmtDate(m.beforeDate))}</span></td>
        <td class="num">${U.fmtMoney(m.after)}<br><span class="c-muted c-small">${esc(fmtDate(m.afterDate))}</span></td>
        <td class="num">${pctBadge(m.pct)}</td></tr>`).join('');
}
function fillMovers() {
    const host = $('#rp-movers-body'); if (!host) return;
    const list = H.movers(state.ingredients, R.history, sinceIso());
    host.innerHTML = list.length ? `<div class="c-table-wrap"><table class="c-table c-table-sm"><thead><tr><th>Item</th><th class="num">${MOVER_DAYS} days ago</th><th class="num">Now</th><th class="num">Change</th></tr></thead><tbody>${moverRowsHtml(list.slice(0, 25), { usedIn: true })}</tbody></table></div>`
        : `<p class="c-muted c-small">No price has changed in the last ${MOVER_DAYS} days. Log a shopping trip and the movers show up here.</p>`;
}
function jumpsList(showDismissed) {
    const a = alertSettings();
    const all = H.priceJumps(state.ingredients, R.history, { thresholdPct: a.priceJumpPct, sinceIso: sinceIso(), dismissed: a.dismissed });
    return { all, open: all.filter(j => !j.dismissed), dismissedCount: all.filter(j => j.dismissed).length, shown: showDismissed ? all : all.filter(j => !j.dismissed) };
}
function jumpRowHtml(j) {
    return `<div class="c-flag c-jump ${j.dismissed ? 'c-jump-dismissed' : ''}">
        <div class="c-flag-text"><a href="#" data-action="open-ingredient" data-id="${esc(j.ingredientId)}">${esc(j.name)}</a>
            <span>${j.pct > 0 ? 'Up' : 'Down'} ${esc(Math.abs(j.pct))}% at ${esc(j.source)}: ${U.fmtMoney(j.prev)} on ${esc(fmtDate(j.prevDate))} to ${U.fmtMoney(j.price)} on ${esc(fmtDate(j.date))}${j.preferred ? '' : ' (not the preferred source)'}${usedInText(j.ingredientId) ? '. Used in ' + esc(usedInText(j.ingredientId)) : ''}</span></div>
        ${j.dismissed ? '<span class="c-badge c-badge-kind">dismissed</span>' : `<button class="btn-secondary btn-sm" data-action="dismiss-jump" data-key="${esc(j.key)}">Dismiss</button>`}
    </div>`;
}
function fillJumps() {
    const host = $('#rp-jumps-body'); if (!host) return;
    const { shown, open, dismissedCount } = jumpsList(R.view.showDismissed);
    host.innerHTML = (shown.length ? shown.map(jumpRowHtml).join('') : `<p class="c-muted c-small">No price moved more than ${esc(alertSettings().priceJumpPct)}% in the last ${MOVER_DAYS} days${dismissedCount ? ' that you have not dismissed' : ''}.</p>`)
        + (dismissedCount ? `<p class="c-small" style="margin-top:.6rem"><a href="#" data-action="toggle-dismissed">${R.view.showDismissed ? 'Hide' : 'Show'} ${dismissedCount} dismissed</a></p>` : '')
        + `<p class="c-muted c-small" style="margin-top:.6rem">Threshold is set in Costing Settings. ${open.length} open.</p>`;
}

function fillCost() {
    const v = R.view;
    const host = $('#rp-change-table'); if (!host) return;
    const from = H.addMonths(todayISO(), -v.months);
    const current = liveSnapshot();
    const pts = H.series(R.snapshots, v.kind, v.key, from);
    // add today's live value as the last point when the newest snapshot is not today
    const liveVal = v.kind === 'recipes' ? (current.recipes[v.key]?.ok ? current.recipes[v.key].total : null) : (current.products[v.key]?.ok ? current.products[v.key].costBasis : null);
    if (liveVal != null && (!pts.length || pts[pts.length - 1].date !== todayISO())) pts.push({ date: todayISO(), value: liveVal, reconstructed: false, live: true });
    const recon = pts.filter(p => p.reconstructed).length;
    const note = $('#rp-cost-note');
    const label = costKeys(v.kind).find(k => k.key === v.key)?.label || '';
    if (note) note.textContent = !R.snapsLoaded ? 'Loading snapshots…' : pts.length < 2 ? `Only ${pts.length} point${pts.length === 1 ? '' : 's'} in the last ${v.months} months. Snapshots are saved whenever prices change; use "Rebuild cost history" in Costing Settings to fill in the past from the price history.` : `${pts.length} points in the last ${v.months} months${recon ? `, ${recon} reconstructed from price history (dashed)` : ''}. Products use the standard version at each date; recipes use today's ingredient lists.`;
    makeChart('rp-cost-chart', {
        type: 'line',
        data: { labels: pts.map(p => shortDate(p.date)), datasets: [{ label, data: pts.map(p => p.value), borderColor: primaryColor(), backgroundColor: primaryColor(), tension: 0.15, borderWidth: 2, pointRadius: pts.map(p => p.reconstructed ? 3 : 4), pointStyle: pts.map(p => p.reconstructed ? 'triangle' : 'circle'), segment: { borderDash: c => (pts[c.p1DataIndex]?.reconstructed ? [5, 5] : undefined) } }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${U.fmtMoney(c.parsed.y)}${pts[c.dataIndex]?.reconstructed ? ' (reconstructed)' : ''}` } } }, scales: { y: { ...moneyAxis(), title: { display: true, text: v.kind === 'recipes' ? 'Batch cost' : 'Cost basis' } } } }
    });
    const rows = H.changeTable(R.snapshots, current, v.kind, todayISO());
    const cell = (a) => a.value == null ? '<span class="c-muted">—</span>' : `${U.fmtMoney(a.value)} ${pctBadge(a.pct)}${a.reconstructed ? '<span class="c-muted c-small" title="reconstructed from price history"> ~</span>' : ''}`;
    host.innerHTML = `<div class="c-table-wrap"><table class="c-table c-table-sm"><thead><tr><th>${v.kind === 'recipes' ? 'Recipe' : 'Product'}</th><th class="num">Now</th><th class="num">3 months ago</th><th class="num">6 months ago</th><th class="num">12 months ago</th></tr></thead><tbody>
        ${rows.map(r => `<tr class="${r.key === v.key ? 'c-row-active' : ''}" data-action="report-pick" data-key="${esc(r.key)}"><td><strong>${esc(r.name)}</strong>${r.label && v.kind === 'products' ? ` · ${esc(r.label)}` : ''}</td><td class="num">${r.now == null ? '<span class="c-badge c-badge-warn">incomplete</span>' : U.fmtMoney(r.now)}</td><td class="num">${cell(r.ago[3])}</td><td class="num">${cell(r.ago[6])}</td><td class="num">${cell(r.ago[12])}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="c-muted c-small">Change is against the nearest snapshot on or before that date. "~" marks a reconstructed point. Click a row to chart it.</p>`;
}

// ------------------------------------------------------------------ Costing Home: price-jump alerts
function homeAlertsHtml() {
    if (!state.ingredients.size) return '';
    return `<div class="c-card" id="c-home-jumps"><div class="c-card-head"><h3>Price jumps</h3><span class="c-muted c-small">over ${esc(alertSettings().priceJumpPct)}%, last ${MOVER_DAYS} days</span></div><p class="c-muted c-small">Loading price history…</p></div>`;
}
function fillHomeAlerts() {
    const host = $('#c-home-jumps'); if (!host) return;
    const { open, dismissedCount } = jumpsList(false);
    const movers = H.movers(state.ingredients, R.history, sinceIso()).filter(m => m.preferred).slice(0, 5);
    const moverLine = movers.length ? `<p class="c-small" style="margin:.6rem 0 0">Biggest movers: ${movers.map(m => `<a href="#" data-action="open-ingredient" data-id="${esc(m.ingredientId)}">${esc(m.name)}</a> ${pctBadge(m.pct)}`).join(', ')}. <a href="#" data-action="go" data-page="costing-reports">Reports</a></p>` : `<p class="c-muted c-small" style="margin:.6rem 0 0">No preferred-source price has moved in the last ${MOVER_DAYS} days. <a href="#" data-action="go" data-page="costing-reports">Reports</a></p>`;
    host.innerHTML = `<div class="c-card-head"><h3>Price jumps</h3><span class="c-muted c-small">${open.length} open${dismissedCount ? `, ${dismissedCount} dismissed` : ''}</span></div>`
        + (open.length ? open.slice(0, 8).map(jumpRowHtml).join('') + (open.length > 8 ? `<p class="c-small"><a href="#" data-action="go" data-page="costing-reports">See all ${open.length} in Reports</a></p>` : '') : `<p class="c-muted c-small">No price moved more than ${esc(alertSettings().priceJumpPct)}% in the last ${MOVER_DAYS} days.</p>`)
        + moverLine;
}

// ------------------------------------------------------------------ Costing Settings: alerts and history card
function settingsHtml() {
    const a = alertSettings();
    const last = latestSnapshot();
    const recon = R.snapshots.filter(s => s.reconstructed).length;
    return `<div class="c-card" id="c-settings-alerts">
        <h3>Alerts and cost history</h3>
        <div class="c-form-grid">
          <label>Flag a price move over (%) <span class="c-hint">shows on Costing Home and the Analytics tile</span><input class="c-input" id="a-jump" type="number" min="0" step="1" value="${esc(a.priceJumpPct)}"></label>
        </div>
        <button class="btn-primary btn-sm" data-action="save-alerts">Save alerts</button>
        <hr class="c-hr">
        <p class="c-small">Cost snapshots feed the "cost over time" charts in Reports. One is saved automatically whenever a price is logged or edited, and when Home or Reports opens after a quiet week. ${R.snapsLoaded ? `${R.snapshots.length} on file${last ? `, newest ${esc(fmtDate(last.date))}` : ''}${recon ? `, ${recon} reconstructed` : ''}.` : 'Loading…'}</p>
        <p class="c-small">Rebuild fills in one point per month back to the first price on record, using today's recipes and products with the prices that were current then (prices before their first record are assumed unchanged). Safe to run again; it never replaces a real snapshot.</p>
        <button class="btn-secondary btn-sm" data-action="rebuild-history">Rebuild cost history</button>
    </div>`;
}

// ------------------------------------------------------------------ Analytics page tile
function analyticsTile(loadHistory = false) {
    const host = $('#costing-analytics-tile'); if (!host) return;
    if (!state.user || !state.loaded.ingredients) { host.innerHTML = '<h3 style="margin-top:0;color:#374151;font-size:1.1rem;">Costing</h3><p class="c-muted c-small">Sign in to see costing alerts.</p>'; return; }
    const ings = [...state.ingredients.values()];
    const stale = ings.filter(i => ingredientStatus(i).code === 'stale').length;
    const rows = state.products.size ? marginRows() : [];
    const under = rows.filter(r => r.est.totals.belowAlert).length;
    let jumps = null;
    if (R.historyLoaded) jumps = jumpsList(false).open.length;
    else if (loadHistory && ings.length) ensureHistory().then(() => analyticsTile(false));
    const pill = (label, value, page, filter) => `<div class="c-pill" data-action="go" data-page="${page}" ${filter ? `data-filter="${filter}"` : ''}><span class="c-pill-value">${value}</span><span class="c-pill-label">${label}</span></div>`;
    host.innerHTML = `<h3 style="margin-top:0;color:#374151;font-size:1.1rem;">Costing</h3>
        <div class="c-pills">
          ${pill('Proposals waiting', '0', 'costing-home')}
          ${pill('Stale prices', stale, 'costing-ingredients', 'stale')}
          ${pill('Under margin', rows.length ? `${under} of ${rows.length}` : '—', 'costing-home')}
          ${pill('Price jumps', jumps == null ? '…' : jumps, 'costing-reports')}
        </div>
        <p class="c-muted c-small" style="margin:.75rem 0 0">Proposals arrive with the price bot in Phase 4. Click a number to open that screen.</p>`;
}
function analyticsVisible() { const p = $('#page-analytics'); return p && !p.classList.contains('hidden'); }

// ------------------------------------------------------------------ registration
registerPage('costing-reports', renderReports);
registerExtension('home', () => { setTimeout(() => ensureHistory().then(fillHomeAlerts), 0); ensureFreshSnapshot(); return homeAlertsHtml(); });
registerExtension('settings', () => settingsHtml());
registerExtension('afterPrices', (entries, touched) => {
    (async () => {
        try {
            await reloadHistoryFor(touched);
            await writeTodaySnapshot('prices');
            if (state.page === 'costing-home' || state.page === 'costing-reports') rerender();
            analyticsTile(false);
        } catch (e) { console.error('afterPrices', e); }
    })();
});
registerExtension('dataChanged', () => {
    if (state.user && !R.unsub) subscribeSnapshots();
    if (!state.user && R.unsub) { unsubscribeSnapshots(); R.history = new Map(); R.historyLoaded = false; R.touchedThisSession = false; }
    analyticsTile(analyticsVisible());
});
document.addEventListener('DOMContentLoaded', () => { const a = $('.nav-links a[data-page="analytics"]'); if (a) a.addEventListener('click', () => setTimeout(() => analyticsTile(true), 50)); });
if (document.readyState !== 'loading') { const a = $('.nav-links a[data-page="analytics"]'); if (a) a.addEventListener('click', () => setTimeout(() => analyticsTile(true), 50)); }

registerAction('report-range', el => { R.view.months = Number(el.dataset.months) || 6; $$('#rp-cost .c-range button').forEach(b => b.classList.toggle('active', b === el)); fillCost(); });
registerAction('report-pick', el => { R.view.key = el.dataset.key; const sel = $('#rp-key'); if (sel) sel.value = R.view.key; fillCost(); });
registerAction('report-ingredient', (el, e) => { e.preventDefault(); R.view.ingredientId = el.dataset.id; closeModal(); const link = $('.nav-links a[data-page="costing-reports"]'); if (link) link.click(); else showCostingPage('costing-reports'); });
registerAction('toggle-dismissed', (el, e) => { e.preventDefault(); R.view.showDismissed = !R.view.showDismissed; fillJumps(); });
registerAction('dismiss-jump', async el => {
    const a = alertSettings();
    const dismissed = H.pruneDismissed([...new Set([...(a.dismissed || []), el.dataset.key])], H.addDays(todayISO(), -DISMISS_KEEP_DAYS));
    state.settings.alerts = { ...a, dismissed }; // optimistic, so the row disappears now
    fillJumps(); fillHomeAlerts(); analyticsTile(false);
    await saveSettings({ alerts: { ...a, dismissed } });
    toast('Dismissed');
});
registerAction('save-alerts', async () => {
    const a = alertSettings();
    const pct = U.num($('#a-jump').value) ?? 10;
    await saveSettings({ alerts: { ...a, priceJumpPct: pct } });
    toast('Alerts saved');
});
registerAction('rebuild-history', async el => {
    if (!confirm('Rebuild the monthly cost history from the price history? Real snapshots are kept; reconstructed months are replaced.')) return;
    el.disabled = true; el.textContent = 'Rebuilding…';
    try {
        const r = await rebuildHistory(el);
        toast(`Rebuilt ${r.written} monthly snapshot${r.written === 1 ? '' : 's'} back to ${fmtDate(r.from)}`);
    } finally { el.disabled = false; el.textContent = 'Rebuild cost history'; }
});
