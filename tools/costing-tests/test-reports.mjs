// Phase 3 unit tests: dates, price-as-of, reconstructed ingredients, cost snapshots, series/change table,
// movers, price-jump alerts, dismissed pruning, recipes-using. Run: node tools/costing-tests/test-reports.mjs
import fs from 'fs';
import * as U from '../../admin/costing-units.js';
import * as H from '../../admin/costing-history.js';
const seed1 = JSON.parse(fs.readFileSync(new URL('../../admin/costing-seed.json', import.meta.url), 'utf8'));
const seed2 = JSON.parse(fs.readFileSync(new URL('../../admin/costing-seed-phase2.json', import.meta.url), 'utf8'));
const ingredients = new Map(); const history = new Map();
function addIng(i) {
    const sources = i.sources.map(s => { const sorted = (s.prices || []).slice().sort((a, b) => a.date.localeCompare(b.date)); const last = sorted[sorted.length - 1]; const { prices, ...rest } = s; return { ...rest, active: true, currentPrice: last ? last.price : null, currentPriceDate: last ? last.date : null }; });
    const pref = sources.find(s => s.preferred) || sources[0];
    ingredients.set(i.id, { ...i, sources, preferredSourceId: pref ? pref.id : null });
    history.set(i.id, i.sources.flatMap(s => (s.prices || []).map(p => ({ sourceId: s.id, price: p.price, date: p.date, method: 'import' }))));
}
seed1.ingredients.forEach(addIng); seed2.supplies.forEach(addIng);
const recipes = new Map(seed1.recipes.map(r => [r.id, r]));
const products = new Map(seed2.products.map(p => [p.id, p]));
const ctx = { ingredients, recipes, products };
const settings = seed2.pricingDefaults;
let pass = 0, fail = 0; const eq = (n, g, w, t = 0) => { const ok = typeof w === 'number' ? Math.abs(g - w) <= t : JSON.stringify(g) === JSON.stringify(w); if (ok) pass++; else { fail++; console.log('FAIL', n, 'got', JSON.stringify(g), 'want', JSON.stringify(w)); } };

// dates
eq('addDays', H.addDays('2026-03-01', -1), '2026-02-28');
eq('addMonths back 3 from May 31 clamps', H.addMonths('2026-05-31', -3), '2026-02-28');
eq('addMonths forward across year', H.addMonths('2025-11-15', 3), '2026-02-15');
eq('monthEnd', H.monthEnd('2026-02-10'), '2026-02-28');
eq('monthEnds Jan..Mar', H.monthEnds('2026-01-12', '2026-03-31'), ['2026-01-31', '2026-02-28', '2026-03-31']);
eq('monthEnds stops before toIso', H.monthEnds('2026-01-12', '2026-03-30'), ['2026-01-31', '2026-02-28']);

// price history on butter: seed 23.59 on 2026-02-01, then a trip 29.99 on 2026-09-06, then a correction same day 28.99
const butterHist = [
    { sourceId: 'costco-kirkland', price: 23.59, date: '2026-02-01', method: 'import' },
    { sourceId: 'costco-kirkland', price: 29.99, date: '2026-09-06', method: 'trip', createdAt: new Date('2026-09-06T10:00:00'), qty: 2 },
    { sourceId: 'costco-kirkland', price: 28.99, date: '2026-09-06', method: 'edit', createdAt: new Date('2026-09-06T11:00:00') },
];
eq('sortHistory keeps same-day creation order', H.sortHistory(butterHist.slice().reverse()).map(e => e.price), [23.59, 29.99, 28.99]);
eq('priceAsOf before first = null', H.priceAsOf(butterHist, 'costco-kirkland', '2026-01-01'), null);
eq('priceAsOf carryBack = first', H.priceAsOf(butterHist, 'costco-kirkland', '2026-01-01', { carryBack: true }).price, 23.59);
eq('priceAsOf mid', H.priceAsOf(butterHist, 'costco-kirkland', '2026-06-01').price, 23.59);
eq('priceAsOf same day picks the later entry', H.priceAsOf(butterHist, 'costco-kirkland', '2026-09-06').price, 28.99);
eq('priceAsOf unknown source', H.priceAsOf(butterHist, 'amazon-butter', '2026-09-06'), null);

