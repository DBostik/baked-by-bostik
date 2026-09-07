// costing-products.js
// Phase 2: Products & Sizes setup screen (what Kristen sells, sizes, tiers, labor, add-ons, packaging kits, menu prices).
import { state, $, $$, esc, toast, openModal, closeModal, getModalCtx, setModalCtx, registerPage, registerAction, byName, uid, slug, openFlags, flagText, pricingCtx, pricingSettings, db } from './costing.js';
import { doc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import * as U from './costing-units.js';
import * as P from './costing-pricing.js';

const FAMILY_LABEL = { cake: 'Cakes', cupcake: 'Cupcakes', cookie: 'Decorated cookies', 'cc-cookie': 'Drop cookies' };

function recipesByCategory(...cats) { return [...state.recipes.values()].filter(r => cats.includes(r.category)).sort(byName); }
function supplies() { return [...state.ingredients.values()].filter(i => i.kind === 'supply').sort(byName); }
function recipeOptions(cats, selected, allowNone = false) {
    return (allowNone ? '<option value="">none</option>' : '') + recipesByCategory(...cats).map(r => `<option value="${esc(r.id)}" ${r.id === selected ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
}
function supplyOptions(selected) {
    return '<option value="">— choose —</option>' + supplies().map(s => `<option value="${esc(s.id)}" ${s.id === selected ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
}

// ------------------------------------------------------------------ list
function renderProducts(body) {
    const products = [...state.products.values()].sort(byName);
    const ctx = pricingCtx(); const ps = pricingSettings();
    if (!products.length) {
        body.innerHTML = `<div class="c-card c-empty"><h3>No products yet</h3><p>Load the Phase 2 starter data from Costing Settings to get Kristen's four products (celebration cakes, cupcakes, sugar cookies, drop cookies) with sizes, menu prices and packaging, or add one by hand.</p><div class="c-inline" style="justify-content:center"><button class="btn-primary btn-sm" data-action="go" data-page="costing-settings">Open Costing Settings</button> <button class="btn-secondary btn-sm" data-action="new-product">+ New product</button></div></div>`;
        return;
    }
    body.innerHTML = `
    <div class="c-toolbar"><span class="c-muted c-small">Standard version of each size or tier at today's prices, labor at ${U.fmtMoney(ps.hourlyRate)}/h, ${esc(ps.profitPct)}% profit. Margin is at the menu price.</span><button class="btn-primary btn-sm" data-action="new-product">+ New product</button></div>
    ${products.map(p => {
        const opts = p.family === 'cake' ? (p.sizes || []) : (p.tiers || []);
        return `<div class="c-card">
            <div class="c-card-head"><h3>${esc(p.name)} <span class="c-badge c-badge-kind">${esc(FAMILY_LABEL[p.family] || p.family)}</span>${p.active === false ? ' <span class="c-badge c-badge-warn">inactive</span>' : ''}</h3><button class="btn-secondary btn-sm" data-action="edit-product" data-id="${esc(p.id)}">Edit</button></div>
            ${p.description ? `<p class="c-small c-muted">${esc(p.description)}</p>` : ''}
            ${openFlags(p).length ? `<p class="c-small"><span class="c-flagcount">${openFlags(p).length} to review</span>: ${esc(flagText(openFlags(p)[0]))}</p>` : ''}
            <div class="c-table-wrap"><table class="c-table c-table-sm"><thead><tr><th>${p.family === 'cake' ? 'Size' : 'Tier'}</th><th class="num">Menu</th><th class="num">Hours</th><th class="num">Materials</th><th class="num">Cost basis</th><th class="num">Suggested</th><th class="num">Margin</th></tr></thead><tbody>
            ${opts.map(o => {
                const est = P.priceEstimate({ items: [P.standardItemFor(p, o.id)] }, ctx, ps); const t = est.totals;
                return `<tr><td>${esc(o.label)}${est.ok ? '' : ` <span class="c-badge c-badge-warn" title="${esc(est.problems.join('\n'))}">${est.problems.length} to fix</span>`}</td><td class="num">${U.fmtMoney(t.menu)}</td><td class="num">${t.hours}</td><td class="num">${U.fmtMoney(t.materials)}</td><td class="num">${U.fmtMoney(t.costBasis)}</td><td class="num">${U.fmtMoney(t.suggested)}</td><td class="num"><span class="c-badge ${t.belowAlert ? 'c-badge-warn' : 'c-badge-ok'}">${t.marginPct == null ? '—' : t.marginPct + '%'}</span></td></tr>`;
            }).join('')}
            </tbody></table></div>
        </div>`;
    }).join('')}`;
}

// ------------------------------------------------------------------ editor
function blankProduct(family) {
    const base = { name: '', family, unitLabel: family === 'cake' ? 'cake' : 'dozen', description: '', active: true, minimumQty: 1, reviewFlags: [] };
    if (family === 'cake') return { ...base, layersDefault: 3, layerHeightIn: 1.5, refSizeId: '6', refFillingGrams: 420, refOuterGrams: 780, defaultFlavorRecipeId: '', defaultFillingRecipeId: '', defaultOuterRecipeId: '', premiumFillingIds: [], sizes: [], addons: { premiumFillingUpcharge: 15, extraLayerUpcharge: 15, extraLayerMinutes: 20, dripRecipeId: '', dripMinutes: 5, dripUpcharge: 0, dripGramsDefault: 150, figureMinutes: 20, figureMaterialCost: 1, figureUpcharge: 20, topperMinutes: 25, topperDefaultCost: 8, tierMinutes: 5, tierKit: [] } };
    if (family === 'cupcake') return { ...base, defaultFlavorRecipeId: '', defaultFrostingRecipeId: '', cupcakesPerBatch: {}, cupcakesPerBatchDefault: 24, frostingGramsPerCupcake: 60, laborHoursPerDozen: 1, tiers: [], kitPerDozen: [] };
    return { ...base, doughRecipeId: '', cookiesPerBatch: 24, icingRecipeId: '', icingGramsPerCookie: 0, laborHoursPerDozen: 0.5, cookiesPerBox: 15, tiers: [], kitPerOrder: [], kitPerBox: [], kitPerCookie: [], addons: { characterMinutes: 10, characterMaterialCost: 0.5, characterUpcharge: 10 } };
}

function kitEditor(kit, key) {
    return `<div class="c-kit" data-kit="${key}">
        ${(kit || []).map((k, i) => `<div class="c-kit-row" data-idx="${i}"><select class="c-input" data-f="supplyId">${supplyOptions(k.supplyId)}</select><input class="c-input c-qty" data-f="qty" type="number" step="any" min="0" value="${k.qty ?? 1}" title="quantity"><button class="btn-text c-remove" data-action="kit-remove">✕</button></div>`).join('')}
        <button class="btn-secondary btn-sm" data-action="kit-add" data-kit="${key}">+ Add supply</button>
    </div>`;
}
function readKit(root, key) {
    const wrap = $(`.c-kit[data-kit="${key}"]`, root); if (!wrap) return [];
    return $$('.c-kit-row', wrap).map(r => ({ supplyId: $('[data-f="supplyId"]', r).value, qty: U.num($('[data-f="qty"]', r).value) || 0 })).filter(k => k.supplyId);
}
function numInput(id, label, value, step = 'any', hint = '') {
    return `<label>${label}${hint ? `<span class="c-hint">${hint}</span>` : ''}<input class="c-input" data-p="${id}" type="number" step="${step}" value="${value ?? ''}"></label>`;
}
function textInput(id, label, value, hint = '') {
    return `<label>${label}${hint ? `<span class="c-hint">${hint}</span>` : ''}<input class="c-input" data-p="${id}" value="${esc(value ?? '')}"></label>`;
}

function openProductModal(id, family) {
    const existing = id ? state.products.get(id) : null;
    const p = existing ? JSON.parse(JSON.stringify(existing)) : blankProduct(family || 'cake');
    setModalCtx({ product: p, existing });
    renderProductModal();
}

function renderProductModal() {
    const ctx = getModalCtx(); const p = ctx.product; const existing = ctx.existing;
    const cakeRecipes = recipesByCategory('cake');
    let familyHtml = '';
    if (p.family === 'cake') {
        familyHtml = `
        <div class="c-section-head"><h3>Defaults and frosting reference</h3></div>
        <div class="c-form-grid c-form-grid-4">
            <label>Default cake flavor<select class="c-input" data-p="defaultFlavorRecipeId">${recipeOptions(['cake'], p.defaultFlavorRecipeId)}</select></label>
            <label>Default filling<select class="c-input" data-p="defaultFillingRecipeId">${recipeOptions(['frosting', 'filling'], p.defaultFillingRecipeId)}</select></label>
            <label>Default outer frosting<select class="c-input" data-p="defaultOuterRecipeId">${recipeOptions(['frosting'], p.defaultOuterRecipeId)}</select></label>
            ${numInput('addons.premiumFillingUpcharge', 'Premium filling upcharge ($)', p.addons?.premiumFillingUpcharge, '1')}
            ${numInput('layersDefault', 'Cake layers (standard)', p.layersDefault, '1')}
            ${numInput('layerHeightIn', 'Layer height (in)', p.layerHeightIn, '0.25', 'for scaling frosting by surface')}
            ${numInput('refFillingGrams', 'Filling on the reference size (g)', p.refFillingGrams, '10', 'all filling layers together')}
            ${numInput('refOuterGrams', 'Outer frosting on the reference size (g)', p.refOuterGrams, '10', 'crumb coat, coat, border, details')}
        </div>
        <p class="c-small c-muted">Premium fillings (menu upcharge applies): ${recipesByCategory('frosting', 'filling').map(r => `<label class="c-check"><input type="checkbox" data-premium="${esc(r.id)}" ${(p.premiumFillingIds || []).includes(r.id) ? 'checked' : ''}> ${esc(r.name)}</label>`).join(' ')}</p>
        <div class="c-section-head"><h3>Sizes</h3><button class="btn-secondary btn-sm" data-action="size-add">+ Add size</button></div>
        <p class="c-small c-muted">Batter batches are per size for the standard layer count, rounded up to whole batches when that setting is on. Reference size: <select class="c-input" data-p="refSizeId" style="width:auto;display:inline-block">${(p.sizes || []).map(s => `<option value="${esc(s.id)}" ${s.id === p.refSizeId ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select></p>
        ${(p.sizes || []).map((s, i) => {
            const fill = P.fillingGrams(p, s, p.layersDefault || 3), outer = P.outerGrams(p, s, p.layersDefault || 3);
            return `<div class="c-source" data-size-idx="${i}">
            <div class="c-form-grid c-form-grid-4">
                <label>Label<input class="c-input" data-s="label" value="${esc(s.label)}"></label>
                <label>Diameter (in)<input class="c-input" data-s="diameterIn" type="number" step="0.5" value="${s.diameterIn ?? ''}"></label>
                <label>Menu price ($)<input class="c-input" data-s="menuPrice" type="number" step="1" value="${s.menuPrice ?? ''}"></label>
                <label>Labor hours<input class="c-input" data-s="laborHours" type="number" step="0.25" value="${s.laborHours ?? ''}"></label>
                ${cakeRecipes.map(r => `<label>Batches: ${esc(r.name)}<input class="c-input" data-batter="${esc(r.id)}" type="number" step="0.25" value="${s.batter?.[r.id] ?? ''}" placeholder="${s.batterDefault ?? 1}"></label>`).join('')}
                <label>Drip ganache (g)<input class="c-input" data-s="dripGrams" type="number" step="10" value="${s.dripGrams ?? ''}"></label>
                <label>Filling override (g)<span class="c-hint">computed: ${Math.round(fill)} g</span><input class="c-input" data-s="fillingGramsOverride" type="number" step="10" value="${s.fillingGramsOverride ?? ''}" placeholder="${Math.round(fill)}"></label>
                <label>Outer override (g)<span class="c-hint">computed: ${Math.round(outer)} g</span><input class="c-input" data-s="outerGramsOverride" type="number" step="10" value="${s.outerGramsOverride ?? ''}" placeholder="${Math.round(outer)}"></label>
            </div>
            <div class="c-source-row"><span class="c-label">Packaging kit for this size</span><button class="btn-text c-remove" data-action="size-remove" data-idx="${i}">Remove size</button></div>
            ${kitEditor(s.kit, 'size-' + i)}
        </div>`;
        }).join('')}
        <div class="c-section-head"><h3>Add-ons</h3></div>
        <div class="c-form-grid c-form-grid-4">
            ${numInput('addons.extraLayerMinutes', 'Extra layer: minutes', p.addons?.extraLayerMinutes, '5')}
            ${numInput('addons.extraLayerUpcharge', 'Extra layer: menu upcharge ($)', p.addons?.extraLayerUpcharge, '1')}
            <label>Drip recipe<select class="c-input" data-p="addons.dripRecipeId">${recipeOptions(['frosting'], p.addons?.dripRecipeId)}</select></label>
            ${numInput('addons.dripMinutes', 'Drip: minutes', p.addons?.dripMinutes, '1')}
            ${numInput('addons.dripUpcharge', 'Drip: menu upcharge ($)', p.addons?.dripUpcharge, '1')}
            ${numInput('addons.figureMinutes', 'Fondant figure: minutes each', p.addons?.figureMinutes, '5')}
            ${numInput('addons.figureMaterialCost', 'Fondant figure: material ($ each)', p.addons?.figureMaterialCost, '0.25')}
            ${numInput('addons.figureUpcharge', 'Fondant figure: menu upcharge ($ each)', p.addons?.figureUpcharge, '1')}
            ${numInput('addons.topperMinutes', 'Topper: minutes', p.addons?.topperMinutes, '5')}
            ${numInput('addons.topperDefaultCost', 'Topper: default cost ($)', p.addons?.topperDefaultCost, '0.5')}
            ${numInput('addons.tierMinutes', 'Each extra tier: minutes to stack', p.addons?.tierMinutes, '1')}
        </div>
        <span class="c-label">Structure kit added per extra tier</span>
        ${kitEditor(p.addons?.tierKit, 'tierKit')}`;
    } else if (p.family === 'cupcake') {
        const batterRecipes = recipesByCategory('cake', 'cupcake');
        familyHtml = `
        <div class="c-section-head"><h3>Recipes and yields</h3></div>
        <div class="c-form-grid c-form-grid-4">
            <label>Default batter<select class="c-input" data-p="defaultFlavorRecipeId">${recipeOptions(['cake', 'cupcake'], p.defaultFlavorRecipeId)}</select></label>
            <label>Default frosting<select class="c-input" data-p="defaultFrostingRecipeId">${recipeOptions(['frosting'], p.defaultFrostingRecipeId)}</select></label>
            ${numInput('frostingGramsPerCupcake', 'Frosting per cupcake (g)', p.frostingGramsPerCupcake, '5', 'about 60 g for a 1/4 cup swirl')}
            ${numInput('laborHoursPerDozen', 'Base labor per dozen (hours)', p.laborHoursPerDozen, '0.25', 'bake, cool, box')}
            ${batterRecipes.map(r => `<label>Cupcakes per batch: ${esc(r.name)}<input class="c-input" data-perbatch="${esc(r.id)}" type="number" step="1" value="${p.cupcakesPerBatch?.[r.id] ?? ''}" placeholder="${p.cupcakesPerBatchDefault ?? 24}"></label>`).join('')}
        </div>
        ${tiersHtml(p)}
        <span class="c-label">Packaging kit per dozen</span>
        ${kitEditor(p.kitPerDozen, 'kitPerDozen')}`;
    } else {
        familyHtml = `
        <div class="c-section-head"><h3>Recipes and yields</h3></div>
        <div class="c-form-grid c-form-grid-4">
            <label>Dough recipe<select class="c-input" data-p="doughRecipeId">${recipeOptions(['cookie'], p.doughRecipeId)}</select></label>
            ${numInput('cookiesPerBatch', 'Cookies per batch', p.cookiesPerBatch, '1', p.family === 'cc-cookie' ? 'scoop table on the recipe overrides this per tier' : '')}
            <label>Icing recipe<select class="c-input" data-p="icingRecipeId">${recipeOptions(['frosting'], p.icingRecipeId, true)}</select></label>
            ${numInput('icingGramsPerCookie', 'Icing per cookie (g)', p.icingGramsPerCookie, '1')}
            ${numInput('laborHoursPerDozen', 'Base labor per dozen (hours)', p.laborHoursPerDozen, '0.25', 'mix, bake, pack')}
            ${numInput('cookiesPerBox', 'Cookies per box', p.cookiesPerBox, '1')}
            ${numInput('addons.characterMinutes', 'Character add-on: minutes each', p.addons?.characterMinutes, '1')}
            ${numInput('addons.characterMaterialCost', 'Character add-on: material ($)', p.addons?.characterMaterialCost, '0.25')}
            ${numInput('addons.characterUpcharge', 'Character add-on: menu ($ each)', p.addons?.characterUpcharge, '1')}
        </div>
        ${tiersHtml(p, p.family === 'cc-cookie')}
        <span class="c-label">Packaging once per order</span>${kitEditor(p.kitPerOrder, 'kitPerOrder')}
        <span class="c-label">Packaging per box</span>${kitEditor(p.kitPerBox, 'kitPerBox')}
        <span class="c-label">Packaging per cookie</span>${kitEditor(p.kitPerCookie, 'kitPerCookie')}`;
    }
    const html = `
    <div class="modal-header c-modal-header"><h2>${existing ? 'Edit product' : 'New product'}</h2><button class="close-modal" data-action="close-modal">&times;</button></div>
    <div class="c-form-grid c-form-grid-4">
        ${textInput('name', 'Name', p.name)}
        <label>Family<select class="c-input" data-p="family" ${existing ? 'disabled' : ''}>${P.FAMILIES.map(f => `<option value="${f}" ${p.family === f ? 'selected' : ''}>${FAMILY_LABEL[f]}</option>`).join('')}</select></label>
        ${textInput('unitLabel', 'Sold per', p.unitLabel, 'cake, dozen, each')}
        ${numInput('minimumQty', 'Minimum quantity', p.minimumQty, '1')}
        <label class="c-span2">Description<input class="c-input" data-p="description" value="${esc(p.description || '')}"></label>
        <label class="c-check c-span2"><input type="checkbox" data-p="active" ${p.active !== false ? 'checked' : ''}> Active (shown in the estimator)</label>
    </div>
    ${familyHtml}
    ${openFlags(p).length ? `<div class="c-section-head"><h3>To review</h3></div><ul class="c-flaglist">${openFlags(p).map(f => `<li>${esc(flagText(f))}</li>`).join('')}</ul>` : ''}
    <div class="c-modal-actions">
        ${existing ? `<button class="btn-secondary btn-sm btn-danger" data-action="delete-product">Delete</button>` : '<span></span>'}
        <div><button class="btn-secondary btn-sm" data-action="close-modal">Cancel</button> <button class="btn-primary btn-sm" data-action="save-product">Save</button></div>
    </div>`;
    openModal(html, ctx);
    const fam = $('#costing-modal [data-p="family"]');
    if (fam && !existing) fam.addEventListener('change', () => { const np = blankProduct(fam.value); np.name = $('#costing-modal [data-p="name"]').value; setModalCtx({ product: np, existing: null }); renderProductModal(); });
}
function tiersHtml(p, withScoop = false) {
    return `<div class="c-section-head"><h3>Tiers</h3><button class="btn-secondary btn-sm" data-action="tier-add">+ Add tier</button></div>
    <div class="c-table-wrap"><table class="c-table c-table-sm c-tiers"><thead><tr><th>Label</th><th class="num">Menu $ per dozen</th><th class="num">Minutes per ${p.family === 'cupcake' ? 'cupcake' : 'cookie'}</th>${withScoop ? '<th>Scoop (from recipe table)</th>' : ''}<th></th></tr></thead><tbody>
    ${(p.tiers || []).map((t, i) => `<tr data-tier-idx="${i}"><td><input class="c-input" data-t="label" value="${esc(t.label)}"></td><td class="num"><input class="c-input c-qty" data-t="menuPricePerDozen" type="number" step="1" value="${t.menuPricePerDozen ?? ''}"></td><td class="num"><input class="c-input c-qty" data-t="minutesPerUnit" type="number" step="1" value="${t.minutesPerUnit ?? ''}"></td>${withScoop ? `<td><input class="c-input" data-t="scoop" value="${esc(t.scoop || '')}" placeholder="60 (S)"></td>` : ''}<td><button class="btn-text c-remove" data-action="tier-remove" data-idx="${i}">✕</button></td></tr>`).join('')}
    </tbody></table></div>`;
}

// Read the whole form back into ctx.product
function readProductForm() {
    const ctx = getModalCtx(); if (!ctx?.product) return null;
    const p = ctx.product; const m = $('#costing-modal');
    const setPath = (obj, path, val) => { const parts = path.split('.'); let o = obj; for (let i = 0; i < parts.length - 1; i++) { o[parts[i]] = o[parts[i]] || {}; o = o[parts[i]]; } o[parts[parts.length - 1]] = val; };
    $$('[data-p]', m).forEach(el => {
        const key = el.dataset.p;
        let val;
        if (el.type === 'checkbox') val = el.checked;
        else if (el.type === 'number') val = U.num(el.value);
        else val = el.value.trim();
        setPath(p, key, val);
    });
    if (p.family === 'cake') {
        p.premiumFillingIds = $$('[data-premium]', m).filter(c => c.checked).map(c => c.dataset.premium);
        p.sizes = $$('[data-size-idx]', m).map((card, i) => {
            const old = (ctx.product.sizes || [])[i] || {};
            const s = { ...old };
            $$('[data-s]', card).forEach(el => { s[el.dataset.s] = el.type === 'number' ? U.num(el.value) : el.value.trim(); });
            s.batter = {}; $$('[data-batter]', card).forEach(el => { const v = U.num(el.value); if (v != null) s.batter[el.dataset.batter] = v; });
            s.id = old.id || slug(s.label || ('size-' + i));
            s.kit = readKit(card, 'size-' + i);
            return s;
        });
        p.addons.tierKit = readKit(m, 'tierKit');
    } else {
        p.tiers = $$('tr[data-tier-idx]', m).map((tr, i) => {
            const old = (ctx.product.tiers || [])[i] || {};
            const t = { ...old };
            $$('[data-t]', tr).forEach(el => { t[el.dataset.t] = el.type === 'number' ? U.num(el.value) : el.value.trim(); });
            t.id = old.id || slug(t.label || ('tier-' + i));
            return t;
        });
        if (p.family === 'cupcake') {
            p.cupcakesPerBatch = {}; $$('[data-perbatch]', m).forEach(el => { const v = U.num(el.value); if (v != null) p.cupcakesPerBatch[el.dataset.perbatch] = v; });
            p.kitPerDozen = readKit(m, 'kitPerDozen');
        } else {
            p.kitPerOrder = readKit(m, 'kitPerOrder'); p.kitPerBox = readKit(m, 'kitPerBox'); p.kitPerCookie = readKit(m, 'kitPerCookie');
        }
    }
    return p;
}

async function saveProduct(p) {
    const id = p.id || (slug(p.name) + '-' + uid(4));
    const data = { ...p }; delete data.id; delete data.createdAt; // the editor's copy holds a plain-map timestamp
    data.updatedAt = serverTimestamp(); if (!p.id) data.createdAt = serverTimestamp();
    await setDoc(doc(db, 'products', id), data, { merge: true });
    return id;
}

// ------------------------------------------------------------------ actions
registerPage('costing-products', renderProducts);
registerAction('new-product', () => openProductModal(null, 'cake'));
registerAction('edit-product', el => openProductModal(el.dataset.id));
registerAction('kit-add', el => { readProductForm(); const key = el.dataset.kit; const ctx = getModalCtx(); const p = ctx.product; const push = (arr) => { arr.push({ supplyId: '', qty: 1 }); }; if (key.startsWith('size-')) push(p.sizes[Number(key.slice(5))].kit = p.sizes[Number(key.slice(5))].kit || []); else if (key === 'tierKit') push(p.addons.tierKit = p.addons.tierKit || []); else push(p[key] = p[key] || []); renderProductModal(); });
registerAction('kit-remove', el => { readProductForm(); const row = el.closest('.c-kit-row'); const wrap = el.closest('.c-kit'); const key = wrap.dataset.kit; const idx = Number(row.dataset.idx); const ctx = getModalCtx(); const p = ctx.product; const arr = key.startsWith('size-') ? p.sizes[Number(key.slice(5))].kit : key === 'tierKit' ? p.addons.tierKit : p[key]; arr.splice(idx, 1); renderProductModal(); });
registerAction('size-add', () => { readProductForm(); const p = getModalCtx().product; const d = 6 + 2 * (p.sizes.length); p.sizes.push({ id: String(d), label: `${d}-inch round`, diameterIn: d, menuPrice: null, laborHours: null, batter: {}, batterDefault: 1, dripGrams: 150, kit: [] }); renderProductModal(); });
registerAction('size-remove', el => { readProductForm(); const p = getModalCtx().product; p.sizes.splice(Number(el.dataset.idx), 1); renderProductModal(); });
registerAction('tier-add', () => { readProductForm(); const p = getModalCtx().product; p.tiers = p.tiers || []; p.tiers.push({ id: 'tier-' + uid(3), label: 'New tier', menuPricePerDozen: null, minutesPerUnit: 0 }); renderProductModal(); });
registerAction('tier-remove', el => { readProductForm(); const p = getModalCtx().product; p.tiers.splice(Number(el.dataset.idx), 1); renderProductModal(); });
registerAction('save-product', async () => {
    const p = readProductForm(); if (!p) return;
    if (!p.name) { toast('Give it a name first', 'err'); return; }
    if (p.family === 'cake' && !(p.sizes || []).length) { toast('Add at least one size', 'err'); return; }
    if (p.family !== 'cake' && !(p.tiers || []).length) { toast('Add at least one tier', 'err'); return; }
    await saveProduct(p); closeModal(); toast('Saved ' + p.name);
});
registerAction('delete-product', async () => {
    const ex = getModalCtx().existing; if (!ex) return;
    const used = [...state.estimates.values()].some(e => (e.items || []).some(i => i.productId === ex.id));
    if (used && !confirm(`"${ex.name}" is used by saved estimates; they will no longer recost. Delete anyway?`)) return;
    if (!used && !confirm(`Delete "${ex.name}"?`)) return;
    await deleteDoc(doc(db, 'products', ex.id)); closeModal(); toast('Deleted');
});
