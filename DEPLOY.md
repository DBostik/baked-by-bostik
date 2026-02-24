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
