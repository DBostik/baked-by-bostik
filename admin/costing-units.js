// costing-units.js
// Pure unit-conversion and costing math for the Baked By Bostik Costing module.
// No Firebase, no DOM: this file also runs in Node for tests.
//
// Base units: 'g' (solids and dry goods), 'ml' (liquids), 'each' (countables).
// Every ingredient declares its baseUnit plus the conversion factors it needs:
//   gramsPerCup  - for 'g' ingredients written in volume (flour, sugar, butter...)
//   gramsPerMl   - for 'ml' ingredients when a recipe or package is in weight (oil 0.92)
//   gramsPerEach - for 'each' ingredients when a recipe is in weight (egg 50 g)

export const ML_PER_CUP = 236.588;

export const VOLUME_ML = {
    tsp: 4.92892, tbsp: 14.7868, cup: ML_PER_CUP, floz: 29.5735, ml: 1, l: 1000,
    pint: 473.176, quart: 946.353, gallon: 3785.41
};
export const WEIGHT_G = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592, stick: 113.4 };
export const COUNT = { each: 1, dozen: 12 };

export const UNIT_LABELS = {
    tsp: 'tsp', tbsp: 'Tbsp', cup: 'cup', floz: 'fl oz', ml: 'ml', l: 'L', pint: 'pint', quart: 'quart', gallon: 'gallon',
    g: 'g', kg: 'kg', oz: 'oz', lb: 'lb', stick: 'stick', each: 'each', dozen: 'dozen', batch: 'batch'
};

// Units offered in dropdowns, grouped.
export const UNIT_GROUPS = [
    { label: 'Volume', units: ['tsp', 'tbsp', 'cup', 'floz', 'ml', 'l', 'pint', 'quart', 'gallon'] },
    { label: 'Weight', units: ['g', 'kg', 'oz', 'lb', 'stick'] },
    { label: 'Count', units: ['each', 'dozen'] },
];
export const RECIPE_LINE_UNITS = ['tsp', 'tbsp', 'cup', 'floz', 'ml', 'g', 'kg', 'oz', 'lb', 'stick', 'each', 'dozen', 'batch'];
export const PACKAGE_UNITS = ['lb', 'oz', 'g', 'kg', 'floz', 'ml', 'l', 'quart', 'pint', 'gallon', 'each', 'dozen'];

const UNIT_ALIASES = {
    teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp', tsps: 'tsp', t: 'tsp', tso: 'tsp',
    tablespoon: 'tbsp', tablespoons: 'tbsp', tbsp: 'tbsp', tbs: 'tbsp', tb: 'tbsp', tbsps: 'tbsp', T: 'tbsp',
    cup: 'cup', cups: 'cup', c: 'cup',
    floz: 'floz', 'fl oz': 'floz', 'fl. oz': 'floz', 'fl.oz': 'floz', 'fluid ounce': 'floz', 'fluid ounces': 'floz',
    ounce: 'oz', ounces: 'oz', oz: 'oz',
    pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb',
    gram: 'g', grams: 'g', g: 'g', gm: 'g', gr: 'g',
    kilogram: 'kg', kilograms: 'kg', kg: 'kg',
    milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml', ml: 'ml', mL: 'ml',
    liter: 'l', liters: 'l', litre: 'l', litres: 'l', l: 'l', L: 'l',
    pint: 'pint', pints: 'pint', pt: 'pint',
    quart: 'quart', quarts: 'quart', qt: 'quart',
    gallon: 'gallon', gallons: 'gallon', gal: 'gallon',
    stick: 'stick', sticks: 'stick',
    each: 'each', ea: 'each', pc: 'each', pcs: 'each', piece: 'each', pieces: 'each', count: 'each', ct: 'each',
    large: 'each', lg: 'each', medium: 'each', small: 'each', whole: 'each',
    dozen: 'dozen', doz: 'dozen', dz: 'dozen',
    batch: 'batch', batches: 'batch',
};

