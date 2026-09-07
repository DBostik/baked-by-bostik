// costing-inventory-math.js
// Phase 6 (inventory): pure functions, no DOM, no Firebase (unit tested in Node).
//   explodeRecipe / explodeEstimate: what an order physically uses, per item, in each item's base unit
//   stockOf / stockStatus / fmtStock: on-hand bookkeeping helpers shared by the screens
import * as U from './costing-units.js';
import * as P from './costing-pricing.js';

const get = (map, id) => (map instanceof Map ? map.get(id) : map?.[id]);
function add(out, itemId, qty) { if (!itemId || !(qty > 0)) return; out.set(itemId, (out.get(itemId) || 0) + qty); }

// Ingredient quantities (base units) used by `batches` of a recipe, sub-recipes included.
export function explodeRecipe(recipeId, batches, ctx, out = new Map(), problems = [], depth = 0) {
    const rec = get(ctx.recipes, recipeId);
    if (!rec) { problems.push(`Recipe ${recipeId} not found`); return out; }
    if (depth > 4) { problems.push(`${rec.name}: recipe nesting too deep`); return out; }
    const c = U.costRecipe(rec, ctx.ingredients, ctx.recipes);
    (rec.lines || []).forEach((l, idx) => {
        const r = c.lines[idx] || {};
        if (l.ingredientId) {
            if (r.baseQty != null) add(out, l.ingredientId, r.baseQty * batches);
            else problems.push(`${rec.name}: ${l.text || 'line ' + (idx + 1)} has no usable quantity`);
        } else if (l.recipeId) {
            const unit = l.unit || 'batch'; const qty = U.num(l.qty) || 0;
            if (unit === 'batch') explodeRecipe(l.recipeId, qty * batches, ctx, out, problems, depth + 1);
            else explodeRecipeGrams(l.recipeId, (r.grams || 0) * batches, ctx, out, problems, depth + 1);
        }
    });
    return out;
}
// Same, for a weight of the recipe (needs the recipe's batch weight)
export function explodeRecipeGrams(recipeId, grams, ctx, out = new Map(), problems = [], depth = 0) {
    const rec = get(ctx.recipes, recipeId);
    if (!rec) { problems.push(`Recipe ${recipeId} not found`); return out; }
    const c = U.costRecipe(rec, ctx.ingredients, ctx.recipes);
    if (!c.gramsComplete || !c.grams) { problems.push(`${rec.name}: batch weight unknown, so its ingredients were not taken from stock`); return out; }
    return explodeRecipe(recipeId, grams / c.grams, ctx, out, problems, depth);
}

// Everything a saved estimate uses: Map(itemId -> quantity in that item's base unit). Supplies come from
// packaging kits and decor lines; ingredients from batter, filling, frosting, drip, dough and icing lines.
// Quantities follow what was costed (whole batches when the settings round, otherwise the exact grams).
export function explodeEstimate(estimate, ctx, settings) {
    const est = P.priceEstimate(estimate, ctx, settings);
    const out = new Map(); const problems = [];
    est.items.forEach((it, k) => {
        const times = Math.max(1, U.num(estimate.items?.[k]?.qty) || 1);
        const perOne = new Map();
        (it.lines || []).forEach(l => {
            const ref = l.ref; if (!ref) return;
            if (ref.itemId) add(perOne, ref.itemId, ref.qty);
            else if (ref.recipeId && ref.batches != null) explodeRecipe(ref.recipeId, ref.batches, ctx, perOne, problems);
            else if (ref.recipeId && ref.grams != null) explodeRecipeGrams(ref.recipeId, ref.grams, ctx, perOne, problems);
        });
        // cakes: lines are per cake and the item may be several cakes; cupcakes and cookies already scale by dozens
        const product = get(ctx.products, estimate.items?.[k]?.productId);
        const mult = product?.family === 'cake' ? times : 1;
        perOne.forEach((q, id) => add(out, id, q * mult));
    });
    return { needs: out, problems: [...new Set(problems)], estimate: est };
}

// ------------------------------------------------------------------ stock helpers
export function stockOf(item) { const s = item?.stock || {}; return { track: !!s.track, onHand: U.num(s.onHand) ?? 0, reorderPoint: U.num(s.reorderPoint), counted: !!s.countedAt }; }
export function stockStatus(item) {
    const s = stockOf(item);
    if (!s.track) return { code: 'off', label: 'Not tracked', cls: 'c-badge-kind' };
    if (!s.counted) return { code: 'uncounted', label: 'Needs a count', cls: 'c-badge-warn' };
    if (s.onHand <= 0) return { code: 'out', label: 'Out', cls: 'c-badge-warn' };
    if (s.reorderPoint != null && s.onHand <= s.reorderPoint) return { code: 'low', label: 'Low', cls: 'c-badge-stale' };
    return { code: 'ok', label: 'OK', cls: 'c-badge-ok' };
}
// "120 each (2.4 packs of 50)" / "2,268 g (5 lb)" / "1,200 ml"
export function fmtStock(qty, item) {
    const n = U.num(qty) ?? 0;
    const base = item?.baseUnit || 'each';
    const pref = U.preferredSource(item);
    const pkg = pref && U.num(pref.packageQty) != null && pref.packageUnit ? U.toBase(U.num(pref.packageQty), pref.packageUnit, item) : null;
    let main;
    if (base === 'each') main = `${fmtNum(n)}`;
    else if (base === 'g') main = n >= 1000 ? `${fmtNum(n / 1000, 2)} kg` : `${fmtNum(n)} g`;
    else main = n >= 1000 ? `${fmtNum(n / 1000, 2)} L` : `${fmtNum(n)} ml`;
    if (pkg && pkg.ok && pkg.baseQty > 0 && !(base === 'each' && pkg.baseQty === 1)) {
        const packs = n / pkg.baseQty;
        const unitWord = pref.packageUnit === 'each' ? '' : ' ' + (U.UNIT_LABELS[pref.packageUnit] || pref.packageUnit);
        main += ` (${fmtNum(packs, 1)} ${packs === 1 ? 'pack' : 'packs'} of ${U.fmtQty(pref.packageQty)}${unitWord})`;
    }
    return main;
}
function fmtNum(n, digits = 0) { const r = Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits); return r.toLocaleString('en-US', { maximumFractionDigits: digits }); }
// Convert a count typed in packs to base units using the preferred source's package
export function packsToBase(packs, item) {
    const pref = U.preferredSource(item);
    const pkg = pref && U.num(pref.packageQty) != null && pref.packageUnit ? U.toBase(U.num(pref.packageQty), pref.packageUnit, item) : null;
    return pkg && pkg.ok ? packs * pkg.baseQty : null;
}
// Stock movement for a price entry: packages bought x package size, in base units (null when not convertible)
export function stockInFromPrice(item, source, packages) {
    const n = U.num(packages); if (!(n > 0) || !source) return null;
    const conv = U.toBase(U.num(source.packageQty), source.packageUnit, item);
    return conv.ok && conv.baseQty ? conv.baseQty * n : null;
}
