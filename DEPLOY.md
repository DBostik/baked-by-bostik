# Deployment & Technology Stack Guide

This document explains how the **Baked By Bostik** website is built, hosted, and deployed. Use this guide to instruct future developers or AI agents.

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

## 2. The "Gold Standard" Workflow

Follow this process to ensure stability and avoid breaking the live site.

### Step 1: Develop Locally (Safe Zone)
1.  **Pull Latest Code:** `git pull origin main`
2.  **Make Changes:** Edit HTML/CSS/JS files on your local machine.
3.  **Test:** Run a local server to verify changes.
    ```bash
    python3 -m http.server 8080
    # OR
    npx serve
    ```
4.  **Verify:** Open `http://localhost:8080` in your browser.

### Step 2: Push to GitHub (The Trigger)
Once you are happy with your changes locally:

1.  **Stage & Commit:**
    ```bash
    git add .
    git commit -m "Description of what you fixed or added"
    ```
2.  **Push to Main:**
    ```bash
    git push origin main
    ```

### Step 3: Automatic Deployment (Hands-Off)
You are done! 
*   **GitHub Actions** will detect the push.
*   It will automatically log in to Firebase and run `firebase deploy`.
*   Your changes will be live on `bakedbybostik.com` within 2-3 minutes.

---

## 3. Manual Deployment (Fallback Only)

If GitHub Actions is failing or you need to deploy a specific backend function immediately without waiting:

**Deploy Everything (Site + Functions + Rules):**
```bash
npx firebase deploy --project bakedbybostik-5eb55
```

**Deploy Only Website (Hosting):**
```bash
npx firebase deploy --only hosting --project bakedbybostik-5eb55
```

**Deploy Only Functions:**
```bash
npx firebase deploy --only functions --project bakedbybostik-5eb55
```

---

## 4. Troubleshooting

*   **"My changes aren't showing up!"**
    *   Did you push to `main`? (Pushing to other branches does not trigger a deploy).
    *   Check the [GitHub Actions tab](https://github.com/DBostik/baked-by-bostik/actions) to see if the build failed.
*   **"Deployment Failed on GitHub"**
    *   It might be a permissions issue. Check that `FIREBASE_SERVICE_ACCOUNT_BAKEDBYBOSTIK_5EB55` is still valid in GitHub Secrets.
