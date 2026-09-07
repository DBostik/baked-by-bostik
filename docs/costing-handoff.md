# Costing module: handoff for the next session

Last updated: Sep 7, 2026 (end of Phase 6). All six planned phases are built. Read this first, then `DEPLOY.md` section 5.

## What this is

Baked By Bostik is Kristen Bostik's home bakery (Glen Ellyn, IL). Dave (her husband, `dabosti@gmail.com`) runs
the site and the Claude sessions. The **Costing** area of the admin dashboard (`bakedbybostik.com/admin`,
sidebar group "Costing") tracks ingredient and supply prices over time, costs every recipe from current prices,
and prices custom orders (cost-plus) against the menu. Full plan and decisions: the "Baked By Bostik Costing Plan"
page in Dave's Claude artifacts. This file is the engineering handoff.

## Working agreement (do not skip)

* Dave does not operate GitHub. Sessions edit the local folder `~/Desktop/BBB Website` on his Mac mini
  (a Cowork session linked to the Mac), test, commit locally, and **push only after Dave says "approved"** in chat.
  Pushing `main` deploys hosting + functions + rules through GitHub Actions in about 3 minutes.
* Kristen tests each phase before the next starts. Her feedback comes through Dave.
* No em dashes in anything written for Dave. Plain language, click-level steps for anything manual.
* Never put secrets in the repo. GitHub push token: `~/Desktop/My Info For Claude/github-token.txt`.
  Admin login UID: `LYJpCo6DEIO9w9Yurupuw0uyxpJ2` (one shared login). Price-bot UID: `USNXR3iZcdVnNUY2VdPdoeYE3BI2`
  (Firebase Auth user `pricebot@bakedbybostik.com`, password known to Dave; not yet used).
