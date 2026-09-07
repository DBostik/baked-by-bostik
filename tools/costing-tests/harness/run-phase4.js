// Phase 4 harness: Price Reviews inbox (approve with an edited price, dismiss, filters), receipt upload and queue,
// the proposals count on Costing Home and the Analytics tile, the Settings "Price bot and receipts" card.
// Run: python3 tools/costing-tests/harness/prepare.py && node tools/costing-tests/harness/run-phase4.js
const { chromium } = require(resolvePlaywright());
function resolvePlaywright() { for (const c of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright', '/opt/node-tools/node_modules/playwright', '/usr/lib/node_modules/playwright']) { try { require.resolve(c); return c; } catch (e) { } } throw new Error('playwright not found; npm i -g playwright'); }
const http = require('http'); const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, 'site');
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/admin/' || p === '/admin') p = '/admin/index.html'; const file = path.join(root, p); if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; } const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream'; res.writeHead(200, { 'content-type': type }); res.end(fs.readFileSync(file)); });

(async () => {
    await new Promise(r => server.listen(4177, r));
    const b = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
    const page = await b.newPage({ viewport: { width: 1360, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
    page.on('dialog', d => d.accept());
    await page.route(/gstatic|googleapis|jsdelivr|cdnjs/, r => r.abort());
    await page.goto('http://localhost:4177/admin/'); await page.waitForTimeout(900);
    const shot = async n => page.screenshot({ path: path.join(__dirname, `shot4-${n}.png`) });
    const nav = async p => { const sel = `.nav-links a[data-page="${p}"]`; await page.$eval(sel, el => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(100); await page.click(sel, { force: true }); await page.waitForTimeout(500); };
    const text = async sel => ((await page.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
    const out = {};

    // 1. Home shows the waiting count; Analytics tile too
    await nav('costing-home'); await page.waitForTimeout(500); await shot('home');
    out.homeReviews = await text('.c-reviews-home');
    await nav('analytics'); await page.waitForTimeout(600);
    out.tileProposals = await text('#costing-analytics-tile .c-pill[data-page="costing-reviews"]');

    // 2. Inbox: three waiting, rows show on-file vs found, link, receipt line, package mismatch warning
    await nav('costing-reviews'); await page.waitForTimeout(600); await shot('reviews');
    out.headerCounts = await text('#page-costing-reviews .c-card-head .c-muted');
    out.rows = await page.$$eval('#page-costing-reviews .c-proposal', r => r.map(x => x.innerText.replace(/\s+/g, ' ').slice(0, 160)));
    out.mismatchWarning = await page.$$eval('.c-warntext', r => r.length);
    out.receiptRows = await page.$$eval('#rv-receipts .c-receipt', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
    await page.waitForTimeout(300);
    out.thumbs = await page.$$eval('#rv-receipts img', r => r.length);

    // 3. Approve butter at a corrected price, dismiss sugar
    const butter = await page.$('.c-proposal[data-id="prop-butter"]');
    await butter.$eval('[data-f="price"]', el => { el.value = '25.99'; });
    await page.click('.c-proposal[data-id="prop-butter"] [data-action="rv-approve"]'); await page.waitForTimeout(700);
    out.butterHistory = await page.evaluate(() => window.__stubPrices('butter'));
    out.butterSource = await page.evaluate(() => { const i = window.BBBCosting.state.ingredients.get('butter'); const s = i.sources.find(x => x.id === 'costco-kirkland'); return { price: s.currentPrice, date: s.currentPriceDate, method: s.currentMethod }; });
    await page.click('.c-proposal[data-id="prop-sugar"] [data-action="rv-dismiss"]'); await page.waitForTimeout(500);
    out.afterCounts = await text('#page-costing-reviews .c-card-head .c-muted');
    out.waitingNow = await page.$$eval('#page-costing-reviews .c-proposal', r => r.length);
    await page.selectOption('#rv-filter', 'approved'); await page.waitForTimeout(300);
    out.approvedRow = await page.$$eval('#page-costing-reviews .c-proposal', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
    await page.selectOption('#rv-filter', 'all'); await page.waitForTimeout(300);
    out.allRows = await page.$$eval('#page-costing-reviews .c-proposal', r => r.length);
    await page.selectOption('#rv-filter', 'pending'); await page.waitForTimeout(300);

    // 4. Upload a receipt (fake jpeg) with store and note
    await page.setInputFiles('#rv-file', { name: 'costco.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake-jpeg-bytes') });
    await page.selectOption('#rv-store', 'Costco'); await page.fill('#rv-note', 'Sunday run');
    await page.click('[data-action="rv-upload"]'); await page.waitForTimeout(700); await shot('reviews-after');
    out.uploads = await page.evaluate(() => window.__uploads);
    out.queueAfter = await page.$$eval('#rv-receipts .c-receipt', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
    out.queueCount = await page.evaluate(() => window.__stubCount('receipt_queue'));

    // 5. Home card disappears when nothing is waiting: dismiss the last one via Dismiss all
    await page.click('.c-proposal[data-id="prop-eggs"] [data-action="rv-dismiss"]'); await page.waitForTimeout(400);
    await nav('costing-home'); await page.waitForTimeout(400);
    out.homeReviewsAfter = await page.$$eval('.c-reviews-home', r => r.length);

    // 6. Settings card
    await nav('costing-settings'); await page.waitForTimeout(400); await shot('settings');
    out.settingsBot = (await text('#c-settings-bot')).slice(0, 200);
    out.lastRuns = await page.$$eval('#c-settings-bot tbody tr', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));

    // 7. mobile
    await nav('costing-reviews'); await page.selectOption('#rv-filter', 'all'); await page.waitForTimeout(300);
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400); await shot('mobile-reviews');
    out.scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    if (out.scrollW > 390) out.wideElements = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > 392 && e.offsetParent !== null && !e.closest('.c-table-wrap')).slice(0, 8).map(e => `${e.tagName}.${e.className} right=${Math.round(e.getBoundingClientRect().right)}`));

    out.errors = errors;
    console.log(JSON.stringify(out, null, 2));
    await b.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
