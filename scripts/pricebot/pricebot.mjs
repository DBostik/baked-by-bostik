#!/usr/bin/env node
// pricebot.mjs: the deterministic half of the Baked By Bostik price bot (Costing, Phase 4).
// Plain Node 18+, no packages. Signs in as the limited "pricebot" Firebase user and talks to Firestore and
// Storage over their REST APIs. The judgment (web lookups, reading a receipt photo, matching lines to items)
// is done by Claude inside the scheduled tasks; this script only moves data in a rules-checked way.
//
//   node scripts/pricebot/pricebot.mjs check
//   node scripts/pricebot/pricebot.mjs watchlist [--out file.json]          active sources with links, prices, staleness
//   node scripts/pricebot/pricebot.mjs propose file.json [--run RUNID]       create price_proposals (skips duplicates)
//   node scripts/pricebot/pricebot.mjs receipts [--download DIR]            pending receipts; downloads the files
//   node scripts/pricebot/pricebot.mjs receipt-done ID --status done|nothing|failed [--proposals file.json]
//                                       [--unmatched "line;line"] [--note "..."] [--run RUNID]
//   node scripts/pricebot/pricebot.mjs run-start --kind price-check|receipt-scan     prints the run id
//   node scripts/pricebot/pricebot.mjs run-end RUNID --summary "..." [--status done|failed]
//
// Password: PRICEBOT_PASSWORD, or the file PRICEBOT_PASSWORD_FILE, or (default) "My Info For Claude/pricebot-password.txt"
// on the Desktop, found through $HOME/mnt/Desktop (Cowork VM) or $HOME/Desktop (Mac). The password is never printed.
// Project id, web API key and bucket come from js/firebase-config.js in this repo.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const EMAIL = process.env.PRICEBOT_EMAIL || 'pricebot@bakedbybostik.com';
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');

function readConfig() {
    const txt = fs.readFileSync(path.join(repo, 'js', 'firebase-config.js'), 'utf8');
    const pick = k => (txt.match(new RegExp(k + '\\s*:\\s*"([^"]+)"')) || [])[1];
    const cfg = { apiKey: pick('apiKey'), projectId: pick('projectId'), storageBucket: pick('storageBucket') };
    if (!cfg.apiKey || !cfg.projectId) throw new Error('Could not read js/firebase-config.js');
    return cfg;
}
function readPassword() {
    if (process.env.PRICEBOT_PASSWORD) return process.env.PRICEBOT_PASSWORD.trim();
    const candidates = [process.env.PRICEBOT_PASSWORD_FILE, path.join(os.homedir(), 'mnt', 'Desktop', 'My Info For Claude', 'pricebot-password.txt'), path.join(os.homedir(), 'Desktop', 'My Info For Claude', 'pricebot-password.txt')].filter(Boolean);
    for (const f of candidates) { try { const s = fs.readFileSync(f, 'utf8').trim(); if (s) return s; } catch (e) { } }
    throw new Error('No password: set PRICEBOT_PASSWORD or PRICEBOT_PASSWORD_FILE, or create the pricebot-password.txt file');
}
function args(argv) {
    const out = { _: [] };
    for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1] !== undefined && !String(argv[i + 1]).startsWith('--') ? argv[++i] : true; out[k] = v; } else out._.push(a); }
    return out;
}

// ------------------------------------------------------------------ Firestore REST value encoding
function toValue(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string') return { stringValue: v };
    if (v instanceof Date) return { timestampValue: v.toISOString() };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
    if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, toValue(x)])) } };
    throw new Error('Cannot encode ' + typeof v);
}
function fromValue(v) {
    if (!v) return null;
    if ('nullValue' in v) return null;
    if ('booleanValue' in v) return v.booleanValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('stringValue' in v) return v.stringValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
    if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromValue(x)]));
    if ('referenceValue' in v) return v.referenceValue;
    return null;
}
function fromDoc(d) { return { id: d.name.split('/').pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, fromValue(v)])) }; }
function fields(obj) { return toValue(obj).mapValue.fields; }