const hist2 = new Map(history); hist2.set('butter', butterHist);
const butterNow = { ...ingredients.get('butter'), sources: ingredients.get('butter').sources.map(s => s.id === 'costco-kirkland' ? { ...s, currentPrice: 28.99, currentPriceDate: '2026-09-06' } : s) };
const ings2 = new Map(ingredients); ings2.set('butter', butterNow);
const asOfJune = H.ingredientsAsOf(ings2, hist2, '2026-06-01');
eq('as of June butter = 23.59', asOfJune.get('butter').sources[0].currentPrice, 23.59);
eq('as of June amazon butter has no price', asOfJune.get('butter').sources[1].currentPrice, null);
const asOfJan25 = H.ingredientsAsOf(ings2, hist2, '2025-01-01');
eq('as of Jan 2025 without carryBack: no butter price', asOfJan25.get('butter').sources[0].currentPrice, null);
const asOfJan25cb = H.ingredientsAsOf(ings2, hist2, '2025-01-01', { carryBack: true });
eq('carryBack gives first price, flagged', [asOfJan25cb.get('butter').sources[0].currentPrice, asOfJan25cb.get('butter').sources[0].carriedBack], [23.59, true]);
const noHist = new Map(hist2); noHist.set('cake-box-tall-12', []);
const cb2 = H.ingredientsAsOf(ings2, noHist, '2025-01-01', { carryBack: true });
eq('carryBack with empty history keeps current price', cb2.get('cake-box-tall-12').sources[0].currentPrice, ingredients.get('cake-box-tall-12').sources[0].currentPrice);
eq('no carryBack with empty history drops price', H.ingredientsAsOf(ings2, noHist, '2025-01-01').get('cake-box-tall-12').sources[0].currentPrice, null);
eq('unloaded history leaves ingredient untouched', H.ingredientsAsOf(ings2, new Map(), '2025-01-01').get('butter'), butterNow);

// unit cost series (per base unit; butter 4 lb = 1814.37 g)
const ser = H.unitCostSeries(butterNow, butterHist);
eq('one line for the source with entries', ser.length, 1);
eq('series points', ser[0].points.map(p => p.price), [23.59, 29.99, 28.99]);
eq('unit cost g', ser[0].points[0].unitCost, 23.59 / (4 * 453.592), 1e-6);
eq('series keeps qty', ser[0].points[1].qty, 2);
eq('series honors the entry package size', H.unitCostSeries(butterNow, [{ sourceId: 'costco-kirkland', price: 10, date: '2026-01-01', packageQty: 1, packageUnit: 'lb' }])[0].points[0].unitCost, 10 / 453.592, 1e-6);

// snapshots
const today = '2026-09-06';
const snapNow = H.buildSnapshot({ ingredients: ings2, recipes, products }, settings, today, { trigger: 'test' });
eq('snapshot counts recipes', snapNow.counts.recipes, recipes.size);
eq('snapshot has every active product size', snapNow.counts.products, [...products.values()].filter(p => p.active !== false).reduce((a, p) => a + (p.family === 'cake' ? p.sizes.length : p.tiers.length), 0));
eq('snapshot ingredient unit cost matches live', snapNow.ingredients.butter.unitCost, U.ingredientUnitCost(butterNow).unitCost, 1e-6);
eq('snapshot recipe total matches costRecipe', snapNow.recipes['white-cake'].total, U.round2(U.costRecipe(recipes.get('white-cake'), ings2, recipes).total));
eq('snapshot recipe with no lines not ok', snapNow.recipes['lemon-cupcakes'].ok, false);
eq('snapshot product 6in cost basis', snapNow.products['celebration-cake|6'].costBasis > 100, true);
eq('snapshot not reconstructed by default', snapNow.reconstructed, false);
const snapJune = H.buildSnapshot({ ingredients: asOfJune, recipes, products }, settings, '2026-06-30', { trigger: 'backfill', reconstructed: true });
eq('June white cake cheaper than now (butter went up)', snapJune.recipes['white-cake'].total < snapNow.recipes['white-cake'].total, true);
const snapJan = H.buildSnapshot({ ingredients: asOfJan25cb, recipes, products }, settings, '2025-01-31', { trigger: 'backfill', reconstructed: true });
eq('Jan 2025 reconstructed product ok (carried back)', snapJan.products['celebration-cake|6'].ok, true);
eq('Jan 2025 flagged carriedBack on butter', snapJan.ingredients.butter.carriedBack, true);

