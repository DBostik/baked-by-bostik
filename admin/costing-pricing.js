// costing-pricing.js
// Phase 2: products, sizes, geometry scaling and the cost-plus estimate math.
// Pure functions (no Firebase, no DOM) so they can be tested in Node.

import * as U from './costing-units.js';

export const DEFAULT_PRICING = {
    hourlyRate: 32,
    wasteAllowancePct: 5,
    overheadType: 'pct',      // 'pct' of (materials + labor) or 'flat' per order
    overheadValue: 10,
    profitPct: 20,
    roundTo: 5,               // suggested price rounds up to this; 0 = to the cent
    marginAlertPct: 15,       // flag products whose margin at menu price is below this
    roundCakeBatches: true,   // she bakes whole batches of cake
    roundFrostingBatches: false,
    roundCupcakeBatches: false, // cupcakes and cookies are costed by the fraction of a batch used
    roundCookieBatches: false,
};

export const FAMILIES = ['cake', 'cupcake', 'cookie', 'cc-cookie'];

export function roundUpTo(v, step) {
    if (v == null || isNaN(v)) return null;
    if (!step) return Math.round(v * 100) / 100;
    return Math.ceil(v / step - 1e-9) * step;
}
export function roundArea(d) { return Math.PI * Math.pow(d / 2, 2); }
export function sideArea(d, h) { return Math.PI * d * h; }
const num = U.num;

export function refSize(product) {
    return (product.sizes || []).find(s => s.id === product.refSizeId) || (product.sizes || [])[0] || null;
}

// Filling grams for a size and layer count, scaled from the reference size by layer area.
export function fillingGrams(product, size, layers) {
    const ref = refSize(product); if (!ref || !size) return 0;
    const refLayers = num(product.layersDefault) || 3;
    if (num(size.fillingGramsOverride) != null && layers === refLayers) return num(size.fillingGramsOverride);
    const perLayerRef = (num(product.refFillingGrams) || 0) / Math.max(1, refLayers - 1);
    const areaRatio = roundArea(num(size.diameterIn) || 6) / roundArea(num(ref.diameterIn) || 6);
    return perLayerRef * areaRatio * Math.max(0, layers - 1);
}

// Outer frosting grams (crumb coat, outer coat, border, details) scaled by outside surface (top + sides).
export function outerGrams(product, size, layers) {
    const ref = refSize(product); if (!ref || !size) return 0;
    const refLayers = num(product.layersDefault) || 3;
    if (num(size.outerGramsOverride) != null && layers === refLayers) return num(size.outerGramsOverride);
    const h = num(product.layerHeightIn) || 1.5;
    const refD = num(ref.diameterIn) || 6, d = num(size.diameterIn) || 6;
    const refSurface = roundArea(refD) + sideArea(refD, h * refLayers);
    const surface = roundArea(d) + sideArea(d, h * layers);
    return (num(product.refOuterGrams) || 0) * surface / refSurface;
}

// Batches of a cake recipe for a size and layer count (whole batches when rounding is on).
export function batterBatches(product, size, recipeId, layers, round) {
    const base = num(size?.batter?.[recipeId]) ?? num(size?.batterDefault) ?? 1;
    const exact = base * layers / (num(product.layersDefault) || 3);
    return round ? Math.ceil(exact - 1e-9) : exact;
}

// Cost helpers -------------------------------------------------------------
function recipeInfo(ctx, recipeId) {
    const r = ctx.recipes instanceof Map ? ctx.recipes.get(recipeId) : ctx.recipes?.[recipeId];
    if (!r) return null;
    const cost = U.costRecipe(r, ctx.ingredients, ctx.recipes);
    const per = U.perUnitCosts(r, cost);
    return { recipe: r, cost, per };
}
function supplyUnitCost(ctx, supplyId) {
    const s = ctx.ingredients instanceof Map ? ctx.ingredients.get(supplyId) : ctx.ingredients?.[supplyId];
    if (!s) return { ok: false, reason: 'Supply not found', unitCost: 0, name: supplyId };
    const uc = U.ingredientUnitCost(s);
    return { ok: uc.ok, reason: uc.reason, unitCost: uc.unitCost || 0, name: s.name, item: s };
}