export function normalizeUnit(raw) {
    if (raw == null) return null;
    let s = String(raw).trim().replace(/\.$/, '');
    if (!s) return null;
    if (UNIT_ALIASES[s]) return UNIT_ALIASES[s];
    const lower = s.toLowerCase().replace(/\s+/g, ' ');
    if (UNIT_ALIASES[lower]) return UNIT_ALIASES[lower];
    const noSpace = lower.replace(/[\s.]/g, '');
    if (UNIT_ALIASES[noSpace]) return UNIT_ALIASES[noSpace];
    return null;
}

export function unitKind(unit) {
    if (unit in VOLUME_ML) return 'volume';
    if (unit in WEIGHT_G) return 'weight';
    if (unit in COUNT) return 'count';
    if (unit === 'batch') return 'batch';
    return null;
}

// "2", "2.25", "1/2", "2 1/2", "2-1/2", "½", "2.5 - 2.75" (range -> midpoint), "3 tsp / 1 TBS" (first)
const VULGAR = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
export function parseQty(raw) {
    if (raw == null) return { value: null, flags: [] };
    let s = String(raw).trim();
    const flags = [];
    for (const [k, v] of Object.entries(VULGAR)) {
        if (s.includes(k)) s = s.replace(k, ' ' + v + ' ');
    }
    s = s.replace(/,/g, '.').replace(/\s+/g, ' ').trim();
    const single = (t) => {
        t = t.trim();
        let m = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);            // 2 1/2
        if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
        m = t.match(/^(\d+)\s*-\s*(\d+)\s*\/\s*(\d+)$/);             // 2-1/2
        if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
        m = t.match(/^(\d+)\s*\/\s*(\d+)$/);                         // 1/2
        if (m) return Number(m[1]) / Number(m[2]);
        m = t.match(/^(\d+)\s+(0?\.\d+)$/);                          // "2 .5" from vulgar replacement
        if (m) return Number(m[1]) + Number(m[2]);
        m = t.match(/^(\d*\.?\d+)$/);
        if (m) return Number(m[1]);
        return null;
    };
    let v = single(s);
    if (v != null) return { value: v, flags };
    // range: "2.5 - 2.75", "2.5 to 2.75", "2.5-2.75"
    let m = s.match(/^(.+?)\s*(?:-|to|–)\s*(.+)$/);
    if (m) {
        const a = single(m[1]), b = single(m[2]);
        if (a != null && b != null) {
            flags.push(`Range ${m[1]} to ${m[2]}; midpoint used.`);
            return { value: (a + b) / 2, flags };
        }
    }
    // alternates: "3 / 1" style handled at line level
    return { value: null, flags };
}

