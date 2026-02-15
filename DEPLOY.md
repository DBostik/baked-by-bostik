# Deployment & Technology Stack Guide

This document explains how the **Baked By Bostik** website is built, hosted, and deployed. Use this guide to instruct future developers or AI agents.

## 1. The Technology Stack

| Component | Service | Role | Key URL |
| :--- | :--- | :--- | :--- |
| **Code Repository** | **GitHub** | **Source of Truth.** All code lives here. | `https://github.com/DBostik/baked-by-bostik` |
| **Frontend (Live)** | **Vercel** | **Production Hosting.** Deploys automatically when code is pushed to the `main` branch. | `https://bakedbybostik.com` |
| **Frontend (Staging)** | **Firebase Hosting** | **Testing/Staging.** Useful for verifying backend features before going live. | `https://bakedbybostik-5eb55.web.app` |
| **Backend** | **Firebase** | **Database, Auth, Storage.** Handles all dynamic data (Gallery Items, Orders, Admin Login). | Firebase Console |

---

## 2. Default Workflow for Agents

**"I need to make a change to the website."**

1.  **Code Locally:**
    -   Switch to a new feature branch (e.g., `git checkout -b feature/new-page`).
    -   Make edits to HTML/CSS/JS files.
    -   Use absolute paths for assets (e.g., `/css/styles.css`, not `css/styles.css`).

2.  **Test Locally:**
    -   Run a local server: `python3 -m http.server 8080` (or `npx serve`).
    -   Verify changes at `http://localhost:8080`.

3.  **Verify on Staging (Optional but Recommended):**
    -   Deploy to Firebase Hosting: `npx firebase deploy --only hosting`.
    -   Check `https://bakedbybostik-5eb55.web.app`.
    -   *Note: This does NOT affect the live `bakedbybostik.com` site.*

4.  **Deploy to Production (Live):**
    -   Commit changes: `git add . && git commit -m "Description of change"`.
    -   Merge to Main: `git checkout main && git merge feature/branch-name`.
    -   **Push to GitHub:** `git push origin main`.
    -   **Result:** Vercel automatically detects the push and updates `bakedbybostik.com` within minutes.

---

## 3. Troubleshooting & FAQs

### Why two hosting providers (Vercel & Firebase)?
*   **Vercel** creates the fastest, most optimized global delivery for your public website (`bakedbybostik.com`). It is very good at "static" sites like yours.
*   **Firebase Hosting** is included with your backend. We use it as a "Staging" environment to test complex features (like the Admin Dashboard or Gallery logic) before breaking the live site.

### "My changes aren't showing up!"
*   **Did you push to `main`?** Pushing to a `feature` branch only updates GitHub, not the live site.
*   **Permissions Error?** If the backend (Gallery/Orders) fails, check `firestore.rules` in the codebase.
*   **404 Not Found?** Ensure you are using **absolute paths** (starting with `/`) for all links, scripts, and images.
