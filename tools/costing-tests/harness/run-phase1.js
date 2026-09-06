const { chromium } = require(resolvePlaywright());
function resolvePlaywright() { for (const c of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright', '/opt/node-tools/node_modules/playwright', '/usr/lib/node_modules/playwright']) { try { require.resolve(c); return c; } catch (e) { } } throw new Error('playwright not found; npm i -g playwright'); }
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = require('path').join(__dirname, 'site');
const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/admin/' || p === '/admin') p = '/admin/index.html';
    const file = path.join(root, p);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    const ext = path.extname(file);
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type }); res.end(fs.readFileSync(file));
});

(async () => {
    await new Promise(r => server.listen(4173, r));
    const browser = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
    const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
    // block the real gstatic/google fonts (offline)
    await page.route(/gstatic|googleapis|jsdelivr|cdnjs/, r => r.abort());
    await page.goto('http://localhost:4173/admin/');
    await page.waitForTimeout(800);
    const shot = async (name) => { await page.screenshot({ path: path.join(__dirname, `shot-${name}.png`), fullPage: false }); };
    const nav = async (p) => { const sel = `.nav-links a[data-page="${p}"]`; await page.$eval(sel, el => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(150); await page.click(sel, { force: true }); await page.waitForTimeout(400); };

    await nav('costing-home'); await shot('home');
    const homeText = await page.textContent('#page-costing-home');
    await nav('costing-ingredients'); await shot('ingredients');
    const rows = await page.$$eval('#page-costing-ingredients tbody tr', r => r.length);
    // open butter
    await page.click('#page-costing-ingredients tr[data-id="butter"]'); await page.waitForTimeout(500); await shot('ingredient-modal');
    const modalText = await page.textContent('#costing-modal-body');
    // type a new price and save
    await page.fill('#costing-modal [data-f="newPrice"]', '17.49');
    await page.click('[data-action="save-ingredient"]'); await page.waitForTimeout(500);
    const butterAfter = await page.$eval('#page-costing-ingredients tr[data-id="butter"]', tr => tr.innerText);
    await nav('costing-log'); await page.selectOption('#trip-store', 'Costco'); await page.waitForTimeout(300); await shot('log');
    const logRows = await page.$$eval('#page-costing-log tbody tr', r => r.length);
    await page.fill('#page-costing-log input[data-key="sugar|costco-pioneer"]', '7.99');
    const saveLabel = await page.textContent('[data-action="save-trip"]');
    await page.click('[data-action="save-trip"]'); await page.waitForTimeout(500);
    await nav('costing-recipes'); await shot('recipes');
    const recRows = await page.$$eval('#page-costing-recipes tbody tr', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
    await page.click('#page-costing-recipes tr[data-id="white-cake"]'); await page.waitForTimeout(500); await shot('recipe-modal');
    const totals = await page.textContent('#r-totals');
    // paste parser
    await page.click('[data-action="toggle-paste"]');
    await page.fill('#r-paste-text', '1 1/2 cups all-purpose flour\n½ cup unsalted butter, softened\n2 large eggs\n1 cup buttermilk\n1 batch Vanilla American Buttercream');
    await page.click('[data-action="parse-paste"]'); await page.waitForTimeout(400);
    const lineTargets = await page.$$eval('#r-lines tbody tr', trs => trs.map(tr => { const s = tr.querySelector('[data-f="target"]'); return s ? s.value : ''; }));
    await shot('recipe-paste');
    await page.click('[data-action="close-modal"]');
    await nav('costing-settings'); await shot('settings');
    // mobile pass
    await page.setViewportSize({ width: 390, height: 844 });
    await nav('costing-ingredients'); await page.waitForTimeout(300); await shot('mobile-ingredients');
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);

    console.log(JSON.stringify({
        errors, rows, logRows, saveLabel, recRows: recRows.slice(0, 4), totals: totals.replace(/\s+/g, ' '), lineTargets,
        butterAfter: butterAfter.replace(/\s+/g, ' '), homeSnippet: homeText.replace(/\s+/g, ' ').slice(0, 300),
        modalHasHistory: /Price history/.test(modalText), scrollW,
        writes: await page.evaluate(() => window.__writes), batches: await page.evaluate(() => window.__batches)
    }, null, 2));
    await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