// One line of an item breakdown
function line(kind, label, cost, detail = '', minutes = 0, ok = true, reason = '') {
    return { kind, label, cost: cost || 0, detail, minutes: minutes || 0, ok, reason };
}

function addRecipeByBatches(lines, ctx, recipeId, batches, label) {
    const info = recipeInfo(ctx, recipeId);
    if (!info) { lines.push(line('ingredient', label, 0, 'recipe missing', 0, false, `Recipe ${recipeId} not found`)); return; }
    const cost = info.cost.total * batches;
    lines.push(line('ingredient', `${label}: ${info.recipe.name}`, cost, `${U.fmtQty(Math.round(batches * 100) / 100)} batch${batches === 1 ? '' : 'es'} at ${U.fmtMoney(info.cost.total)}`, 0, info.cost.ok, info.cost.ok ? '' : info.cost.problems.join('; ')));
}
function addRecipeByGrams(lines, ctx, recipeId, grams, label, roundBatches) {
    const info = recipeInfo(ctx, recipeId);
    if (!info) { lines.push(line('ingredient', label, 0, 'recipe missing', 0, false, `Recipe ${recipeId} not found`)); return; }
    if (info.per.perGram == null) {
        lines.push(line('ingredient', `${label}: ${info.recipe.name}`, 0, 'needs every line in grams', 0, false, `${info.recipe.name} has no weight yet (a line is missing grams)`));
        return;
    }
    const batchGrams = info.cost.grams;
    let cost, detail;
    if (roundBatches && batchGrams) {
        const batches = Math.ceil(grams / batchGrams - 1e-9);
        cost = batches * info.cost.total;
        detail = `${Math.round(grams)} g needed, ${batches} whole batch${batches === 1 ? '' : 'es'}`;
    } else {
        cost = grams * info.per.perGram;
        detail = `${Math.round(grams)} g at ${U.fmtMoney(info.per.perGram * 100)} per 100 g`;
    }
    lines.push(line('ingredient', `${label}: ${info.recipe.name}`, cost, detail, 0, info.cost.ok, info.cost.ok ? '' : info.cost.problems.join('; ')));
}
function addSupply(lines, ctx, supplyId, qty, label) {
    if (!qty) return;
    const s = supplyUnitCost(ctx, supplyId);
    const cost = s.unitCost * qty;
    lines.push(line('supply', label || s.name, cost, `${U.fmtQty(qty)} x ${U.fmtMoney(s.unitCost)}`, 0, s.ok, s.ok ? '' : `${s.name}: ${s.reason}`));
}
function addKit(lines, ctx, kit, times = 1) {
    (kit || []).forEach(k => addSupply(lines, ctx, k.supplyId, (num(k.qty) || 0) * times));
}
function addDecor(lines, ctx, decor) {
    (decor || []).forEach(d => {
        const item = ctx.ingredients instanceof Map ? ctx.ingredients.get(d.itemId) : ctx.ingredients?.[d.itemId];
        if (!item) { lines.push(line('supply', d.label || 'Decor item', num(d.cost) || 0, 'entered by hand', num(d.minutes) || 0)); return; }
        const conv = U.toBase(num(d.qty), d.unit || item.baseUnit, item);
        const uc = U.ingredientUnitCost(item);
        const ok = conv.ok && uc.ok;
        const cost = ok ? conv.baseQty * uc.unitCost : 0;
        lines.push(line(item.kind === 'supply' ? 'supply' : 'ingredient', item.name, cost, `${U.fmtQty(d.qty)} ${U.UNIT_LABELS[d.unit || item.baseUnit] || ''}`, num(d.minutes) || 0, ok, ok ? '' : `${item.name}: ${conv.reason || uc.reason}`));
    });
}
function addCustom(lines, custom) {
    (custom || []).forEach(c => lines.push(line('supply', c.name || 'Custom item', num(c.cost) || 0, 'entered by hand', num(c.minutes) || 0)));
}

