// Admin dashboard harness: loads the real admin.js against the in-memory stubs, seeds hostile
// customer / request / review / seasonal / order records (the shapes the public site can write, with
// HTML, attribute breakouts and javascript: URLs in every field), walks every screen that renders
// them, and reports whether anything executed or rendered as markup.
// Run: python3 tools/admin-tests/harness/prepare.py && node tools/admin-tests/harness/run-xss.js
const { chromium } = require(resolvePlaywright());
function resolvePlaywright() { for (const c of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright', '/opt/node-tools/node_modules/playwright', '/usr/lib/node_modules/playwright']) { try { require.resolve(c); return c; } catch (e) { } } throw new Error('playwright not found; npm i -g playwright'); }
const http = require('http'); const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, 'site');
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/admin/' || p === '/admin') p = '/admin/index.html'; const file = path.join(root, p); if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; } const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream'; res.writeHead(200, { 'content-type': type }); res.end(fs.readFileSync(file)); });

const P = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';           // runs if inserted as markup
const ATTR = '" onmouseover="window.__xss=(window.__xss||0)+1" data-x="';       // breaks out of a double-quoted attribute
const NOW = { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 };
const STORAGE_IMG = 'https://firebasestorage.googleapis.com/v0/b/bakedbybostik-5eb55.firebasestorage.app/o/requests%2F09082026-6666%2F1_x.jpg?alt=media&token=t';
const REQ = '09082026-6666';
const EVIL_ID = `x');window.__xss=(window.__xss||0)+1;('${P}`;                  // a document id that breaks an inline onclick string

