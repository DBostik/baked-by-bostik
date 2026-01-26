# How to Connect Your Hostinger Domain to Vercel

Here are the simple steps to point `bakedbybostik.com` (managed on Hostinger) to your new Vercel site.

## Step 1: Get the Values from Vercel
1.  Log in to your **Vercel Dashboard**.
2.  Click on your **Baked By Bostik** project.
3.  Go to **Settings** > **Domains**.
4.  Type `bakedbybostik.com` in the box and click **Add**.
5.  Vercel will show you an "Invalid Configuration" error. **This is normal!**
6.  Look for the values it gives you (usually):
    *   **A Record**: `76.76.21.21`
    *   **CNAME Record**: `cname.vercel-dns.com`

## Step 2: Update Hostinger DNS
1.  Log in to your **Hostinger Dashboard**.
2.  Go to **Domains** and select `bakedbybostik.com`.
3.  Find **DNS / Name Servers** on the left sidebar.
4.  You will see a list of records. You need to **Delete** or **Edit** the existing ones that point to your old site:
    *   Look for an **A Record** with name `@` (or blank). **Delete it.**
    *   Look for a **CNAME Record** with name `www`. **Delete it.**

## Step 3: Add New Records in Hostinger
Now add the two new records from Vercel:

**Record 1 (The Root Domain):**
*   **Type**: `A`
*   **Name**: `@`
*   **Target/Points to**: `76.76.21.21`
*   **TTL**: Leave as default (usually 14400 or 3600)

**Record 2 (The "www" Subdomain):**
*   **Type**: `CNAME`
*   **Name**: `www`
*   **Target/Points to**: `cname.vercel-dns.com`
*   **TTL**: Default

## Step 4: Wait
1.  Go back to **Vercel** and click **Refresh** (or just wait).
2.  It creates a secure certificate automatically (SSL). This might take **5-15 minutes**.
3.  Once the icons turn **Green**, your site is live!

> **Note**: DNS changes can technically take up to 24-48 hours to propagate around the world, but it usually happens in less than an hour.
