# Deployment & Technology Stack Guide

This document explains how the **Baked By Bostik** website is built, hosted, and deployed. It is the one set of rules for every developer and every AI agent (Claude Code, Google Antigravity, or any other tool). `CLAUDE.md` and `GEMINI.md` only point here. Read it before you commit, push, deploy, or change how the project is set up.

## 1. The Technology Stack

| Component | Service | Role | Key URL |
| :--- | :--- | :--- | :--- |
| **Code Repository** | **GitHub** | **Source of Truth.** All code lives here. | `https://github.com/DBostik/baked-by-bostik` |
| **Hosting (Live)** | **Firebase Hosting** | **Production.** Automatically deployed via GitHub Actions. | `https://bakedbybostik.com` |
| **Backend** | **Firebase** | **Database, Auth, Storage, Functions.** Handles all dynamic data (request forms, admin dashboard, emails). | Firebase Console |
| **CI/CD** | **GitHub Actions** | **Automation.** Watcher that deploys code to Firebase whenever changes are pushed to `main`. | `.github/workflows/firebase-deploy.yml` |

> [!NOTE]
> **Vercel is NO LONGER used.** 
> The site is hosted 100% on Firebase to simplify architecture and avoid domain conflict issues.

---

## 2. Rules for Every Change (any tool)

1. **Dave approves each commit and each push, one at a time.** Approval for one never covers the next. A push to `main` is a live deploy of the whole site, its database rules and its functions.
2. **No pull requests.** Dave's workflow: edit the files in the working copy, test, commit, then push `main` after he says yes. Nothing for him to merge.
3. **One working copy:** `~/Projects/BBB Website` on Dave's Mac. The old `~/Desktop/BBB Website` copy is on the iCloud Desktop (iCloud has broken a git repo before) and is retired: never edit, commit or push from it. Two scheduled price-bot tasks still run scripts from it until they are moved (see `scripts/pricebot/README.md`).
4. **Deploy only by pushing `main` to GitHub.** Don't run `firebase deploy` yourself unless Dave asks for the manual fallback (section 5).
5. **Push with the Mac's own GitHub sign-in:** plain `git push origin main`. Never put a GitHub token in a command, a file, or this repo.
6. **Stage files by name** (`git add path/to/file`), never `git add .` or `git add -A`. macOS rewrites `.DS_Store` files on its own; never commit those changes.
7. **Never print secrets** (the email password, any service-account key). Never run `firebase functions:list --json`, which can print the email password; the table output is safe.
8. **Run the Firebase CLI as `npx --yes firebase-tools ...`.** Plain `npx firebase` can fail or pick up the wrong package.

---

## 3. The "Gold Standard" Workflow

Follow this process to ensure stability and avoid breaking the live site.

### Step 1: Develop Locally (Safe Zone)
1.  **Pull Latest Code:** `git pull origin main`
2.  **Make Changes:** Edit HTML/CSS/JS files on your local machine.
3.  **Preview:** Run a local server to verify changes.
    ```bash
    python3 -m http.server 8080
    ```
4.  **Verify:** Open `http://localhost:8080` in your browser.

### Step 2: Test (what to run depends on what changed)
All of these run on the Mac against local emulators or stubs. None of them touch the live site or live data.
*   **`firestore.rules` or `storage.rules`:** `tools/rules-tests` (see its README; 81 checks, all must pass). The emulators need Java; on Dave's Mac put `PATH=/opt/homebrew/opt/openjdk/bin:$PATH JAVA_HOME=/opt/homebrew/opt/openjdk` in front of the command.
*   **Costing files in `admin/`:** the four `node tools/costing-tests/test-*.mjs` files (see `tools/costing-tests/README.md`).
*   **`admin/admin.js`:** `tools/admin-tests` (see its README).
*   **`functions/`:** `cd functions && npm ci`, then load them in the emulator under a demo project id (a `demo-` id never reaches the live project):
    ```bash
    npx --yes firebase-tools emulators:exec --only functions,firestore --project demo-bbb "node -e 'setTimeout(()=>{},3000)'"
    ```
    The log must list all 4 functions after "Loaded functions definitions from source".

### Step 3: Commit and Push (each with Dave's yes)
```bash
git add <each file you changed>
git commit -m "Description of what you fixed or added"
git push origin main
```

