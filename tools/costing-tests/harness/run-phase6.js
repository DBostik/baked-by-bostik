// Phase 6 harness: turn inventory on, count, reorder point and status, stock in from a shopping trip (packs),
// adjust with a reason, stock out when a request becomes COMPLETED (auto) with undo, "Made this" on an estimate,
// history modal, Home stock card, Analytics low-stock pill.
// Run: python3 tools/costing-tests/harness/prepare.py && node tools/costing-tests/harness/run-phase6.js
const { chromium } = require(resolvePlaywright());
function resolvePlaywright() { for (const c of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright', '/opt/node-tools/node_modules/playwright', '/usr/lib/node_modules/playwright']) { try { require.resolve(c); return c; } catch (e) { } } throw new Error('playwright not found; npm i -g playwright'); }
const http = require('http'); const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, 'site');
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/admin/' || p === '/admin') p = '/admin/index.html'; const file = path.join(root, p); if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; } const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream'; res.writeHead(200, { 'content-type': type }); res.end(fs.readFileSync(file)); });

(async () => {
    await new Promise(r => server.listen(4179, r));
    const b = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
    const page = await b.newPage({ viewport: { width: 1360, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
    page.on('dialog', d => d.accept());
    await page.route(/gstatic|googleapis|jsdelivr|cdnjs/, r => r.abort());
    await page.goto('http://localhost:4179/admin/'); await page.waitForTimeout(900);
    const shot = async n => page.screenshot({ path: path.join(__dirname, `shot6-${n}.png`) });
    const nav = async p => { const sel = `.nav-links a[data-page="${p}"]`; await page.$eval(sel, el => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(100); await page.click(sel, { force: true }); await page.waitForTimeout(500); };
    const text = async sel => ((await page.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
    const stock = async id => page.evaluate(id => { const i = window.BBBCosting.state.ingredients.get(id); return i.stock || null; }, id);
    const out = {};

    // 1. off state, turn on
    await nav('costing-inventory'); await shot('off');
    out.offText = (await text('#page-costing-inventory')).slice(0, 80);
    await page.click('[data-action="inv-start"]'); await page.waitForTimeout(600); await shot('on');
    out.trackedRows = await page.$$eval('#page-costing-inventory tbody tr', r => r.length);
    out.firstStatus = await text('#page-costing-inventory tbody tr:first-child .c-badge:last-of-type');
    out.startedAt = await page.evaluate(() => !!window.BBBCosting.state.settings.inventory?.startedAt);

    // 2. count board-round-6 to 12, set reorder point 5, then recount to 4 -> low
    await page.click('tr[data-id="board-round-6"] [data-action="inv-count"]'); await page.waitForTimeout(300);
    await page.fill('#inv-amount', '12'); await page.fill('#inv-note', 'First count'); await page.click('[data-action="inv-count-save"]'); await page.waitForTimeout(500);
    out.afterCount = await stock('board-round-6');
    await page.fill('tr[data-id="board-round-6"] .c-inv-reorder', '5'); await page.$eval('tr[data-id="board-round-6"] .c-inv-reorder', el => el.dispatchEvent(new Event('change', { bubbles: true }))); await page.waitForTimeout(400);
    out.statusOk = await text('tr[data-id="board-round-6"] td:nth-child(4)');
    out.onHandText = await text('tr[data-id="board-round-6"] td:nth-child(2)');
    await page.click('tr[data-id="board-round-6"] [data-action="inv-count"]'); await page.waitForTimeout(300);
    await page.fill('#inv-amount', '4'); await page.click('[data-action="inv-count-save"]'); await page.waitForTimeout(500);
    out.statusLow = await text('tr[data-id="board-round-6"] td:nth-child(4)');

    // 3. stock in from a trip: 2 packs of 20 boards at Amazon
    await nav('costing-log'); await page.selectOption('#trip-store', 'Amazon'); await page.waitForTimeout(300);
    await page.fill('#page-costing-log input.c-price-in[data-key="board-round-6|amazon"]', '11.99');
    await page.fill('#page-costing-log input.c-qty-in[data-key="board-round-6|amazon"]', '2');
    await page.click('[data-action="save-trip"]'); await page.waitForTimeout(800);
    out.afterTrip = await stock('board-round-6');

    // 4. adjust: remove 3 (spoilage)
    await nav('costing-inventory');
    await page.click('tr[data-id="board-round-6"] [data-action="inv-adjust"]'); await page.waitForTimeout(300);
    await page.fill('#inv-amount', '3'); await page.selectOption('#inv-reason', 'spoilage'); await page.click('[data-action="inv-adjust-save"]'); await page.waitForTimeout(500);
    out.afterAdjust = await stock('board-round-6');
    out.recentMoves = await page.$$eval('#page-costing-inventory .c-card tbody tr', r => r.map(x => x.innerText.replace(/\s+/g, ' ')).slice(0, 4));

    // 5. estimate linked to a request; request becomes COMPLETED -> auto stock out; then undo from Estimates
    await nav('costing-estimator');
    await page.selectOption('#est-add-product', 'celebration-cake'); await page.click('[data-action="est-add-item"]'); await page.waitForTimeout(400);
    await page.selectOption('[data-e="requestId"]', '09012026-AB12'); await page.waitForTimeout(300);
    await page.click('[data-action="est-save"]'); await page.waitForTimeout(500);
    const before = await stock('board-round-6');
    await page.evaluate(() => window.__stubSet('requests', '09012026-AB12', { status: 'COMPLETED', updated_at: new Date() })); await page.waitForTimeout(900);
    out.afterOrder = await stock('board-round-6');
    out.boardsTakenByOrder = before.onHand - out.afterOrder.onHand;
    out.estimateStamped = await page.evaluate(() => { const e = [...window.BBBCosting.state.estimates.values()][0]; return !!e.stockOut && e.stockOut.items; });
    out.butterUntouched = await page.evaluate(() => { const i = window.BBBCosting.state.ingredients.get('butter'); return !i.stock || !i.stock.track; });
    await nav('costing-estimates'); await page.waitForTimeout(400); await shot('estimates');
    out.estimateButton = await text('#page-costing-estimates [data-action="inv-undo-group"]');
    await page.click('#page-costing-estimates [data-action="inv-undo-group"]'); await page.waitForTimeout(700);
    out.afterUndo = await stock('board-round-6');
    out.madeThisButton = await text('#page-costing-estimates [data-action="inv-take"]');
    await page.click('#page-costing-estimates [data-action="inv-take"]'); await page.waitForTimeout(700);
    out.afterMadeThis = await stock('board-round-6');
    // second completion of the same request must not double count
    await page.evaluate(() => window.__stubSet('requests', '09012026-AB12', { status: 'BOOKED', updated_at: new Date() })); await page.waitForTimeout(300);
    await page.evaluate(() => window.__stubSet('requests', '09012026-AB12', { status: 'COMPLETED', updated_at: new Date() })); await page.waitForTimeout(700);
    out.afterSecondCompletion = await stock('board-round-6');
    // 5b. audit K1 (Sep 2026): opening the estimate and clicking Save after its stock-out must keep the stamp,
    // so Home does not ask to take it again and a second "Made this" / re-completion cannot double count
    await nav('costing-estimates'); await page.waitForTimeout(300);
    await page.click('#page-costing-estimates [data-action="est-open"]'); await page.waitForTimeout(500);
    await page.click('[data-action="est-save"]'); await page.waitForTimeout(700);
    out.k1StampKeptAfterEditSave = await page.evaluate(() => { const e = [...window.BBBCosting.state.estimates.values()][0]; return !!e.stockOut; });
    out.k1StockAfterEditSave = await stock('board-round-6');
    await nav('costing-home'); await page.waitForTimeout(400);
    out.k1HomeAsksToTakeAgain = /not yet taken from stock/.test(await text('#page-costing-home'));
    await page.evaluate(() => window.__stubSet('requests', '09012026-AB12', { status: 'BOOKED', updated_at: new Date() })); await page.waitForTimeout(300);
    await page.evaluate(() => window.__stubSet('requests', '09012026-AB12', { status: 'COMPLETED', updated_at: new Date() })); await page.waitForTimeout(700);
    out.k1StockAfterRecompletion = await stock('board-round-6');

    // 6. history modal, home card, analytics pill
    await nav('costing-inventory'); await page.click('tr[data-id="board-round-6"] [data-action="inv-history"]'); await page.waitForTimeout(300); await shot('history');
    out.historyRows = await page.$$eval('#costing-modal tbody tr', r => r.length);
    await page.click('#costing-modal [data-action="close-modal"]');
    await page.click('tr[data-id="board-round-6"] [data-action="inv-count"]'); await page.waitForTimeout(300);
    await page.fill('#inv-amount', '2'); await page.click('[data-action="inv-count-save"]'); await page.waitForTimeout(400);
    await nav('costing-home'); await page.waitForTimeout(500); await shot('home');
    out.homeStock = (await text('#c-home-stock')).slice(0, 200);
    await nav('analytics'); await page.waitForTimeout(500);
    out.tileLow = await text('#costing-analytics-tile .c-pill[data-page="costing-inventory"]');

    // 7. mobile
    await nav('costing-inventory'); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400); await shot('mobile');
    out.scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    if (out.scrollW > 390) out.wideElements = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > 392 && e.offsetParent !== null && !e.closest('.c-table-wrap')).slice(0, 8).map(e => `${e.tagName}.${e.className} right=${Math.round(e.getBoundingClientRect().right)}`));

    out.errors = errors;
    console.log(JSON.stringify(out, null, 2));
    await b.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
