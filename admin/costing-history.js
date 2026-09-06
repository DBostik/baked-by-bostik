// costing-history.js
// Phase 3 (reports and alerts): pure functions with no DOM and no Firebase, so they run in Node for the unit tests.
//   - dates: addDays, addMonths, monthEnd, monthEnds
//   - price history: sortHistory, priceAsOf, ingredientsAsOf, unitCostSeries
//   - cost snapshots: buildSnapshot (one document per day in `cost_snapshots`), snapshotAsOf, series, changeTable
//   - alerts: movers (price now vs N days ago), priceJumps (entries that moved more than a threshold), jumpKey
import * as U from './costing-units.js';
import * as P from './costing-pricing.js';

// ------------------------------------------------------------------ dates (all YYYY-MM-DD strings, local time)
export function isoOf(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function addDays(iso, days) { const d = U.toDate(iso); d.setDate(d.getDate() + days); return isoOf(d); }
export function addMonths(iso, months) {
    const d = U.toDate(iso); const day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + months);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return isoOf(d);
}
export function monthEnd(iso) { const d = U.toDate(iso); return isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
// Last day of every month from the month of `fromIso` up to (not after) `toIso`
export function monthEnds(fromIso, toIso) {
    const out = [];
    let cur = monthEnd(fromIso);
    while (cur <= toIso) { out.push(cur); cur = monthEnd(addDays(cur, 1)); }
    return out;
}

// ------------------------------------------------------------------ price history
const get = (map, id) => (map instanceof Map ? map.get(id) : map?.[id]);
const values = (map) => (map instanceof Map ? [...map.values()] : Object.values(map || {}));
function tsOf(e) { const d = U.toDate(e?.createdAt); return d ? d.getTime() : 0; }

// Oldest first; same-day entries keep their creation order so the later entry wins as "current"
export function sortHistory(entries) {
    return (entries || []).slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || (tsOf(a) - tsOf(b)));
}

// Latest entry for a source dated on or before `iso`. With carryBack, a source whose first entry is after `iso`
// returns that first entry (used only for reconstructed history, where "price before the first record" is a guess).
export function priceAsOf(entries, sourceId, iso, opts = {}) {
    const list = sortHistory(entries).filter(e => e.sourceId === sourceId && U.num(e.price) != null);
    let found = null;
    for (const e of list) { if (e.date <= iso) found = e; else break; }
    if (!found && opts.carryBack && list.length) return { ...list[0], carriedBack: true };
    return found;
}

// A copy of the ingredients map with every source's current price set to what it was on `iso`.
// historyMap: Map(ingredientId -> price entries). Ingredients with no loaded history keep their current values.
export function ingredientsAsOf(ingredients, historyMap, iso, opts = {}) {
    const out = new Map();
    values(ingredients).forEach(i => {
        const hist = get(historyMap, i.id);
        if (!hist) { out.set(i.id, i); return; }
        const copy = { ...i, sources: (i.sources || []).map(s => {
            const e = priceAsOf(hist, s.id, iso, opts);
            if (!e && opts.carryBack && !hist.some(h => h.sourceId === s.id)) {
                // no history at all for this source: with carryBack, its current price stands in (a guess, flagged)
                return { ...s, carriedBack: U.num(s.currentPrice) != null };
            }
            return { ...s, currentPrice: e ? U.num(e.price) : null, currentPriceDate: e ? e.date : null, currentMethod: e ? e.method : null, carriedBack: !!e?.carriedBack };
        }) };
        out.set(i.id, copy);
    });
    return out;
}

// Cost per base unit over time for one ingredient, one line per source: [{source, points:[{date, price, unitCost, method, qty}]}]
export function unitCostSeries(ingredient, entries) {
    return (ingredient?.sources || []).map(s => {
        const points = sortHistory(entries).filter(e => e.sourceId === s.id && U.num(e.price) != null).map(e => {
            const src = { ...s, currentPrice: U.num(e.price) };
            if (U.num(e.packageQty) != null && e.packageUnit) { src.packageQty = U.num(e.packageQty); src.packageUnit = e.packageUnit; }
            const uc = U.sourceUnitCost(src, ingredient);
            return { date: e.date, price: U.num(e.price), unitCost: uc.ok ? uc.unitCost : null, method: e.method || '', qty: U.num(e.qty), note: e.note || '' };
        });
        return { source: s, points };
    }).filter(x => x.points.length);
}

// ------------------------------------------------------------------ cost snapshots
function r2(v) { return v == null || isNaN(v) ? null : U.round2(v); }
function r4(v) { return v == null || isNaN(v) ? null : Math.round(v * 10000) / 10000; }