### Step 4: Automatic Deployment and Checks
*   **GitHub Actions** detects the push, signs in to Firebase with the `FIREBASE_SERVICE_ACCOUNT_BAKEDBYBOSTIK_5EB55` secret and runs `firebase deploy`.
*   Changes are live on `bakedbybostik.com` within about 1 to 3 minutes.
*   Watch the run: `gh run list --limit 3`, then `gh run watch <run id>`. It must end green.
*   Check the live pages you changed. After a functions change, also run `npx --yes firebase-tools functions:list --project bakedbybostik-5eb55` (table output).

---

## 4. Secrets and Settings

*   The email login (`SMTP_EMAIL`, `SMTP_PASSWORD`) lives in **Google Cloud Secret Manager**. `dispatchQuoteEmail`, `scheduledWeeklyReport` and `onNewOrderRequest` declare it with `secrets: [...]` in `functions/index.js`. `createQuotePDF` never sends email and has no secrets on purpose.
*   Never put the email login in `functions/.env`. A name can't be both a plain setting and a secret, so the deploy would fail, and plain settings are readable by anyone with project access.
*   To check that the secrets exist without seeing them: `npx --yes firebase-tools functions:secrets:get SMTP_PASSWORD --project bakedbybostik-5eb55` (shows version numbers only).
*   If sending a quote from the admin shows "SIMULATION MODE", the functions can't see the email login.
*   **Node version:** the functions run on Node 24. `functions/package.json` (`engines`) and the workflow's `node-version` must match. Google retires Node 24 on 2028-10-31; move to a newer version before then.

---

## 5. Manual Deployment (Fallback Only, with Dave's yes)

If GitHub Actions is failing or you need to deploy a specific backend function immediately without waiting. Deploy only from a committed `main` that matches GitHub, so the live site never runs code GitHub doesn't have.

**Deploy Everything (Site + Functions + Rules):**
```bash
npx --yes firebase-tools deploy --project bakedbybostik-5eb55
```

**Deploy Only Website (Hosting):**
```bash
npx --yes firebase-tools deploy --only hosting --project bakedbybostik-5eb55
```

**Deploy Only Functions:**
```bash
npx --yes firebase-tools deploy --only functions --project bakedbybostik-5eb55
```

**Do not use `deploy_update.command` or `easy_setup.sh`.** They are from before the functions read the email login from Secret Manager: they write the password into `functions/.env` or old-style config and deploy from the Mac.

---

## 6. Troubleshooting