* Git on the mounted folder is quirky (see `DEPLOY.md` section 5): move `.git/logs` aside while committing,
  `git fetch` of new packs bus-errors; when a fetch is needed, use a real-filesystem clone in `$HOME` and sync
  objects back with `git pack-objects` / `git unpack-objects` (that is how PR #1 was merged).

## Files

| File | Role |
| --- | --- |
| `admin/costing-main.js` | The only costing `<script>` tag in `index.html`. Imports the other costing modules by plain relative path so each runs once. (Before Phase 3, `costing.js?v=2` in the tag plus `./costing.js` in the imports made the browser run costing.js twice: doubled click handlers.) Do not add `?v=` to costing script tags; `firebase.json` sends `Cache-Control: no-cache` for `/admin/**` instead. |
| `admin/costing.js` | Shared plumbing (Firebase app/db, live state via `onSnapshot`, modal, toast, page/action registries, extension points) plus Phase 1 screens: Costing Home, Ingredients & Supplies, Log Prices, Recipes, Costing Settings (incl. pricing settings and both starter-data loaders). Exports `state`, helpers, `registerPage`, `registerAction`, `registerExtension`, `pricingCtx`, `pricingSettings`, `recordPrices`, `loadPriceHistory`, `ingredientStatus`, `marginRows`. |
| `admin/costing-units.js` | Pure functions: unit normalization, recipe-line parser, volume/weight/count conversion via per-ingredient factors, recipe costing (`costRecipe`, `perUnitCosts`), CSV. Runs in Node. |
| `admin/costing-pricing.js` | Pure functions: product geometry scaling (`fillingGrams`, `outerGrams`, `batterBatches`), `priceEstimate` (cost-plus), `DEFAULT_PRICING`. Runs in Node. |
| `admin/costing-products.js` | Products & Sizes screen and product editor (registers page `costing-products`). |
| `admin/costing-estimator.js` | Estimator and Estimates screens, request-modal hook (registers `costing-estimator`, `costing-estimates`). |
| `admin/costing-history.js` | Pure functions for Phase 3 (run in Node): date helpers, `priceAsOf`, `ingredientsAsOf` (prices as they were on a date), `unitCostSeries`, `buildSnapshot`, `snapshotAsOf`, `series`, `changeTable`, `movers`, `priceJumps`, `jumpKey`, `pruneDismissed`, `recipesUsing`. |
| `admin/costing-reports.js` | Reports screen (registers `costing-reports`): price history chart per ingredient with one line per source, biggest movers (30 days), price-jump alerts with Dismiss, recipe/product cost over 3/6/12 months from `cost_snapshots` plus a "now vs 3/6/12 months ago" table. Also: the price-jump card on Costing Home (extension `home`), the "Alerts and cost history" card on Costing Settings (extension `settings`, incl. Rebuild cost history), the Costing tile on the Analytics page (`#costing-analytics-tile`), and snapshot writing (`afterPrices` extension, plus a weekly "touch" when Home/Reports opens). Charts via the global `Chart` (Chart.js from the CDN tag in `index.html`). |
| `admin/costing-reviews.js` | Phase 4: Price Reviews inbox (registers `costing-reviews`): proposals with approve (editable price, goes through `recordPrices`), dismiss, filters; receipt upload to Storage `receipts/` + `receipt_queue`; the "proposals waiting" card on Costing Home (extension `home`) and the "Price bot and receipts" card on Costing Settings (extension `settings`, shows `bot_runs`). Puts `state.proposals`, `state.receipts`, `state.botRuns` on the shared state; the Analytics tile reads `state.proposals`. |
| `admin/costing-quote.js` | Phase 5: "Add to quote". Buttons on the Estimates list (extension `rendered`) and on the Costing strip in the Request Details modal (MutationObserver on `#modal-body`). Preview modal with suggested vs menu basis, then pushes lines into admin.js's Create Quote / Invoice modal through its own UI: `window.resendQuote(requestId)` opens it, `#btn-add-item` adds rows, input events on `.q-name/.q-qty/.q-price` update admin.js's private items array. Placeholder rows (price 0) are removed first. Line math is `quoteLines` / `quoteItemName` in `costing-pricing.js` (pure, tested). |
| `admin/costing-inventory-math.js` | Phase 6, pure: `explodeRecipe` / `explodeRecipeGrams` / `explodeEstimate` (what an order physically uses per item, from the `ref` on each priced line), `stockOf`, `stockStatus`, `fmtStock`, `packsToBase`, `stockInFromPrice`. |
| `admin/costing-inventory.js` | Phase 6: Inventory screen (registers `costing-inventory`): turn on (all supplies), per-item Track, count, adjust with reason, reorder point, history, undo; `inventory_moves` writes via `recordMoves` (move doc + `stock.onHand` increment in one batch); stock in on the `afterPrices` extension (trips and approved receipts, qty x package); stock out on requests becoming COMPLETED (listener on `requests` where status == COMPLETED, transitions seen in-session; first snapshot only lists candidates), "Made this" on the Estimates list (extension `rendered`), undo of a whole order; Home "Stock" card (extension `home`). The Analytics tile's Low stock pill is computed in costing-reports.js from the same math. |
| `scripts/pricebot/pricebot.mjs` | The bot's deterministic half (plain Node, REST APIs, signs in as the pricebot; see `scripts/pricebot/README.md` for commands and the two task prompts). Runs on Dave's Mac inside the scheduled tasks. |
| `admin/costing.css` | All Costing styles (prefix `c-`), leans on `admin.css` variables. |
| `admin/costing-seed.json` | Phase 1 starter data from Kristen's sheet (ingredients, sources, dated prices, 14 recipes, review flags). |
| `admin/costing-seed-phase2.json` | Phase 2 starter data (real packaging supplies, 4 products, pricing defaults, recipe patches). |
| `admin/index.html` | Sidebar items `data-page="costing-*"`, page containers `#page-costing-* > .costing-body`, the `#costing-analytics-tile` card inside `.analytics-grid`, and the single `costing-main.js` script tag. |
| `admin/admin.js` | Untouched except one line in `showPage()` that hides `.costing-page` elements. Nav clicks are handled by admin.js; costing.js listens on the same links to render. |
| `firestore.rules` | `isAdmin()` UID list, `isPricebot()`, Costing collections. `storage.rules` uses the same admin list. |
| `tools/costing-tests/` | Node unit tests and the Playwright harness (see its README). Run them before every commit. |

Conventions: vanilla ES modules, no bundler, Firebase 10.7.1 modular SDK from gstatic (same as admin.js).
UI is rendered with template strings; every clickable element carries `data-action="..."` handled by the registry
in `costing.js` (Phase 1 actions are in its `switch`; other modules use `registerAction`). Escape all user text with
`esc()`. Modals: `openModal(html, ctx)` / `closeModal()` / `getModalCtx()`. Money helpers in `costing-units.js`.
Keep new work in new files that register pages/actions; do not grow `admin.js`. To add to a Phase 1 screen from a new
file use `registerExtension(point, fn)`: `home(body)` and `settings(body)` return HTML appended to that screen,
`afterPrices(entries, touchedIds)` runs after `recordPrices` commits, `dataChanged()` runs on every rerender (any
collection changed, even with no costing page showing), `rendered(name, body)` runs after any costing page renders
(used to add buttons to another module's screen). New modules must be imported from `costing-main.js`.

## Firestore data (all admin-only unless noted)

* `ingredients/{id}`: name, kind (`ingredient` | `supply`), category, baseUnit (`g` | `ml` | `each`), gramsPerCup,
  gramsPerEach, gramsPerMl, aliases[], notes, staleDays, preferredSourceId, `sources[]` (inline: id, brand, store,
  packageQty, packageUnit, productUrl, preferred, needsPackage, active, currentPrice, currentPriceDate,
  currentMethod), reviewFlags[{text, resolved}], nameLower, createdAt, updatedAt. Pricebot may read.
  * `ingredients/{id}/prices/{auto}`: sourceId, price, date (`YYYY-MM-DD` string), method
    (`import` | `trip` | `edit` | `receipt` | `bot`), note, packageQty, packageUnit, `qty` (packages bought; set by
    Log Prices since Phase 3, default 1; null for edits and older entries; inventory reads this), enteredBy, createdAt.
* `recipes/{id}`: name, category (`cake` | `cupcake` | `cookie` | `frosting` | `filling` | `other`), creator,
  sourceUrl, notes, `lines[]` ({text, qty, unit, ingredientId | recipeId, note}; unit `batch` for sub-recipes),
  `yield` ({type: `batter` | `volume` | `count`, value, unit, label, scoopTable?}), reviewFlags, timestamps.
* `products/{id}`: name, family (`cake` | `cupcake` | `cookie` | `cc-cookie`), unitLabel, description, active,
  minimumQty, reviewFlags. Cake: layersDefault, layerHeightIn, refSizeId, refFillingGrams, refOuterGrams,
  defaultFlavorRecipeId, defaultFillingRecipeId, defaultOuterRecipeId, premiumFillingIds[], `sizes[]`
  ({id, label, diameterIn, menuPrice, laborHours, batter{recipeId: batches}, batterDefault, dripGrams,
  fillingGramsOverride, outerGramsOverride, kit[{supplyId, qty}]}), `addons` (premiumFillingUpcharge,
  extraLayerUpcharge, extraLayerMinutes, dripRecipeId, dripMinutes, dripUpcharge, dripGramsDefault, figureMinutes,
  figureMaterialCost, figureUpcharge, topperMinutes, topperDefaultCost, tierMinutes, tierKit[],
  perCakeOnlySupplyIds[]). Cupcake: defaultFlavorRecipeId, defaultFrostingRecipeId, cupcakesPerBatch{recipeId: n},
  cupcakesPerBatchDefault, frostingGramsPerCupcake, laborHoursPerDozen, `tiers[]` ({id, label, menuPricePerDozen,
  minutesPerUnit}), kitPerDozen[]. Cookie / cc-cookie: doughRecipeId, cookiesPerBatch, icingRecipeId,
  icingGramsPerCookie, laborHoursPerDozen, cookiesPerBox, tiers[] (+ `scoop` for cc-cookie), kitPerOrder[],
  kitPerBox[], kitPerCookie[], addons (characterMinutes, characterMaterialCost, characterUpcharge).
* `estimates/{id}`: name, requestId, customerLabel, notes, `items[]` (see `newItemFor` in costing-estimator.js:
  cake items have `tiers[]`, drip, fondantFigures, topper, decor[], custom[]; others have qty in dozens, tierId, ...),
  `snapshot` ({totals, items, settingsUsed, at}), createdAt, updatedAt.
* `costing_settings/global`: staleDaysDefault, stores[], wasteAllowancePct, `pricing` ({hourlyRate, profitPct,
  overheadType `pct` | `flat`, overheadValue, roundTo, marginAlertPct, roundCakeBatches, roundFrostingBatches,
  roundCupcakeBatches, roundCookieBatches}), `alerts` ({priceJumpPct (default 10), dismissed[] of jump keys
  `ingredientId|sourceId|date|price`, pruned to the last 90 days on write}), seededAt, phase2SeededAt.
* `cost_snapshots/{YYYY-MM-DD}` (Phase 3): one document per day; date, trigger (`prices` | `open` | `backfill` |
  `rebuild`), reconstructed (true for backfilled months), `recipes` ({id: {name, category, total, ok, perCount,
  countLabel, perCup, perGram}}), `products` ({`productId|sizeOrTierId`: {name, label, family, costBasis, materials,
  labor, suggested, menu, marginPct, ok}}), `ingredients` ({id: {name, kind, baseUnit, unitCost, price, priceDate,
  sourceId, carriedBack}}), counts, at. Written by the admin page after every price save, when Home or Reports opens
  and the newest snapshot is over 7 days old, and by "Rebuild cost history" (month-ends back to the first price entry,
  prices as of each date with the first known price carried back; never replaces a non-reconstructed snapshot).
  Reports read the whole collection (ordered by date, limit 600); with a few writes a month that stays small.
* `price_proposals/{auto}` (Phase 4, written by the pricebot script): ingredientId, ingredientName, sourceId,
  sourceLabel, price (package price), foundAt (`YYYY-MM-DD`), status (`pending` | `approved` | `dismissed`), method
  (`bot` | `receipt`), currentPrice, currentPriceDate (on file when found), packageQty, packageUnit (what the bot saw),
  foundUrl, note, confidence (`high` | `medium` | `low`), receiptId, receiptPath, lineText, qty (receipts), runId,
  createdBy, createdAt; on review: approvedPrice, reviewedAt, reviewedBy. Pricebot may read and create; admin the rest.
* `receipt_queue/{date-uid}` (Phase 4, written by the admin upload): path (`receipts/<id>.<ext>` in Storage),
  contentType, originalName, size, store, note, date, status (`pending` | `done` | `nothing` | `failed`), uploadedAt,
  uploadedBy; set by the scanner: scannedAt, proposalsCount, unmatched[], botNote (the only fields the pricebot may
  update). Storage rules: admin read/write, pricebot read on `receipts/`.
* `ingredients/{id}.stock` (Phase 6): track, onHand (base units: each, g or ml), reorderPoint (same unit; null = no
  alert), countedAt (`YYYY-MM-DD` of the last count), updatedAt. `costing_settings/global.inventory.startedAt` marks
  when inventory was turned on; orders completed before it are ignored.
* `inventory_moves/{type-date-uid}` (Phase 6): itemId, itemName, baseUnit, delta, before, after, type (`count` |
  `adjust` | `in-trip` | `in-receipt` | `out-order` | `undo`), note, refType (`price` | `estimate` | `move`), refId,
  groupId (`out-<estimateId>` for an order's set of moves), at, by, date, undone. Admin only. `estimates/{id}.stockOut`
  ({at, groupId, items, auto, problems}) marks an estimate already taken from stock (cleared on undo).
* `bot_runs/{auto}`: kind (`price-check` | `receipt-scan`), startedAt, finishedAt, status, summary. Pricebot creates
  and updates; Costing Settings lists the last 8.
* Reserved: `menu_prices`.

Cost math in one line: unit cost = package price / package size in the ingredient's base unit; line cost =
converted quantity x unit cost; recipe cost = sum of lines (sub-recipes by batch, grams, cups or count);
estimate = materials (ingredients x (1 + waste) + supplies) + labor (hours x rate) + overhead (% or flat),
suggested = cost basis x (1 + profit) rounded up to `roundTo`; margin = (menu - cost basis) / menu.

## Status

* **Phase 0** (setup), **Phase 1** (ingredients, prices, recipes, rules hardening) and **Phase 2** (products,
  estimator, pricing, saved estimates, request hook) are built, tested and deployed (Sep 6, 2026).
  PR #1 (security: quote functions require the admin login, storage uploads limited to images under 15 MB) was
  merged the same day with a fix that keeps the order form's `getDownloadURL` working.
* **Phase 6** (inventory) was built Sep 7, 2026: `costing-inventory.js`, `costing-inventory-math.js`, `ref` data
  on priced lines in `costing-pricing.js`, rules for `inventory_moves`, unit tests `test-inventory.mjs`, harness
  `run-phase6.js`. Kristen's first steps: Inventory, "Turn on for all supplies", then Count each supply once and set
  reorder points; log a trip with Packages filled in and watch the counts rise; complete a request that has an
  estimate and watch its packaging come off. Ingredients by weight: press Track on butter, sugar and so on, count
  once (grams, or packs of the preferred package).
* **Phase 5** (add to quote) was built Sep 7, 2026: `costing-quote.js`, `quoteLines` in `costing-pricing.js`, harness
  `run-phase5.js` (with a stand-in for admin.js's quote modal in `prepare.py`). Kristen's test: open a request that has
  a saved estimate, press Add to quote on the Costing strip, check the lines and prices in the quote screen, generate
  the PDF as usual.
* **Phase 4** (price bot and receipts) was built Sep 7, 2026: Price Reviews inbox, receipt upload and queue,
  `scripts/pricebot/pricebot.mjs` (tested live as the pricebot: sign-in ok, 47 items / 53 sources / 26 searchable,
  none with product links yet), rules for the pricebot, and the two scheduled tasks. Dave's password file was
  first saved as RTF (`pricebot-password.txt.rtf`); the session converted it to the plain `pricebot-password.txt`.
  Kristen's first steps: open Price Reviews after the first bot run, approve or dismiss each line; upload one real
  receipt and check it the next morning; add product links on the item pages for things the bot could not find.
* **Phase 3** (reports and alerts) was built Sep 6, 2026 (evening): Reports screen, price-jump alerts with Dismiss on
  Costing Home, Analytics tile, `cost_snapshots`, "Packages" (qty) on Log Prices, alert threshold setting, Rebuild cost
  history. It also fixed the double-loaded `costing.js` (see `costing-main.js`). Committed locally; pushed once Dave
  approves. Kristen's first steps after the deploy: Costing Settings, "Rebuild cost history" once; set "Flag a price
  move over (%)"; log one real trip and watch Home, Reports and the Analytics tile.
* Kristen has loaded the Phase 1 starter data and tried the screens ("works well so far"). She still needs to
  press **Load Phase 2 starter data** in Costing Settings after the Phase 2 deploy, then work the review list
  (butter price first) and check the hours per cake size (her 3/4/5/6 hours make every size price below cost;
  she is deciding between hands-on hours and price changes).
* Her numbers on file: labor $32/h; waste 5%; fondant figure 20 min; drip 5 min; topper 20 to 30 min; 5 min per
  extra tier; one buttercream batch per 6-inch 3-layer cake; whole batches of cake; packaging brands and pack
  prices are in `costing-seed-phase2.json`. Placeholders she has not confirmed: sugar cookies per batch (24),
  royal icing per cookie (20 g), decorating minutes per tier (5/8/12), cupcake labor and frosting (1 h/doz, 60 g),
  dowels per cake (4), label cost (20 cents), heat-seal bag pack size (50).
* Two recipes (Lemon Cupcakes, Pumpkin Cookie) still have no ingredient lines; she pastes them in.

## Next phases (from the plan page; inventory added Sep 6 at Dave's request)

3. **Reports and alerts**: done (see Status). Possible second pass after Kristen's feedback: alert on the Analytics
   tile for proposals once Phase 4 lands; the monthly routine could also write a `cost_snapshots` doc (it would need
   read access to recipes and products, which the pricebot does not have today; the admin page's weekly touch covers
   it for now).
4. **Monthly price bot and receipts**: done Sep 7, 2026 as designed below (design revised Sep 6 with Dave after Phase 3, because a
   Cowork session cannot create a cloud environment, set environment variables, or generate an API trigger token
   (no tools for those), but it CAN create scheduled tasks (Routines) with `create_trigger`, as it did for Dave's SEO
   re-benchmark. So:
   * **Bot login**: Firebase Auth user `pricebot@bakedbybostik.com`, UID `USNXR3iZcdVnNUY2VdPdoeYE3BI2` (done, in the
     rules). The password lives in `~/Desktop/My Info For Claude/pricebot-password.txt` on the Mac mini (Dave creates
     it; never in the repo, a prompt, or chat). Routines run linked to the Mac (`requires_local_device: true`) and read
     the file with `device_bash`, then sign in from the cloud container via the Identity Toolkit REST API
     (`signInWithPassword`, web API key from `js/firebase-config.js`) and use the Firestore REST API with the ID token.
     If the Mac is offline when a routine fires, it reports that and stops; nothing else is needed.
   * **Two scheduled tasks, created by Claude** (no Dave clicks): "BBB monthly price check" on the 1st of each month
     (reads `ingredients` sources with product links, web-searches prices, writes `price_proposals` with foundAt, link,
     confidence note, status `pending`); "BBB receipt scanner" daily in the morning (reads `receipt_queue` docs with
     status `pending`, fetches the photo from Storage, matches lines to ingredients/sources, writes proposals with
     method `receipt`, marks the queue doc done). A run that finds nothing ends in seconds. Rules already let the
     pricebot read `ingredients` and create pending `price_proposals`; add read on `receipt_queue` + update of its
     status, and Storage read on `receipts/` for the pricebot UID. No Cloud Function and no API trigger.
   * **Admin side** (new file `admin/costing-reviews.js`): Price Reviews inbox (approve writes a `prices` entry with
     method `bot` or `receipt` through `recordPrices`, edit, dismiss; source link beside every line); "Upload receipt"
     button (Storage `receipts/{date}-{id}.jpg`, `receipt_queue` doc); the Analytics tile and Costing Home "proposals
     waiting" numbers switch from 0 to the real count; the "share the photo with Claude in the app" fallback is
     documented in Costing Settings. The bot's deterministic parts go in `scripts/pricebot/` (Node, no dependencies)
     so the routine prompt is short: run the script to fetch the watch list, do the looking up, run the script to
     write proposals.
   * The scheduled tasks are created with `create_trigger` (`requires_local_device: true`, cron in UTC: price check
     `0 12 1 * *`, receipt scan `0 12 * * *`, both 7 am Chicago during daylight time, an hour later in winter);
     `list_triggers` shows them, `fire_trigger` runs one by hand. Their prompts are in `scripts/pricebot/README.md`.
   * Possible second pass after Kristen's feedback: product links on sources (helps the bot most), a "match this line
     to..." picker on unmatched receipt lines, approving several proposals at once.
5. **Add to quote**: done Sep 7, 2026 (see `admin/costing-quote.js`). Lines: one per cake (qty = cakes), cupcakes and
   cookies per dozen; suggested price split across items in proportion to materials plus labor so the lines add up to
   the estimate's suggested price, or menu prices per item. Names are customer-facing (product, sizes, flavors, add-ons)
   and editable in the quote screen.
6. **Inventory**: done Sep 7, 2026 as planned (see the file map and data model). Dave's call: stock out is
   automatic on Completed, with Undo for 30 days and a Home list for orders completed while the admin was closed.
   Known limits: the automatic stock-out needs an admin page open somewhere when the card is moved (the listener
   runs in the browser); anything missed shows on Home and Inventory as "not yet taken from stock". Ingredient
   quantities follow what was costed (whole batches when the settings round). Two admin tabs completing the same
   order at the same instant could double-count; the estimate's `stockOut` stamp prevents it in normal use.

Ideas for later, none scheduled: product links on sources for the bot; a "match this line to..." picker on
unmatched receipt lines; approving several proposals at once; a shopping list from low-stock items; ingredient
stock-out shown in grams on the estimate breakdown.

## Testing

`node tools/costing-tests/test-units.mjs && node tools/costing-tests/test-pricing.mjs && node tools/costing-tests/test-reports.mjs && node tools/costing-tests/test-inventory.mjs`
(pure math), then `python3 tools/costing-tests/harness/prepare.py` and `node tools/costing-tests/harness/run-phase1.js`,
`run-phase2.js`, `run-phase3.js`, `run-phase4.js`, `run-phase5.js`, `run-phase6.js` (each renders screens with the seed data in headless Chromium and prints a JSON
summary; `errors` must be empty apart from blocked font/CDN loads). Add a check for every screen you add. The Playwright
harness cannot run inside the Cowork VM on the Mac (no root, Chromium's system libraries are missing), so run it in the
cloud container: tar `admin/`, `js/firebase-config.js` and `tools/costing-tests` from the Mac, stage the tar, extract in
the container, run there, and copy changed files back with `device_commit_files` (that is how Phase 3 was tested).
There is no staging site; Kristen tests on the live admin after each approved push.

## Setup for Phase 4 (done)

`~/Desktop/My Info For Claude/pricebot-password.txt` holds the pricebot's password (plain text, one line; created
Sep 7, 2026). The plan page's steps C2, C3 and D (cloud environment, environment variables, Routines with an API
trigger) were not needed; Claude created the scheduled tasks. The Cowork VM on the Mac reaches `*.googleapis.com`
directly, so the script runs there and the password never leaves the Mac.
