# Simple Deployment Guide (Under Construction Mode)

We are deploying the site in **Under Construction** mode. This allows you to get the domain live while we work on the custom CMS/Forms features later.

## Phase 1: Create the GitHub Repository
This is the "home" where your code will live online.

1.  Log into [GitHub.com](https://github.com).
2.  Click the **+** icon in the top right -> **New repository**.
3.  **Repository name**: `baked-by-bostik`
4.  **Public/Private**: Either is fine.
5.  **Important**: Leave "Add a README file" **UNCHECKED**.
6.  Click **Create repository**.
7.  Copy the URL (e.g., `https://github.com/davebostik/baked-by-bostik.git`).
8.  **PASTE THAT URL HERE IN THE CHAT.**

## Phase 2: I Push the Code (My Turn)
Once you give me the **GitHub URL**:
1.  I will handle the terminal commands to upload your site.

## Phase 3: Connect Custom Domain (Optional)
If you want to use `bakedbybostik.com` with this deployment:

1.  Go to the [Firebase Hosting Console](https://console.firebase.google.com/project/bakedbybostik-5eb55/hosting).
2.  Click **Add Custom Domain**.
3.  Enter `bakedbybostik.com`.
4.  Follow the instructions to update your DNS records (A Records) at Hostinger.
    -   This will replace the Vercel connection.
    -   It may take up to 24 hours to propagate.


