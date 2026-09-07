# Costing tests and browser harness

Offline checks for the admin Costing module. Nothing here touches Firebase or the live site.

## Unit tests (pure math)

    node tools/costing-tests/test-units.mjs      # unit conversion, recipe line parser, recipe costing on the seed
    node tools/costing-tests/test-pricing.mjs    # geometry scaling, whole batches, cost-plus estimate math
    node tools/costing-tests/test-reports.mjs    # Phase 3: price-as-of, snapshots, series/change table, movers, jump alerts

## Browser harness (renders every Costing screen with the seed data)

The harness serves the real `admin/` files with the Firebase SDK swapped for in-memory stubs
(`harness/stubs/`: app, auth, firestore, storage) fed by `admin/costing-seed.json` and `admin/costing-seed-phase2.json`,
plus Phase 4 fixtures (proposals, receipts, a bot run) defined at the top of `stubs/firestore.js`.
It needs Playwright with Chromium (`npm i -g playwright && npx playwright install chromium`). Chart.js is served
from `harness/vendor/chart.umd.js` (4.4.4) so the Reports charts render offline. The Cowork VM on Dave's Mac cannot
run Chromium (no root for its system libraries); run the harness in the cloud container instead (see
`docs/costing-handoff.md`, Testing).

    python3 tools/costing-tests/harness/prepare.py     # builds harness/site from the current admin files
    node tools/costing-tests/harness/run-phase1.js     # ingredients, log prices, recipes, settings
    node tools/costing-tests/harness/run-phase2.js     # products, estimator, estimates, margin table
    node tools/costing-tests/harness/run-phase3.js     # reports, home alerts + dismiss, log prices qty, rebuild history, analytics tile
    node tools/costing-tests/harness/run-phase4.js     # price reviews inbox (approve/dismiss/filters), receipt upload + queue, home card, settings card
    node tools/costing-tests/harness/run-phase5.js     # add to quote: preview (suggested/menu), push into the quote modal stand-in, request strip button

Each run prints a JSON summary (row counts, totals, matched lines, page errors) and writes
screenshots next to the runner. `errors` must be empty apart from blocked font/CDN loads. `run-phase3.js` also
reports `costingJsLoads`, which must be 1 (costing.js used to load twice; see `admin/costing-main.js`).

Add a check whenever you add a screen: navigate to it, assert something about its text, screenshot it.
