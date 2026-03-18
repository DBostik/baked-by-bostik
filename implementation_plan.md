# Implementation Plan: Baked By Bostik CRM

> [!CAUTION]
> **STOP! DATA LOSS VISIBLE**
> **AGENTS**: This file contains the MASTER ROADMAP.
> **DO NOT OVERWRITE THIS FILE.**
> You must **ONLY** append new items or mark existing items as complete [x].
> If you overwrite this file, you will destroy the project history and future roadmap.
>
> **RUN THIS NOW**: `git add . && git commit -m "Pre-edit backup"`

## Project Overview
**Goal**: Build a custom, "premium" CRM and Admin Dashboard to manage a bakery business.
**Tech Stack**: Firebase (Auth, Firestore, Storage, Functions), Vanilla JS, Tailwind-like CSS.

> [!NOTE]
> **Completed History**: For a detailed list of completed milestones (1 through 11), please refer to [changelog.md](./changelog.md).

---

## 🚀 CURRENT SPRINT (Active Work)

### 🟢 Milestone 10: Admin Refinement (COMPLETE)
- [x] **Editable Request Details**: Full edit capability for Event Specs and Design Details.
- [x] **Add-ons**: Edit/Add secondary items (Cookies, Cupcakes).
- [x] **Image Management**: Upload and Delete inspiration images with storage cleanup.

### 🟡 Milestone 12: Admin-Managed Reviews
**Goal**: Allow Kristen to add, edit, and hide "Sweet Words" reviews from the Admin Dashboard without code changes.

**Phase 1: Data & Public Site**
- [ ] Create `reviews` Firestore collection (Fields: `quote`, `cite`, `display_order`, `visible`).
- [ ] Migrate existing 4 hardcoded reviews to Firestore.
- [ ] Update `js/app.js`: `initTestimonials` to fetch active reviews from Firestore.

**Phase 2: Admin Interface**
- [ ] Add "Reviews" tab to Admin Sidebar.
- [ ] Create simple CRUD Interface:
  - [ ] List View (Quote preview, Author, Visibility Toggle).
  - [ ] Add/Edit Modal (simpler than Gallery modal).
  - [ ] Delete button.

### 🟡 Milestone 13: Resources & Guides
**Goal**: Educational content for customers to improve experience and reduce support questions.
- [ ] **Data Structure**: Create `resources` Firestore collection or hardcode content pages.
- [ ] **New Tab**: Add "Resources" main navigation item.
- [ ] **Content Pages**:
  - [ ] Care & Freezing Guidelines (Cookies, Cupcakes, Cakes).
  - [ ] Cake Cutting Guide (Visual diagram/instructions).
  - [ ] Affiliate Links (Tools, Recommended Products).
  - [ ] Policies & Procedures.

### 🟢 Milestone 14: Multi-Item Orders (Step 2 Add-ons) (COMPLETE)
**Goal**: Allow customers to add secondary items (e.g. cookies with a cake).
- [x] **Frontend**: "Add to Order" section with cookies/cupcakes/cake checkboxes.
- [x] **Backend**: Captures `add_ons` array in `order-flow.js`.
- [x] **Admin**: Admin dashboard now supports viewing and editing these add-ons (Milestone 10).
- [ ] **Admin Dashboard**: Update `admin.js` request modal to display "Primary Item" and list any "Add-ons" clearly below it.

---

### 🟢 Milestone 15: Continuous Deployment (Active)
- [x] **Setup GitHub Actions**: Create `.github/workflows/firebase-deploy.yml` to auto-deploy to Firebase on push to `main`.
- [x] **Configure Secrets**: Instruct user on adding `FIREBASE_SERVICE_ACCOUNT` secret to GitHub repository.
- [x] **Verification**: Push a small change to `main` and verify auto-deploy.

### 🟢 Milestone 16: Content & UX Expansion (COMPLETE)
**Goal**: Add phone collection, notifications, and 3 new content pages.

**Phase 1: Quick Wins (Engineer)**
- [x] Add phone field to Step 1 modal + save to Firestore
- [x] Carry phone through to Step 2, display in review box
- [x] Display/edit phone in Admin Request Modal and Customers table
- [x] Create `onNewOrderRequest` Cloud Function for email notifications
- [x] Deploy Cloud Function

**Phase 2: Content Pages (Engineer + Designer)**
- [x] Create `policies.html` with accordion layout
- [x] Add "Policies" to footer nav on all pages
- [x] Create `menu.html` with pricing cards
- [x] Add "Menu" to main nav on all pages
- [x] Create `resources.html` with care guide cards
- [x] Add "Resources" to footer nav on all pages
- [x] Identify 2 PDF care guides in `assets/resources/`
- [x] Update `firebase.json` if needed for new routes


## 🔮 FUTURE ROADMAP (Backlog)

### 🟡 Milestone 13: Resources & Guides
**Goal**: Educational content for customers to improve experience and reduce support questions.
- [ ] **Data Structure**: Create `resources` Firestore collection or hardcode content pages.
- [ ] **New Tab**: Add "Resources" main navigation item.
- [ ] **Content Pages**:
  - [ ] Care & Freezing Guidelines (Cookies, Cupcakes, Cakes).
  - [ ] Cake Cutting Guide (Visual diagram/instructions).
  - [ ] Affiliate Links (Tools, Recommended Products).
  - [ ] Policies & Procedures.

### 🟡 Milestone 6: Customer Portal
**Goal**: Self-service experience for clients.
- [ ] **Magic Link Login**: Secure access without passwords.
- [ ] **Dashboard**: View past orders, current status, and download Quotes/Invoices.
- [ ] **Online Payments**: Integration with Stripe/Square to pay deposits directly from the invoice page.

### 🟡 Milestone 7: Inventory & Costing
**Goal**: Track profitability and supplies.
- [ ] **Ingredient Tracker**: Database of supplies (Flour, Sugar, Eggs).
- [ ] **Recipe Costing**: Calculate exact cost-per-item to automate pricing suggestions.
- [ ] **Stock Alerts**: Low-stock notifications based on upcoming orders.

### 🟡 Milestone 8: Marketing Automation
**Goal**: Retain customers and increase lifetime value.
- [ ] **Automated Follow-ups**: "How was your cake?" email 2 days after event.
- [ ] **Birthday/Anniversary Reminders**: Auto-email clients 11 months after their event to re-book.
- [ ] **Review Collection**: Link to Google Reviews in follow-up emails.