// One snapshot of every cost the tool knows, for the day `iso`.
// ctx: {ingredients, recipes, products} (Maps or objects); settings: pricing settings (see pricingSettings()).
export function buildSnapshot(ctx, settings, iso, opts = {}) {
    const ingredients = ctx.ingredients instanceof Map ? ctx.ingredients : new Map(Object.entries(ctx.ingredients || {}).map(([id, v]) => [id, { id, ...v }]));
    const recipes = ctx.recipes instanceof Map ? ctx.recipes : new Map(Object.entries(ctx.recipes || {}).map(([id, v]) => [id, { id, ...v }]));
    const products = ctx.products instanceof Map ? ctx.products : new Map(Object.entries(ctx.products || {}).map(([id, v]) => [id, { id, ...v }]));
    const snap = { date: iso, trigger: opts.trigger || 'prices', reconstructed: !!opts.reconstructed, recipes: {}, products: {}, ingredients: {}, counts: { recipes: 0, products: 0, ingredients: 0 } };
    recipes.forEach(r => {
        const c = U.costRecipe(r, ingredients, recipes);
        const per = U.perUnitCosts(r, c);
        snap.recipes[r.id] = { name: r.name || '', category: r.category || '', total: r2(c.total), ok: !!c.ok && (r.lines || []).length > 0, perCount: r4(per.perCount), countLabel: per.countLabel || null, perCup: r4(per.perCup), perGram: per.perGram == null ? null : Math.round(per.perGram * 1e6) / 1e6 };
        snap.counts.recipes++;
    });
    const pctx = { ingredients, recipes, products };
    products.forEach(p => {
        if (p.active === false) return;
        const opts2 = p.family === 'cake' ? (p.sizes || []) : (p.tiers || []);
        opts2.forEach(o => {
            const est = P.priceEstimate({ items: [P.standardItemFor(p, o.id)] }, pctx, settings);
            const t = est.totals;
            snap.products[`${p.id}|${o.id}`] = { name: p.name || '', label: o.label || o.id, family: p.family || '', costBasis: r2(t.costBasis), materials: r2(t.materials), labor: r2(t.labor), suggested: r2(t.suggested), menu: r2(t.menu), marginPct: t.marginPct, ok: !!est.ok };
            snap.counts.products++;
        });
    });
    ingredients.forEach(i => {
        const uc = U.ingredientUnitCost(i);
        const s = uc.source;
        snap.ingredients[i.id] = { name: i.name || '', kind: i.kind || 'ingredient', baseUnit: i.baseUnit || 'g', unitCost: uc.ok ? Math.round(uc.unitCost * 1e6) / 1e6 : null, price: s ? U.num(s.currentPrice) : null, priceDate: s?.currentPriceDate || null, sourceId: s?.id || null, carriedBack: !!s?.carriedBack };
        snap.counts.ingredients++;
    });
    return snap;
}

// Latest snapshot dated on or before `iso` (snapshots: array, any order)
export function snapshotAsOf(snapshots, iso) {
    let best = null;
    for (const s of snapshots || []) { if (s.date <= iso && (!best || s.date > best.date)) best = s; }
    return best;
}
function valueOf(snap, kind, key) {
    const e = snap?.[kind]?.[key];
    if (!e) return null;
    if (kind === 'recipes') return e.ok ? e.total : null;
    if (kind === 'products') return e.ok ? e.costBasis : null;
    return e.unitCost;
}
// Points for a chart: [{date, value, reconstructed}] for one recipe / product size / ingredient, from `fromIso` on
export function series(snapshots, kind, key, fromIso) {
    return (snapshots || []).filter(s => !fromIso || s.date >= fromIso).slice().sort((a, b) => a.date.localeCompare(b.date))
        .map(s => ({ date: s.date, value: valueOf(s, kind, key), reconstructed: !!s.reconstructed }))
        .filter(p => p.value != null);
}
// Every item of `kind` with its value now (from `current`, a snapshot built from live data) and 3/6/12 months ago
export function changeTable(snapshots, current, kind, todayIso, months = [3, 6, 12]) {
    const rows = [];
    Object.entries(current?.[kind] || {}).forEach(([key, e]) => {
        const now = valueOf(current, kind, key);
        const row = { key, name: e.name, label: e.label || e.countLabel || '', family: e.family || e.category || e.kind || '', now, ago: {} };
        months.forEach(m => {
            const target = addMonths(todayIso, -m);
            const s = snapshotAsOf(snapshots, target);
            const v = s ? valueOf(s, kind, key) : null;
            row.ago[m] = { value: v, date: s ? s.date : null, pct: (v != null && now != null && v > 0) ? Math.round((now - v) / v * 1000) / 10 : null, reconstructed: !!s?.reconstructed };
        });
        rows.push(row);
    });
    return rows.sort((a, b) => String(a.name).localeCompare(String(b.name)) || String(a.label).localeCompare(String(b.label)));
}

