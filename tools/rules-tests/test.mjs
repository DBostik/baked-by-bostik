// Rules tests for Phase 1. Every "allowed" case uses the exact object shape the public site writes
// (js/firebase-handler.js Step 1, js/order-flow.js Step 2, js/leave-review.js, js/seasonal.js).
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, getDocs, addDoc, collection, deleteDoc, serverTimestamp, query, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getBytes, listAll, deleteObject } from 'firebase/storage';

const ADMIN = 'LYJpCo6DEIO9w9Yurupuw0uyxpJ2';
const BOT = 'USNXR3iZcdVnNUY2VdPdoeYE3BI2';
const BUCKET = 'bakedbybostik-5eb55.firebasestorage.app';

const env = await initializeTestEnvironment({
  projectId: 'bakedbybostik-5eb55',
  firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
  storage: { rules: fs.readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
});

let pass = 0, fail = 0;
async function ok(name, p) { try { await assertSucceeds(p); pass++; console.log('  ok   ', name); } catch (e) { fail++; console.log('  FAIL ', name, '\n        ', String(e.message || e).split('\n')[0].slice(0, 300)); } }
async function no(name, p) { try { await assertFails(p); pass++; console.log('  ok   ', name, '(denied as expected)'); } catch (e) { fail++; console.log('  FAIL ', name, '(should have been denied)'); } }

// one context (and one Firestore / Storage instance) per identity for the whole run
const CTX = { anon: env.unauthenticatedContext(), admin: env.authenticatedContext(ADMIN), bot: env.authenticatedContext(BOT), other: env.authenticatedContext('someRandomUid123') };
const DB = {}, ST = {};
for (const k of Object.keys(CTX)) { DB[k] = CTX[k].firestore(); ST[k] = CTX[k].storage(); }
const anon = () => ({ firestore: () => DB.anon, storage: () => ST.anon });
const admin = () => ({ firestore: () => DB.admin, storage: () => ST.admin });
const bot = () => ({ firestore: () => DB.bot, storage: () => ST.bot });
const other = () => ({ firestore: () => DB.other, storage: () => ST.other });

// ---- exact client payloads -------------------------------------------------------------------
const REQ_ID = '09082026-4821';
function step1Customer() { return { name: 'Jane Doe', email: 'Jane.Doe@Example.com', phone: '(630) 555-0100', last_updated: serverTimestamp() }; }
function step1Request(customerId) {
  return {
    customer_id: customerId,
    status: 'NEW',
    step1_data: { category: 'Cookies', event_date: '2026-10-03', quantity_value: '24', phone: '(630) 555-0100', fulfillment: 'pickup', delivery_zip: null, rush_flag: false, pickup_window: 'Not sure yet' },
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
}
const IMG = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/requests%2F${REQ_ID}%2F1757300000000_inspo.jpg?alt=media&token=abc-123`;
function step2Update(images = [IMG]) {
  return {
    status: 'AWAITING_DETAILS',
    step2_data: {
      occasion: 'birthday', occasion_other: null, theme_keywords: 'Like: Cake, Star Wars, Darth Vader', colors: 'navy, gold',
      complexity: 'detailed', budget_range: '100-200',
      add_ons: [{ type: 'Cookies', qty: '2 dozen' }, { type: 'Cake', qty: '6 inch smash cake' }],
      allergies: 'yes', allergy_details: 'Tree nuts', hear_about_us: 'Friend/Family Referral: Sarah', notes: 'Please no fondant.',
      inspiration_images: images, email_opt_in: true, cake_flavor: 'Not sure yet', filling_flavor: 'Not sure yet',
    },
    updated_at: serverTimestamp(),
  };
}

console.log('\n== Firestore: the public order form (Step 1) ==');
{
  const db = anon().firestore();
  const custId = 'jane.doe@example.com';
  await ok('Step 1: new customer setDoc(merge) under own lower-cased email', setDoc(doc(db, 'customers', custId), step1Customer(), { merge: true }));
  await ok('Step 1: returning customer setDoc(merge) with a new phone', setDoc(doc(db, 'customers', custId), { ...step1Customer(), phone: '(630) 555-0199' }, { merge: true }));
  await ok('Step 1: create request with the exact Step 1 shape', setDoc(doc(db, 'requests', REQ_ID), step1Request(custId)));
  await ok('Step 1: delivery order (zip string, rush true)', setDoc(doc(db, 'requests', '09082026-4822'), { ...step1Request(custId), step1_data: { ...step1Request(custId).step1_data, fulfillment: 'delivery', delivery_zip: '60137', rush_flag: true, pickup_window: '9am–11am' } }));
  await ok('Step 1: collision with an existing id fails as before (not an overwrite)', assertFails(setDoc(doc(db, 'requests', REQ_ID), step1Request('someone.else@example.com'))));
}
console.log('\n== Firestore: attacker cases on customers ==');
{
  const db = anon().firestore();
  await no('change an existing customer email to another address', setDoc(doc(db, 'customers', 'jane.doe@example.com'), { name: 'Jane Doe', email: 'attacker@evil.com', phone: '1', last_updated: serverTimestamp() }, { merge: true }));
  await no('create a customer under an id that is not its email', setDoc(doc(db, 'customers', 'victim@example.com'), { name: 'X', email: 'me@evil.com', phone: '1', last_updated: serverTimestamp() }));
  await no('create a customer with extra fields (address/notes)', setDoc(doc(db, 'customers', 'new@example.com'), { name: 'X', email: 'new@example.com', phone: '1', address: '1 Main', notes: 'vip', last_updated: serverTimestamp() }));
  await no('create a customer with a 5,000-char name', setDoc(doc(db, 'customers', 'big@example.com'), { name: 'A'.repeat(5000), email: 'big@example.com', phone: '1', last_updated: serverTimestamp() }));
  await no('anonymous read of a customer', getDoc(doc(db, 'customers', 'jane.doe@example.com')));
  await no('anonymous delete of a customer', deleteDoc(doc(db, 'customers', 'jane.doe@example.com')));
}
console.log('\n== Firestore: attacker cases on requests ==');
{
  const db = anon().firestore();
  await no('create a request with status BOOKED', setDoc(doc(db, 'requests', '09082026-9001'), { ...step1Request('x@example.com'), status: 'BOOKED' }));
  await no('create a request with quote fields', setDoc(doc(db, 'requests', '09082026-9002'), { ...step1Request('x@example.com'), quote_total: 999, quote_pdf_url: 'javascript:alert(1)' }));
  await no('create a request under an HTML-ish id', setDoc(doc(db, 'requests', `<img src=x onerror=alert(1)>`), step1Request('x@example.com')));
  await no('create a request under an auto-style id', setDoc(doc(db, 'requests', 'abcDEF1234567890abcd'), step1Request('x@example.com')));
  await no('create a request with a backdated created_at', setDoc(doc(db, 'requests', '09082026-9003'), { ...step1Request('x@example.com'), created_at: new Date('2020-01-01') }));
  await no('create a request with unknown step1 keys', setDoc(doc(db, 'requests', '09082026-9004'), { ...step1Request('x@example.com'), step1_data: { ...step1Request('x@example.com').step1_data, admin_note: 'x' } }));
  await no('anonymous read of a request', getDoc(doc(db, 'requests', REQ_ID)));
  await no('anonymous list of requests', getDocs(query(collection(db, 'requests'), limit(1))));
}
console.log('\n== Firestore: Step 2 (order-flow.js) ==');
{
  const db = anon().firestore();
  await ok('Step 2: update NEW request with the exact Step 2 shape (one photo, two add-ons)', updateDoc(doc(db, 'requests', REQ_ID), step2Update()));
  await ok('Step 2: re-submit (back button) while AWAITING_DETAILS', updateDoc(doc(db, 'requests', REQ_ID), step2Update([])));
  await ok('Step 2: no photos, no add-ons, opt-out', updateDoc(doc(db, 'requests', '09082026-4822'), { ...step2Update([]), step2_data: { ...step2Update([]).step2_data, add_ons: [], email_opt_in: false, allergies: 'no', allergy_details: 'None' } }));
  await ok('Step 2: three photos', updateDoc(doc(db, 'requests', '09082026-4822'), step2Update([IMG, IMG.replace('inspo', 'b'), IMG.replace('inspo', 'c')])));
  await ok('Step 2: ten photos (hard ceiling)', updateDoc(doc(db, 'requests', '09082026-4822'), step2Update(Array.from({ length: 10 }, (_, i) => IMG.replace('inspo', 'p' + i)))));
  await no('Step 2: eleven photos', updateDoc(doc(db, 'requests', '09082026-4822'), step2Update(Array.from({ length: 11 }, (_, i) => IMG.replace('inspo', 'p' + i)))));
  await no('Step 2 with a javascript: image URL', updateDoc(doc(db, 'requests', REQ_ID), step2Update(['javascript:alert(document.cookie)'])));
  await no('Step 2 with an off-site image URL', updateDoc(doc(db, 'requests', REQ_ID), step2Update(['https://evil.example/pixel.gif'])));
  await no('Step 2 with a gallery-bucket URL (not the requests folder)', updateDoc(doc(db, 'requests', REQ_ID), step2Update([`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/gallery%2Fx.jpg?alt=media`])));
  await no('Step 2 with an unknown step2 key', updateDoc(doc(db, 'requests', REQ_ID), { ...step2Update([]), step2_data: { ...step2Update([]).step2_data, quote_total: 1 } }));
  await no('Step 2 that also touches customer_id', updateDoc(doc(db, 'requests', REQ_ID), { ...step2Update([]), customer_id: 'attacker@evil.com' }));
  await no('Step 2 with a 4th add-on', updateDoc(doc(db, 'requests', REQ_ID), { ...step2Update([]), step2_data: { ...step2Update([]).step2_data, add_ons: [{ type: 'a', qty: '1' }, { type: 'b', qty: '1' }, { type: 'c', qty: '1' }, { type: 'd', qty: '1' }] } }));
  // admin moves it on; the public can no longer touch it
  await ok('admin: move request to BOOKED', updateDoc(doc(admin().firestore(), 'requests', REQ_ID), { status: 'BOOKED', updated_at: new Date() }));
  await no('Step 2 on a BOOKED request (knock-back attack)', updateDoc(doc(db, 'requests', REQ_ID), step2Update([])));
  await ok('admin: move request to COMPLETED', updateDoc(doc(admin().firestore(), 'requests', REQ_ID), { status: 'COMPLETED' }));
  await no('Step 2 on a COMPLETED request', updateDoc(doc(db, 'requests', REQ_ID), step2Update([])));
}
console.log('\n== Firestore: reviews, seasonal, public reads ==');
{
  const db = anon().firestore();
  await ok('leave-review.js: addDoc pending review with exact shape', addDoc(collection(db, 'pending_reviews'), { name: 'Sarah M.', event_date: '2026-08-30', rating: 5, text: 'Wonderful cookies!', created_at: serverTimestamp() }));
  await no('pending review with an extra field (approved: true)', addDoc(collection(db, 'pending_reviews'), { name: 'X', event_date: '2026-08-30', rating: 5, text: 'x', approved: true, created_at: serverTimestamp() }));
  await no('anonymous write to approved reviews', addDoc(collection(db, 'reviews'), { name: 'X', text: 'x', rating: 5, created_at: serverTimestamp() }));
  await ok('seasonal.js: addDoc seasonal order with exact shape', addDoc(collection(db, 'seasonal_orders'), { parent_name: 'A', parent_email: 'a@b.com', parent_phone: '1', pickup_date: '2026-05-10', num_sets: 2, teacher_names: ['Ms. K'], total_price: 40, free_crayon_box: false, campaign: 'teacher-appreciation-2026', campaign_id: 'teacher_appreciation_2026', status: 'PENDING_PAYMENT', created_at: serverTimestamp(), updated_at: serverTimestamp() }));
  await no('seasonal order pre-marked PAID', addDoc(collection(db, 'seasonal_orders'), { parent_name: 'A', parent_email: 'a@b.com', parent_phone: '1', pickup_date: '2026-05-10', num_sets: 2, teacher_names: [], total_price: 40, free_crayon_box: false, campaign: 'x', campaign_id: 'x', status: 'PAID', created_at: serverTimestamp(), updated_at: serverTimestamp() }));
  await ok('seasonal.js: addDoc waitlist with exact shape', addDoc(collection(db, 'seasonal_waitlist'), { name: 'A', email: 'a@b.com', campaign: 'teacher-appreciation-2026', created_at: serverTimestamp() }));
  { const adb = admin().firestore(); await setDoc(doc(adb, 'gallery_items', 'g1'), { visible: true, sort_order: 0, image_url: 'x' }); await setDoc(doc(adb, 'reviews', 'r1'), { name: 'A', text: 't', rating: 5 }); await setDoc(doc(adb, 'site_content', 'homepage'), { themes: [] }); await setDoc(doc(adb, 'ingredients', 'butter'), { name: 'Butter' }); }
  await ok('public read: gallery_items', getDoc(doc(db, 'gallery_items', 'g1')));
  await ok('public read: reviews', getDoc(doc(db, 'reviews', 'r1')));
  await ok('public read: site_content/homepage', getDoc(doc(db, 'site_content', 'homepage')));
  await no('public read: ingredients (costing data)', getDoc(doc(db, 'ingredients', 'butter')));
}
console.log('\n== Firestore: admin, other signed-in user, pricebot ==');
{
  const adb = admin().firestore();
  await ok('admin: read requests', getDocs(collection(adb, 'requests')));
  await ok('admin: read customers', getDocs(collection(adb, 'customers')));
  await ok('admin: create a customer with any fields (New Customer modal, addDoc)', addDoc(collection(adb, 'customers'), { name: 'Walk-in', email: 'w@x.com', phone: '1', address: '1 Main St', created_at: new Date() }));
  await ok('admin: create a manual request with any shape', setDoc(doc(adb, 'requests', 'MANUAL-1'), { customer_id: 'w@x.com', status: 'QUOTING', step1_data: { category: 'Cakes' }, created_at: new Date(), manual: true }));
  await ok('admin: write an order', setDoc(doc(adb, 'orders', 'o1'), { total_price: 100, amount_paid: 50 }));
  await ok('admin: delete a request', deleteDoc(doc(adb, 'requests', 'MANUAL-1')));
  const odb = other().firestore();
  await no('other signed-in user: read requests', getDocs(collection(odb, 'requests')));
  await no('other signed-in user: read ingredients', getDoc(doc(odb, 'ingredients', 'butter')));
  const bdb = bot().firestore();
  await ok('pricebot: read ingredients', getDoc(doc(bdb, 'ingredients', 'butter')));
  await no('pricebot: write ingredients', setDoc(doc(bdb, 'ingredients', 'butter'), { name: 'x' }));
  await ok('pricebot: create a well-formed proposal', setDoc(doc(bdb, 'price_proposals', 'p1'), { ingredientId: 'butter', sourceId: 's', price: 4.5, foundAt: '2026-09-08', status: 'pending' }));
  await no('pricebot: read requests', getDocs(collection(bdb, 'requests')));
}

console.log('\n== Storage: order-form uploads (order-flow.js) ==');
{
  const st = anon().storage();
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const path = `requests/${REQ_ID}/1757300000000_inspo.jpg`;
  await ok('anonymous upload of a jpeg under a well-formed request id', uploadBytes(ref(st, path), jpg, { contentType: 'image/jpeg' }));
  await ok('anonymous upload of a png', uploadBytes(ref(st, `requests/${REQ_ID}/1757300000001_b.png`), jpg, { contentType: 'image/png' }));
  await ok('anonymous upload of a heic (iPhone)', uploadBytes(ref(st, `requests/${REQ_ID}/1757300000002_c.heic`), jpg, { contentType: 'image/heic' }));
  await ok('anonymous upload of a webp', uploadBytes(ref(st, `requests/${REQ_ID}/1757300000003_d.webp`), jpg, { contentType: 'image/webp' }));
  await ok('getDownloadURL right after upload (what the form does)', getDownloadURL(ref(st, path)));
  await ok('anonymous get of that object', getBytes(ref(st, path)));
  await no('anonymous LIST of the request folder', listAll(ref(st, `requests/${REQ_ID}`)));
  await no('anonymous LIST of requests/', listAll(ref(st, 'requests')));
  await no('upload of an svg (scriptable) declared as image', uploadBytes(ref(st, `requests/${REQ_ID}/x.svg`), jpg, { contentType: 'image/svg+xml' }));
  await no('upload of an html file', uploadBytes(ref(st, `requests/${REQ_ID}/x.html`), jpg, { contentType: 'text/html' }));
  await no('upload under a made-up folder name', uploadBytes(ref(st, `requests/evil-folder/x.jpg`), jpg, { contentType: 'image/jpeg' }));
  await no('upload to quotes/', uploadBytes(ref(st, `quotes/x.pdf`), jpg, { contentType: 'application/pdf' }));
  await no('anonymous overwrite (update) of an existing object', uploadBytes(ref(st, path), jpg, { contentType: 'image/jpeg' }));
  await no('anonymous delete of an object', deleteObject(ref(st, `requests/${REQ_ID}/1757300000001_b.png`)));
  await no('upload of a 15 MB+ file', uploadBytes(ref(st, `requests/${REQ_ID}/big.jpg`), new Uint8Array(15 * 1024 * 1024 + 1), { contentType: 'image/jpeg' }));
}
console.log('\n== Storage: quotes and admin ==');
{
  const ast = admin().storage();
  await ok('admin (function/dashboard): write a quote PDF', uploadBytes(ref(ast, `quotes/${REQ_ID}_1757300000000.pdf`), new Uint8Array([0x25, 0x50, 0x44, 0x46]), { contentType: 'application/pdf' }));
  await ok('admin: getDownloadURL of the quote (dashboard step)', getDownloadURL(ref(ast, `quotes/${REQ_ID}_1757300000000.pdf`)));
  await ok('admin: list the request folder', listAll(ref(ast, `requests/${REQ_ID}`)));
  await ok('admin: list quotes/', listAll(ref(ast, 'quotes')));
  const st = anon().storage();
  await ok('customer: get the quote PDF by its exact path', getBytes(ref(st, `quotes/${REQ_ID}_1757300000000.pdf`)));
  await no('anonymous LIST of quotes/ (the enumeration Grok missed)', listAll(ref(st, 'quotes')));
  await ok('public read of gallery images', listAll(ref(st, 'gallery')));
  const bst = bot().storage();
  await no('pricebot: list requests/', listAll(ref(bst, 'requests')));
  await no('other signed-in user: list quotes/', listAll(ref(other().storage(), 'quotes')));
}

await env.cleanup();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