// Parse a recipe line as written. Returns {qty, unit, name, note, flags, ok}.
// Examples:
//   "2.25 cups King Arthur all purpose flour"      -> 2.25 cup, name...
//   "1.25 cups (250g) sugar"                       -> 250 g (grams win when present)
//   "1.5 cups (3 sticks) butter"                   -> 1.5 cup
//   "5 egg whites" / "3 eggs" / "2 LG eggs"        -> each
//   "8 ounces semisweet chocolate, chopped"        -> 8 oz, note "chopped"
//   "3 tsp / 1 TBS vanilla extract"                -> 1 tbsp (second form kept, note)
//   "2.5 - 2.75 c flour"                           -> 2.625 cup, flagged
export function parseLine(text) {
    const flags = [];
    let s = String(text || '').trim();
    if (!s) return { ok: false, qty: null, unit: null, name: '', note: '', flags: ['Empty line'] };

    // pull parenthetical hints
    let note = '';
    let gramsHint = null, eachHint = null;
    s = s.replace(/\(([^)]*)\)/g, (_, inner) => {
        const gm = inner.match(/(\d*\.?\d+)\s*(g|grams?|gr)\b/i);
        if (gm) gramsHint = Number(gm[1]);
        const em = inner.match(/^(\d*\.?\d+)\s*(sticks?|large|lg|each)\b/i);
        if (em && /stick/i.test(em[2])) eachHint = { qty: Number(em[1]), unit: 'stick' };
        note = note ? note + '; ' + inner.trim() : inner.trim();
        return ' ';
    }).replace(/\s+/g, ' ').trim();

    // trailing ", chopped" style notes
    const cm = s.match(/^(.*?),\s*([a-z][^,]*)$/i);
    if (cm && cm[1].length > 3) { s = cm[1].trim(); note = note ? note + '; ' + cm[2].trim() : cm[2].trim(); }

    // alternates "3 tsp / 1 TBS vanilla": keep the last form
    const alt = s.match(/^\s*[\d\s./½¼¾⅓⅔]+\s*[a-zA-Z.]+\s*\/\s*([\d\s./½¼¾⅓⅔]+\s*[a-zA-Z.]+\s+.*)$/);
    if (alt) { note = note ? note + '; as written: ' + s : 'as written: ' + s; s = alt[1].trim(); }

    // qty at start: digits, fractions, vulgar, ranges
    const qm = s.match(/^((?:\d+\s+)?(?:\d+\s*\/\s*\d+|\d*\.?\d+|[½¼¾⅓⅔⅛⅜⅝⅞])(?:\s*(?:-|to|–)\s*(?:\d+\s+)?(?:\d+\s*\/\s*\d+|\d*\.?\d+))?)\s*(.*)$/);
    if (!qm) return { ok: false, qty: null, unit: null, name: s, note, flags: ['No quantity found'] };
    const q = parseQty(qm[1]);
    flags.push(...q.flags);
    let rest = qm[2].trim();

    // unit token: try two-word units first ("fl oz"), then one word
    let unit = null;
    const two = rest.match(/^([a-zA-Z]+\.?\s+[a-zA-Z]+\.?)\s+(.*)$/);
    if (two && normalizeUnit(two[1])) { unit = normalizeUnit(two[1]); rest = two[2]; }
    else {
        const one = rest.match(/^([a-zA-Z]+\.?)\s+(.*)$/);
        if (one && normalizeUnit(one[1]) && !/^(egg|eggs|lemon|lemons)$/i.test(one[1])) { unit = normalizeUnit(one[1]); rest = one[2]; }
    }
    let name = rest.trim();
    if (!unit) {
        // "3 eggs", "5 egg whites", "2 lemons"
        unit = 'each';
    }
    let qty = q.value;
    if (gramsHint != null && unit !== 'g') {
        note = note ? note : '';
        flags.push(`Grams in parentheses (${gramsHint} g) used instead of ${qty} ${UNIT_LABELS[unit] || unit}.`);
        qty = gramsHint; unit = 'g';
    } else if (eachHint && unit === 'cup') {
        // "1.5 cups (3 sticks) butter": keep cups; sticks are equivalent
    }
    return { ok: qty != null, qty, unit, name, note, flags };
}

// Convert a quantity in `unit` to the ingredient's base unit.
// ingredient: {baseUnit, gramsPerCup, gramsPerMl, gramsPerEach}
// Returns {ok, baseQty, reason}
export function toBase(qty, unit, ingredient) {
    if (qty == null || isNaN(qty)) return { ok: false, baseQty: null, reason: 'No quantity' };
    const base = ingredient?.baseUnit || 'g';
    const kind = unitKind(unit);
    if (!kind) return { ok: false, baseQty: null, reason: `Unknown unit "${unit}"` };
    const gpc = num(ingredient?.gramsPerCup);
    const gpml = num(ingredient?.gramsPerMl) || 1;
    const gpe = num(ingredient?.gramsPerEach);
    if (base === 'g') {
        if (kind === 'weight') return ok(qty * WEIGHT_G[unit]);
        if (kind === 'volume') {
            if (!gpc) return fail(`Needs grams per cup for ${ingredient?.name || 'this ingredient'}`);
            return ok(qty * VOLUME_ML[unit] / ML_PER_CUP * gpc);
        }
        if (kind === 'count') {
            if (!gpe) return fail('Needs grams per each');
            return ok(qty * COUNT[unit] * gpe);
        }
    }
    if (base === 'ml') {
        if (kind === 'volume') return ok(qty * VOLUME_ML[unit]);
        if (kind === 'weight') return ok(qty * WEIGHT_G[unit] / gpml);
        if (kind === 'count') {
            if (!gpe) return fail('Needs grams per each');
            return ok(qty * COUNT[unit] * gpe / gpml);
        }
    }
    if (base === 'each') {
        if (kind === 'count') return ok(qty * COUNT[unit]);
        if (kind === 'weight') {
            if (!gpe) return fail('Needs grams per each');
            return ok(qty * WEIGHT_G[unit] / gpe);
        }
        if (kind === 'volume') {
            if (!gpe || !gpc) return fail('Needs grams per cup and grams per each');
            return ok(qty * VOLUME_ML[unit] / ML_PER_CUP * gpc / gpe);
        }
    }
    return fail('Cannot convert');
    function ok(v) { return { ok: true, baseQty: v, reason: '' }; }
    function fail(r) { return { ok: false, baseQty: null, reason: r }; }
}

