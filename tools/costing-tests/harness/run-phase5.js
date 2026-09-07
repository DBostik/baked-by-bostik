// Phase 5 harness: save an estimate linked to a request, "Add to quote" from the Estimates list (preview modal,
// suggested vs menu basis, push into the quote modal stand-in), and the button on the request modal's Costing strip.
// Run: python3 tools/costing-tests/harness/prepare.py && node tools/costing-tests/harness/run-phase5.js
const { chromium } = require(resolvePlaywright());
function resolvePlaywright() { for (const c of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright', '/opt/node-tools/node_modules/playwright', '/usr/lib/node_modules/playwright']) { try { require.resolve(c); return c; } catch (e) { } } throw new Error('playwright not found; npm i -g playwright'); }
const http = require('http'); const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, 'site');
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/admin/' || p === '/admin') p = '/admin/index.html'; const file = path.join(root, p); if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; } const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream'; res.writeHead(200, { 'content-type': type }); res.end(fs.readFileSync(file)); });

(async () => {
    await new Promise(r => server.listen(4178, r));
    const b = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
    const page = await b.newPage({ viewport: { width: 1360, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
    page.on('dialog', d => d.accept());
    await page.route(/gstatic|googleapis|jsdelivr|cdnjs/, r => r.abort());
    await page.goto('http://localhost:4178/admin/'); await page.waitForTimeout(900);
    const shot = async n => page.screenshot({ path: path.join(__dirname, `shot5-${n}.png`) });
    const nav = async p => { const sel = `.nav-links a[data-page="${p}"]`; await page.$eval(sel, el => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(100); await page.click(sel, { force: true }); await page.waitForTimeout(500); };
    const text = async sel => ((await page.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
    const out = {};

    // 1. build and save a two-item estimate linked to a request (same steps as the Phase 2 run)
    await nav('costing-estimator');
    await page.selectOption('#est-add-product', 'celebration-cake'); await page.click('[data-action="est-add-item"]'); await page.waitForTimeout(400);
    await page.selectOption('[data-tier="0:0"] [data-tf="sizeId"]', '8'); await page.waitForTimeout(300);
    await page.check('[data-i="drip"]'); await page.waitForTimeout(300);
    await page.selectOption('#est-add-product', 'cupcakes'); await page.click('[data-action="est-add-item"]'); await page.waitForTimeout(300);
    await page.selectOption('[data-e="requestId"]', '09012026-AB12'); await page.waitForTimeout(300);
    await page.click('[data-action="est-save"]'); await page.waitForTimeout(500);

    // 2. Estimates list has the button; unlinked estimates would get a disabled one
    await nav('costing-estimates'); await page.waitForTimeout(400); await shot('estimates');
    out.addButtons = await page.$$eval('#page-costing-estimates [data-action="quote-preview"]', r => r.map(x => ({ text: x.textContent, disabled: x.disabled })));

    // 3. preview modal: suggested basis, then menu basis
    await page.click('#page-costing-estimates [data-action="quote-preview"]'); await page.waitForTimeout(400); await shot('preview');
    out.previewRows = await page.$$eval('#costing-modal tbody tr', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
    out.previewButton = await text('#costing-modal [data-action="quote-push"]');
    await page.check('#costing-modal input[name="q-basis"][value="menu"]'); await page.waitForTimeout(400);
    out.previewRowsMenu = await page.$$eval('#costing-modal tbody tr', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
    await page.check('#costing-modal input[name="q-basis"][value="suggested"]'); await page.waitForTimeout(400);

    // 4. push into the quote modal stand-in: placeholder removed, two priced lines, admin.js-style array updated
    await page.click('#costing-modal [data-action="quote-push"]'); await page.waitForTimeout(500); await shot('quote-modal');
    out.quoteFor = await page.evaluate(() => window.__quoteFor);
    out.quoteModalOpen = await page.$eval('#quote-modal', el => !el.classList.contains('hidden'));
    out.quoteItems = await page.evaluate(() => window.__quoteItems.map(i => [i.name.slice(0, 60), i.qty, i.price]));
    out.quoteRows = await page.$$eval('#quote-items-body tr', r => r.length);
    out.quoteTotal = await page.evaluate(() => Math.round(window.__quoteItems.reduce((a, i) => a + i.qty * i.price, 0) * 100) / 100);
    out.estimateSuggested = await page.evaluate(() => { const e = [...window.BBBCosting.state.estimates.values()][0]; return e.snapshot?.totals?.suggested; });

    // 5. request modal strip: emulate admin.js opening Request Details for that request
    await page.evaluate(() => { const mb = document.getElementById('modal-body'); mb.innerHTML = '<div class="modal-hero"><span class="hero-id">#09012026-AB12</span></div><p>details</p>'; });
    await page.waitForTimeout(500);
    out.stripText = await text('#modal-body .c-req-estimates');
    out.stripQuoteButtons = await page.$$eval('#modal-body [data-action="quote-preview"]', r => r.length);
    await page.$eval('#modal-body [data-action="quote-preview"]', el => el.click()); await page.waitForTimeout(400);
    out.previewFromStrip = await page.$$eval('#costing-modal tbody tr', r => r.length);
    await page.click('#costing-modal [data-action="close-modal"]');

    // 6. mobile
    await nav('costing-estimates'); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400); await shot('mobile-estimates');
    out.scrollW = await page.evaluate(() => document.documentElement.scrollWidth);

    out.errors = errors;
    console.log(JSON.stringify(out, null, 2));
    await b.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