*   **"My changes aren't showing up!"**
    *   Did you push to `main`? (Pushing to other branches does not trigger a deploy).
    *   Check the [GitHub Actions tab](https://github.com/DBostik/baked-by-bostik/actions) to see if the build failed.
*   **"Deployment Failed on GitHub with an IAM or Permission Error"**
    *   It might be a basic permissions issue. Check that `FIREBASE_SERVICE_ACCOUNT_BAKEDBYBOSTIK_5EB55` is still valid in GitHub Secrets.
    *   **Cloud Billing API Error:** If migrating to 2nd Gen Firebase Functions, ensure the [Cloud Billing API](https://console.developers.google.com/apis/api/cloudbilling.googleapis.com) is enabled for the Firebase Project in the Google Cloud Console.
    *   **Eventarc Permission Denied:** 2nd Gen functions require Eventarc. If you see a permission denied error for the Eventarc Service Agent, you must run this command in Google Cloud Shell:
        ```bash
        gcloud projects add-iam-policy-binding bakedbybostik-5eb55 \
          --member="serviceAccount:service-824666210371@gcp-sa-eventarc.iam.gserviceaccount.com" \
          --role="roles/eventarc.serviceAgent"
        ```
*   **"Deployment Failed with Secret Manager 403 / 404 Errors"**
    *   2nd Gen Functions cannot use `process.env` directly; they require variables to be stored in **Google Cloud Secret Manager**.
    *   If you see a `404` error, the secret hasn't been created yet. Go to Google Cloud Secret Manager and manually create the secret.
    *   If you see a `403` error when deploying via GitHub Actions, the robotic Service Account (`824666210371-compute@developer.gserviceaccount.com`) lacks permission to explicitly *read* the newly created secret.
    *   **The Fix:** You must go into the Google Cloud Secret Manager UI, click on the specific secret, click the "Permissions" tab, and manually assign the `Secret Manager Secret Accessor` role to the aforementioned Default Compute Service Account. Run this for every secret the function needs.
*   **"Secret environment variable overlaps non secret environment variable"**
    *   A function still has an old plain setting with the same name as a secret it now declares. A Firebase deploy does not remove plain settings that were added outside it, and deploying once without the secret does not clear them either (tried Oct 22, 2026).
    *   Fix it in Cloud Run, one service at a time, with one command so the function is never without the login (Cloud Shell in the Google Cloud console has `gcloud`):
        ```bash
        gcloud run services update <service name> --region us-central1 --remove-env-vars SMTP_EMAIL,SMTP_PASSWORD --update-secrets SMTP_EMAIL=SMTP_EMAIL:latest,SMTP_PASSWORD=SMTP_PASSWORD:latest
        ```
        Then rerun the failed GitHub deploy (`gh run rerun <run id>`). Done for `dispatchquoteemail` and `scheduledweeklyreport` on Oct 22, 2026.
*   **"Runtime Node.js ... was deprecated / decommissioned"**
    *   Move `engines` in `functions/package.json` and `node-version` in the workflow to a supported version together (section 4), then test the functions in the emulator (section 3, Step 2) before pushing.
*   **`git push` is rejected or asks for a password**
    *   Run `gh auth status`; it should show the `DBostik` account. If it doesn't, Dave signs in again with `gh auth login`. Don't work around it with a token.

---

## 7. Project Notes

Background for anyone changing the code. Written Sep 2026 during Milestone 24 (Costing) and the September security audit.

### Costing module
* **Module map**: `admin/costing.js` (screens and Firestore), `admin/costing-units.js` (unit conversion and cost math, pure functions), `admin/costing.css`, `admin/costing-seed.json` (starter data from Kristen's sheet). `admin/admin.js` only has a one-line hook in `showPage()`. Rules: `firestore.rules` (`isAdmin()` UID list, `isPricebot()`). Plan and phases: the "Baked By Bostik Costing Plan" page in Dave's Claude artifacts; `implementation_plan.md` Milestone 7 lists the phases.
* Handoff for the Costing work: `docs/costing-handoff.md`. Tests: `tools/costing-tests/README.md`.
* Costing scripts: `admin/index.html` has one tag, `costing-main.js`, which imports the other costing modules. Never add
  `?v=` to a costing script tag (it made `costing.js` load twice). `firebase.json` sends `Cache-Control: no-cache` for
  `/admin/**`, so browsers recheck admin files on every load and a deploy shows up right away.
* The Playwright browser harnesses (`tools/costing-tests/harness`, `tools/admin-tests/harness`) need Chromium. They did not run
  inside the Claude Cowork VM (no system libraries there).
* Files ending in " 2.jpg" that appear in `assets/` are dataless macOS duplicates (0 blocks) from the iCloud Desktop; never commit them.

### Audit Phase 1 (Sep 8, 2026): rules and hosting lockdown

* **Public writes are shape-checked.** `firestore.rules` now lets anonymous visitors write only the exact
  documents the public site produces: `customers/{email}` with name, email, phone, last_updated (the email
  can never be changed to another address), `requests/{MMDDYYYY-1234}` Step 1 with status `NEW`, the Step 2
  update only while the request is `NEW` or `AWAITING_DETAILS` (a BOOKED or COMPLETED order can no longer be
  knocked back from outside), `pending_reviews`, `seasonal_orders` and `seasonal_waitlist` with their forms'
  fields. Inspiration photos must be download URLs under `requests/` in this project's bucket. If a public
  form gains a field, add it to the matching allowlist in the rules or the form will start failing with
  "Missing or insufficient permissions". Run `tools/rules-tests` (see its README) after any rules change.
* **Rules budget.** Firestore evaluates at most 1000 expressions per request and a size check costs ~25;
  the Step 2 rule uses about half the budget. Keep new checks cheap (see the README in `tools/rules-tests`).
* **Storage.** `requests/{id}/{file}` and `quotes/{file}` allow `get`, not `read`, so nothing can list
  customer photos or every quote PDF. Emailed quote links are tokenized download URLs and keep working.
  Anonymous uploads: jpeg/png/webp/gif/heic/heif/avif under 15 MB, new paths only, under a well-formed id.
* **Hosting.** `firebase.json` now excludes `docs/`, `scripts/`, `tools/`, `.github/`, `.agent/`, all
  `*.md`, `*.rules`, `*.mjs`, `*.py`, the leftover `admin/*_part`-style files, `Claude outputs/` and the
  unused `assets/images/Gallery/` folder (the gallery loads from Storage). The deploy went from ~1,300
  files to ~370. `.firebaseignore` was removed: it was never a Firebase feature. `/admin/**` is served with
  `X-Frame-Options: DENY`; everything gets `X-Content-Type-Options: nosniff` and a referrer policy. A custom
  `404.html`, `robots.txt` and `sitemap.xml` were added.
* **Costing seed files are not published** (`admin/costing-seed*.json` is in the hosting ignore list since the
  K1 follow-up the same day): they hold Kristen's recipes and store prices. The "Load starter data" buttons in
  Costing Settings only work while Costing is empty and the data is already loaded, so nothing changes day to
  day. To bootstrap a fresh database, deploy the files briefly (remove that ignore line, push, load, put it back)
  or load them from a session with admin credentials.
* The Claude desktop app writes deliverables into `Claude outputs/` inside the project folder; it is gitignored and
  hosting-ignored. Never commit it.

### Audit Phase 2 (Sep 8, 2026): output encoding in the dashboard

* `admin/admin.js` escapes everything that came from a document (customer name, Step 1 and Step 2 fields,
  reviews, seasonal orders, orders, document ids) with `esc()` before placing it in HTML, in text or in an
  attribute; `safeUrl()` gates every URL from a document (only this project's Storage links pass); no data
  ever goes inside an inline `onclick` string. Keep it that way when adding screens, and run
  `tools/admin-tests` (see its README) after changes to admin.js.
* Homepage testimonials (`js/app.js`) are built with text nodes.

### iPhone photos (Oct 22, 2026)

* Every photo the admin uploads (gallery, homepage editor, request photos, quote attachments) goes through
  `toUploadablePhoto()` in `admin/photo-convert.js`: HEIC/HEIF becomes a JPEG (long edge 2400 px, no location
  data), anything else is untouched. HEIC is spotted by file name, type or the file's first bytes (iPhone photos
  sometimes arrive renamed to `.jpg`). Safari decodes HEIC itself; other browsers load `heic-to` 1.5.2 from
  jsdelivr, pinned with an integrity hash. If conversion fails the original file is uploaded, as before.
  Use it for any new admin upload.
* Photos uploaded before that: the Gallery page shows a "Fix N old iPhone photos" button while any gallery item
  or homepage picture is still HEIC. It downloads each one, converts it, saves the JPEG under a new name
  (`gallery/converted/<item id>.jpg`, `site_content/homepage/<kind>_<time>_converted.jpg`) and points the entry
  at it, keeping `original_image_url` / `original_storage_path` (homepage: `original_url`). The HEIC files stay
  in Storage. Downloading needs the Storage bucket's CORS setting, which allows GET from bakedbybostik.com and
  the two Firebase addresses only (set Oct 22, 2026; see it with
  `gcloud storage buckets describe gs://bakedbybostik-5eb55.firebasestorage.app --format="json(cors_config)"`).
  On click it also reads the first bytes of every other photo, so renamed iPhone photos are caught too.
* Gallery uploads are stored as `gallery/<time>_<name>`. Older uploads used the plain file name, so re-uploading
  a photo made several entries share one file, and deleting one deleted the photo for all (that is how
  `IMG_3814` and `IMG_3616` lost theirs). The gallery delete now removes the file only if no other entry uses
  it (`storage_path` or `original_storage_path`), and finishes quietly if the file is already gone.
* `seed-reviews.html` was removed from the repo (it seeded placeholder reviews); the dashboard no longer
  auto-seeds placeholder reviews when the list is empty.

### Removed Oct 22, 2026
The old notes for Claude Cowork sessions (git workarounds inside the Cowork VM's mounted Desktop folder, and pushing
with a token file) were removed when the working copy moved to `~/Projects`. They are in this file's history
(commit `7cc5726`) if ever needed.