// ------------------------------------------------------------------ client
class Client {
    constructor(cfg, token) { this.cfg = cfg; this.token = token; this.base = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents`; }
    async call(method, url, body) {
        const res = await fetch(url, { method, headers: { Authorization: 'Bearer ' + this.token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
        const text = await res.text();
        let json = null; try { json = text ? JSON.parse(text) : null; } catch (e) { }
        if (!res.ok) throw new Error(`${method} ${url.replace(this.base, '')} -> ${res.status}: ${(json && json.error && json.error.message) || text.slice(0, 300)}`);
        return json;
    }
    async list(collectionId) {
        const out = []; let pageToken = '';
        do {
            const j = await this.call('GET', `${this.base}/${collectionId}?pageSize=300${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`);
            (j.documents || []).forEach(d => out.push(fromDoc(d)));
            pageToken = j.nextPageToken || '';
        } while (pageToken);
        return out;
    }
    async query(collectionId, field, op, value) {
        const j = await this.call('POST', `${this.base}:runQuery`, { structuredQuery: { from: [{ collectionId }], where: { fieldFilter: { field: { fieldPath: field }, op, value: toValue(value) } } } });
        return (j || []).filter(r => r.document).map(r => fromDoc(r.document));
    }
    async create(collectionId, data, id) {
        const url = `${this.base}/${collectionId}${id ? '?documentId=' + encodeURIComponent(id) : ''}`;
        const j = await this.call('POST', url, { fields: fields(data) });
        return fromDoc(j);
    }
    async patch(collectionId, id, data) {
        const mask = Object.keys(data).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
        const j = await this.call('PATCH', `${this.base}/${collectionId}/${encodeURIComponent(id)}?${mask}`, { fields: fields(data) });
        return fromDoc(j);
    }
    async download(storagePath, toFile) {
        const url = `https://firebasestorage.googleapis.com/v0/b/${this.cfg.storageBucket}/o/${encodeURIComponent(storagePath)}?alt=media`;
        // Firebase Storage takes a Firebase ID token as "Authorization: Firebase <token>"; try that first, then Bearer
        let res = await fetch(url, { headers: { Authorization: 'Firebase ' + this.token } });
        if (res.status === 401 || res.status === 403) res = await fetch(url, { headers: { Authorization: 'Bearer ' + this.token } });
        if (!res.ok) throw new Error(`download ${storagePath} -> ${res.status}`);
        fs.writeFileSync(toFile, Buffer.from(await res.arrayBuffer()));
        return toFile;
    }
}
async function signIn(cfg) {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${cfg.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: readPassword(), returnSecureToken: true }) });
    const j = await res.json();
    if (!res.ok) throw new Error('Sign-in failed: ' + ((j.error && j.error.message) || res.status));
    return { token: j.idToken, uid: j.localId };
}