// Item pricing by family --------------------------------------------------
export function priceCakeItem(item, product, ctx, settings) {
    const lines = [];
    const qty = Math.max(1, num(item.qty) || 1);
    const layersDefault = num(product.layersDefault) || 3;
    const tiers = (item.tiers && item.tiers.length) ? item.tiers : [{ sizeId: product.refSizeId }];
    let hours = 0, menu = 0;
    tiers.forEach((t, i) => {
        const size = (product.sizes || []).find(s => s.id === t.sizeId) || refSize(product);
        if (!size) { lines.push(line('ingredient', 'Size', 0, '', 0, false, 'No size chosen')); return; }
        const layers = layersDefault + (num(t.extraLayers) || 0);
        const tierLabel = tiers.length > 1 ? `Tier ${i + 1} (${size.label})` : size.label;
        const flavor = t.flavorRecipeId || product.defaultFlavorRecipeId;
        const filling = t.fillingRecipeId || product.defaultFillingRecipeId;
        const outer = t.outerRecipeId || product.defaultOuterRecipeId;
        if (flavor) addRecipeByBatches(lines, ctx, flavor, batterBatches(product, size, flavor, layers, settings.roundCakeBatches), `${tierLabel} batter`);
        if (filling) addRecipeByGrams(lines, ctx, filling, fillingGrams(product, size, layers), `${tierLabel} filling`, settings.roundFrostingBatches);
        if (outer) addRecipeByGrams(lines, ctx, outer, outerGrams(product, size, layers), `${tierLabel} outer frosting`, settings.roundFrostingBatches);
        // Tiers after the first share the box and labels of the cake; only per-tier items (boards, dowels) repeat.
        const perCakeOnly = new Set(product.addons?.perCakeOnlySupplyIds || []);
        addKit(lines, ctx, i === 0 ? size.kit : (size.kit || []).filter(k => !perCakeOnly.has(k.supplyId)), 1);
        hours += num(t.laborHoursOverride) ?? (num(size.laborHours) || 0);
        menu += num(size.menuPrice) || 0;
        if (num(t.extraLayers)) {
            hours += (num(product.addons?.extraLayerMinutes) || 0) * t.extraLayers / 60;
            menu += (num(product.addons?.extraLayerUpcharge) || 0) * t.extraLayers;
        }
        if (filling && (product.premiumFillingIds || []).includes(filling)) menu += num(product.addons?.premiumFillingUpcharge) || 0;
        if (i > 0) { hours += (num(product.addons?.tierMinutes) || 0) / 60; addKit(lines, ctx, product.addons?.tierKit, 1); }
    });
    if (item.drip) {
        const size = (product.sizes || []).find(s => s.id === tiers[0].sizeId) || refSize(product);
        const grams = num(size?.dripGrams) || num(product.addons?.dripGramsDefault) || 150;
        addRecipeByGrams(lines, ctx, item.dripRecipeId || product.addons?.dripRecipeId || 'ganache', grams, 'Ganache drip', false);
        hours += (num(product.addons?.dripMinutes) || 0) / 60;
        menu += num(product.addons?.dripUpcharge) || 0;
    }
    const figures = num(item.fondantFigures) || 0;
    if (figures) {
        // minutes ride on the line and are summed below
        lines.push(line('supply', `Fondant figures x${figures}`, figures * (num(product.addons?.figureMaterialCost) || 0), 'material allowance', figures * (num(product.addons?.figureMinutes) || 0)));
        menu += figures * (num(product.addons?.figureUpcharge) || 0);
    }
    if (item.topper) {
        const cost = num(item.topper.cost) ?? num(product.addons?.topperDefaultCost) ?? 0;
        lines.push(line('supply', `Topper${item.topper.name ? ': ' + item.topper.name : ''}`, cost, 'purchased', num(product.addons?.topperMinutes) || 0));
    }
    addDecor(lines, ctx, item.decor);
    addCustom(lines, item.custom);
    hours += lines.reduce((s, l) => s + (l.minutes || 0), 0) / 60;
    if (num(item.laborHoursOverride) != null) hours = num(item.laborHoursOverride);
    return finishItem(item, product, lines, hours, menu, qty, `${product.name}: ${tiers.map(t => ((product.sizes || []).find(s => s.id === t.sizeId) || {}).label || '?').join(' + ')}`);
}

