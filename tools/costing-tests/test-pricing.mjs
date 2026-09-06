import fs from 'fs';
import * as U from '../../admin/costing-units.js';
import * as P from '../../admin/costing-pricing.js';
const seed1 = JSON.parse(fs.readFileSync(new URL('../../admin/costing-seed.json', import.meta.url),'utf8'));
const seed2 = JSON.parse(fs.readFileSync(new URL('../../admin/costing-seed-phase2.json', import.meta.url),'utf8'));
const ingredients = new Map();
function addIng(i){ const sources=i.sources.map(s=>{const sorted=(s.prices||[]).slice().sort((a,b)=>a.date.localeCompare(b.date)); const last=sorted[sorted.length-1]; const {prices,...rest}=s; return {...rest, currentPrice:last?last.price:null, currentPriceDate:last?last.date:null};}); const pref=sources.find(s=>s.preferred)||sources[0]; ingredients.set(i.id,{...i, sources, preferredSourceId:pref?pref.id:null}); }
seed1.ingredients.forEach(addIng); seed2.supplies.forEach(addIng);
const recipes = new Map(seed1.recipes.map(r=>[r.id,r]));
const products = new Map(seed2.products.map(p=>[p.id,p]));
const ctx = { ingredients, recipes, products };
const settings = seed2.pricingDefaults;
let pass=0, fail=0; const eq=(n,g,w,t=0)=>{ const ok = typeof w==='number' ? Math.abs(g-w)<=t : JSON.stringify(g)===JSON.stringify(w); if(ok)pass++; else {fail++; console.log('FAIL',n,'got',JSON.stringify(g),'want',JSON.stringify(w));} };

const cake = products.get('celebration-cake');
const s6 = cake.sizes[0], s8 = cake.sizes[1];
eq('filling 6in 3 layers = 420', P.fillingGrams(cake, s6, 3), 420, 0.01);
eq('outer 6in 3 layers = 780', P.outerGrams(cake, s6, 3), 780, 0.01);
eq('filling 8in = 420*1.78', P.fillingGrams(cake, s8, 3), 420*(64/36), 0.5);
eq('outer 8in ~ 1.44x', P.outerGrams(cake, s8, 3)/780, (Math.PI*16 + Math.PI*8*4.5)/(Math.PI*9 + Math.PI*6*4.5), 0.001);
eq('batter 6in white whole = 1', P.batterBatches(cake, s6, 'white-cake', 3, true), 1);
eq('batter 6in 4 layers whole = 2', P.batterBatches(cake, s6, 'white-cake', 4, true), 2);
eq('batter 8in choc = 2', P.batterBatches(cake, s8, 'chocolate-cake', 3, true), 2);

const est6 = P.priceEstimate({ items: [{ productId: 'celebration-cake', qty: 1, tiers: [{ sizeId: '6' }] }] }, ctx, settings);
const t = est6.totals;
console.log('6-inch white/buttercream:', JSON.stringify(t));
console.log(est6.items[0].lines.map(l=>`  ${l.kind.padEnd(10)} ${l.label.padEnd(44)} ${U.fmtMoney(l.cost).padStart(8)}  ${l.detail}`).join('\n'));
eq('6in ok', est6.ok, true);
eq('6in hours 3', t.hours, 3);
eq('6in labor 96', t.labor, 96);
eq('6in menu 95', t.menu, 95);
eq('6in suggested rounds to 5', t.suggested % 5, 0);
eq('6in below alert', t.belowAlert, true);

const est2 = P.priceEstimate({ items: [{ productId: 'celebration-cake', qty: 1, tiers: [{ sizeId: '8', flavorRecipeId: 'chocolate-cake', fillingRecipeId: 'ganache' }, { sizeId: '6' }], drip: true, fondantFigures: 2, topper: { cost: 12, name: 'number 5' } }] }, ctx, settings);
console.log('two-tier 8+6 w/ ganache, drip, 2 figures, topper:', JSON.stringify(est2.totals), est2.problems);
eq('two-tier menu = 125+15+95+40', est2.totals.menu, 125 + 15 + 95 + 40);
eq('two-tier hours = 4+3 + 5/60 tier + 5/60 drip + 40/60 figures + 25/60 topper', est2.totals.hours, 7 + (5+5+40+25)/60, 0.01);

const cup = P.priceEstimate({ items: [{ productId: 'cupcakes', qty: 2, tierId: 'themed', flavorRecipeId: 'chocolate-cake' }] }, ctx, settings);
console.log('2 dozen themed cupcakes:', JSON.stringify(cup.totals), cup.problems);
eq('cupcakes menu 120', cup.totals.menu, 120);
eq('cupcakes hours = 2 + 24*6/60', cup.totals.hours, 2 + 2.4, 0.01);

const ck = P.priceEstimate({ items: [{ productId: 'sugar-cookies', qty: 2, tierId: 'masterpiece', characters: 3 }] }, ctx, settings);
console.log('2 dozen masterpiece cookies + 3 characters:', JSON.stringify(ck.totals), ck.problems);
eq('cookies menu 144+30', ck.totals.menu, 174);
eq('cookies hours = 1 + 24*8/60 + 30/60', ck.totals.hours, 1 + 3.2 + 0.5, 0.01);
const boxes = ck.items[0].lines.filter(l=>/Treat box/.test(l.label));
eq('2 large boxes for 24 cookies', boxes.length ? boxes[0].detail.startsWith('2 x') : false, true);

const dd = P.priceEstimate({ items: [{ productId: 'daily-drop-cookies', qty: 1, tierId: 'mini' }] }, ctx, settings);
console.log('1 dozen mini CC:', JSON.stringify(dd.totals), dd.problems);
eq('cc cookies ok', dd.ok, true);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