const snaps = [snapJan, snapJune, { ...H.buildSnapshot({ ingredients: asOfJune, recipes, products }, settings, '2026-03-31', { reconstructed: true }) }];
eq('snapshotAsOf picks latest on/before', H.snapshotAsOf(snaps, '2026-07-01').date, '2026-06-30');
eq('snapshotAsOf exact date', H.snapshotAsOf(snaps, '2026-03-31').date, '2026-03-31');
eq('snapshotAsOf before all = null', H.snapshotAsOf(snaps, '2024-12-31'), null);
eq('series sorted and filtered by from', H.series(snaps, 'recipes', 'white-cake', '2026-01-01').map(p => p.date), ['2026-03-31', '2026-06-30']);
eq('series skips incomplete recipes', H.series(snaps, 'recipes', 'lemon-cupcakes'), []);
const table = H.changeTable(snaps, snapNow, 'recipes', today);
const wc = table.find(r => r.key === 'white-cake');
eq('changeTable 3 months ago (Jun 6) uses the March snapshot, not the later June one', wc.ago[3].date, '2026-03-31');
eq('changeTable pct positive after butter jump', wc.ago[3].pct > 0, true);
eq('changeTable 12 months ago uses Jan 2025', wc.ago[12].date, '2025-01-31');
eq('changeTable marks reconstructed', wc.ago[12].reconstructed, true);
eq('changeTable rows sorted by name', table.map(r => r.name), table.map(r => r.name).slice().sort((a, b) => a.localeCompare(b)));
const ptable = H.changeTable(snaps, snapNow, 'products', today);
eq('product change table has labels', ptable[0].label.length > 0, true);

// movers and jumps
const since = H.addDays(today, -30);
const mv = H.movers(ings2, hist2, since);
eq('one mover (butter)', mv.map(m => m.ingredientId), ['butter']);
eq('mover compares to price as of 30 days ago', [mv[0].before, mv[0].after], [23.59, 28.99]);
eq('mover pct', mv[0].pct, Math.round((28.99 - 23.59) / 23.59 * 1000) / 10);
eq('mover preferred flag', mv[0].preferred, true);
eq('no movers when window excludes the change', H.movers(ings2, hist2, '2026-09-07'), []);
const jumps = H.priceJumps(ings2, hist2, { thresholdPct: 10, sinceIso: since });
eq('one jump over 10% (the trip); the correction is under threshold', jumps.map(j => j.price), [29.99]);
eq('jump key format', jumps[0].key, 'butter|costco-kirkland|2026-09-06|29.99');
eq('jump pct', jumps[0].pct, 27.1);
eq('jump not dismissed by default', jumps[0].dismissed, false);
eq('lower threshold catches the correction too', H.priceJumps(ings2, hist2, { thresholdPct: 3, sinceIso: since }).length, 2);
const exact = new Map(hist2); exact.set('butter', [{ sourceId: 'costco-kirkland', price: 10, date: '2026-09-01' }, { sourceId: 'costco-kirkland', price: 11, date: '2026-09-06' }]);
eq('exactly the threshold is not "more than"', H.priceJumps(ings2, exact, { thresholdPct: 10, sinceIso: since }).length, 0);
eq('just over the threshold is', H.priceJumps(ings2, exact, { thresholdPct: 9.99, sinceIso: since }).length, 1);
eq('dismissed flag', H.priceJumps(ings2, hist2, { thresholdPct: 10, sinceIso: since, dismissed: [jumps[0].key] })[0].dismissed, true);
eq('jumps ignore entries before since', H.priceJumps(ings2, hist2, { thresholdPct: 10, sinceIso: '2026-09-07' }), []);
eq('pruneDismissed drops old keys', H.pruneDismissed(['a|b|2026-01-01|1', 'a|b|2026-09-01|2'], '2026-06-01'), ['a|b|2026-09-01|2']);

// recipes using (sub-recipe chain: buttercream uses butter; cakes use butter directly too)
const usingButter = H.recipesUsing('butter', recipes).map(r => r.id);
eq('butter used in white cake', usingButter.includes('white-cake'), true);
eq('butter used through sub-recipe (confetti = white cake + sprinkles)', usingButter.includes('confetti-cake'), true);
eq('sprinkles not in chocolate cake', H.recipesUsing('sprinkles', recipes).map(r => r.id).includes('chocolate-cake'), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