export function priceCupcakeItem(item, product, ctx, settings) {
    const lines = [];
    const dozens = Math.max(0.5, num(item.qty) || 1);
    const count = Math.round(dozens * 12);
    const tier = (product.tiers || []).find(t => t.id === item.tierId) || (product.tiers || [])[0] || {};
    const flavor = item.flavorRecipeId || product.defaultFlavorRecipeId;
    const frosting = item.frostingRecipeId || product.defaultFrostingRecipeId;
    if (flavor) {
        const perBatch = num(product.cupcakesPerBatch?.[flavor]) || num(product.cupcakesPerBatchDefault) || 24;
        const exact = count / perBatch;
        addRecipeByBatches(lines, ctx, flavor, settings.roundCupcakeBatches ? Math.ceil(exact - 1e-9) : exact, 'Batter');
    }
    if (frosting) addRecipeByGrams(lines, ctx, frosting, count * (num(product.frostingGramsPerCupcake) || 60), 'Frosting', settings.roundFrostingBatches);
    addKit(lines, ctx, product.kitPerDozen, Math.ceil(dozens - 1e-9));
    addDecor(lines, ctx, item.decor); addCustom(lines, item.custom);
    let hours = (num(product.laborHoursPerDozen) || 0) * dozens + count * (num(tier.minutesPerUnit) || 0) / 60 + lines.reduce((s, l) => s + (l.minutes || 0), 0) / 60;
    if (num(item.laborHoursOverride) != null) hours = num(item.laborHoursOverride);
    const menu = (num(tier.menuPricePerDozen) || 0) * dozens;
    return finishItem(item, product, lines, hours, menu, 1, `${product.name}: ${U.fmtQty(dozens)} dozen, ${tier.label || ''}`);
}

export function priceCookieItem(item, product, ctx, settings) {
    const lines = [];
    const dozens = Math.max(0.5, num(item.qty) || 1);
    const count = Math.round(dozens * 12);
    const tier = (product.tiers || []).find(t => t.id === item.tierId) || (product.tiers || [])[0] || {};
    const dough = item.doughRecipeId || product.doughRecipeId;
    if (dough) {
        let perBatch = num(product.cookiesPerBatch) || 24;
        const info = recipeInfo(ctx, dough);
        if (product.family === 'cc-cookie' && info?.recipe?.yield?.scoopTable && tier.scoop) {
            const row = info.recipe.yield.scoopTable.find(r => r.scoop === tier.scoop);
            if (row && num(row.count)) perBatch = num(row.count);
        }
        const exact = count / perBatch;
        addRecipeByBatches(lines, ctx, dough, settings.roundCookieBatches ? Math.ceil(exact - 1e-9) : exact, 'Dough');
    }
    if (product.icingRecipeId && num(product.icingGramsPerCookie)) addRecipeByGrams(lines, ctx, product.icingRecipeId, count * num(product.icingGramsPerCookie), 'Icing', settings.roundFrostingBatches);
    // packaging: per-order kit once, per-box kit by capacity, per-cookie kit
    addKit(lines, ctx, product.kitPerOrder, 1);
    const perBox = num(product.cookiesPerBox) || 15;
    addKit(lines, ctx, product.kitPerBox, Math.ceil(count / perBox - 1e-9));
    addKit(lines, ctx, product.kitPerCookie, count);
    const characters = num(item.characters) || 0;
    if (characters) {
        lines.push(line('supply', `Character add-on x${characters}`, characters * (num(product.addons?.characterMaterialCost) || 0), 'material allowance', characters * (num(product.addons?.characterMinutes) || 0)));
    }
    addDecor(lines, ctx, item.decor); addCustom(lines, item.custom);
    let hours = (num(product.laborHoursPerDozen) || 0) * dozens + count * (num(tier.minutesPerUnit) || 0) / 60 + lines.reduce((s, l) => s + (l.minutes || 0), 0) / 60;
    if (num(item.laborHoursOverride) != null) hours = num(item.laborHoursOverride);
    const menu = (num(tier.menuPricePerDozen) || 0) * dozens + characters * (num(product.addons?.characterUpcharge) || 0);
    return finishItem(item, product, lines, hours, menu, 1, `${product.name}: ${U.fmtQty(dozens)} dozen, ${tier.label || ''}`);
}

