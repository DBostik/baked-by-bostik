# Baked By Bostik Costing: how it works and what to try

Everything lives in the admin at bakedbybostik.com/admin, in the sidebar group **Costing**. Same login as always. It works on the laptop and on the phone.

## The idea in one paragraph

You tell it what you buy and what it costs. It knows every recipe, so it always knows what a batch of white cake or buttercream costs today. It knows every product and size, so it can price an 8-inch chocolate cake with ganache and a drip in seconds, tell you the margin at your menu price, and drop the lines into a quote. A bot checks prices online once a month and reads receipts you upload; nothing changes until you approve it. And it keeps count of boxes, boards and bags so you know when to reorder.

## The screens, in the order you will use them

**Costing Home**: what needs attention. Prices that are stale, items missing a price or a package size, the review list, price jumps in the last 30 days (with Dismiss), products under your margin threshold, stock that is low, and any proposals waiting.

**Ingredients**: everything you buy. Each item has one or more sources (brand, store, package size, product link) and one preferred source. Click an item to edit it, update a price, see its price history, or open its chart. A product link helps the monthly bot a lot.

**Log Prices**: after a shopping trip. Pick the store, type the package price next to what you bought, set Packages (how many you bought, usually 1), Save. Every recipe recomputes, and if inventory is on, the counts go up.

**Recipes**: every recipe as written, with the live cost per batch, per cup, per cookie or per cupcake, and which line drives the cost. Paste a recipe as text and it matches the ingredients for you; check the matches.

**Products & Sizes**: the setup behind the Estimator: sizes, menu prices, labor hours, batter batches per size, frosting amounts, packaging kits, add-on minutes and upcharges.

**Estimator**: build an order. Product, size, flavor, filling, outer frosting, extra layer, drip, fondant figures, topper, decor, custom lines; tiers for a two-tier cake; cupcakes and cookies by the dozen. You see materials, labor at your rate, overhead, cost basis, suggested price (your cost-plus formula, rounded up) and margin at the menu price. Link it to a request and save.

**Estimates**: saved estimates with the price when saved and the price today. Open, Duplicate, **Add to quote**, **Made this**.

**Reports**: price history chart for any item (one line per source), biggest movers in the last 30 days, price-jump alerts, and recipe or product cost over 3, 6 and 12 months.

**Price Reviews**: the inbox. Prices the bot found online and lines read from your receipts. Each shows the price on file, the price found, a link, and a note. Fix the number if needed, then Approve or Dismiss. Upload receipts here too (photo or PDF); they are read the next morning.

**Inventory**: on-hand counts and reorder points. Count, Adjust, History, Undo.

**Costing Settings**: stale-price days, waste, stores, the pricing numbers (hourly rate, profit, overhead, rounding, margin alert), the price-jump threshold, cost history rebuild, and what the bot does.

## What happens on its own

* Saving a trip or approving a proposal records a dated price on that source; every recipe, product and saved estimate recomputes from it.
* A cost snapshot is saved whenever prices change, feeding the cost-over-time charts.
* On the 1st of each month at 7 am the price bot looks up every source that has a product link or a named brand and store, and puts what it finds in Price Reviews. It skips Costco items it cannot find online rather than guessing.
* Every morning at 7 am the receipt scanner reads any receipt you uploaded and puts the matched lines in Price Reviews, with the lines it could not match listed on the receipt.
* With inventory on: a trip or an approved receipt adds what you bought; moving a request to Completed takes its estimate's packaging (and any tracked ingredients) off the counts. Everything has Undo for 30 days.

## Adding an estimate to a quote

Open the request as usual. The Costing strip at the top shows its saved estimate and an **Add to quote** button. You get a preview: one line per cake, one line per dozen for cupcakes and cookies, at the suggested price (or switch to menu prices). Add them, and they land in the normal Create Quote screen, where you edit wording or numbers and generate the PDF as always.

## What to test, in order

1. **Prices.** Log one real trip on Log Prices with Packages filled in. Check that the recipes using those items changed on Recipes, and that Costing Home shows a price jump if something moved more than 10%. Dismiss one.
2. **Reports.** Open Reports, pick butter, and look at the chart and the 3, 6, 12 month table. If the cost-over-time chart is empty, press Rebuild cost history once in Costing Settings.
3. **Price Reviews.** Twelve proposals are waiting from the first bot run. Approve a couple you agree with (fix the number first if the shelf price differs), dismiss the rest. Upload one real receipt with the store and date, then look the next morning: matched lines appear as proposals, unmatched lines are listed on the receipt.
4. **Estimates and quotes.** Open a real request, build its estimate, save it. Press Add to quote on the request, try both price choices, and take the quote all the way to the PDF. Compare the suggested price with what you would have charged.
5. **Inventory.** Inventory, Turn on for all supplies. Count each supply you actually have (in packs is fine) and set a reorder point on the ones you run out of. Log a trip and watch the count rise. Move a request that has an estimate to Completed and watch its box and board come off; press Undo if it was only a test. When you trust it, press Track on butter and sugar and count them once.
6. **Settings.** Check the pricing numbers are yours (hourly rate, profit, overhead, rounding, margin alert) and change the price-jump threshold if 10% is too chatty.

## Things to know

* Nothing you approve or log can be lost: every price is a dated entry in the item's history, every stock change is a movement with Undo.
* Suggested prices include your labor at your hourly rate. If they come out far above the menu, the honest fix is the hours per size in Products & Sizes, the rate in Settings, or the menu.
* For anything the bot reports as not found, adding the product link on the item's page is the single thing that helps most.
* If a receipt cannot wait for the morning scan, share the photo with Claude in the Claude app and say "Log this receipt for Baked By Bostik"; it ends up in the same inbox.
* Feedback goes to Dave; he passes it on and the next update follows.
