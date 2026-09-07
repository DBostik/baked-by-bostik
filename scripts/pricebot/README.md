# Price bot (Costing, Phase 4)

Two scheduled tasks on Dave's Claude account keep ingredient prices fresh without anyone typing them in:

* **BBB monthly price check** (1st of each month, 7 am Chicago): looks up every source that has a product link or a
  named brand and store, and proposes a price for the ones it can verify.
* **BBB receipt scanner** (every morning, 7 am Chicago): reads receipts Kristen uploaded on the admin's Price Reviews
  screen, matches the lines to her ingredients, and proposes those prices.

Proposals land in **Costing > Price Reviews** in the admin. Nothing changes a price until Kristen approves it.

## How it runs

Each task is a fresh Claude session linked to Dave's Mac mini (it must be on with the Claude app running). The
deterministic parts are `pricebot.mjs` in this folder, run with `device_bash` on the Mac; Claude does only the
judgment: web lookups, reading the receipt photo, matching lines to items. The script signs in as the limited
Firebase user `pricebot@bakedbybostik.com` (UID in `firestore.rules`), whose password sits in
`~/Desktop/My Info For Claude/pricebot-password.txt` on the Mac (never in the repo, a prompt, or chat). Rules let
that user read `ingredients`, read and create `price_proposals`, read `receipt_queue` and update a receipt's
result fields, read `receipts/` in Storage, and write `bot_runs`. Nothing else.

    node scripts/pricebot/pricebot.mjs check                       # sign in, print counts
    node scripts/pricebot/pricebot.mjs watchlist --out wl.json     # every active source with brand, store, package, link, price, staleness
    node scripts/pricebot/pricebot.mjs propose proposals.json      # create proposals (validates ids, skips duplicates)
    node scripts/pricebot/pricebot.mjs receipts --download DIR     # pending receipts, files downloaded to DIR
    node scripts/pricebot/pricebot.mjs receipt-done ID --status done --proposals p.json --unmatched "a;b" --note "..."
    node scripts/pricebot/pricebot.mjs run-start --kind price-check   # prints a run id; run-end ID --summary "..." closes it

Proposal JSON: `[{ingredientId, sourceId, price, foundAt?, foundUrl?, note?, confidence?, packageQty?, packageUnit?,
lineText?, qty?}]`. `price` is the package price. `foundAt` defaults to today.

Run it by hand from a Cowork session linked to the Mac: `cd "$HOME/mnt/Desktop/BBB Website" && node scripts/pricebot/pricebot.mjs check`.

## The two task prompts

Kept here so they can be re-created if a task is ever deleted (Claude creates them with the scheduled-task tools;
see `docs/costing-handoff.md`).

### BBB monthly price check

