import { parseLine, parseQty, toBase, costRecipe, perUnitCosts, normalizeUnit, parsePackage, sourceUnitCost, fmtUnitCost } from '../../admin/costing-units.js';
import fs from 'fs';

let pass = 0, fail = 0;
function eq(name, got, want, tol = 0) {
    const ok = typeof want === 'number' ? Math.abs(got - want) <= tol : JSON.stringify(got) === JSON.stringify(want);
    if (ok) pass++; else { fail++; console.log('FAIL', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); }
}

// --- quantities
eq('qty 2.25', parseQty('2.25').value, 2.25);
eq('qty 1/2', parseQty('1/2').value, 0.5);
eq('qty 2 1/2', parseQty('2 1/2').value, 2.5);
eq('qty ½', parseQty('½').value, 0.5);
eq('qty range', parseQty('2.5 - 2.75').value, 2.625, 1e-9);
eq('qty range flag', parseQty('2.5 - 2.75').flags.length, 1);

// --- units
eq('unit TBS', normalizeUnit('TBS'), 'tbsp');
eq('unit c.', normalizeUnit('c.'), 'cup');
eq('unit fl oz', normalizeUnit('fl. oz'), 'floz');
eq('unit tso typo', normalizeUnit('tso'), 'tsp');
eq('unit LG', normalizeUnit('LG'), 'each');

// --- lines from the sheet
const cases = [
    ["2.25 cups King Arthur's all purpose flour", { qty: 2.25, unit: 'cup', name: "King Arthur's all purpose flour" }],
    ['1.25 cups (250g) sugar', { qty: 250, unit: 'g', name: 'sugar' }],
    ['1.5 cups (3 sticks) butter', { qty: 1.5, unit: 'cup', name: 'butter' }],
    ['5 egg whites', { qty: 5, unit: 'each', name: 'egg whites' }],
    ['3 eggs', { qty: 3, unit: 'each', name: 'eggs' }],
    ['2 LG eggs', { qty: 2, unit: 'each', name: 'eggs' }],
    ['8 ounces semisweet chocolate, chopped', { qty: 8, unit: 'oz', name: 'semisweet chocolate' }],
    ['3 tsp / 1 TBS vanilla extract', { qty: 1, unit: 'tbsp', name: 'vanilla extract' }],
    ['2.5 - 2.75 c King Arthur all-purpose flour', { qty: 2.625, unit: 'cup', name: 'King Arthur all-purpose flour' }],
    ['1 tso salt', { qty: 1, unit: 'tsp', name: 'salt' }],
    ['4 cups (24 oz) chocolate chips', { qty: 4, unit: 'cup', name: 'chocolate chips' }],
    ['1 1/2 cups all-purpose flour', { qty: 1.5, unit: 'cup', name: 'all-purpose flour' }],
    ['½ cup unsalted butter, softened', { qty: 0.5, unit: 'cup', name: 'unsalted butter' }],
    ['14 oz. strawberries', { qty: 14, unit: 'oz', name: 'strawberries' }],
    ['1 cup heavy whipping cream', { qty: 1, unit: 'cup', name: 'heavy whipping cream' }],
    ['2 tablespoons lemon zest (from 2 lemons)', { qty: 2, unit: 'tbsp', name: 'lemon zest' }],
];
for (const [text, want] of cases) {
    const p = parseLine(text);
    eq('line ' + text, { qty: Math.round(p.qty * 1000) / 1000, unit: p.unit, name: p.name }, want);
}

// --- conversions
const flour = { name: 'flour', baseUnit: 'g', gramsPerCup: 120 };
eq('2.25 cups flour -> g', toBase(2.25, 'cup', flour).baseQty, 270, 1e-6);
eq('1 tsp salt -> g', toBase(1, 'tsp', { baseUnit: 'g', gramsPerCup: 288 }).baseQty, 6, 0.01);
eq('3 sticks butter -> g', toBase(3, 'stick', { baseUnit: 'g', gramsPerCup: 227 }).baseQty, 340.2, 0.01);
eq('4 tbsp cream -> ml', toBase(4, 'tbsp', { baseUnit: 'ml' }).baseQty, 59.147, 0.01);
eq('1 quart -> ml', toBase(1, 'quart', { baseUnit: 'ml' }).baseQty, 946.353, 0.01);
eq('5 dozen eggs -> each', toBase(5, 'dozen', { baseUnit: 'each' }).baseQty, 60);
eq('99 g oil -> ml', toBase(99, 'g', { baseUnit: 'ml', gramsPerMl: 0.92 }).baseQty, 107.6, 0.1);
eq('missing density fails', toBase(1, 'cup', { baseUnit: 'g' }).ok, false);

