// Minimal in-memory Firestore stub fed by the seed file, enough to render every Costing screen.
const seed = await (await fetch('/admin/costing-seed.json')).json();
const seed2 = await (await fetch('/admin/costing-seed-phase2.json')).json();
const store = { ingredients: new Map(), recipes: new Map(), costing_settings: new Map(), prices: new Map(), products: new Map(), estimates: new Map(), requests: new Map(), cost_snapshots: new Map() };
for (const i of seed.ingredients) {
  const sources = i.sources.map(s => { const sorted=(s.prices||[]).slice().sort((a,b)=>a.date.localeCompare(b.date)); const last=sorted[sorted.length-1]; const {prices,...rest}=s; return {...rest, active:true, currentPrice:last?last.price:null, currentPriceDate:last?last.date:null}; });
  const pref = sources.find(s=>s.preferred)||sources[0];
  const {id, sources:_s, ...rest} = i;
  store.ingredients.set(id, {...rest, sources, preferredSourceId: pref?pref.id:null, reviewFlags:(i.reviewFlags||[]).map(t=>({text:t,resolved:false}))});
  store.prices.set(id, i.sources.flatMap(s => (s.prices||[]).map((p,k)=>({id:s.id+'-'+k, sourceId:s.id, price:p.price, date:p.date, method:'import', note:p.note||''}))));
}
for (const r of seed.recipes) { const {id,...rest}=r; store.recipes.set(id, {...rest, reviewFlags:(r.reviewFlags||[]).map(t=>({text:t,resolved:false}))}); }
store.costing_settings.set('global', {...seed.settings, pricing: seed2.pricingDefaults});
for (const i of seed2.supplies) { const sources = i.sources.map(s => { const sorted=(s.prices||[]).slice().sort((a,b)=>a.date.localeCompare(b.date)); const last=sorted[sorted.length-1]; const {prices,...rest}=s; return {...rest, active:true, currentPrice:last?last.price:null, currentPriceDate:last?last.date:null}; }); const pref = sources.find(s=>s.preferred)||sources[0]; const {id, sources:_s, ...rest} = i; store.ingredients.set(id, {...rest, sources, preferredSourceId: pref?pref.id:null, reviewFlags:(i.reviewFlags||[]).map(t=>({text:t,resolved:false}))}); store.prices.set(id, i.sources.flatMap(s => (s.prices||[]).map((p,k)=>({id:s.id+'-'+k, sourceId:s.id, price:p.price, date:p.date, method:'import', note:p.note||''})))); }
for (const p of seed2.products) { const {id,...rest}=p; store.products.set(id, {...rest, reviewFlags:(p.reviewFlags||[]).map(t=>({text:t,resolved:false}))}); }
store.requests.set('09012026-AB12', { customer_id: 'emma@example.com', status: 'NEW', created_at: new Date(), step1_data: { name: 'Emma R.', event_date: '2026-10-04', category: 'Cakes' } });
store.requests.set('08282026-CD34', { customer_id: 'liz@example.com', status: 'QUOTING', created_at: new Date(), step1_data: { name: 'Liz M.', event_date: '2026-09-20', category: 'Cookies' } });
const listeners = [];
function snapOf(name){ const m = store[name]||new Map(); return { forEach(fn){ for (const [id,data] of m) fn({id, data:()=>data}); }, docs:[...m].map(([id,data])=>({id, data:()=>data})), size:m.size }; }
export function getFirestore(){return {};}
export function collection(db, ...path){ return {type:'col', path}; }
export function doc(db, ...path){ if (db && db.type==='col') return {type:'doc', path:[...db.path, 'auto-'+Math.random().toString(36).slice(2,8)]}; return {type:'doc', path}; }
export function query(ref){ return ref; } export function orderBy(){ return null; } export function limit(){ return null; } export function where(){ return null; }
export function serverTimestamp(){ return new Date(); }
export function onSnapshot(ref, cb){ 
  if (ref.type==='col' && ref.path.length===1) { cb(snapOf(ref.path[0])); listeners.push({ref,cb}); }
  else if (ref.type==='doc') { const fire=()=>{ const m=store[ref.path[0]]; const d=m&&m.get(ref.path[1]); cb({exists:()=>!!d, data:()=>d}); }; fire(); listeners.push({ref, cb:fire, isDoc:true}); }
  return ()=>{}; }
export async function getDocs(ref){ if (ref.type==='col' && ref.path.length===1 && store[ref.path[0]]) { const m=store[ref.path[0]]; return {docs:[...m].map(([id,data])=>({id, data:()=>data}))}; } if (ref.type==='col' && ref.path.length===3 && ref.path[2]==='prices') { const list=(store.prices.get(ref.path[1])||[]).slice().sort((a,b)=>b.date.localeCompare(a.date)); return {docs:list.map(d=>({id:d.id, data:()=>d}))}; } return {docs:[]}; }
export async function getDoc(ref){ const m=store[ref.path[0]]; const d=m&&m.get(ref.path[1]); return {exists:()=>!!d, data:()=>d}; }
export async function setDoc(ref, data){
  window.__writes=(window.__writes||0)+1;
  if (ref.path.length===4 && ref.path[2]==='prices') { const list=store.prices.get(ref.path[1])||[]; list.push({id:ref.path[3], ...data}); store.prices.set(ref.path[1], list); return; } // price history entry
  const m=store[ref.path[0]]; if(m){ m.set(ref.path[1], {...(m.get(ref.path[1])||{}), ...data}); notify(ref.path[0]); } }
export async function updateDoc(ref, data){ return setDoc(ref, data); }
export async function addDoc(ref, data){ window.__writes=(window.__writes||0)+1; return {id:'new'}; }
export async function deleteDoc(ref){ const m=store[ref.path[0]]; if(m){ m.delete(ref.path[1]); notify(ref.path[0]); } }
export function writeBatch(){ const ops=[]; return { set(ref,data){ops.push(()=>setDoc(ref,data));}, update(ref,data){ops.push(()=>setDoc(ref,data));}, delete(ref){ops.push(()=>deleteDoc(ref));}, async commit(){ for(const o of ops) await o(); window.__batches=(window.__batches||0)+1; } }; }
function notify(name){ for (const l of listeners) if (l.ref.path[0]===name) { if (l.isDoc) l.cb(); else l.cb(snapOf(name)); } }
// debug hooks for the harness runners
window.__stubPrices = (id) => (store.prices.get(id) || []).map(p => ({ sourceId: p.sourceId, price: p.price, date: p.date, method: p.method, qty: p.qty }));
window.__stubCount = (name) => (store[name] ? store[name].size : null);
