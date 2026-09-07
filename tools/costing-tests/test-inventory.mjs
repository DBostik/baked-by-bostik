// Phase 6 unit tests: recipe explosion, estimate explosion, stock helpers. Run: node tools/costing-tests/test-inventory.mjs
import fs from 'fs';
import * as U from '../../admin/costing-units.js';
import * as P from '../../admin/costing-pricing.js';
import * as I from '../../admin/costing-inventory-math.js';
const seed1 = JSON.parse(fs.readFileSync(new URL('../../admin/costing-seed.json', import.meta.url), 'utf8'));
const seed2 = JSON.parse(fs.readFileSync(new URL('../../admin/costing-seed-phase2.json', import.meta.url), 'utf8'));
const ingredients = new Map();
function addIng(i) { const sources = i.sources.map(s => { const sorted = (s.prices || []).slice().sort((a, b) => a.date.localeCompare(b.date)); const last = sorted[sorted.length - 1]; const { prices, ...rest } = s; return { ...rest, active: true, currentPrice: last ? last.price : null, currentPriceDate: last ? last.date : null }; }); const pref = sources.find(s => s.preferred) || sources[0]; ingredients.set(i.id, { ...i, sources, preferredSourceId: pref ? pref.id : null }); }
seed1.ingredients.forEach(addIng); seed2.supplies.forEach(addIng);
const recipes = new Map(seed1.recipes.map(r => [r.id, r]));
const products = new Map(seed2.products.map(p => [p.id, p]));
const ctx = { ingredients, recipes, products };
const settings = seed2.pricingDefaults;
let pass = 0, fail = 0; const eq = (n, g, w, t = 0) => { const ok = typeof w === 'number' ? Math.abs(g - w) <= t : JSON.stringify(g) === JSON.stringify(w); if (ok) pass++; else { fail++; console.log('FAIL', n, 'got', JSON.stringify(g), 'want', JSON.stringify(w)); } };

// explode one batch of white cake: butter line as written -> grams
const wc = recipes.get('white-cake');
const butterLine = wc.lines.find(l => l.ingredientId === 'butter');
const wcCost = U.costRecipe(wc, ingredients, recipes);
const one = I.explodeRecipe('white-cake', 1, ctx);
eq('white cake uses butter', one.has('butter'), true);
eq('butter grams = converted line qty', one.get('butter'), wcCost.lines[wc.lines.indexOf(butterLine)].baseQty, 1e-6);
eq('eggs counted each', one.get('eggs') > 0 && ingredients.get('eggs').baseUnit === 'each', true);
const two = I.explodeRecipe('white-cake', 2, ctx);
eq('two batches doubles', two.get('butter'), one.get('butter') * 2, 1e-6);

// confetti = white cake (1 batch) + sprinkles: sub-recipe by batch
const conf = I.explodeRecipe('confetti-cake', 1, ctx);
eq('confetti carries white cake butter', conf.get('butter'), one.get('butter'), 1e-6);
eq('confetti adds sprinkles', conf.get('sprinkles') > 0, true);

// by grams: half a batch of buttercream
const bc = U.costRecipe(recipes.get('vanilla-buttercream'), ingredients, recipes);
const halfProblems = [];
const half = I.explodeRecipeGrams('vanilla-buttercream', bc.grams / 2, ctx, new Map(), halfProblems);
const full = I.explodeRecipe('vanilla-buttercream', 1, ctx);
eq('half batch by grams = half the butter', half.get('butter'), full.get('butter') / 2, 1e-6);
eq('no problems', halfProblems, []);
// unknown recipe
const bad = []; I.explodeRecipe('nope', 1, ctx, new Map(), bad); eq('unknown recipe reports a problem', bad.length, 1);