// Grams for a line (for batter weight). Works for any base unit when factors exist.
export function toGrams(qty, unit, ingredient) {
    const kind = unitKind(unit);
    if (!kind || qty == null) return null;
    const gpc = num(ingredient?.gramsPerCup), gpml = num(ingredient?.gramsPerMl) || 1, gpe = num(ingredient?.gramsPerEach);
    if (kind === 'weight') return qty * WEIGHT_G[unit];
    if (kind === 'volume') {
        if (ingredient?.baseUnit === 'ml') return qty * VOLUME_ML[unit] * gpml;
        if (gpc) return qty * VOLUME_ML[unit] / ML_PER_CUP * gpc;
        return null;
    }
    if (kind === 'count') return gpe ? qty * COUNT[unit] * gpe : null;
    return null;
}

export function baseUnitLabel(baseUnit) {
    return baseUnit === 'each' ? 'each' : baseUnit;
}

// Cost per base unit for a source: price / package in base units.
export function sourceUnitCost(source, ingredient) {
    const price = num(source?.currentPrice);
    if (price == null) return { ok: false, unitCost: null, reason: 'No price yet' };
    const conv = toBase(num(source?.packageQty), source?.packageUnit, ingredient);
    if (!conv.ok || !conv.baseQty) return { ok: false, unitCost: null, reason: conv.reason || 'Package size missing' };
    return { ok: true, unitCost: price / conv.baseQty, reason: '' };
}

export function preferredSource(ingredient) {
    const list = (ingredient?.sources || []).filter(s => s.active !== false);
    return list.find(s => s.id === ingredient.preferredSourceId) || list.find(s => s.preferred) || list[0] || null;
}

// Current cost per base unit for an ingredient (preferred source unless overridden).
export function ingredientUnitCost(ingredient, sourceId) {
    const src = sourceId ? (ingredient.sources || []).find(s => s.id === sourceId) : preferredSource(ingredient);
    if (!src) return { ok: false, unitCost: null, reason: 'No source', source: null };
    const r = sourceUnitCost(src, ingredient);
    return { ...r, source: src };
}

// Days since a date string / Date / Firestore Timestamp-like {toDate}
export function daysSince(d, now = new Date()) {
    const dt = toDate(d);
    if (!dt) return null;
    return Math.floor((now - dt) / 86400000);
}
export function toDate(d) {
    if (!d) return null;
    if (d instanceof Date) return d;
    if (typeof d?.toDate === 'function') return d.toDate();
    if (typeof d === 'number') return new Date(d);
    const s = String(d);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const dt = new Date(s);
    return isNaN(dt) ? null : dt;
}