// --- packages
eq('pkg 4 lb', parsePackage('4 lb'), { qty: 4, unit: 'lb' });
eq('pkg 72 oz bag', parsePackage('72 oz bag'), { qty: 72, unit: 'oz' });
eq('pkg 11 fl oz', parsePackage('11 fl oz'), { qty: 11, unit: 'floz' });
eq('pkg 5 dozen', parsePackage('5 dozen'), { qty: 5, unit: 'dozen' });
eq('pkg 2 x 5 lb', parsePackage('2 x 5 lb'), { qty: 10, unit: 'lb' });

// --- source cost: Watkins 11 fl oz $10.99 -> 1.5 tsp
const vanilla = { name: 'clear vanilla', baseUnit: 'ml', gramsPerMl: 0.88 };
const src = { packageQty: 11, packageUnit: 'floz', currentPrice: 10.99 };
const uc = sourceUnitCost(src, vanilla).unitCost;
eq('1.5 tsp watkins = $0.25', Math.round(uc * toBase(1.5, 'tsp', vanilla).baseQty * 100) / 100, 0.25, 0.005);

// --- cost the seeded white cake and buttercream
const seed = JSON.parse(fs.readFileSync(new URL('../../admin/costing-seed.json', import.meta.url), 'utf8'));
const ingredients = {};
for (const i of seed.ingredients) {
    const sources = i.sources.map(s => {
        const last = s.prices.slice().sort((a, b) => a.date.localeCompare(b.date)).pop();
        return { ...s, currentPrice: last ? last.price : null, currentPriceDate: last ? last.date : null };
    });
    ingredients[i.id] = { ...i, sources, preferredSourceId: (sources.find(s => s.preferred) || sources[0] || {}).id };
}
const recipes = {}; for (const r of seed.recipes) recipes[r.id] = r;
const report = [];
for (const r of seed.recipes) {
    const c = costRecipe(r, ingredients, recipes);
    const per = perUnitCosts(r, c);
    report.push(`${r.name.padEnd(48)} $${c.total.toFixed(2).padStart(6)}  grams=${c.gramsComplete ? Math.round(c.grams) : 'n/a'}  perCup=${per.perCup != null ? '$' + per.perCup.toFixed(2) : '-'}  perCount=${per.perCount != null ? '$' + per.perCount.toFixed(2) : '-'}  problems=${c.problems.length ? c.problems.join(' | ') : 'none'}`);
}
console.log(report.join('\n'));
const wc = costRecipe(recipes['white-cake'], ingredients, recipes);
eq('white cake all lines costed', wc.ok, true);
eq('white cake batter grams ~1250 (whites counted as whole eggs)', wc.grams, 1250, 80);
const cc = costRecipe(recipes['confetti-cake'], ingredients, recipes);
eq('confetti = white cake + sprinkles', cc.total > wc.total, true);
eq('confetti grams complete', cc.gramsComplete, true);

// a sub-recipe line without a quantity must be a problem, not a free $0 line
const noQty = costRecipe({ id: 'x', name: 'X', lines: [{ text: 'buttercream', unit: 'batch', recipeId: 'vanilla-buttercream' }] }, ingredients, recipes);
eq('sub-recipe without qty is flagged', [noQty.ok, noQty.problems.length], [false, 1]);
const empty = costRecipe({ id: 'e', name: 'E', lines: [] }, ingredients, recipes);
eq('recipe with no lines is not complete', [empty.ok, empty.total, empty.problems[0]], [false, 0, 'No ingredient lines yet']);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
