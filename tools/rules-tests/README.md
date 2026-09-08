# Security rules tests

`test.mjs` runs the public site's exact write shapes (Step 1 and Step 2 of the order form, the review
form, the seasonal form, photo uploads) plus the attack cases from the September 2026 audit against
`firestore.rules` and `storage.rules` in the Firebase emulators. Run it whenever either rules file changes.

Needs Node 20+ and Java 17+ (the emulators are Java). From this folder:

```
npm install
npx firebase setup:emulators:firestore
npx firebase setup:emulators:storage
npm test
```

`npm test` first copies the two rules files from the repo root into this folder (the emulator will not read
files outside its project folder; the copies are gitignored). It prints one line per check and ends with `N passed, 0 failed`. Anything that fails is a rule that would
break the live order form (an "ok" case) or leave a hole open (a "denied as expected" case).

Two limits to remember when editing the rules:

* Firestore evaluates at most 1000 expressions per request. Per-field size checks cost about 25 each and
  helper functions re-count every time they are called, so keep the Step 2 rule lean. The current rule
  uses roughly half the budget; `test.mjs` exercises the heaviest legitimate case (ten photos, three
  add-ons). The photo list is validated with one `join(' ').matches(...)` for that reason.
* A single expression with about 100 chained `&&` terms fails to compile ("too complex to evaluate
  safely"). Split long conditions into helper functions.