// estimate: one 6-inch cake with whole-batch batter (1 batch white cake), buttercream by grams, kit supplies
const est6 = { items: [{ productId: 'celebration-cake', qty: 1, tiers: [{ sizeId: '6' }] }] };
const x6 = I.explodeEstimate(est6, ctx, settings);
const cake = products.get('celebration-cake'); const s6 = cake.sizes.find(s => s.id === '6');
s6.kit.forEach(k => eq(`kit ${k.supplyId} x${k.qty}`, x6.needs.get(k.supplyId), U.num(k.qty), 1e-9));
eq('cake batter = 1 batch of white cake butter', x6.needs.get('butter') >= one.get('butter'), true);
eq('frosting used by grams adds more butter than batter alone', x6.needs.get('butter') > one.get('butter'), true);
eq('no explosion problems for the 6-inch', x6.problems, []);
// two cakes double everything
const x6b = I.explodeEstimate({ items: [{ productId: 'celebration-cake', qty: 2, tiers: [{ sizeId: '6' }] }] }, ctx, settings);
eq('two cakes double the boards', x6b.needs.get(s6.kit[0].supplyId), 2 * U.num(s6.kit[0].qty), 1e-9);
eq('two cakes double the butter', x6b.needs.get('butter'), 2 * x6.needs.get('butter'), 1e-6);
// cupcakes: kit per dozen scales by dozens, not by item qty twice
const xc = I.explodeEstimate({ items: [{ productId: 'cupcakes', qty: 2, tierId: products.get('cupcakes').tiers[0].id }] }, ctx, settings);
const kpd = products.get('cupcakes').kitPerDozen || [];
if (kpd.length) eq('cupcake kit x2 dozen', xc.needs.get(kpd[0].supplyId), 2 * U.num(kpd[0].qty), 1e-9);
eq('cupcakes use eggs', xc.needs.get('eggs') > 0, true);

// a sub-recipe line measured by count cannot be weighed: it must be reported, never silently skipped
const probs = [];
I.explodeRecipe('x-count', 1, { ...ctx, recipes: new Map([...recipes, ['x-count', { id: 'x-count', name: 'X', lines: [{ text: '6 cookies', qty: 6, unit: 'each', recipeId: 'sugar-cookie' }] }]]) }, new Map(), probs);
eq('count-unit sub-recipe reports a problem', probs.length, 1);
const probs2 = [];
I.explodeRecipe('x-noqty', 1, { ...ctx, recipes: new Map([...recipes, ['x-noqty', { id: 'x-noqty', name: 'X', lines: [{ text: 'buttercream', unit: 'batch', recipeId: 'vanilla-buttercream' }] }]]) }, new Map(), probs2);
eq('sub-recipe without qty reports a problem', probs2.length, 1);

// stock helpers
const box = { ...ingredients.get('board-round-6'), stock: { track: true, onHand: 7, reorderPoint: 5, countedAt: '2026-09-07' } };
eq('status ok', I.stockStatus(box).code, 'ok');
eq('status low', I.stockStatus({ ...box, stock: { ...box.stock, onHand: 5 } }).code, 'low');
eq('status out', I.stockStatus({ ...box, stock: { ...box.stock, onHand: 0 } }).code, 'out');
eq('status needs count', I.stockStatus({ ...box, stock: { track: true } }).code, 'uncounted');
eq('status off', I.stockStatus(ingredients.get('butter')).code, 'off');
const bags = ingredients.get('cookie-bags-cello');
const pref = U.preferredSource(bags);
eq('fmtStock shows packs for multi-count packages', /packs? of/.test(I.fmtStock(U.toBase(U.num(pref.packageQty), pref.packageUnit, bags).baseQty * 2, bags)), true);
eq('fmtStock grams to kg', I.fmtStock(2268, ingredients.get('butter')).startsWith('2.27 kg'), true);
eq('packsToBase', I.packsToBase(2, bags), 2 * U.toBase(U.num(pref.packageQty), pref.packageUnit, bags).baseQty, 1e-9);
const butter = ingredients.get('butter'); const bsrc = U.preferredSource(butter);
eq('stockInFromPrice: 2 packs of 4 lb butter in grams', I.stockInFromPrice(butter, bsrc, 2), 2 * 4 * 453.592, 0.01);
eq('stockInFromPrice: no qty -> null', I.stockInFromPrice(butter, bsrc, 0), null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