function finishItem(item, product, lines, hours, menuPerUnit, qty, label) {
    const ingredients = lines.filter(l => l.kind === 'ingredient').reduce((s, l) => s + l.cost, 0) * qty;
    const supplies = lines.filter(l => l.kind === 'supply').reduce((s, l) => s + l.cost, 0) * qty;
    const problems = lines.filter(l => !l.ok).map(l => l.reason).filter(Boolean);
    return { label, qty, lines, ingredients, supplies, hours: hours * qty, menu: menuPerUnit * qty, problems, ok: problems.length === 0 };
}

export function priceItem(item, ctx, settings) {
    const product = ctx.products instanceof Map ? ctx.products.get(item.productId) : ctx.products?.[item.productId];
    if (!product) return { label: 'Unknown product', qty: 1, lines: [], ingredients: 0, supplies: 0, hours: 0, menu: 0, problems: ['Product not found'], ok: false };
    const s = { ...DEFAULT_PRICING, ...(settings || {}) };
    if (product.family === 'cake') return priceCakeItem(item, product, ctx, s);
    if (product.family === 'cupcake') return priceCupcakeItem(item, product, ctx, s);
    return priceCookieItem(item, product, ctx, s);
}

// Whole estimate: items + order-level totals
export function priceEstimate(estimate, ctx, settings) {
    const s = { ...DEFAULT_PRICING, ...(settings || {}) };
    const items = (estimate.items || []).map(it => priceItem(it, ctx, s));
    const ingredients = items.reduce((a, i) => a + i.ingredients, 0);
    const supplies = items.reduce((a, i) => a + i.supplies, 0);
    const waste = ingredients * (num(s.wasteAllowancePct) || 0) / 100;
    const materials = ingredients + supplies + waste;
    const hours = items.reduce((a, i) => a + i.hours, 0);
    const rate = num(s.hourlyRate) || 0;
    const labor = hours * rate;
    const overhead = s.overheadType === 'flat' ? (num(s.overheadValue) || 0) : (materials + labor) * (num(s.overheadValue) || 0) / 100;
    const costBasis = materials + labor + overhead;
    const suggestedRaw = costBasis * (1 + (num(s.profitPct) || 0) / 100);
    const suggested = roundUpTo(suggestedRaw, num(s.roundTo) || 0);
    const menu = items.reduce((a, i) => a + i.menu, 0);
    const marginAtMenu = menu - costBasis;
    const marginPct = menu ? marginAtMenu / menu * 100 : null;
    const problems = items.flatMap(i => i.problems);
    return {
        items, totals: {
            ingredients: U.round2(ingredients), supplies: U.round2(supplies), waste: U.round2(waste), materials: U.round2(materials),
            hours: Math.round(hours * 100) / 100, rate, labor: U.round2(labor), overhead: U.round2(overhead), costBasis: U.round2(costBasis),
            suggestedRaw: U.round2(suggestedRaw), suggested, menu: U.round2(menu), marginAtMenu: U.round2(marginAtMenu),
            marginPct: marginPct == null ? null : Math.round(marginPct * 10) / 10,
            belowAlert: marginPct != null && marginPct < (num(s.marginAlertPct) || 0)
        }, settingsUsed: s, problems, ok: problems.length === 0
    };
}

// A quick "standard" estimate for a product size (used for the products list and margin alerts)
export function standardItemFor(product, sizeOrTierId) {
    if (product.family === 'cake') return { productId: product.id, qty: 1, tiers: [{ sizeId: sizeOrTierId }] };
    return { productId: product.id, qty: 1, tierId: sizeOrTierId };
}

