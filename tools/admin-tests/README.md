# Admin dashboard tests

`harness/run-xss.js` loads the real `admin/admin.js` (with the Firebase SDK swapped for the in-memory stubs in
`tools/costing-tests/harness/stubs`), seeds hostile customer, request, review, seasonal and order records
(HTML in every field, attribute break-outs, `javascript:` and off-site URLs, a document id that breaks an inline
`onclick` string), walks every screen that renders them (board, list, search, detail modal, edit mode, quote
modal, customers and the History button, reviews, seasonal, ledger, analytics, calendar, gallery), and reports
whether anything executed (`xss`), rendered as markup (`imgX`), produced a `javascript:` or off-site link, or
left data inside an inline handler. Every one of those numbers must be 0 and `errors` must be empty; the
`...AsText` checks must be true (the payload is visible, as text).

Needs Playwright with Chromium (run it in the cloud container, not the Cowork VM on the Mac):

```
python3 tools/admin-tests/harness/prepare.py
node tools/admin-tests/harness/run-xss.js
```

Before the September 2026 Phase 2 fix the deployed dashboard executed the payload 84 times across those screens
(26 on the default board view alone) and the global search threw on a customer without an email.

Rules for admin.js that keep this green: anything from a Firestore document or a document id goes through
`esc()` before it is placed in HTML (text or attribute); URLs from documents go through `safeUrl()` (only this
project's Storage links pass); never put data inside an inline `onclick` string, use `data-*` attributes and a
listener; `textContent` for anything that needs no markup.