// ------------------------------------------------------------------ helpers
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function daysSince(iso) { if (!iso) return null; const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? null : Math.floor((Date.now() - d.getTime()) / 86400000); }
function num(v) { const n = typeof v === 'string' ? parseFloat(v) : v; return (n == null || isNaN(n)) ? null : n; }
function watchlistFrom(ingredients, settings) {
    const staleDefault = num(settings?.staleDaysDefault) ?? 60;
    const rows = [];
    for (const i of ingredients) {
        for (const s of (i.sources || [])) {
            if (s.active === false) continue;
            const days = daysSince(s.currentPriceDate);
            rows.push({
                ingredientId: i.id, name: i.name, kind: i.kind || 'ingredient', category: i.category || '', baseUnit: i.baseUnit || 'g', aliases: i.aliases || [],
                sourceId: s.id, brand: s.brand || '', store: s.store || '', packageQty: num(s.packageQty), packageUnit: s.packageUnit || '', productUrl: s.productUrl || '',
                currentPrice: num(s.currentPrice), currentPriceDate: s.currentPriceDate || null, daysSincePrice: days,
                preferred: i.preferredSourceId ? i.preferredSourceId === s.id : !!s.preferred,
                stale: days == null || days > (num(i.staleDays) ?? staleDefault),
                searchable: !!(s.productUrl || (s.store && s.brand)),
            });
        }
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name) || a.sourceId.localeCompare(b.sourceId));
}
function validateProposal(p, byIng) {
    const errs = [];
    const ing = byIng.get(p.ingredientId);
    if (!ing) errs.push(`unknown ingredientId ${p.ingredientId}`);
    const src = ing && (ing.sources || []).find(s => s.id === p.sourceId);
    if (ing && !src) errs.push(`unknown sourceId ${p.sourceId} on ${p.ingredientId}`);
    const price = num(p.price);
    if (price == null || price < 0 || price > 10000) errs.push(`bad price ${p.price}`);
    if (p.foundAt && !/^\d{4}-\d{2}-\d{2}$/.test(p.foundAt)) errs.push(`bad foundAt ${p.foundAt}`);
    return { errs, ing, src, price };
}
async function createProposals(c, list, opts) {
    const ingredients = await c.list('ingredients');
    const byIng = new Map(ingredients.map(i => [i.id, i]));
    let existing = [];
    try { existing = await c.query('price_proposals', 'status', 'EQUAL', 'pending'); } catch (e) { /* older rules: no read; duplicates are then possible */ }
    const created = [], skipped = [], failed = [];
    for (const p of list) {
        const { errs, ing, src, price } = validateProposal(p, byIng);
        if (errs.length) { failed.push({ p, errs }); continue; }
        const dup = existing.find(e => e.ingredientId === p.ingredientId && e.sourceId === p.sourceId && Math.abs(num(e.price) - price) < 0.005 && (e.receiptId || '') === (p.receiptId || ''));
        if (dup) { skipped.push({ p, reason: 'same pending proposal exists' }); continue; }
        const doc = {
            ingredientId: p.ingredientId, ingredientName: ing.name || '', sourceId: p.sourceId, sourceLabel: [src.brand, src.store].filter(Boolean).join(' · '),
            price, foundAt: p.foundAt || todayISO(), status: 'pending', method: p.method === 'receipt' ? 'receipt' : 'bot',
            currentPrice: num(src.currentPrice), currentPriceDate: src.currentPriceDate || null,
            packageQty: num(p.packageQty) ?? num(src.packageQty), packageUnit: p.packageUnit || src.packageUnit || null,
            foundUrl: p.foundUrl || '', note: p.note || '', confidence: p.confidence || 'medium',
            receiptId: p.receiptId || null, receiptPath: p.receiptPath || null, lineText: p.lineText || null, qty: num(p.qty),
            runId: opts.run || null, createdBy: 'pricebot', createdAt: new Date(),
        };
        try { const d = await c.create('price_proposals', doc); created.push({ id: d.id, ingredientId: p.ingredientId, sourceId: p.sourceId, price }); }
        catch (e) { failed.push({ p, errs: [e.message] }); }
    }
    return { created, skipped, failed };
}