// Cost a recipe. ingredientsById: Map or object; recipesById likewise. Returns:
// { ok, total, lines:[{idx, text, cost, baseQty, baseUnit, unitCost, ok, reason, grams, priceDate}],
//   grams (sum of gram-able lines), oldestPriceDate, problems:[...] }
export function costRecipe(recipe, ingredientsById, recipesById, opts = {}) {
    const depth = opts.depth || 0;
    const get = (map, id) => (map instanceof Map ? map.get(id) : map?.[id]);
    const overrides = opts.sourceOverrides || {}; // {ingredientId: sourceId}
    const out = { ok: true, total: 0, lines: [], grams: 0, gramsComplete: true, oldestPriceDate: null, problems: [] };
    if (depth > 4) { out.ok = false; out.problems.push('Recipe nesting too deep'); return out; }
    (recipe?.lines || []).forEach((line, idx) => {
        const res = { idx, text: line.text, cost: 0, baseQty: null, baseUnit: null, unitCost: null, ok: true, reason: '', grams: null, priceDate: null };
        const qty = num(line.qty);
        if (line.recipeId) {
            const sub = get(recipesById, line.recipeId);
            if (!sub) { res.ok = false; res.reason = 'Sub-recipe not found'; }
            else if (sub.id === recipe.id) { res.ok = false; res.reason = 'A recipe cannot include itself'; }
            else {
                const subCost = costRecipe(sub, ingredientsById, recipesById, { ...opts, depth: depth + 1 });
                const per = perUnitCosts(sub, subCost);
                const unit = line.unit || 'batch';
                if (unit === 'batch') { res.cost = subCost.total * qty; res.grams = subCost.gramsComplete ? subCost.grams * qty : null; }
                else if (unitKind(unit) === 'weight' && per.perGram != null) { const g = qty * WEIGHT_G[unit]; res.cost = per.perGram * g; res.grams = g; }
                else if (unitKind(unit) === 'volume' && per.perCup != null) { const cups = qty * VOLUME_ML[unit] / ML_PER_CUP; res.cost = per.perCup * cups; res.grams = per.gramsPerCup ? cups * per.gramsPerCup : null; }
                else if (unitKind(unit) === 'count' && per.perCount != null) { res.cost = per.perCount * qty * COUNT[unit]; }
                else { res.ok = false; res.reason = `Cannot use ${unit} of ${sub.name}`; }
                res.baseUnit = unit; res.baseQty = qty;
                if (!subCost.ok) { res.ok = false; res.reason = res.reason || `Problems in ${sub.name}`; }
                res.priceDate = subCost.oldestPriceDate;
            }
        } else {
            const ing = get(ingredientsById, line.ingredientId);
            if (!ing) { res.ok = false; res.reason = line.ingredientId ? 'Ingredient not found' : 'Not matched to an ingredient'; }
            else {
                const conv = toBase(qty, line.unit, ing);
                const uc = ingredientUnitCost(ing, overrides[ing.id]);
                res.baseUnit = ing.baseUnit;
                if (!conv.ok) { res.ok = false; res.reason = conv.reason; }
                else if (!uc.ok) { res.ok = false; res.reason = uc.reason; res.baseQty = conv.baseQty; }
                else {
                    res.baseQty = conv.baseQty; res.unitCost = uc.unitCost; res.cost = conv.baseQty * uc.unitCost;
                    res.priceDate = uc.source?.currentPriceDate || null;
                }
                res.grams = toGrams(qty, line.unit, ing);
            }
        }
        if (!res.ok) { out.ok = false; out.problems.push(`${line.text || 'line ' + (idx + 1)}: ${res.reason}`); }
        out.total += res.cost || 0;
        if (res.grams != null) out.grams += res.grams; else out.gramsComplete = false;
        const pd = toDate(res.priceDate);
        if (pd && (!out.oldestPriceDate || pd < out.oldestPriceDate)) out.oldestPriceDate = pd;
        out.lines.push(res);
    });
    out.total = round2(out.total);
    return out;
}