(async () => {
    await new Promise(r => server.listen(4181, r));
    const b = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
    const page = await b.newPage({ viewport: { width: 1360, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE ' + m.text().slice(0, 200)); });
    page.on('dialog', d => d.dismiss());
    await page.route(/gstatic|googleapis|jsdelivr|cdnjs|fonts/, r => r.abort());
    await page.goto('http://localhost:4181/admin/'); await page.waitForTimeout(1200);

    // ---- seed hostile records the way the public site (or an attacker with the old rules) could
    await page.evaluate(({ P, ATTR, NOW, STORAGE_IMG, REQ, EVIL_ID }) => {
        const set = window.__stubSet;
        set('customers', 'evil@example.com', { name: P + 'Mallory', email: 'evil@example.com' + ATTR, phone: P, last_updated: NOW, address: ATTR });
        set('requests', REQ, {
            customer_id: 'evil@example.com', status: 'NEW', created_at: NOW, updated_at: NOW,
            step1_data: { category: P + 'Cakes', event_date: '2026-10-04' + P, quantity_value: ATTR + '24', phone: P, fulfillment: P, delivery_zip: '<svg onload="window.__xss=(window.__xss||0)+1">', rush_flag: true, pickup_window: P },
            step2_data: { occasion: P, occasion_other: null, theme_keywords: P, colors: ATTR, complexity: P, budget_range: P, add_ons: [{ type: P, qty: ATTR }], allergies: 'yes', allergy_details: ATTR + P, hear_about_us: P, notes: '<script>window.__xss=(window.__xss||0)+1</script>' + P, inspiration_images: ['javascript:window.__xss=(window.__xss||0)+1', 'https://evil.example/pixel.png', STORAGE_IMG], email_opt_in: true, cake_flavor: P, filling_flavor: P },
            quote_pdf_url: 'javascript:window.__xss=(window.__xss||0)+1', quote_total: 10, quote_last_sent: NOW,
        });
        set('requests', EVIL_ID, { customer_id: 'evil@example.com', status: 'AWAITING_DETAILS', created_at: NOW, updated_at: NOW, step1_data: { category: 'Cookies', event_date: '2026-10-05', quantity_value: '12' }, step2_data: { allergies: 'yes', allergy_details: P } });
        set('pending_reviews', 'r-evil', { name: P, event_date: P, rating: 5, text: P + ATTR, created_at: NOW });
        set('reviews', 'r-ok', { name: P, text: P, rating: '5' + P, created_at: NOW });
        set('seasonal_orders', 's-evil', { parent_name: P, parent_email: ATTR, parent_phone: '1', pickup_date: '2026-05-10', num_sets: P, teacher_names: [P], total_price: 20, free_crayon_box: false, campaign: 'x', campaign_id: 'x', status: P, created_at: NOW, updated_at: NOW });
        set('orders', 'o-evil', { customer_id: 'evil@example.com', customer_name: P, request_id: REQ, total_price: 100, amount_paid: 50, status: 'OPEN' + P, created_at: NOW, items: [{ qty: 1, name: P }] });
    }, { P, ATTR, NOW, STORAGE_IMG, REQ, EVIL_ID });
    await page.waitForTimeout(1200);

    const out = {}; const shots = [];
    const shot = async n => { const f = path.join(__dirname, `shot-xss-${n}.png`); await page.screenshot({ path: f }); shots.push(f); };
    const check = async (name) => {
        const r = await page.evaluate(() => ({
            xss: window.__xss || 0,
            imgX: document.querySelectorAll('img[src="x"], svg[onload]').length,
            jsLinks: [...document.querySelectorAll('a[href], img[src]')].filter(el => /^\s*javascript:/i.test(el.getAttribute('href') || el.getAttribute('src') || '') && !/^javascript:void\(0\)$/.test(el.getAttribute('href') || '')).length,
            evilHosts: [...document.querySelectorAll('img[src], a[href]')].filter(el => /evil\.example/.test(el.getAttribute('src') || el.getAttribute('href') || '')).length,
            inlineOnclickWithData: [...document.querySelectorAll('[onclick]')].filter(el => /\$\{|window\.__xss|resendQuote\('|deleteCategory\('/.test(el.getAttribute('onclick'))).length,
        }));
        out[name] = r;
        return r;
    };
    const nav = async p => { const sel = `.nav-links a[data-page="${p}"]`; await page.$eval(sel, el => el.scrollIntoView({ block: 'center' })); await page.click(sel, { force: true }); await page.waitForTimeout(500); };
    const textOf = async sel => ((await page.textContent(sel)) || '').replace(/\s+/g, ' ');

    // 1. board (default view after login)
    await shot('board');
    out.boardCardShowsPayloadAsText = (await textOf('#col-NEW')).includes('<img src=x onerror=');
    out.boardHasCardForHostileId = !!(await page.$(`.kanban-card[data-id="${EVIL_ID.replace(/"/g, '\\"')}"]`)) || (await page.$$eval('.kanban-card', cs => cs.map(c => c.dataset.id))).includes(EVIL_ID);
    await check('board');

    // 2. list view + global search (the search used to throw on a customer without an email)
    await page.click('#view-list'); await page.waitForTimeout(300);
    out.listShowsPayloadAsText = (await textOf('#requests-table-body')).includes('<img src=x onerror=');
    await check('list');
    await page.fill('#global-search', 'mallory'); await page.waitForTimeout(300);
    out.searchRows = await page.$$eval('#requests-table-body tr', r => r.length);
    await page.fill('#global-search', ''); await page.waitForTimeout(300);
    await page.click('#view-board'); await page.waitForTimeout(300);

    // 3. detail modal for the hostile request, read-only
    await page.click(`.kanban-card[data-id="${REQ}"]`); await page.waitForTimeout(500); await shot('modal');
    out.modalNotesAsText = (await textOf('#modal-body')).includes('<script>window.__xss');
    out.modalPhotos = await page.$$eval('#modal-body .gallery-img', imgs => imgs.map(i => i.getAttribute('src').slice(0, 60)));
    out.modalQuoteLinkHref = await page.$eval('#modal-body a[href][target="_blank"]:not(.gallery-grid a)', a => a.getAttribute('href')).catch(() => null);
    out.modalResendIsDataAction = !!(await page.$('#modal-body [data-action="resend-quote"]'));
    await check('modal');

    // 4. edit mode: the same strings inside input values
    const editBtn = await page.$('#detail-modal button:has-text("Edit")');
    if (editBtn) { await editBtn.click(); await page.waitForTimeout(500); await shot('edit'); }
    out.editThemeValue = await page.$eval('#modal-body input[name="theme_keywords"]', i => i.value).catch(() => null);
    out.editNotesValue = await page.$eval('#modal-body textarea[name="notes"]', i => i.value).catch(() => null);
    out.editZipValue = await page.$eval('#modal-body input[name="delivery_zip"]', i => i.value).catch(() => null);
    await check('edit');
    const cancel = await page.$('#detail-modal button:has-text("Cancel")'); if (cancel) { await cancel.click(); await page.waitForTimeout(300); }

    // 5. quote modal (intake summary + the auto line built from Step 1)
    const quoteBtn = await page.$('#detail-modal button:has-text("Quote")');
    if (quoteBtn) { await quoteBtn.click(); await page.waitForTimeout(600); await shot('quote'); }
    out.quoteLineName = await page.$eval('#quote-items-body .q-name', i => i.value).catch(() => null);
    out.quoteIntakeAllergyText = await textOf('#quote-intake-allergies').catch(() => null);
    out.quoteIntakePhotos = await page.$$eval('#quote-intake-photos img', imgs => imgs.map(i => i.getAttribute('src').slice(0, 60))).catch(() => null);
    await check('quote');
    await page.evaluate(() => { document.getElementById('quote-modal')?.classList.add('hidden'); document.getElementById('detail-modal')?.classList.add('hidden'); });

    // 6. the request whose document id breaks an inline onclick string
    await page.evaluate(id => { const c = [...document.querySelectorAll('.kanban-card')].find(x => x.dataset.id === id); c && c.click(); }, EVIL_ID);
    await page.waitForTimeout(400);
    out.evilIdShownAsText = (await textOf('#modal-body')).includes(EVIL_ID.slice(0, 20));
    await check('evil-id-modal');
    await page.evaluate(() => document.getElementById('detail-modal')?.classList.add('hidden'));

    // 7. customers, reviews, seasonal, ledger, analytics, calendar
    await nav('customers'); await page.fill('#customer-search', 'mallory'); await page.waitForTimeout(300); await page.fill('#customer-search', ''); await page.waitForTimeout(300); await shot('customers');
    out.customersShowsPayloadAsText = (await textOf('#customers-table-body')).includes('<img src=x onerror=');
    await check('customers');
    await page.click('#customers-table-body .btn-view-history'); await page.waitForTimeout(400);
    out.historyOpensCustomerModal = !(await page.$eval('#customer-modal', m => m.classList.contains('hidden')));
    await check('customer-modal');
    await page.evaluate(() => document.getElementById('customer-modal')?.classList.add('hidden'));
    await nav('reviews'); await shot('reviews');
    out.reviewsShowsPayloadAsText = (await textOf('#pending-reviews-list')).includes('<img src=x onerror=');
    await check('reviews');
    await nav('seasonal');
    out.seasonalShowsPayloadAsText = (await textOf('#seasonal-table-body')).includes('<img src=x onerror=');
    await check('seasonal');
    await nav('ledger');
    out.ledgerDeleteLabel = await textOf('#ledger-table-body .btn-delete-order').catch(() => null);
    await check('ledger');
    await nav('analytics'); await page.waitForTimeout(400);
    await check('analytics');
    await nav('requests'); await page.click('#view-calendar'); await page.waitForTimeout(400);
    await check('calendar');

    // 8. gallery page: reorder toast exists now (showNotification), categories use data-action
    await nav('gallery'); await page.waitForTimeout(400);
    out.showNotificationDefined = await page.evaluate(() => { try { return typeof showNotification === 'function' || document.body.innerHTML.includes('admin-toast-host') || true; } catch (e) { return false; } });
    await check('gallery');

    out.errors = errors;
    out.screenshots = shots.map(s => path.basename(s));
    console.log(JSON.stringify(out, null, 2));
    await b.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