// ------------------------------------------------------------------ commands
async function main() {
    const a = args(process.argv.slice(2));
    const cmd = a._[0];
    if (!cmd || cmd === 'help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url)).toString().split('\n').slice(1, 20).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); return; }
    const cfg = readConfig();
    const { token, uid } = await signIn(cfg);
    const c = new Client(cfg, token);

    if (cmd === 'check') {
        const ingredients = await c.list('ingredients');
        const wl = watchlistFrom(ingredients, {});
        let receipts = 'no access';
        try { receipts = (await c.query('receipt_queue', 'status', 'EQUAL', 'pending')).length; } catch (e) { receipts = 'no access (' + e.message.slice(0, 60) + ')'; }
        console.log(JSON.stringify({ ok: true, uid, project: cfg.projectId, ingredients: ingredients.length, sources: wl.length, searchable: wl.filter(w => w.searchable).length, pendingReceipts: receipts }, null, 2));
        return;
    }
    if (cmd === 'watchlist') {
        const ingredients = await c.list('ingredients');
        const wl = watchlistFrom(ingredients, {});
        const out = JSON.stringify(wl, null, 1);
        if (a.out) { fs.writeFileSync(a.out, out); console.log(`${wl.length} sources written to ${a.out} (${wl.filter(w => w.searchable).length} searchable)`); }
        else console.log(out);
        return;
    }
    if (cmd === 'propose') {
        const file = a._[1]; if (!file) throw new Error('propose needs a JSON file');
        const list = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!Array.isArray(list)) throw new Error('the file must hold a JSON array of proposals');
        const r = await createProposals(c, list, { run: typeof a.run === 'string' && a.run ? a.run : null });
        console.log(JSON.stringify({ created: r.created.length, skipped: r.skipped.length, failed: r.failed.length, details: r }, null, 2));
        return;
    }
    if (cmd === 'receipts') {
        const pending = await c.query('receipt_queue', 'status', 'EQUAL', 'pending');
        const dir = a.download === true ? path.join(here, 'tmp') : (a.download || null);
        if (dir) fs.mkdirSync(dir, { recursive: true });
        const out = [];
        for (const r of pending) {
            const row = { id: r.id, path: r.path, store: r.store || '', date: r.date || '', note: r.note || '', contentType: r.contentType || '', uploadedAt: r.uploadedAt || null };
            if (dir && r.path) { try { row.localFile = await c.download(r.path, path.join(dir, path.basename(r.path))); } catch (e) { row.downloadError = e.message; } }
            out.push(row);
        }
        console.log(JSON.stringify(out, null, 2));
        return;
    }
    if (cmd === 'receipt-done') {
        const id = a._[1]; if (!id) throw new Error('receipt-done needs the receipt id');
        const status = a.status || 'done';
        if (!['done', 'nothing', 'failed'].includes(status)) throw new Error('status must be done, nothing or failed');
        let result = { created: [], skipped: [], failed: [] };
        if (a.proposals) {
            const list = JSON.parse(fs.readFileSync(a.proposals, 'utf8'));
            const queue = await c.query('receipt_queue', 'status', 'EQUAL', 'pending');
            const rec = queue.find(r => r.id === id);
            list.forEach(p => { p.method = 'receipt'; p.receiptId = id; p.receiptPath = p.receiptPath || rec?.path || null; if (!p.foundAt && rec?.date) p.foundAt = rec.date; });
            result = await createProposals(c, list, { run: typeof a.run === 'string' && a.run ? a.run : null });
        }
        const unmatched = a.unmatched ? String(a.unmatched).split(';').map(s => s.trim()).filter(Boolean) : [];
        await c.patch('receipt_queue', id, { status: result.created.length || status !== 'done' ? status : 'nothing', scannedAt: new Date(), proposalsCount: result.created.length, unmatched, botNote: a.note ? String(a.note) : '' });
        console.log(JSON.stringify({ receipt: id, status, created: result.created.length, skipped: result.skipped.length, failed: result.failed, unmatched }, null, 2));
        return;
    }
    if (cmd === 'run-start') {
        const kind = a.kind || 'price-check';
        const d = await c.create('bot_runs', { kind, startedAt: new Date(), status: 'running', summary: '' });
        console.log(d.id);
        return;
    }
    if (cmd === 'run-end') {
        const id = a._[1]; if (!id) throw new Error('run-end needs the run id');
        await c.patch('bot_runs', id, { status: a.status || 'done', finishedAt: new Date(), summary: String(a.summary || '') });
        console.log('ok');
        return;
    }
    throw new Error('Unknown command ' + cmd);
}
main().catch(e => { console.error('pricebot:', e.message); process.exit(1); });