> You are the Baked By Bostik monthly price check (the bakery's Costing tool, Phase 4). This session is linked to Dave's Mac mini; the site repo is the folder Desktop/BBB Website there, reached in device_bash at "$HOME/mnt/Desktop/BBB Website". If the computer is not reachable, say so in one line and stop. Never print, copy or quote the password file. Full details: scripts/pricebot/README.md and docs/costing-handoff.md in that repo. Important: every device_bash call starts a fresh shell in the home folder with no variables kept, so every command below begins with cd "$HOME/mnt/Desktop/BBB Website" && and the run id is kept in a file.
>
> 1. device_bash: cd "$HOME/mnt/Desktop/BBB Website" && node scripts/pricebot/pricebot.mjs check. If sign-in fails, report it and stop.
> 2. device_bash: cd "$HOME/mnt/Desktop/BBB Website" && node scripts/pricebot/pricebot.mjs run-start --kind price-check > "$HOME/run.txt" && cat "$HOME/run.txt" (the run id). Then: cd "$HOME/mnt/Desktop/BBB Website" && node scripts/pricebot/pricebot.mjs watchlist --out "$HOME/wl.json" && cat "$HOME/wl.json".
> 3. For each source with searchable true, look up today's price online with WebSearch and WebFetch: use productUrl when present; otherwise search for the brand, item name, package size and store together. Accept a price only for the same brand and the same package size, at that store's own site (or the Amazon listing for Amazon sources). Costco warehouse items are often not online and Walmart prices vary by store: when there is no clean match, mark it not found; never guess or average. Skip sources whose price on file is under 30 days old unless they have a productUrl. Keep the whole run to about 40 lookups.
> 4. Write the proposals file with device_bash (a heredoc: cat > "$HOME/proposals.json" <<'EOF' ... EOF): a JSON array of {ingredientId, sourceId, price, foundAt (today, YYYY-MM-DD), foundUrl, note, confidence, packageQty, packageUnit}. Include items you found and items where only a different package size was found (confidence low, packageQty and packageUnit set to what you saw, note saying so). Leave out items whose found price equals the price on file within a cent, and everything not found. Notes are one plain sentence: where it was found and any doubt.
> 5. device_bash: cd "$HOME/mnt/Desktop/BBB Website" && node scripts/pricebot/pricebot.mjs propose "$HOME/proposals.json" --run "$(cat "$HOME/run.txt")".
> 6. device_bash: cd "$HOME/mnt/Desktop/BBB Website" && node scripts/pricebot/pricebot.mjs run-end "$(cat "$HOME/run.txt")" --summary "N proposed, M not found, K unsure" (add --status failed if something broke).
> 7. Report to Dave in plain language with no em dashes: how many were proposed, the notable moves, what was not found and why, and anything that needs a product link added on the item's page in the admin. Do not edit repo files, do not commit, do not push.

### BBB receipt scanner

> You are the Baked By Bostik receipt scanner (the bakery's Costing tool, Phase 4). This session is linked to Dave's Mac mini; the site repo is the folder Desktop/BBB Website there, reached in device_bash at "$HOME/mnt/Desktop/BBB Website". If the computer is not reachable, say so in one line and stop. Never print, copy or quote the password file. Full details: scripts/pricebot/README.md and docs/costing-handoff.md in that repo. Important: every device_bash call starts a fresh shell in the home folder with no variables kept, so every command below begins with cd "$HOME/mnt/Desktop/BBB Website" && and the run id is kept in a file.
>
> 1. device_bash: cd "$HOME/mnt/Desktop/BBB Website" && node scripts/pricebot/pricebot.mjs receipts --download "$HOME/mnt/Desktop/BBB Website/scripts/pricebot/tmp". If the result is an empty list, reply "No receipts waiting." and stop; do not create a run record.
> 2. device_bash: cd "$HOME/mnt/Desktop/BBB Website" && node scripts/pricebot/pricebot.mjs run-start --kind receipt-scan > "$HOME/run.txt" && cat "$HOME/run.txt". Then: cd "$HOME/mnt/Desktop/BBB Website" && node scripts/pricebot/pricebot.mjs watchlist --out "$HOME/wl.json" && cat "$HOME/wl.json".
> 3. For each receipt, stage its downloaded file with device_stage_files using the Mac path "/Users/davebostik/Desktop/BBB Website/scripts/pricebot/tmp/<file name>", then Read the staged file to see it (for a PDF, Read with pages). Read every line item: the item text as printed, the price paid, and the quantity if shown.
> 4. Match each grocery line to a watch-list source: same store (the receipt's store field, or the store printed on it), brand or item words that fit, and a package size that fits. Match only when you are confident. For each match write {ingredientId, sourceId, price (the price of one package; divide when the line shows a quantity), lineText (as printed), qty (packages bought, default 1), note (one sentence), confidence}. Grocery lines you could not match go in a short "unmatched" list as printed; ignore non-grocery lines, tax and totals.
> 5. Write the matches with device_bash (a heredoc) to "$HOME/p-<receipt id>.json", then: cd "$HOME/mnt/Desktop/BBB Website" && node scripts/pricebot/pricebot.mjs receipt-done "<receipt id>" --status done --proposals "$HOME/p-<receipt id>.json" --unmatched "line;line" --note "<one sentence about the receipt>" --run "$(cat "$HOME/run.txt")". Use --status nothing (no --proposals) when no line matched, and --status failed with a note when the photo cannot be read.
> 6. device_bash: cd "$HOME/mnt/Desktop/BBB Website" && node scripts/pricebot/pricebot.mjs run-end "$(cat "$HOME/run.txt")" --summary "R receipts, N proposed, U unmatched".
> 7. Report to Dave in plain language with no em dashes: per receipt, what was matched and what was not. Do not edit repo files, do not commit, do not push. Files under scripts/pricebot/tmp are ignored by git; leave them.