// ------------------------------------------------------------------ alerts
export function jumpKey(ingredientId, entry) { return `${ingredientId}|${entry.sourceId}|${entry.date}|${U.num(entry.price)}`; }
function sourceLabel(s) { return [s?.brand, s?.store, (U.num(s?.packageQty) != null && s?.packageUnit) ? `${U.fmtQty(s.packageQty)} ${U.UNIT_LABELS?.[s.packageUnit] || s.packageUnit}` : ''].filter(Boolean).join(' · '); }
function isPreferred(ing, s) { return ing.preferredSourceId ? ing.preferredSourceId === s.id : !!s.preferred; }

// Price now vs the price on `sinceIso`, per source, for anything that changed after `sinceIso`. Sorted by biggest move.
export function movers(ingredients, historyMap, sinceIso) {
    const out = [];
    values(ingredients).forEach(i => {
        const hist = get(historyMap, i.id); if (!hist) return;
        (i.sources || []).forEach(s => {
            const before = priceAsOf(hist, s.id, sinceIso);
            const list = sortHistory(hist).filter(e => e.sourceId === s.id && U.num(e.price) != null);
            const after = list[list.length - 1];
            if (!before || !after || after.date <= sinceIso) return;
            const b = U.num(before.price), a = U.num(after.price);
            if (!(b > 0) || a === b) return;
            out.push({ ingredientId: i.id, name: i.name, kind: i.kind || 'ingredient', sourceId: s.id, source: sourceLabel(s), preferred: isPreferred(i, s), before: b, after: a, beforeDate: before.date, afterDate: after.date, pct: Math.round((a - b) / b * 1000) / 10 });
        });
    });
    return out.sort((x, y) => Math.abs(y.pct) - Math.abs(x.pct));
}

// Entries dated on/after `sinceIso` that moved at least `thresholdPct` from that source's previous entry.
// dismissed: array of jumpKey strings; those rows come back with dismissed:true (callers usually hide them).
export function priceJumps(ingredients, historyMap, opts = {}) {
    const threshold = U.num(opts.thresholdPct) ?? 10;
    const since = opts.sinceIso || '0000-00-00';
    const dismissed = new Set(opts.dismissed || []);
    const out = [];
    values(ingredients).forEach(i => {
        const hist = get(historyMap, i.id); if (!hist) return;
        (i.sources || []).forEach(s => {
            const list = sortHistory(hist).filter(e => e.sourceId === s.id && U.num(e.price) != null);
            for (let k = 1; k < list.length; k++) {
                const e = list[k], prev = list[k - 1];
                if (e.date < since) continue;
                const p0 = U.num(prev.price), p1 = U.num(e.price);
                if (!(p0 > 0)) continue;
                const pct = Math.round((p1 - p0) / p0 * 1000) / 10;
                if (Math.abs(pct) < threshold) continue;
                const key = jumpKey(i.id, e);
                out.push({ key, ingredientId: i.id, name: i.name, kind: i.kind || 'ingredient', sourceId: s.id, source: sourceLabel(s), preferred: isPreferred(i, s), prev: p0, price: p1, prevDate: prev.date, date: e.date, method: e.method || '', pct, dismissed: dismissed.has(key) });
            }
        });
    });
    return out.sort((x, y) => y.date.localeCompare(x.date) || Math.abs(y.pct) - Math.abs(x.pct));
}
// Keep only dismissed keys whose entry date is on/after keepFromIso (so the list never grows forever)
export function pruneDismissed(keys, keepFromIso) { return (keys || []).filter(k => (k.split('|')[2] || '') >= keepFromIso); }

// Recipes that use an ingredient (directly or through a sub-recipe), for "used in" notes on alerts
export function recipesUsing(ingredientId, recipes) {
    const list = values(recipes);
    const direct = new Set(list.filter(r => (r.lines || []).some(l => l.ingredientId === ingredientId)).map(r => r.id));
    let grew = true;
    while (grew) {
        grew = false;
        list.forEach(r => { if (!direct.has(r.id) && (r.lines || []).some(l => l.recipeId && direct.has(l.recipeId))) { direct.add(r.id); grew = true; } });
    }
    return list.filter(r => direct.has(r.id));
}
