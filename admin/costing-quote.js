// costing-quote.js
// Phase 5: "Add to quote". Pushes a saved estimate's items into the existing Create Quote / Invoice modal
// (admin.js) as customer-facing lines with the suggested price prefilled (or the menu price), editable there.
// admin.js keeps its quote items in a private array, so this file drives the modal through its own UI:
// the global window.resendQuote(requestId) opens it, "+ Add Item" adds a row, and typing into the row's inputs
// (with input events) updates admin.js's array through its own listeners. Nothing in admin.js changes.
// Buttons appear on the Estimates list and on the Costing strip inside the Request Details modal.
import { state, $, $$, esc, toast, registerAction, registerExtension, openModal, closeModal, pricingCtx, pricingSettings, fmtDate } from './costing.js';
import * as U from './costing-units.js';
import * as P from './costing-pricing.js';

function quoteAvailable() { return typeof window.resendQuote === 'function' && !!document.getElementById('quote-items-body') && !!document.getElementById('btn-add-item'); }

// ------------------------------------------------------------------ preview modal
function openQuotePreview(estimateId, basis = 'suggested') {
    const e = state.estimates.get(estimateId);
    if (!e) { toast('Estimate not found', 'err'); return; }
    if (!e.requestId) { toast('Link this estimate to a request first (open it and pick the request)', 'err'); return; }
    if (!quoteAvailable()) { toast('The quote screen is not loaded on this page', 'err'); return; }
    const q = P.quoteLines(e, pricingCtx(), pricingSettings(), basis);
    const t = q.estimateTotals;
    const html = `
    <div class="modal-header c-modal-header"><h2>Add to quote</h2><button class="close-modal" data-action="close-modal">&times;</button></div>
    <p class="c-small c-muted">These lines go into the Create Quote / Invoice screen for request <code>${esc(e.requestId)}</code>${e.customerLabel ? ' (' + esc(e.customerLabel) + ')' : ''}. Edit the wording or the numbers there before you generate the PDF; nothing is sent until you do.</p>
    <div class="c-inline c-quote-basis">
      <label class="c-check"><input type="radio" name="q-basis" value="suggested" ${basis === 'suggested' ? 'checked' : ''}> Suggested price <span class="c-muted">(${U.fmtMoney(t.suggested)}, cost plus ${esc(pricingSettings().profitPct)}%)</span></label>
      <label class="c-check"><input type="radio" name="q-basis" value="menu" ${basis === 'menu' ? 'checked' : ''}> Menu price <span class="c-muted">(${U.fmtMoney(t.menu)})</span></label>
    </div>
    <div class="c-table-wrap"><table class="c-table c-table-sm"><thead><tr><th>Line</th><th class="num">Qty</th><th class="num">Each</th><th class="num">Total</th></tr></thead><tbody>
      ${q.lines.map(l => `<tr><td>${esc(l.name)}</td><td class="num">${esc(U.fmtQty(l.qty))}</td><td class="num">${U.fmtMoney(l.price)}</td><td class="num">${U.fmtMoney(l.total)}</td></tr>`).join('')}
      <tr><td colspan="3" class="num"><strong>Items total</strong></td><td class="num"><strong>${U.fmtMoney(q.total)}</strong></td></tr>
    </tbody></table></div>
    <p class="c-small c-muted">Cakes are one line each; cupcakes and cookies are priced per dozen. Cost basis ${U.fmtMoney(t.costBasis)}, margin at menu ${t.marginPct == null ? '—' : t.marginPct + '%'}. The quote's placeholder line (price $0) is replaced; lines already priced stay.</p>
    <div class="c-modal-actions"><span></span><div><button class="btn-secondary btn-sm" data-action="close-modal">Cancel</button> <button class="btn-primary btn-sm" data-action="quote-push" data-id="${esc(e.id)}">Add ${q.lines.length} line${q.lines.length === 1 ? '' : 's'} to quote</button></div></div>`;
    openModal(html, { estimateId, basis, lines: q.lines });
    $$('input[name="q-basis"]').forEach(r => r.addEventListener('change', ev => openQuotePreview(estimateId, ev.target.value)));
}

