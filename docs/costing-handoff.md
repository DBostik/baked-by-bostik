# Costing module: handoff for the next session

Last updated: Sep 6, 2026 (end of Phase 2). Read this first, then `DEPLOY.md` section 5.

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
| `admin/costing.js` | Shared plumbing (Firebase app/db, live state via `onSnapshot`, modal, toast, page/action registries) plus Phase 1 screens: Costing Home, Ingredients & Supplies, Log Prices, Recipes, Costing Settings (incl. pricing settings and both starter-data loaders). Exports `state`, helpers, `registerPage`, `registerAction`, `pricingCtx`, `pricingSettings`. |
| `admin/costing-units.js` | Pure functions: unit normalization, recipe-line parser, volume/weight/count conversion via per-ingredient factors, recipe costing (`costRecipe`, `perUnitCosts`), CSV. Runs in Node. |
| `admin/costing-pricing.js` | Pure functions: product geometry scaling (`fillingGrams`, `outerGrams`, `batterBatches`), `priceEstimate` (cost-plus), `DEFAULT_PRICING`. Runs in Node. |
| `admin/costing-products.js` | Products & Sizes screen and product editor (registers page `costing-products`). |
| `admin/costing-estimator.js` | Estimator and Estimates screens, request-modal hook (registers `costing-estimator`, `costing-estimates`). |
| `admin/costing.css` | All Costing styles (prefix `c-`), leans on `admin.css` variables. |
| `admin/costing-seed.json` | Phase 1 starter data from Kristen's sheet (ingredients, sources, dated prices, 14 recipes, review flags). |
| `admin/costing-seed-phase2.json` | Phase 2 starter data (real packaging supplies, 4 products, pricing defaults, recipe patches). |
| `admin/index.html` | Sidebar items `data-page="costing-*"`, page containers `#page-costing-* > .costing-body`, script tags. |
| `admin/admin.js` | Untouched except one line in `showPage()` that hides `.costing-page` elements. Nav clicks are handled by admin.js; costing.js listens on the same links to render. |
| `firestore.rules` | `isAdmin()` UID list, `isPricebot()`, Costing collections. `storage.rules` uses the same admin list. |
| `tools/costing-tests/` | Node unit tests and the Playwright harness (see its README). Run them before every commit. |

Conventions: vanilla ES modules, no bundler, Firebase 10.7.1 modular SDK from gstatic (same as admin.js).
UI is rendered with template strings; every clickable element carries `data-action="..."` handled by the registry
in `costing.js` (Phase 1 actions are in its `switch`; other modules use `registerAction`). Escape all user text with
`esc()`. Modals: `openModal(html, ctx)` / `closeModal()` / `getModalCtx()`. Money helpers in `costing-units.js`.
Keep new work in new files that register pages/actions; do not grow `admin.js`.

## Firestore data (all admin-only unless noted)

* `ingredients/{id}`: name, kind (`ingredient` | `supply`), category, baseUnit (`g` | `ml` | `each`), gramsPerCup,
  gramsPerEach, gramsPerMl, aliases[], notes, staleDays, preferredSourceId, `sources[]` (inline: id, brand, store,
  packageQty, packageUnit, productUrl, preferred, needsPackage, active, currentPrice, currentPriceDate,
  currentMethod), reviewFlags[{text, resolved}], nameLower, createdAt, updatedAt. Pricebot may read.
  * `ingredients/{id}/prices/{auto}`: sourceId, price, date (`YYYY-MM-DD` string), method
    (`import` | `trip` | `edit` | `receipt` | `bot`), note, packageQty, packageUnit, enteredBy, createdAt.
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
  roundCupcakeBatches, roundCookieBatches}), seededAt, phase2SeededAt.
* Reserved for later phases (rules already in place): `menu_prices`, `price_proposals` (pricebot may create
  well-formed pending proposals), `receipt_queue`.

Cost math in one line: unit cost = package price / package size in the ingredient's base unit; line cost =
converted quantity x unit cost; recipe cost = sum of lines (sub-recipes by batch, grams, cups or count);
estimate = materials (ingredients x (1 + waste) + supplies) + labor (hours x rate) + overhead (% or flat),
suggested = cost basis x (1 + profit) rounded up to `roundTo`; margin = (menu - cost basis) / menu.

## Status

* **Phase 0** (setup), **Phase 1** (ingredients, prices, recipes, rules hardening) and **Phase 2** (products,
  estimator, pricing, saved estimates, request hook) are built, tested and deployed (Sep 6, 2026).
  PR #1 (security: quote functions require the admin login, storage uploads limited to images under 15 MB) was
  merged the same day with a fix that keeps the order form's `getDownloadURL` working.
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

3. **Reports and alerts** (1 to 2 sessions): price history charts per ingredient/source (Chart.js is already on
   the admin page), recipe and product cost over 3/6/12 months (needs periodic cost snapshots: add a small
   `cost_snapshots` collection written when prices change or by a monthly routine), cost-jump alerts, Analytics
   page tile. Also start capturing **quantity bought** on Log Prices (a `qty` field on each price entry) so
   inventory has data from day one.
4. **Monthly price bot and receipts** (2 sessions + Dave's setup steps C and D on the plan page): Claude Routine
   on Dave's subscription signs in as the pricebot (env vars in a "Bakery bot" cloud environment), reads
   `ingredients` sources with product links, web-searches prices, writes `price_proposals`; Price Reviews inbox in
   the admin (approve writes a `prices` entry with method `bot`); receipt upload in the admin -> Storage `receipts/`
   -> `receipt_queue` doc -> Cloud Function fires the receipt Routine (API trigger) -> proposals with method `receipt`.
   Fallback: share the receipt with Claude in the app. Helper script for the routine goes in `scripts/pricebot/`.
5. **Add to quote** (1 session): button on a saved estimate that pushes items ({name, qty, price}) into the existing
   Create Quote / Invoice modal in `admin.js` (`renderQuoteItems`, items array), suggested price prefilled.
6. **Inventory** (2 to 3 sessions; Dave asked for it Sep 6): on-hand quantity per supply and later per ingredient,
   reorder point and custom low-stock alerts on Costing Home and the Analytics tile; stock in from Log Prices
   quantities and approved receipt scans; stock out automatically when an order is completed (hook the existing
   request status change to COMPLETED / the estimate linked to that request, consuming its kit and ingredient
   quantities) with a manual adjust screen; history in `inventory_moves`. Start with supplies (boxes, boards,
   bags), extend to ingredients by weight once she trusts it.

## Testing

`node tools/costing-tests/test-units.mjs && node tools/costing-tests/test-pricing.mjs` (pure math), then
`python3 tools/costing-tests/harness/prepare.py && node tools/costing-tests/harness/run-phase2.js` (renders every
screen with the seed data in headless Chromium and prints a JSON summary; `errors` must be empty). Add a check for
every screen you add. There is no staging site; Kristen tests on the live admin after each approved push.

## Setup still pending for Phase 4 (Dave)

Cloud environment "Bakery bot" with `PRICEBOT_EMAIL`, `PRICEBOT_PASSWORD`, `FIREBASE_PROJECT_ID=bakedbybostik-5eb55`,
`FIREBASE_WEB_API_KEY` (public key from `js/firebase-config.js`); two Routines at claude.ai/code/routines
(monthly price check on a schedule; receipt scanner on an API trigger). Click-level steps are on the plan page
(steps C and D). Trusted network access already allows `*.googleapis.com`, which covers Identity Toolkit, Firestore
REST and Storage.
