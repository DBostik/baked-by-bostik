// Phase 3 harness: Reports (price history chart, movers, price jumps, cost over time), Costing Home alerts with
// Dismiss, Log Prices "Packages" column, Rebuild cost history, the Costing tile on Analytics, and the single-load
// check for costing.js. Run: python3 tools/costing-tests/harness/prepare.py && node tools/costing-tests/harness/run-phase3.js
const { chromium } = require(resolvePlaywright());
function resolvePlaywright() { for (const c of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright', '/opt/node-tools/node_modules/playwright', '/usr/lib/node_modules/playwright']) { try { require.resolve(c); return c; } catch (e) { } } throw new Error('playwright not found; npm i -g playwright'); }
const http = require('http'); const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, 'site');
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/admin/' || p === '/admin') p = '/admin/index.html'; const file = path.join(root, p); if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; } const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream'; res.writeHead(200, { 'content-type': type }); res.end(fs.readFileSync(file)); });

(async () => {
    await new Promise(r => server.listen(4175, r));
    const b = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
    const page = await b.newPage({ viewport: { width: 1360, height: 900 } });
    const errors = []; const costingLoads = [];
    page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
    page.on('request', r => { if (/\/admin\/costing\.js/.test(r.url())) costingLoads.push(r.url()); });
    page.on('dialog', d => d.accept());
    await page.route(/gstatic|googleapis|jsdelivr|cdnjs/, r => r.abort());
    await page.goto('http://localhost:4175/admin/'); await page.waitForTimeout(900);
    const shot = async n => page.screenshot({ path: path.join(__dirname, `shot3-${n}.png`) });
    const nav = async p => { const sel = `.nav-links a[data-page="${p}"]`; await page.$eval(sel, el => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(100); await page.click(sel, { force: true }); await page.waitForTimeout(500); };
    const text = async sel => ((await page.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
    const out = {};

    // 1. costing.js must load exactly once (the ?v= double-load bug)
    out.costingJsLoads = costingLoads.length;

    // 2. Home before any change: alerts card present, no jumps yet
    await nav('costing-home'); await page.waitForTimeout(600); await shot('home-before');
    out.homeJumpsBefore = await text('#c-home-jumps');

    // 3. Log Prices: butter at Costco jumps from 23.59 to 29.99 (+27%), 2 packages; sugar small move
    await nav('costing-log'); await page.selectOption('#trip-store', 'Costco'); await page.waitForTimeout(300);
    out.logHeaders = await page.$$eval('#page-costing-log thead th', ths => ths.map(t => t.textContent.trim()));
    await page.fill('#page-costing-log input.c-price-in[data-key="butter|costco-kirkland"]', '29.99');
    await page.fill('#page-costing-log input.c-qty-in[data-key="butter|costco-kirkland"]', '2');
    await page.fill('#page-costing-log input.c-price-in[data-key="sugar|costco-pioneer"]', '7.59');
    await shot('log');
    await page.click('[data-action="save-trip"]'); await page.waitForTimeout(800);
    out.butterHistory = await page.evaluate(() => (window.__stubPrices ? window.__stubPrices('butter') : null));
    out.snapshotsAfterTrip = await page.evaluate(() => window.__stubCount ? window.__stubCount('cost_snapshots') : null);

    // 4. Home after: one open jump for butter, then dismiss it
    await nav('costing-home'); await page.waitForTimeout(700); await shot('home-after');
    out.homeJumpsAfter = await text('#c-home-jumps');
    out.homeJumpRows = await page.$$eval('#c-home-jumps .c-jump', r => r.length);
    await page.click('#c-home-jumps [data-action="dismiss-jump"]'); await page.waitForTimeout(500);
    out.homeJumpsDismissed = await text('#c-home-jumps');

    // 5. Reports: price history for butter, movers, jumps (dismissed hidden), cost over time
    await nav('costing-reports'); await page.waitForTimeout(900); await shot('reports');
    await page.selectOption('#rp-ing', 'butter'); await page.waitForTimeout(400);
    out.priceTableRows = await page.$$eval('#rp-price-table tbody tr', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
    out.moversRows = await page.$$eval('#rp-movers-body tbody tr', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
    out.jumpsText = await text('#rp-jumps-body');
    await page.click('[data-action="toggle-dismissed"]'); await page.waitForTimeout(300);
    out.jumpsShownWithDismissed = await page.$$eval('#rp-jumps-body .c-jump', r => r.length);
    out.chartsBeforeRebuild = await page.evaluate(() => Object.keys(window.Chart.instances).length);
    out.costNoteBefore = await text('#rp-cost-note');
    out.changeTableRows = await page.$$eval('#rp-change-table tbody tr', r => r.length);

    // 6. Settings: rebuild cost history, then back to Reports for a real curve
    await nav('costing-settings'); await page.waitForTimeout(400);
    out.alertField = await page.$eval('#a-jump', el => el.value);
    await page.fill('#a-jump', '15'); await page.click('[data-action="save-alerts"]'); await page.waitForTimeout(300);
    await page.click('[data-action="rebuild-history"]'); await page.waitForTimeout(1500); await shot('settings');
    out.settingsHistoryText = await text('#c-settings-alerts');
    out.snapshotsAfterRebuild = await page.evaluate(() => window.__stubCount ? window.__stubCount('cost_snapshots') : null);
    await nav('costing-reports'); await page.waitForTimeout(900);
    await page.selectOption('#rp-kind', 'products'); await page.waitForTimeout(500);
    await page.click('[data-action="report-range"][data-months="12"]'); await page.waitForTimeout(400);
    await shot('reports-cost');
    out.costNoteAfter = await text('#rp-cost-note');
    out.productChangeRows = await page.$$eval('#rp-change-table tbody tr', r => r.slice(0, 3).map(x => x.innerText.replace(/\s+/g, ' ')));
    await page.click('#rp-change-table tbody tr:nth-child(2)'); await page.waitForTimeout(300);
    out.pickedKey = await page.$eval('#rp-key', el => el.value);
    out.jumpsHeaderAfterThreshold = await text('#rp-jumps .c-card-head');

    // 7. Analytics tile
    await nav('analytics'); await page.waitForTimeout(900); await shot('analytics');
    out.analyticsTile = await page.$$eval('#costing-analytics-tile .c-pill', p => p.map(x => x.innerText.replace(/\s+/g, ' ')));
    await page.click('#costing-analytics-tile .c-pill[data-page="costing-reports"]'); await page.waitForTimeout(400);
    out.tileClickLandsOn = await page.$eval('#page-costing-reports', el => !el.classList.contains('hidden'));

    // 8. Ingredient modal: history table has Bought column and a chart link
    await nav('costing-ingredients'); await page.click('#page-costing-ingredients tr[data-id="butter"]'); await page.waitForTimeout(500);
    out.modalHistoryHeaders = await page.$$eval('#costing-modal .c-history thead th', ths => ths.map(t => t.textContent.trim()));
    await page.click('#costing-modal .c-history summary'); await page.waitForTimeout(200);
    await page.click('#costing-modal [data-action="report-ingredient"]'); await page.waitForTimeout(600);
    out.chartLinkLandsOn = await page.$eval('#page-costing-reports', el => !el.classList.contains('hidden'));
    out.chartLinkIngredient = await page.$eval('#rp-ing', el => el.value);

    // 9. mobile width
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400); await shot('mobile-reports');
    out.scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    if (out.scrollW > 390) out.wideElements = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > 392 && e.offsetParent !== null && !e.closest('.c-table-wrap')).slice(0, 8).map(e => `${e.tagName}.${e.className} right=${Math.round(e.getBoundingClientRect().right)}`));

    out.writes = await page.evaluate(() => window.__writes);
    out.errors = errors;
    console.log(JSON.stringify(out, null, 2));
    await b.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