// Per-unit costs from a recipe's yield.
export function perUnitCosts(recipe, costResult) {
    const y = recipe?.yield || {};
    const total = costResult?.total || 0;
    const grams = costResult?.gramsComplete ? costResult.grams : null;
    const res = { perGram: null, perCup: null, perCount: null, gramsPerCup: null, countLabel: null };
    if (grams) res.perGram = total / grams;
    if (y.type === 'volume' && num(y.value)) {
        const cups = num(y.value) * (VOLUME_ML[y.unit || 'cup'] || ML_PER_CUP) / ML_PER_CUP;
        res.perCup = total / cups;
        if (grams) res.gramsPerCup = grams / cups;
    }
    if (y.type === 'count' && num(y.value)) { res.perCount = total / num(y.value); res.countLabel = y.unit || 'each'; }
    if (y.type === 'batter' && grams) { /* per gram already set */ }
    return res;
}

export function num(v) { const n = typeof v === 'string' ? parseFloat(v) : v; return (n == null || isNaN(n)) ? null : n; }
export function round2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
export function fmtMoney(v, digits = 2) { if (v == null || isNaN(v)) return '—'; return '$' + Number(v).toFixed(digits); }
export function fmtUnitCost(unitCost, baseUnit) {
    if (unitCost == null) return '—';
    if (baseUnit === 'each') return fmtMoney(unitCost) + ' each';
    // show per 100 g / 100 ml so the numbers are readable
    return fmtMoney(unitCost * 100) + ' per 100 ' + baseUnit;
}
export function fmtQty(v) {
    if (v == null || isNaN(v)) return '';
    const n = Number(v);
    if (Number.isInteger(n)) return String(n);
    return String(Math.round(n * 1000) / 1000);
}

// Suggested grams-per-cup by keyword (for new ingredients). Seeded from the King Arthur Baking chart.
const DENSITY_KEYWORDS = [
    [/almond flour/i, 96], [/bread flour/i, 120], [/cake flour/i, 120], [/flour/i, 120],
    [/powdered sugar|confectioners|icing sugar/i, 113], [/brown sugar/i, 213], [/sugar/i, 198],
    [/butter/i, 227], [/shortening/i, 191], [/cream cheese/i, 232], [/sour cream|yogurt/i, 227],
    [/cocoa/i, 84], [/chocolate chips|chips/i, 170], [/chopped chocolate/i, 170],
    [/oats/i, 99], [/honey|molasses|corn syrup/i, 340], [/peanut butter/i, 270],
    [/baking powder/i, 192], [/baking soda/i, 230], [/salt/i, 288], [/cornstarch/i, 112],
    [/sprinkles/i, 180], [/meringue powder/i, 128], [/espresso|coffee/i, 110], [/cinnamon|nutmeg|clove|spice/i, 130],
    [/pumpkin/i, 245], [/strawberr|berr/i, 150], [/nuts|pecan|walnut/i, 113], [/coconut/i, 85],
];
export function suggestGramsPerCup(name) {
    for (const [re, g] of DENSITY_KEYWORDS) if (re.test(name || '')) return g;
    return null;
}
export function suggestBaseUnit(name) {
    if (/egg|lemon|lime|orange|banana|box|board|bag|liner|dowel|drum|topper|ribbon|cup$|count/i.test(name || '')) return 'each';
    if (/milk|cream|water|juice|oil|extract|vanilla|syrup|honey|molasses/i.test(name || '')) return 'ml';
    return 'g';
}

// Package size text parser: "4 lb", "72 oz bag", "11 fl oz", "5 dozen", "18 count", "2 x 5 lb"
export function parsePackage(text) {
    let s = String(text || '').trim().toLowerCase();
    if (!s) return null;
    const mult = s.match(/^(\d+)\s*[x×]\s*(.*)$/);
    let factor = 1;
    if (mult) { factor = Number(mult[1]); s = mult[2]; }
    const m = s.match(/^(\d*\.?\d+)\s*([a-z][a-z .]*?)(?:\s+(?:bag|box|bottle|jar|can|carton|container|pack|package|tub))?\.?$/);
    if (!m) return null;
    const unit = normalizeUnit(m[2].trim());
    if (!unit) return null;
    return { qty: Number(m[1]) * factor, unit };
}

// Simple CSV helper
export function toCSV(rows) {
    return rows.map(r => r.map(v => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\n');
}