### 🟡 Milestone 9: Process Optimization
- [ ] **Kitchen Display System (KDS)**: "Kitchen View" mode for tablets (large text, checkbox steps).
- [ ] **Label Printing**: One-click generation of box labels (Order #, flavor, allergy info).
- [ ] **Mobile App**: PWA or Native wrapper for easier admin access on the go.

### 🟡 Milestone 10: Admin Refinement
- [ ] **Editable Request Details**: Allow admins to edit event specs (Date, Qty, Fulfillment) and design details directly in the modal.

### Optimization Queue (Milestone 14 - Thumbnail Generation)
**Thumbnail Generation Cloud Function**
- **Plan**: Create `onGalleryUpload` Cloud Function to resize images to 400px using `sharp` and update Firestore `thumb_url`.

---

## ✅ COMPLETED RECENTLY (Moved from Backlog)

### Milestone 11.5: Post-Launch Refinements
- [x] **FAQ Update**: Update "Payment Methods" on About page (Remove Zelle, add Checks/Cash).
- [x] **Order Form Data**: Add "How did you hear about us?" to Step 2.
- [x] **Admin Dashboard**:
    - [x] Show "Allergies" prominently in Request Modal.
    - [x] Show "How did you hear about us" in Customer card.

### Milestone 11: Gallery Enhancements
- [x] **Drag-and-Drop Reordering**: Admin gallery grid sorting via `sortablejs` with Firestore batch updates.
- [x] **Clean URLs**: `gallery.html` -> `/gallery` via `firebase.json` configuration.
- [x] **Migrated**: All hardcoded images to Firestore/Storage.

## User Questions (Resolved)
1. **Service Account Key**: Handled during migration.
2. **Unique "All" folder file**: Handled during migration.
3. **Migration timing**: Completed successfully.

## ✅ COMPLETED (Quick Fixes)
- [x] Fix Deposit Permissions in `firestore.rules`.
- [x] Fix Princess Gallery Filter in Firestore.
- [x] Add Address Field to Customer Profile Modal in Admin.
- [x] Add Venmo handle to Invoice Email template.

---

## 🏗️ Architect Roadmap — March 2026

> [!NOTE]
> The following milestones (17-19) were created by the Architect agent on March 17-18, 2026.
> Each item includes root cause analysis, technical scope, and a ready-to-use **engineer/designer prompt** with recommended LLM model.
> Prompts are fully self-contained for use in brand new chats.

---

### UX Analysis: Order Form Fields & Conversion Impact

Before diving in, here is the strategic recommendation on the proposed order form additions:

#### ✅ Safe to Add (Low Friction)
| Field | Why it's safe |
|---|---|
| **Pickup/Delivery window** (dropdown) | Replacing a free-text field with quick-tap options *reduces* friction. Customers want clarity on timing anyway. |
| **Cake flavor** (dropdown) | Essential product info. A short dropdown (5-6 options) is faster than typing. |
| **Filling flavor** (dropdown) | Same logic. Quick-tap dropdowns with an "Unsure / Surprise Me" default option make it painless. |

#### 🟡 Recommendation
- Add flavor and filling dropdowns to **Step 2** (the details page), not Step 1. Step 1 should remain ultra-fast (name, email, phone, date, type, quantity).
- Add the **pickup window** to Step 1 alongside the date field — it pairs naturally with "when is your event?"
- Always include a **"Not sure yet"** or **"Surprise me!"** default so that indecisive customers don't abandon.
- Mark all new fields as **optional** (not `required`). Kristen can follow up for missing details during the quoting conversation.

#### Bottom Line
These additions are **safe for conversion** because they are dropdowns (not open-ended text fields), they reduce back-and-forth emails, and they are all marked optional. Well within best practices for intake forms.

---

## Milestone 17: Bug Fixes & Critical Issues

**Priority**: 🔴 Urgent — These are blocking real workflows.

### 17.1 — Fix Deposit "Missing Permissions" Error

**Root Cause**: The Firestore security rules (`firestore.rules`) have rules for `customers`, `requests`, `gallery_items`, and `gallery_categories` — but **no rule for the `orders` collection or its `payments` subcollection**.

When `admin.js` calls `addDoc(collection(db, "orders"), orderData)` and then `addDoc(collection(db, "orders", orderRef.id, "payments"), paymentData)`, Firestore blocks the write because there's no matching rule.

**Fix**: Add rules for `orders` and `orders/{orderId}/payments` to `firestore.rules`.

**Files to modify**:
- [firestore.rules](file:///Users/davebostik/Desktop/BBB%20Website/firestore.rules)

**Spec**:
```diff
+    // Orders Collection (Admin Only)
+    match /orders/{orderId} {
+      allow read, write: if request.auth != null;
+      
+      // Payments Subcollection (Admin Only)
+      match /payments/{paymentId} {
+        allow read, write: if request.auth != null;
+      }
+    }
```

**Deploy**: `firebase deploy --only firestore:rules`

---

### 17.2 — Fix "Princess & Fairytale" Gallery Filter

**Root Cause**: On `index.html`, the link is `gallery.html?theme=princess`. The `gallery.js` reads this URL param and tries to match it against `categories.find(cat => cat.slug === themeParam)`. If the slug stored in Firestore's `gallery_categories` collection for this category doesn't exactly match `princess`, the filter silently fails and shows "All" instead.

**Fix**: This is a **data issue**, not a code issue. Need to verify the Firestore `gallery_categories` document for Princess & Fairytale has `slug: "princess"`. If it doesn't, either:
1. Update the Firestore document slug to `princess`, OR
2. Update the `index.html` link to match whatever slug is actually stored.

Additionally, ensure the `gallery_items` documents for princess images have `"princess"` in their `categories` array.

**Files to potentially modify**:
- [index.html](file:///Users/davebostik/Desktop/BBB%20Website/index.html) (line 127)
- Firestore `gallery_categories` collection (via admin dashboard or console)
- Firestore `gallery_items` collection (verify `categories` arrays)

**Action for Engineer**: Check Firestore for the slug value, then align the link or the data.

---

### 17.3 — Add Customer Address Field

**Scope**: Add an `address` field to the customer profile in the admin dashboard. Not collected from customers yet — just an internal admin field for Kristen.

**Files to modify**:
- [admin/index.html](file:///Users/davebostik/Desktop/BBB%20Website/admin/index.html) — Add address field to Customer Modal (around line 619)
- [admin/admin.js](file:///Users/davebostik/Desktop/BBB%20Website/admin/admin.js) — Update `openCustomerModal()` and `saveCustomer()` to read/write `address` field
- Firestore `customers` documents — schema update (soft, no migration needed)

**Spec**:
- Add a `<textarea>` for address after the Phone field in the Customer Modal
- In `openCustomerModal()`: populate `els.editCustAddress.value = cust.address || ''`
- In `saveCustomer()`: include `address` in the update/create object
- Optionally display address in the Customers table (a new column) or just in the modal

---

### 17.4 — Cookie Menu Page Overhaul

**Problem**: The existing Cookie card on `menu.html` has **outdated pricing and tier names** that must be replaced with the business owner's new copy. The new content is substantially richer — it includes a personality-driven intro, a "Building Your Custom Set" philosophy section, and 3 detailed tiers with descriptive copy, "Perfect for" suggestions, and styling details. This won't fit inside the current bullet-point card.

#### What's Changing (Old → New)

| Old Tier Name | Old Price | New Tier Name | New Price |
|---|---|---|---|
| The Simply Sweet | $48/doz ($4/ea) | The Simply Sweet | **$60/doz ($5/ea)** |
| The Celebration | $60/doz ($5/ea) | The Masterpiece | **$72/doz ($6/ea)** |
| The Masterpiece | $72/doz ($6/ea) | The Luxe Elite | **$84+/doz ($7+/ea)** |

The "Character Add-On: $10/each" line should be **preserved** (it's not mentioned in the new copy but is likely still offered).

#### Layout Analysis & Brainstorm

The current menu page structure is:

```
[Page Hero]
[Pricing Cards Grid] — 3-col on desktop, 4 cards: Cookies, Cupcakes, Cakes, Daily Drop
[Cake Design Tiers]  — 3-col `.tier-card` grid + Add-ons box
[Fillings Section]   — centered box
[Important Notes]    — left-bordered callout
[Final CTA]
```

**The challenge**: The new cookie content has 2 parts:
1. **Intro copy** — "I keep things pretty simple..." + "Building Your Custom Set" — this is storytelling, not a pricing table
2. **3 detailed tiers** — each with a name, starting price, "Details", "The Look", and "Perfect for" sub-sections

Here are 3 options for fitting this in:

---

**Option A: Dedicated Cookie Section (⭐ RECOMMENDED)**

Add a new full-width section **after** the Pricing Cards grid, mirroring the existing Cake Design Tiers section pattern. This gives the cookie tiers the storytelling space the copy deserves.

```
[Page Hero]
[Pricing Cards Grid] — Cookies card becomes a SIMPLIFIED summary card
[Cookie Tiers Section] — NEW: intro copy + 3-column tier-card grid (matches Cake Tiers)
[Cake Design Tiers]
[Fillings Section]
[Important Notes]
[Final CTA]
```

**How it works:**
- The **Cookies summary card** in the grid is updated with new pricing ranges but stays compact: just shows "Starting at $60/doz" with a brief line and a "See Cookie Tiers ↓" anchor link
- The **new Cookie Tiers section** uses the existing `.tiers-grid` / `.tier-card` CSS pattern (3-column on desktop, 1-column on mobile) — no new CSS classes needed
- Intro copy ("I keep things pretty simple..." and "Building Your Custom Set") sits above the 3 tier cards as a centered paragraph block, just like the Fillings section uses `.subtitle`
- Each tier card gets the tier name as `<h3>`, the price as a styled subtitle, and the descriptive copy as body text

**Why this is best:**
- ✅ Reuses existing `.tier-card` and `.tiers-grid` CSS — minimal new styles
- ✅ Gives the rich copy enough room to breathe
- ✅ The summary card in the grid still serves as a quick overview for scanners
- ✅ Natural visual flow: quick overview → deep dive → cake tiers → fillings
- ✅ Mobile-friendly: all 3 tier cards stack cleanly in single column

---

**Option B: Expand the Cookie Card In-Place**

Keep everything in the existing Cookies menu-card but make it significantly taller with the full copy inside.

**Why NOT recommended:**
- ❌ The card would be 3-4x taller than the other cards, breaking the visual balance of the grid
- ❌ Walls of text inside a card feel cramped and un-scannable
- ❌ On mobile, it would create an extremely long scroll before users see cupcakes/cakes

---

**Option C: Separate Cookie Page**

Move cookies to a dedicated `cookies.html` page with its own URL.

**Why NOT recommended:**
- ❌ Splits the menu across two pages — bad for UX and SEO
- ❌ Users expect to see all pricing on one menu page
- ❌ Unnecessary navigation friction

---

#### Detailed Spec (Option A — Recommended)

**Files to modify:**
- [menu.html](file:///Users/davebostik/Desktop/BBB%20Website/menu.html) — Update cookie card (lines 62-97) + add new Cookie Tiers section (after line 204)
- [styles.css](file:///Users/davebostik/Desktop/BBB%20Website/css/styles.css) — Minor additions for cookie tier accent styling (optional, can reuse `.tier-card`)

**Step 1: Update the Existing Cookie Summary Card (lines 62-97)**

Replace the current 4-tier bullet list with a simplified overview:

```html
<!-- 1. Custom Sugar Cookies -->
<div class="menu-card fade-in-up">
    <h3><span class="menu-icon">🍪</span> Custom Sugar Cookies</h3>
    <p class="text-muted" style="font-weight: 500; margin-bottom: var(--space-4);">
        Minimum Order: 2 Dozen
    </p>
    <div class="card-features" style="flex-grow: 1;">
        <p>Every set is custom-quoted so we can mix and match tiers 
           to fit your vision and your budget.</p>
        <ul>
            <li class="price-row">
                <span>The Simply Sweet</span>
                <strong>$60/doz</strong>
            </li>
            <li class="price-row">
                <span>The Masterpiece</span>
                <strong>$72/doz</strong>
            </li>
            <li class="price-row">
                <span>The Luxe Elite</span>
                <strong>$84+/doz</strong>
            </li>
        </ul>
        <p class="text-muted text-sm" style="margin-top: var(--space-4);">
            * Character Add-On: $10/each (min 12)
        </p>
    </div>
    <a href="#cookie-tiers" class="btn btn-secondary full-width" 
       style="width: 100%; margin-bottom: var(--space-2);">
        See Cookie Tier Details ↓
    </a>
    <button class="btn btn-primary full-width" style="width: 100%;" 
            onclick="openOrderModal()">Request a Quote</button>
</div>
```

> [!NOTE]
> Uses the `.price-row` class already in use on the Cake card (lines 139-158 in current `menu.html`). No new CSS needed for this part.

**Step 2: Add the New Cookie Tiers Section (after line 204)**

Insert a new `<section>` between the Pricing Cards section and the Cake Design Tiers section:

```html
<!-- Cookie Tiers Detail Section -->
<section id="cookie-tiers" class="design-tiers-section">
    <div class="container">
        <h2 class="section-title text-center">The Cookie Menu</h2>
        <div style="max-width: 750px; margin: 0 auto var(--space-8);">
            <p class="subtitle" style="text-align: center; margin-bottom: var(--space-4);">
                I keep things pretty simple around here: I use the best ingredients, 
                bake every batch from scratch, and obsess over the details so you don't 
                have to. Because custom icing is a true labor of love, I have a two-dozen 
                minimum on all custom orders.
            </p>
            <h3 style="text-align: center; margin-bottom: var(--space-2);">
                Building Your Custom Set
            </h3>
            <p class="text-muted" style="text-align: center;">
                Every celebration is unique, so I don't believe in "one size fits all" pricing. 
                When you receive a quote from me, you'll see a line-by-line breakdown of the 
                cost for each individual cookie style in your set. This allows us to mix and 
                match tiers to fit your vision and your budget perfectly!
            </p>
        </div>

        <div class="tiers-grid">
            <!-- Tier 1: The Simply Sweet -->
            <div class="tier-card">
                <h3>The Simply Sweet</h3>
                <p style="font-size: var(--text-lg); font-weight: 600; 
                   color: var(--color-accent-hover); margin-bottom: var(--space-4);">
                    Starting at $60/doz <span class="text-muted" 
                    style="font-size: var(--text-sm); font-weight: 400;">($5.00/cookie)</span>
                </p>
                <p style="margin-bottom: var(--space-3);">
                    Think of these as your "everyday" celebration cookies. Clean, classic, 
                    and perfect for when you want a high-end treat without all the bells 
                    and whistles.
                </p>
                <ul style="list-style: none; padding: 0;">
                    <li style="margin-bottom: var(--space-2);">
                        <strong>Details:</strong> 1–2 icing colors, simple shapes 
                        (hearts, stars, plaques)
                    </li>
                    <li style="margin-bottom: var(--space-2);">
                        <strong>The Look:</strong> Smooth flood icing with minimal, 
                        clean piping
                    </li>
                    <li>
                        <strong>Perfect for:</strong> School treats, "just because" gifts, 
                        simple celebration accents
                    </li>
                </ul>
            </div>

            <!-- Tier 2: The Masterpiece -->
            <div class="tier-card">
                <h3>The Masterpiece</h3>
                <p style="font-size: var(--text-lg); font-weight: 600; 
                   color: var(--color-accent-hover); margin-bottom: var(--space-4);">
                    Starting at $72/doz <span class="text-muted" 
                    style="font-size: var(--text-sm); font-weight: 400;">($6.00/cookie)</span>
                </p>
                <p style="margin-bottom: var(--space-3);">
                    This is where your theme really starts to come to life! Most of my 
                    clients land here because it allows for that extra "wow" factor that 
                    makes a party feel cohesive and special.
                </p>
                <ul style="list-style: none; padding: 0;">
                    <li style="margin-bottom: var(--space-2);">
                        <strong>Details:</strong> 3–5 icing colors and moderate detailing
                    </li>
                    <li style="margin-bottom: var(--space-2);">
                        <strong>The Look:</strong> Layered icing, textures, and more 
                        specific themed shapes
                    </li>
                    <li>
                        <strong>Ideal for:</strong> Baby showers, themed birthday parties, 
                        bridal brunches
                    </li>
                </ul>
            </div>

            <!-- Tier 3: The Luxe Elite -->
            <div class="tier-card">
                <h3>The Luxe Elite</h3>
                <p style="font-size: var(--text-lg); font-weight: 600; 
                   color: var(--color-accent-hover); margin-bottom: var(--space-4);">
                    Starting at $84+/doz <span class="text-muted" 
                    style="font-size: var(--text-sm); font-weight: 400;">($7.00+/cookie)</span>
                </p>
                <p style="margin-bottom: var(--space-3);">
                    If you are looking for a showstopper, this is it. These aren't just 
                    cookies; they're tiny edible canvases.
                </p>
                <ul style="list-style: none; padding: 0;">
                    <li style="margin-bottom: var(--space-2);">
                        <strong>Details:</strong> 6+ icing colors, hand-painted details, 
                        3D elements
                    </li>
                    <li style="margin-bottom: var(--space-2);">
                        <strong>The Look:</strong> Museum-quality artistry, multi-technique 
                        designs
                    </li>
                    <li>
                        <strong>Perfect for:</strong> Milestone celebrations, luxury events, 
                        unforgettable gifts
                    </li>
                </ul>
            </div>
        </div>

        <!-- Cookie Add-ons (carried from old card) -->
        <div class="addons-box">
            <h3>Cookie Add-Ons:</h3>
            <ul>
                <li>Character Add-On: $10/each (min 12). Add your child's favorite character.</li>
            </ul>
        </div>
    </div>
</section>
```

**Step 3: Update Important Notes (line 269-271)**

The old "Mixed Tiers" note says pricing is averaged. Update to match the new "line-by-line breakdown" philosophy:

```diff
- <li><strong>Mixed Tiers:</strong> If you want a variety of
-     detail in one order (like half simple cookies, half extravagant), we price at the average tier
-     rate.</li>
+ <li><strong>Mixed Tiers:</strong> Love variety? We quote each 
+     cookie style individually so you can mix and match tiers to fit 
+     your budget and vision perfectly.</li>
```

**Designer notes:**
- The `.tier-card` and `.tiers-grid` classes already exist in `styles.css` and handle all responsive behavior — no CSS changes needed
- The cookie tiers section will visually mirror the "Cake Design Tiers" section below it, creating a cohesive "deep dive" pattern
- Optional enhancement: The designer could add a subtle background color difference between the Cookie Tiers and Cake Tiers sections (e.g., make Cookie Tiers use `bg-cream` and Cake Tiers use white, or vice versa) so they feel distinct

---

## Milestone 18: Order Form & Quoting Enhancements

**Priority**: 🟡 Medium — Improves workflow efficiency.

### 18.1 — Add Pickup/Delivery Time Windows

**Where**: Step 1 order modal (in `index.html`, the `openOrderModal()` flow) — add a dropdown next to the date picker.

**Options**: `9am–11am`, `11am–1pm`, `1pm–3pm`, `3pm–5pm`

**Files to modify**:
- [index.html](file:///Users/davebostik/Desktop/BBB%20Website/index.html) — Add to the Step 1 modal form (search for `openOrderModal`)
- [js/app.js](file:///Users/davebostik/Desktop/BBB%20Website/js/app.js) — Capture `pickup_window` and pass it to Step 2 / Firestore
- [order.html](file:///Users/davebostik/Desktop/BBB%20Website/order.html) — Add hidden input to carry the value, display in review box
- [js/order-flow.js](file:///Users/davebostik/Desktop/BBB%20Website/js/order-flow.js) — Save to `step1_data.pickup_window`
- [admin/admin.js](file:///Users/davebostik/Desktop/BBB%20Website/admin/admin.js) — Display in Request Detail modal

### 18.2 — Add Cake Flavor & Filling Dropdowns

**Where**: Step 2 (`order.html`), inside the "Design Details" section.

**Cake Flavors**: Vanilla, Chocolate, Confetti, Red Velvet, Lemon, Marble, Other  
**Fillings**: Buttercream, Chocolate Ganache, Strawberry Jam, Cream Cheese, Lemon Curd, None / Not Sure

**Files to modify**:
- [order.html](file:///Users/davebostik/Desktop/BBB%20Website/order.html) — Add two dropdowns in Design Details section
- [js/order-flow.js](file:///Users/davebostik/Desktop/BBB%20Website/js/order-flow.js) — Capture into `step2_data`
- [admin/admin.js](file:///Users/davebostik/Desktop/BBB%20Website/admin/admin.js) — Display in Request Detail modal

**UX Note**: Both should default to "Not sure yet" and be marked optional.

### 18.3 — View Intake Form While Creating Quote

**Problem**: When creating a quote, Kristen can't see the customer's order details.

**Current behavior**: The Quote Modal opens on top of the Detail Modal, hiding all the intake info.

**Fix options** (recommend Option A):
- **Option A**: Show a collapsible summary panel at the top of the Quote Modal with key info (Category, Date, Theme, Colors, Allergies, Notes, Inspiration Photos).
- **Option B**: Make the Quote Modal a side panel instead of overlay (more complex).

**Files to modify**:
- [admin/index.html](file:///Users/davebostik/Desktop/BBB%20Website/admin/index.html) — Add summary panel HTML in Quote Modal (around line 508)
- [admin/admin.js](file:///Users/davebostik/Desktop/BBB%20Website/admin/admin.js) — Populate the summary when opening the Quote Modal (in `openQuoteModal` or equivalent)

### 18.4 — Attach Multiple Images to Quote

**Problem**: Kristen wants to attach reference images when sending quotes to show clients her design ideas.

**Scope**: Add an image upload area in the Quote Modal. When generating the PDF or sending the email, include these images.

**Files to modify**:
- [admin/index.html](file:///Users/davebostik/Desktop/BBB%20Website/admin/index.html) — Add file upload input to Quote Modal
- [admin/admin.js](file:///Users/davebostik/Desktop/BBB%20Website/admin/admin.js) — Upload images to Storage (`quote_attachments/{requestId}/`), include URLs in email
- [functions/index.js](file:///Users/davebostik/Desktop/BBB%20Website/functions/index.js) — Update `dispatchQuoteEmail` to accept and attach multiple image URLs

**Implementation note**: Images should be uploaded to Firebase Storage when "Generate PDF" is clicked, then their download URLs passed to the Cloud Function.

---

## Milestone 19: Admin & Automation Features

**Priority**: 🟢 Nice-to-have — process improvements and future analytics.

### 19.1 — Add Venmo to Invoice Email Signature

**Files to modify**:
- [functions/index.js](file:///Users/davebostik/Desktop/BBB%20Website/functions/index.js) — Update `dispatchQuoteEmail` HTML template (around line 267-269)

**Spec**: Add `<p>Venmo: @Kristen-Bostik</p>` to the email HTML signature block, after the "Best, Baked By Bostik" line.

### 19.2 — Dead Leads Pipeline Status

**Problem**: No way to track leads that didn't convert. They stay in the pipeline and clutter the board.

**Solution**: Add a `DEAD` status to the Kanban board.

**Files to modify**:
- [admin/index.html](file:///Users/davebostik/Desktop/BBB%20Website/admin/index.html) — Add a new board column for `DEAD` (after COMPLETED column, around line 296)
- [admin/admin.js](file:///Users/davebostik/Desktop/BBB%20Website/admin/admin.js) — Add `DEAD` to board columns initialization, ensure drag-and-drop supports it
- [admin/admin.css](file:///Users/davebostik/Desktop/BBB%20Website/admin/admin.css) — Style `DEAD` column with muted/red theme

**Calendar behavior**: Filter out `DEAD` status requests from the calendar view, or render them in red/strikethrough.

**Analytics**: `DEAD` leads should be queryable in the Analytics tab for conversion analysis.

### 19.3 — Public Review Submission

**Problem**: No place for customers to leave reviews.

**Recommended approach**: Create a simple public review form (new page or section on the thank-you page) that saves to a `pending_reviews` Firestore collection. Kristen approves them in the admin before they appear on the homepage.

> [!IMPORTANT]
> This overlaps with the existing **Milestone 12: Admin-Managed Reviews** above. That milestone covers the admin CRUD for reviews. This item adds the **public submission** side. They should be implemented together.

**Files to create/modify**:
- New page or section on [thank-you.html](file:///Users/davebostik/Desktop/BBB%20Website/thank-you.html)
- Firestore `pending_reviews` collection (or reuse `reviews` with a `status: "pending"` field)
- Admin dashboard: add a "Review Moderation" section in the Reviews tab
- Update `firestore.rules` for public write to `pending_reviews`

### 19.4 — Thank You Email on Pipeline Completion

**Problem**: Kristen wants an automated thank-you email/reminder when an order moves to COMPLETED.

**Solution**: Create a Cloud Function `onRequestStatusChange` that triggers on document update. When `status` changes to `COMPLETED`, send a thank-you email to the customer.

**Files to modify**:
- [functions/index.js](file:///Users/davebostik/Desktop/BBB%20Website/functions/index.js) — Add `onDocumentUpdated` trigger for `requests/{requestId}`
- [functions/package.json](file:///Users/davebostik/Desktop/BBB%20Website/functions/package.json) — May need `onDocumentUpdated` import

**Spec**:
```js
exports.onRequestStatusComplete = onDocumentUpdated({
    document: "requests/{requestId}",
    secrets: ["SMTP_EMAIL", "SMTP_PASSWORD"]
}, async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (before.status !== 'COMPLETED' && after.status === 'COMPLETED') {
        // Look up customer email from customers collection
        // Send thank-you email
    }
});
```

---

## Implementation Order (Recommended)

| Priority | Item | Agent | Estimated Effort |
|---|---|---|---|
| 1 | 17.1 Deposit Permission Fix | Engineer | 15 min |
| 2 | 17.2 Gallery Filter Fix | Engineer | 15 min |
| 3 | 17.3 Customer Address Field | Engineer | 30 min |
| 4 | 17.4 Cookie Menu Page Overhaul | Engineer + Designer | 1 hr |
| 5 | 19.1 Venmo in Email | Engineer | 10 min |
| 6 | 18.1 Pickup Time Windows | Engineer | 45 min |
| 7 | 18.2 Flavor/Filling Dropdowns | Engineer | 30 min |
| 8 | 18.3 Intake Form in Quote View | Engineer + Designer | 45 min |
| 9 | 18.4 Multi-Image Quote | Engineer | 1 hr |
| 10 | 19.2 Dead Leads Status | Engineer + Designer | 45 min |
| 11 | 19.3 Public Reviews | Engineer + Designer | 2-3 hrs |
| 12 | 19.4 Thank You Email | Engineer | 30 min |

---

## Ready-to-Use Prompts

### Model Selection Guide

| Prompt | Recommended Model | Why |
|---|---|---|
| **1 — Bug Fixes** | **Gemini 3.1 Pro High** | Well-specified fixes with exact code diffs provided. Doesn't need deep reasoning — just precise execution across a few files. Pro Low could also work but Pro High gives a safety margin for the Firestore data check. |
| **2 — Order Form** | **Claude Sonnet 4.6 Thinking** | Needs to trace a data pipeline across 5 files (HTML → JS → Firestore → admin display). The thinking model's chain-of-thought helps ensure nothing gets dropped in the handoff between files. |
| **3 — Quote Modal** | **Claude Opus 4.6 Thinking** | The most complex prompt — multi-system integration (HTML modals, JS upload logic, Firebase Storage, Cloud Function modification). Opus's deeper reasoning is worth it here to avoid subtle bugs in the async upload → URL → email attachment chain. |
| **4 — Dead Leads & Automation** | **Claude Sonnet 4.6 Thinking** | Moderate complexity: Kanban board changes + a new Cloud Function with `onDocumentUpdated` trigger. Sonnet Thinking handles this well — it's multi-file but each piece is well-defined. |
| **5 — Cookie Menu** | **Gemini 3.1 Pro High** | Primarily HTML content placement with exact markup provided in the spec. No complex logic — just putting the right HTML in the right place and updating copy. Fast and efficient. |

---

### Prompt 1: Bug Fixes (Items 17.1, 17.2, 17.3, 19.1)

> 🤖 **Model: Gemini 3.1 Pro High**

> **For the Engineer agent:**
>
> @engineer This is a **Firebase + Vanilla JS** project (Baked By Bostik — a bakery CRM/website). Key files: `firestore.rules` (security rules), `admin/admin.js` (admin dashboard logic), `admin/index.html` (admin UI with modals), `functions/index.js` (Cloud Functions using Nodemailer + Hostinger SMTP), `index.html` (public homepage), `js/gallery.js` (gallery filtering via Firestore). Full specs for each item are in `implementation_plan.md` under Milestone 17.
>
> **⚠️ IMPORTANT:** Do NOT overwrite or replace `implementation_plan.md` or `changelog.md` — if you update them, only append. Do NOT restructure or refactor existing code beyond what is specified. These are targeted fixes only.
>
> Please implement these 4 quick fixes:
>
> **1. Fix Deposit Permissions (`firestore.rules`)**
> The admin dashboard throws "Missing or insufficient permissions" when recording a deposit. Root cause: `firestore.rules` has no rules for the `orders` collection or its `payments` subcollection. Add rules for `orders/{orderId}` and `payments/{paymentId}` subcollection after the existing `requests` match block. Both need `request.auth != null` for read/write. Deploy with `firebase deploy --only firestore:rules`.
>
> **2. Fix Princess Gallery Filter**
> Clicking "Princess & Fairytale" on the homepage doesn't filter the gallery. The homepage link is `gallery.html?theme=princess`. The `js/gallery.js` matches via `categories.find(cat => cat.slug === themeParam)`. Check the Firestore `gallery_categories` collection — verify the Princess & Fairytale document's `slug` field is exactly `"princess"`. If not, either update the slug in Firestore or update the link in `index.html` (around line 127). Also spot-check that `gallery_items` documents have `"princess"` in their `categories` array.
>
> **3. Add Address Field to Customer Profile**
> In `admin/index.html`, the Customer Modal is at `id="customer-modal"` (around line 586). After the Phone field (`id="edit-cust-phone"`, around line 618), add a form group with `<textarea id="edit-cust-address">` for Address. In `admin/admin.js`, update `openCustomerModal()` to populate it with `cust.address || ''` and update the save function to include `address` in the Firestore document data.
>
> **4. Add Venmo to Invoice Email Signature**
> In `functions/index.js`, find the `dispatchQuoteEmail` callable function (around line 230+). In the HTML email template, after the "Best, Baked By Bostik" sign-off, add: `<p style="margin-top:8px; font-size:0.9em; color:#666;">Venmo: @Kristen-Bostik</p>`. Redeploy with `firebase deploy --only functions`.

### Prompt 2: Order Form Enhancements (Items 18.1, 18.2)

> 🤖 **Model: Claude Sonnet 4.6 Thinking**

> **For the Engineer agent:**
>
> @engineer This is a **Firebase + Vanilla JS** project (Baked By Bostik — a bakery CRM/website). The order intake flow: Step 1 is a modal on `index.html` (opened via `openOrderModal()` in `js/app.js`) collecting basic info, then redirects to `order.html` for Step 2 (detailed design info). Step 2 is handled by `js/order-flow.js` which saves to Firestore's `requests` collection. The admin views request details in `admin/admin.js` via a Detail Modal. Full specs are in `implementation_plan.md` under Milestone 18.
>
> **⚠️ IMPORTANT:** Do NOT overwrite or replace `implementation_plan.md` or `changelog.md` — only append if updating. Do NOT restructure the existing order flow — only add new fields alongside existing ones. All new fields must be **optional** (not `required`) with a sensible default so they don't block form submission.
>
> Please add these 2 new fields:
>
> **1. Pickup/Delivery Time Window (Step 1)**
> In `index.html`, inside the order modal form, add a `<select>` dropdown near the date picker with options: "Not sure yet" (default/selected), "9am–11am", "11am–1pm", "1pm–3pm", "3pm–5pm". In `js/app.js`, capture the selected value and pass it to Step 2 via URL params (alongside the existing date, category, etc.). In `order.html`, add a hidden input to receive and carry the value. In `js/order-flow.js`, save it as `step1_data.pickup_window` when writing to Firestore. In `admin/admin.js`, find where the Request Detail modal body is populated and display `pickup_window` under the Event Date/Specs section.
>
> **2. Cake Flavor & Filling Dropdowns (Step 2)**
> In `order.html`, add two `<select>` dropdowns in the "Design Details" section. Cake Flavor options: "Not sure yet" (default), Vanilla, Chocolate, Confetti, Red Velvet, Lemon, Marble, Other. Filling options: "Not sure yet" (default), Buttercream, Chocolate Ganache, Strawberry Jam, Cream Cheese, Lemon Curd, None. In `js/order-flow.js`, capture both into `step2_data.cake_flavor` and `step2_data.filling_flavor` when saving to Firestore. In `admin/admin.js`, display both fields in the Request Detail modal alongside existing design details.

### Prompt 3: Quote Modal Improvements (Items 18.3, 18.4)

> 🤖 **Model: Claude Opus 4.6 Thinking**

> **For the Engineer + Designer agents:**
>
> @engineer @designer This is a **Firebase + Vanilla JS** project (Baked By Bostik — a bakery CRM/website). The admin dashboard is `admin/index.html` + `admin/admin.js`. It uses Firebase Auth, Firestore, and Storage. Cloud Functions are in `functions/index.js` (Nodemailer + Hostinger SMTP for emails). The Quote Modal (`id="quote-modal"`, around line 501 in `admin/index.html`) is where Kristen builds quotes with line items, generates a PDF (via `createQuotePDF` Cloud Function), and sends it via email (`dispatchQuoteEmail` Cloud Function). Currently, opening the Quote Modal hides the underlying Detail Modal, so Kristen can't see customer intake details while building the quote. Full specs are in `implementation_plan.md` under Milestone 18.
>
> **⚠️ IMPORTANT:** Do NOT overwrite or replace `implementation_plan.md` or `changelog.md` — only append if updating. Do NOT restructure the existing modal system — add to it. Ensure all existing quote functionality (PDF generation, email sending) continues to work after changes.
>
> Please improve the Quote Modal experience:
>
> **1. Intake Summary Panel**
> At the top of the Quote Modal (inside `.modal-body`, around line 508), add a collapsible summary panel showing the current request's: Category, Event Date, Pickup Window (if present), Theme/Colors, Allergies (highlight in red if present), Customer Notes, and thumbnail links to inspiration photos. In `admin/admin.js`, populate this panel from the current request data when the Quote Modal opens (the request data should already be available in a variable like `currentQuoteRequest`). **Designer:** Style it with a light background card (`var(--color-bg-cream)` or light blue-gray) visually distinct from the white quote builder below. Add a toggle: "▼ View Request Details" / "▲ Hide Details".
>
> **2. Quote Image Attachments**
> Add a file upload area in the Quote Modal below the Notes/Terms textarea (`id="quote-notes"`, around line 537). Allow selecting multiple images. When "Generate PDF" is clicked (`id="btn-generate-pdf"`), upload selected images to Firebase Storage at `quote_attachments/{requestId}/filename` and store the download URLs. When "Send Email" is clicked (`id="btn-send-email"`), pass image URLs to `dispatchQuoteEmail` in `functions/index.js`. Update `dispatchQuoteEmail` to accept an `imageUrls` array and include them as email attachments (Nodemailer `attachments` array with `path` URLs) or inline `<img>` tags. Redeploy with `firebase deploy --only functions`.

### Prompt 4: Dead Leads & Automation (Items 19.2, 19.4)

> 🤖 **Model: Claude Sonnet 4.6 Thinking**

> **For the Engineer agent:**
>
> @engineer This is a **Firebase + Vanilla JS** project (Baked By Bostik — a bakery CRM/website). The admin dashboard (`admin/admin.js` + `admin/index.html`) has a Kanban board with columns: NEW, AWAITING_DETAILS, QUOTING, BOOKED, COMPLETED. Board columns are initialized in the `els.boardColumns` object near the top of `admin.js` (around lines 52-57, with re-binds around lines 582-588). Board HTML is in `admin/index.html` around lines 224-297 (each column is `<div class="board-column" data-status="STATUS_NAME">`). Cloud Functions are in `functions/index.js` using Firebase v2 functions, Nodemailer, and Hostinger SMTP (credentials via `process.env` secrets). The `requests` Firestore collection stores order requests with a `status` field and a `customer_id` linking to the `customers` collection. Full specs are in `implementation_plan.md` under Milestone 19.
>
> **⚠️ IMPORTANT:** Do NOT overwrite or replace `implementation_plan.md` or `changelog.md` — only append if updating. Do NOT rename or restructure existing status values — only add the new `DEAD` status alongside them. Ensure existing Kanban drag-and-drop, list view filtering, and calendar view all continue to work.
>
> Please implement these 2 features:
>
> **1. Dead Leads Pipeline Status**
> Add a `DEAD` board column to the Kanban board in `admin/index.html` after the COMPLETED column (around line 296). Use a muted red/gray color theme (e.g., `color:#991B1B`). In `admin/admin.js`: add `DEAD: document.getElementById('col-DEAD')` to `boardColumns` initialization (and the re-bind section), ensure card rendering includes DEAD, in the calendar view either filter out DEAD requests or render them in red/strikethrough, add a "Conversion Rate" stat: `(BOOKED count) / (BOOKED + DEAD count) * 100`%, and make sure the list view table displays DEAD requests (perhaps with a muted row style).
>
> **2. Thank You Email on Completion**
> In `functions/index.js`, add a new Cloud Function `onRequestStatusComplete` using `onDocumentUpdated` (from `firebase-functions/v2/firestore`). Watch `requests/{requestId}`. When `status` changes from anything to `COMPLETED`: look up customer email from `customers` collection using the request's `customer_id`, send a thank-you email via the existing Hostinger SMTP transport (reuse the Nodemailer setup from `dispatchQuoteEmail`), include Kristen's Venmo handle (`@Kristen-Bostik`) and a friendly closing. Add `secrets: ["SMTP_EMAIL", "SMTP_PASSWORD"]` to the function config. Redeploy with `firebase deploy --only functions`.

### Prompt 5: Cookie Menu Page Overhaul (Item 17.4)

> 🤖 **Model: Gemini 3.1 Pro High**

> **For the Engineer + Designer agents:**
>
> @engineer @designer This is a **Firebase + Vanilla JS** project (Baked By Bostik — a bakery website). The menu page is `menu.html`. It uses CSS classes from `css/styles.css` including: `.menu-card` (pricing cards), `.menu-grid` (3-column grid), `.tier-card` + `.tiers-grid` (design tier cards — 3-col desktop, 1-col mobile), `.price-row` (price/label rows used on the Cake card), `.addons-box` (add-on lists), `.design-tiers-section` (section wrapper). Page structure: Page Hero → Pricing Cards Grid (4 cards) → Cake Design Tiers → Fillings → Important Notes → Final CTA. Full specs with exact HTML are in `implementation_plan.md` under item 17.4.
>
> **⚠️ IMPORTANT:** Do NOT overwrite or replace `implementation_plan.md` or `changelog.md` — only append if updating. Do NOT modify the Cake, Cupcakes, or Daily Drop cards. Do NOT add new CSS classes if existing ones work — reuse `.tier-card`, `.tiers-grid`, `.price-row`, `.addons-box`, and `.design-tiers-section`.
>
> Please overhaul the Cookie section on `menu.html`:
>
> **1. Update the Cookie Summary Card (lines 62-97 in `menu.html`)**
> Replace the current 4-bullet-point list (outdated pricing: $48/$60/$72) with a clean `.price-row` layout showing 3 updated tiers: The Simply Sweet → $60/doz, The Masterpiece → $72/doz, The Luxe Elite → $84+/doz. Add a brief intro: "Every set is custom-quoted so we can mix and match tiers to fit your vision and your budget." Keep "Character Add-On: $10/each (min 12)" as a `text-muted text-sm` note. Add a "See Cookie Tier Details ↓" anchor link button (`<a href="#cookie-tiers" class="btn btn-secondary full-width">`) above the existing "Request a Quote" button.
>
> **2. Add a New "The Cookie Menu" Section**
> Insert `<section id="cookie-tiers" class="design-tiers-section">` **after** the Pricing Cards grid `</section>` (after line 204) and **before** Cake Design Tiers (line 207). Contents:
>
> **Intro block** (centered, `max-width: 750px; margin: 0 auto`):
> - Paragraph 1: *"I keep things pretty simple around here: I use the best ingredients, bake every batch from scratch, and obsess over the details so you don't have to. Because custom icing is a true labor of love, I have a two-dozen minimum on all custom orders."*
> - Subheading: **Building Your Custom Set**
> - Paragraph 2: *"Every celebration is unique, so I don't believe in 'one size fits all' pricing. When you receive a quote from me, you'll see a line-by-line breakdown of the cost for each individual cookie style in your set. This allows us to mix and match tiers to fit your vision and your budget perfectly!"*
>
> **3-column `.tiers-grid`** with 3 `.tier-card` elements:
>
> Card 1 — **The Simply Sweet:** Starting at $60/doz ($5.00/cookie). *"Think of these as your 'everyday' celebration cookies. Clean, classic, and perfect for when you want a high-end treat without all the bells and whistles."* Details: 1–2 icing colors, simple shapes (hearts, stars, plaques). The Look: Smooth flood icing with minimal, clean piping. Perfect for: School treats, "just because" gifts, simple celebration accents.
>
> Card 2 — **The Masterpiece:** Starting at $72/doz ($6.00/cookie). *"This is where your theme really starts to come to life! Most of my clients land here because it allows for that extra 'wow' factor that makes a party feel cohesive and special."* Details: 3–5 icing colors and moderate detailing. The Look: Layered icing, textures, themed shapes. Ideal for: Baby showers, themed birthday parties, bridal brunches.
>
> Card 3 — **The Luxe Elite:** Starting at $84+/doz ($7.00+/cookie). *"If you are looking for a showstopper, this is it. These aren't just cookies; they're tiny edible canvases."* Details: 6+ icing colors, hand-painted details, 3D elements. The Look: Museum-quality artistry, multi-technique designs. Perfect for: Milestone celebrations, luxury events, unforgettable gifts.
>
> Style prices with `font-size: var(--text-lg); font-weight: 600; color: var(--color-accent-hover)` and per-cookie price as smaller `text-muted` span.
>
> Add a `.addons-box` below grid: "Cookie Add-Ons:" → "Character Add-On: $10/each (min 12). Add your child's favorite character."
>
> **3. Update "Mixed Tiers" Note (Important Notes section, around line 269)**
> Change from *"we price at the average tier rate"* to: *"Love variety? We quote each cookie style individually so you can mix and match tiers to fit your budget and vision perfectly."*
>
> **Designer:** Add `class="bg-cream"` to the Cookie Tiers section to visually distinguish it from the Cake Design Tiers below. Both use `.tier-card` / `.tiers-grid`, so a background difference helps them feel distinct.

---

## Verification Plan

### Automated Testing
- No automated test suite exists in this project. All testing is manual via the browser and Firebase console.

### Manual Verification (per milestone)

**Milestone 17 (Bug Fixes & Menu Updates)**:
1. Log into the admin dashboard → Open a request in QUOTING status → Click "Record Deposit" → Fill in values → Submit → Should succeed without permissions error
2. Go to the homepage → Click "Princess & Fairytale" in Browse by Theme → Should load the gallery filtered to princess items
3. Go to admin → Customers → Edit a customer → Verify address field is present → Save → Refresh → Verify address persists
4. Create a quote and send email → Check email received → Verify Venmo appears in signature
5. Go to `/menu` → Verify the Cookies summary card shows new pricing ($60/$72/$84+) → Click "See Cookie Tier Details ↓" → Should scroll to the new Cookie Tiers section → Verify all 3 tier cards display correctly with the right copy → Check on mobile that tier cards stack in single column

**Milestone 18 (Form Enhancements)**:
1. Open the order form from homepage → Verify pickup time dropdown appears → Complete both steps → Check Firestore to verify `pickup_window` saved
2. On Step 2, verify flavor and filling dropdowns appear with correct options → Submit → Check Firestore
3. Open a request in admin → Click "Create Quote" → Verify intake summary panel is visible at top of Quote Modal
4. In Quote Modal, upload images → Generate PDF → Send Email → Verify images attached

**Milestone 19 (Automation)**:
1. In Kanban board, drag a request to DEAD column → Verify it renders correctly → Check calendar view
2. Move a request status to COMPLETED → Check email inbox for thank-you email (may take 1-2 minutes for Cloud Function trigger)
