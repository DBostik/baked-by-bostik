# Deployment Guide: Baked By Bostik

This guide covers how to push your code to GitHub, deploy it on Vercel, and connect your Hostinger domain.

## Prerequisites
- A **GitHub** account.
- A **Vercel** account.
- Your **Hostinger** login.
- A free **Formspree** account (for your email forms).

---

## Part 1: Git & GitHub Setup
1.  **Initialize Git** (if you haven't already):
    - Open your terminal in VS Code.
    - Run: `git init`
    - Run: `git add .`
    - Run: `git commit -m "Initial launch of Baked By Bostik"`

2.  **Create a Repository**:
    - Go to [GitHub.com](https://github.com/new).
    - Create a new repository named `baked-by-bostik-website`.
    - Make sure it is **Public** (or Private, Vercel works with both).
    - Do **not** initialize with README/gitignore (since you have them locally).

3.  **Push Code**:
    - GitHub will show you commands under "…or push an existing repository from the command line".
    - Copy and run them. They usually look like:
      ```bash
      git remote add origin https://github.com/YOUR_USERNAME/baked-by-bostik-website.git
      git branch -M main
      git push -u origin main
      ```

---

## Part 2: Connect Forms (Formspree)
Since Vercel is a static host, it doesn't process forms automatically like a PHP server. The easiest free solution is **Formspree**.

1.  Go to [Formspree.io](https://formspree.io) and create a free account.
2.  Create a **New Form** and name it "BBB Contact".
3.  Copy the **Endpoint URL** they give you (starts with `https://formspree.io/f/...`).
4.  **Edit your Code**:
    - Open `about.html` and `thank-you.html` (or wherever your forms are).
    - Locate the `<form>` tag.
    - Paste your Formspree URL into the `action` attribute:
      ```html
      <form action="https://formspree.io/f/YOUR_CODE_HERE" method="POST">
      ```
    - **Step 2 Order Form**: For `js/order-flow.js`, you might need to update the `submit` logic to send a `fetch` request to that URL.
      *(I have included a code block below to update your `js/order-flow.js` to work with Formspree)*.

---

## Part 3: Vercel Deployment
1.  Log in to [Vercel](https://vercel.com).
2.  Click **"Add New..."** -> **"Project"**.
3.  Click **"Import"** next to your `baked-by-bostik-website` repo.
4.  Keep all build settings as default (Framework Preset: Other).
5.  Click **"Deploy"**.
6.  Wait ~30 seconds. Your site is now live at something like `baked-by-bostik.vercel.app`.

---

## Part 4: Connect Hostinger Domain
1.  In your Vercel Project Dashboard, go to **Settings** -> **Domains**.
2.  Enter `bakedbybostik.com` and click **Add**.
3.  Vercel will likely show an **Invalid Configuration** error and give you two values:
    - **A Record**: `76.76.21.21`
    - **CNAME**: `cname.vercel-dns.com`

4.  **Go to Hostinger**:
    - Log in -> Manage your Domain -> **DNS / Name Servers**.
    - **Delete** any existing defaults for `@` (A records) and `www` (CNAME).
    - **Add New Record**:
        - Type: **A**
        - Name: `@`
        - Points to: `76.76.21.21` (from Vercel)
        - TTL: Default (e.g., 3600)
    - **Add Another Record**:
        - Type: **CNAME**
        - Name: `www`
        - Points to: `cname.vercel-dns.com`
    - Click **Update/Save**.

5.  **Wait**: DNS changes can take up to 24-48 hours, but usually work within 1 hour. Vercel will automatically issue an SSL certificate (HTTPS) once it connects.

---

## Helper Code: Updating Forms for Vercel
To make your forms work seamlessly, update `js/order-flow.js` to send data to Formspree:

**In `js/order-flow.js`:**
```javascript
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.innerText = "Sending...";
    btn.disabled = true;

    const formData = new FormData(form);
    
    // Send to Formspree
    fetch("https://formspree.io/f/YOUR_FORMSPREE_ID", {
        method: "POST",
        body: formData,
        headers: {
            'Accept': 'application/json'
        }
    }).then(response => {
        if (response.ok) {
            sessionStorage.removeItem('orderStep1');
            window.location.href = 'thank-you.html';
        } else {
            alert("Oops! There was a problem submitting your form.");
            btn.innerText = "Try Again";
            btn.disabled = false;
        }
    });
});
```