// ------------------------------------------------------------------ push into admin.js's quote modal
function setInput(el, value) { if (!el) return; el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); }
function pushLines(requestId, lines) {
    window.resendQuote(requestId); // closes the request modal, opens the quote modal with the request's placeholder line
    const qm = document.getElementById('quote-modal');
    if (!qm || qm.classList.contains('hidden')) { toast('That request could not be opened (was it deleted?)', 'err'); return 0; }
    const body = document.getElementById('quote-items-body');
    const addBtn = document.getElementById('btn-add-item');
    // drop placeholder rows (price 0) so the estimate lines are not stacked on top of an empty line
    for (let guard = 0; guard < 20; guard++) {
        const zero = [...body.querySelectorAll('tr')].find(tr => !(Number(tr.querySelector('.q-price')?.value) > 0));
        if (!zero) break;
        zero.querySelector('button')?.click();
    }
    let added = 0;
    for (const l of lines) {
        addBtn.click();
        const tr = body.lastElementChild; if (!tr) break;
        setInput(tr.querySelector('.q-name'), l.name);
        setInput(tr.querySelector('.q-qty'), l.qty);
        setInput(tr.querySelector('.q-price'), l.price.toFixed(2));
        added++;
    }
    return added;
}

// ------------------------------------------------------------------ buttons on the Estimates list and the request modal strip
function decorateEstimatesList() {
    const body = $('#page-costing-estimates .costing-body'); if (!body) return;
    $$('[data-action="est-open"]', body).forEach(btn => {
        if (btn.parentElement.querySelector('[data-action="quote-preview"]')) return;
        const id = btn.dataset.id; const e = state.estimates.get(id); if (!e) return;
        const b = document.createElement('button');
        b.className = 'btn-secondary btn-sm'; b.dataset.action = 'quote-preview'; b.dataset.id = id; b.textContent = 'Add to quote';
        if (!e.requestId) { b.disabled = true; b.title = 'Link this estimate to a request first'; }
        btn.parentElement.insertBefore(b, btn.nextSibling); btn.parentElement.insertBefore(document.createTextNode(' '), b);
    });
}
function installRequestStripHook() {
    const mb = document.getElementById('modal-body'); if (!mb) return;
    const obs = new MutationObserver(() => {
        const strip = $('.c-req-estimates', mb); if (!strip || strip.querySelector('[data-action="quote-preview"]')) return;
        const hero = $('.hero-id', mb); if (!hero) return;
        const reqId = hero.textContent.replace(/^#/, '').trim();
        const ests = [...state.estimates.values()].filter(e => e.requestId === reqId);
        if (!ests.length || !quoteAvailable()) return;
        const wrap = document.createElement('span'); wrap.className = 'c-req-quote';
        ests.forEach(e => { const b = document.createElement('button'); b.className = 'btn-primary btn-sm'; b.dataset.action = 'quote-preview'; b.dataset.id = e.id; b.textContent = ests.length > 1 ? `Add "${e.name}" to quote` : 'Add to quote'; wrap.appendChild(b); });
        strip.appendChild(wrap);
    });
    obs.observe(mb, { childList: true, subtree: true });
}
if (document.readyState !== 'loading') installRequestStripHook(); else document.addEventListener('DOMContentLoaded', installRequestStripHook);

registerExtension('rendered', name => { if (name === 'costing-estimates') decorateEstimatesList(); });
registerAction('quote-preview', el => openQuotePreview(el.dataset.id));
registerAction('quote-push', el => {
    if (el.disabled) return; el.disabled = true;
    const e = state.estimates.get(el.dataset.id); if (!e) return;
    const basis = $('input[name="q-basis"]:checked')?.value || 'suggested';
    const q = P.quoteLines(e, pricingCtx(), pricingSettings(), basis);
    closeModal();
    const n = pushLines(e.requestId, q.lines);
    if (n) toast(`${n} line${n === 1 ? '' : 's'} added to the quote at ${basis === 'menu' ? 'menu' : 'suggested'} prices`);
});
