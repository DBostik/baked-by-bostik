# Firebase & Hostinger Setup Guide

## 1. Firebase "Blaze" Plan & Costs
You mentioned you are on the **Blaze (Pay as you go)** plan.
*   **Why is it needed?** To send emails using Hostinger (an external service), Firebase Cloud Functions requires the Blaze plan. The free "Spark" plan blocks all connections outside of Google.
*   **Will it cost money?** For a small volume of emails (quotes/invoices), it is extremely unlikely you will exceed the free tier limits.
    *   **Cloud Functions**: First 2 million invocations per month are free.
    *   **Storage**: First 5GB is free.
    *   **Firestore**: First 50k reads/day are free.
    *   **Real-world cost**: Likely $0.00 or pennies per month unless you have thousands of orders.

## 2. Hostinger Email Setup
**Is Hostinger sufficient?** Yes, absolutely. You only need a basic email account (e.g., `orders@bakedbybostik.com`) that supports SMTP. All paid Hostinger email plans support this.

**Steps to Get Credentials:**
1.  Log in to your Hostinger Control Panel.
2.  Go to **Emails** -> Manage your domain.
3.  Create a new email account (e.g., `admin@` or `quotes@`).
4.  Find **Configuration Settings** (usually "Connect Apps & Devices").
5.  Note down:
    *   **SMTP Host**: Usually `smtp.hostinger.com`
    *   **SMTP Port**: `465` (SSL) or `587` (TLS)
    *   **Username**: Your full email address
    *   **Password**: The password you just set

## 3. Deploying Cloud Functions
Using your terminal in VS Code:

1.  **Login to Firebase**:
    ```bash
    firebase login
    ```
2.  **Initialize Functions (if prompted)**:
    Since I created the files manually, you might need to run `npm install` inside the functions folder first:
    ```bash
    cd functions
    npm install
    cd ..
    ```
3.  **Set Environment Variables** (Securely store your Hostinger details):
    ```bash
    firebase functions:config:set smtp.email="YOUR_EMAIL@DOMAIN.COM" smtp.password="YOUR_PASSWORD"
    ```
4.  **Deploy**:
    ```bash
    firebase deploy --only functions
    ```