// Phase 5: customer-facing quote lines for the Create Quote / Invoice modal ------------------------------
// One line per estimate item. basis 'suggested' splits the order's suggested price across items in
// proportion to each item's materials plus labor (so the lines add up to the estimate); 'menu' uses each
// item's menu price. Cakes are 1 line per cake (qty = cakes); cupcakes and cookies are priced per dozen.
function getFrom(map, id) { return map instanceof Map ? map.get(id) : map?.[id]; }
function recipeName(ctx, id) { return id ? (getFrom(ctx.recipes, id)?.name || '') : ''; }
function short(name) { return String(name || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim(); }
export function quoteItemName(item, product, ctx) {
    if (!product) return 'Item';
    const bits = [];
    if (product.family === 'cake') {
        const tiers = (item.tiers && item.tiers.length) ? item.tiers : [{ sizeId: product.refSizeId }];
        const sizes = tiers.map(t => ((product.sizes || []).find(s => s.id === t.sizeId) || {}).label || '?');
        const flavors = [...new Set(tiers.map(t => short(recipeName(ctx, t.flavorRecipeId || product.defaultFlavorRecipeId))).filter(Boolean))];
        const fillings = [...new Set(tiers.map(t => short(recipeName(ctx, t.fillingRecipeId || product.defaultFillingRecipeId))).filter(Boolean))];
        const outers = [...new Set(tiers.map(t => short(recipeName(ctx, t.outerRecipeId || product.defaultOuterRecipeId))).filter(Boolean))];
        if (flavors.length) bits.push(flavors.join(' and '));
        if (fillings.length) bits.push(fillings.join(' and ') + ' filling');
        if (outers.length) bits.push(outers.join(' and '));
        const extra = tiers.reduce((a, t) => a + (num(t.extraLayers) || 0), 0);
        if (extra) bits.push(`${extra} extra layer${extra > 1 ? 's' : ''}`);
        if (item.drip) bits.push('ganache drip');
        if (num(item.fondantFigures)) bits.push(`${item.fondantFigures} fondant figure${item.fondantFigures > 1 ? 's' : ''}`);
        if (item.topper) bits.push(item.topper.name ? `topper: ${item.topper.name}` : 'topper');
        (item.decor || []).forEach(d => { const it = getFrom(ctx.ingredients, d.itemId); bits.push(short(it?.name || d.label || 'decor')); });
        (item.custom || []).forEach(c => { if (c.name) bits.push(c.name); });
        return `${product.name}: ${sizes.join(' + ')}${bits.length ? ' (' + bits.join(', ') + ')' : ''}`;
    }
    const tier = (product.tiers || []).find(t => t.id === item.tierId) || {};
    if (product.family === 'cupcake') {
        const f = short(recipeName(ctx, item.flavorRecipeId || product.defaultFlavorRecipeId)); const fr = short(recipeName(ctx, item.frostingRecipeId || product.defaultFrostingRecipeId));
        if (f) bits.push(f); if (fr) bits.push(fr);
    }
    if (num(item.characters)) bits.push(`${item.characters} character${item.characters > 1 ? 's' : ''}`);
    (item.decor || []).forEach(d => { const it = getFrom(ctx.ingredients, d.itemId); bits.push(short(it?.name || d.label || 'decor')); });
    (item.custom || []).forEach(c => { if (c.name) bits.push(c.name); });
    return `${product.name}${tier.label ? ': ' + tier.label : ''}${bits.length ? ' (' + bits.join(', ') + ')' : ''}, per dozen`;
}
export function quoteLines(estimate, ctx, settings, basis = 'suggested') {
    const s = { ...DEFAULT_PRICING, ...(settings || {}) };
    const est = priceEstimate(estimate, ctx, s);
    const src = estimate.items || [];
    const waste = (num(s.wasteAllowancePct) || 0) / 100, rate = num(s.hourlyRate) || 0;
    const bases = est.items.map(i => i.ingredients * (1 + waste) + i.supplies + i.hours * rate);
    const sumBase = bases.reduce((a, b) => a + b, 0);
    const target = basis === 'menu' ? est.totals.menu : est.totals.suggested;
    let acc = 0;
    const lines = est.items.map((it, k) => {
        const product = getFrom(ctx.products, src[k]?.productId);
        const isCake = product?.family === 'cake';
        const qty = isCake ? Math.max(1, num(src[k]?.qty) || 1) : Math.max(0.5, num(src[k]?.qty) || 1);
        let share;
        if (basis === 'menu') share = U.round2(it.menu);
        else if (k === est.items.length - 1) share = U.round2(target - acc);
        else share = U.round2(sumBase ? target * bases[k] / sumBase : target / est.items.length);
        acc += share;
        const price = U.round2(share / qty);
        return { name: quoteItemName(src[k] || {}, product, ctx).replace(/"/g, ''), qty, price, total: U.round2(price * qty), menu: U.round2(it.menu), suggestedShare: share, label: it.label };
    });
    return { lines, total: U.round2(lines.reduce((a, l) => a + l.total, 0)), basis, estimateTotals: est.totals };
}
