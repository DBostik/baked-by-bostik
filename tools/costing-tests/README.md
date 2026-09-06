# Costing tests and browser harness

Offline checks for the admin Costing module. Nothing here touches Firebase or the live site.

## Unit tests (pure math)

    node tools/costing-tests/test-units.mjs      # unit conversion, recipe line parser, recipe costing on the seed
    node tools/costing-tests/test-pricing.mjs    # geometry scaling, whole batches, cost-plus estimate math

## Browser harness (renders every Costing screen with the seed data)

The harness serves the real `admin/` files with the Firebase SDK swapped for in-memory stubs
(`harness/stubs/`) fed by `admin/costing-seed.json` and `admin/costing-seed-phase2.json`.
It needs Playwright with Chromium (`npm i -g playwright && npx playwright install chromium`).

    python3 tools/costing-tests/harness/prepare.py     # builds harness/site from the current admin files
    node tools/costing-tests/harness/run-phase1.js     # ingredients, log prices, recipes, settings
    node tools/costing-tests/harness/run-phase2.js     # products, estimator, estimates, margin table

Each run prints a JSON summary (row counts, totals, matched lines, page errors) and writes
screenshots next to the runner. `errors` must be empty apart from blocked font/CDN loads.

Add a check whenever you add a screen: navigate to it, assert something about its text, screenshot it.
