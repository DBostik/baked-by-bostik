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
**Status**: Ready for Architect

> [!NOTE]
> **Completed History**: For a detailed list of completed milestones (1 through 11), please refer to [changelog.md](./changelog.md).

---

## 🚀 CURRENT SPRINT (Active Work)

## 🟡 Milestone 23: Finance Ledger & Order Auditing
**Priority**: 🟡 Medium — Critical for accurate business analytics.

**Goal**: Upgrade the CRM's financial tracking to handle cancelled orders (Voiding) and fix analytics inaccuracies caused by orphaned test data (Cascading Deletes and Auditing).

**Phase 1: Order Voiding (Engineer)**
- [x] In `admin.js`, update the Request Detail Modal (where the "Record Deposit" button lives).
- [x] Add a new "Void Order / Refund" button if an `orders` document currently exists for that request.
- [x] Clicking it confirms with the user, then updates the linked `orders/{id}` document to have `status: 'VOIDED'`.

**Phase 2: Finance Ledger Tab (Engineer)**
- [x] In `admin/index.html`, add a "Ledger" tab to the admin sidebar navigation and a new `#page-ledger` wrapper.
- [x] Build a table that lists EVERY document from the `orders` collection, sorted by date in `admin.js`.
- [x] Display columns: Date, Request ID, Total Amount, Amount Paid, and Status (Active vs Voided).
- [x] Add a "Delete Test Data" button to each row. Clicking it permanently deletes the `orders/{id}` document AND any documents inside its `orders/{id}/payments` subcollection.

**Phase 3: Analytics Accuracy & Cascading Deletes (Engineer)**
- [x] Update the Analytics page logic (`initAnalytics`). Filter the revenue calculations to **ignore** any data from `orders` where `status === 'VOIDED'` or where the parent Request no longer exists/is marked `DEAD`.
- [x] Update the existing "Delete Request" and "Delete Customer" functions in `admin.js`. When a Request or Customer is fully deleted from the dashboard, perform a cascading delete down to the `orders` and `orders/{id}/payments` database collections.

**Phase 4: Payment Tracking (Engineer)**
- [x] In `admin/index.html`, add a new `#payment-modal` similar to `#deposit-modal` but specifically for recording subsequent payments on an existing order.
- [x] In `admin.js`, update the Request Detail Modal footer. If an `order` already exists and is not `VOIDED`, display a "Record Payment" button alongside "Void Order".
- [x] Implement `openPaymentModal()` and `initRecordPaymentLogic()` which adds a new document to `orders/{orderId}/payments` and recalculates `amount_paid` and `balance_due` on the parent `order` document.
- [x] Update the Ledger Table logic to reflect the new `amount_paid` dynamically.

## 🟡 Milestone 24: Admin Dashboard Optimization
**Priority**: 🟡 Medium — Quality of life improvements for daily admin workflow.

**Goal**: Improve readability, add visual cues, fix analytics accuracy, and add new analytics charts.

**Phase 1: Ledger, Payment, & Analytics Normalization (Engineer)**
- [x] In `admin.js` `renderLedgerTable()`, replace the raw Firestore document ID in the "Request ID" column with the customer's name + order number suffix (e.g., "Jane Smith · #04222026-1234"). Look up `customers[o.customer_id]?.name`.
- [x] In `admin/index.html`, change the Ledger `<th>` from "Request ID" to "Customer / Order".
- [x] Make each ledger `<tr>` row clickable → calls `openModal(o.request_id)` to open the request detail modal. Prevent click when the Delete button is targeted.
- [x] In `admin/index.html` `#payment-modal`, add `<option value="Venmo">Venmo</option>` to the `#payment-method` select dropdown (after Cash, before Check).
- [x] Add a `normalizeCategory(cat)` helper near `updateCharts()` that maps `cakes`/`Custom Cake` → `Cakes`, `cookies` → `Cookies`, `cupcakes` → `Cupcakes`.
- [x] Use `normalizeCategory()` in the product mix counting loop inside `updateCharts()`.
- [x] Update `js/app.js` Step 1 form option values from lowercase (`cookies`, `cakes`, `cupcakes`) to title case (`Cookies`, `Cakes`, `Cupcakes`).
- [x] Update the admin edit mode category dropdown (~line 1149) to use `Cakes` instead of `Custom Cake`, with a selected check that handles legacy values.

**Phase 2: Allergy Indicators (Engineer)**
- [x] In `admin.js` `renderTable()`, add a `⚠️` icon next to the customer name in the list view for requests where `step2_data.allergies === 'yes'`. Include allergy details in the tooltip.
- [x] In `admin.js` `renderBoard()`, add a `<span class="card-tag tag-allergy">⚠️ ALLERGY</span>` badge to Kanban cards for requests with allergies.
- [x] Add `.allergy-indicator` and `.tag-allergy` CSS styles to `admin.css`.

**Phase 3: Leads by Source Chart (Engineer)**
- [x] In `admin/index.html`, add a new `<canvas id="leadsSourceChart">` chart card inside `#page-analytics .analytics-grid`.
- [x] In `admin.js`, declare `let leadsSourceChartInstance = null;` and add rendering logic at the end of `updateCharts()` that counts `step2_data.hear_about_us` values from all requests and renders a horizontal bar chart.
- [x] Normalize referral entries: strip referral names from "Friend/Family Referral: [Name]" before counting.

## 🔴 Milestone 25: Security & Code Quality Hardening
**Priority**: 🔴 High — Fix before next production deploy.

**Goal**: Tighten Firestore security rules, add XSS sanitization, fix broken links, exclude dev files from deploy.

**Phase 1: Firestore Rules + Deploy Exclusions (Engineer)**
- [ ] Harden `firestore.rules`: Restrict public `update` on `customers` to only allow `name`, `email`, `phone`, `last_updated` fields.
- [ ] Harden `firestore.rules`: Restrict public `update` on `requests` to only allow `status`, `step2_data`, `updated_at` fields, and enforce `status == 'AWAITING_DETAILS'` for public writes.
- [ ] Update `firebase.json` hosting `ignore` to exclude `*.py`, `*.sh`, `*.command`, `*.mjs`, `seed-reviews.html`, `gallery_items.html`, `verify_deploy.txt`.
- [ ] Test: Submit test order through public form (Step 1 + Step 2) to confirm form still works.
- [ ] Test: Attempt unauthorized update via browser console to confirm it's blocked.

**Phase 2: XSS Sanitization + Path Fixes (Engineer)**
- [ ] Add `escapeHtml()` utility function to `admin.js`.
- [ ] Apply `escapeHtml()` to all user-submitted text in `renderTable()`, `renderBoard()`, `renderLedgerTable()`, and `renderModal()`.
- [ ] Fix `about.html` footer: Change `href="privacy.html"` to `href="/privacy.html"`.
- [ ] Fix `gallery.html` footer: Same change.

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

### Prompt 4: Finance Ledger & Voiding
> 🤖 **Model: Claude Sonnet 4.6 Thinking**
>
> **For the Engineer agent:**
>
> @engineer This is a **Firebase + Vanilla JS** project. We need to upgrade the CRM financial tracking.
>
> **⚠️ IMPORTANT:** First, read `implementation_plan.md` under Milestone 23 for the full context. Do NOT overwrite or replace `implementation_plan.md` or `changelog.md` — only append or mark items as `[x]` when completed.
>
> **1. Voiding (`admin.js`)**
> In the Request Detail Modal (near "Record Deposit"), add a "Void Order" button if an `orders/{id}` document exists. Clicking it sets `status: "VOIDED"` on the order document.
>
> **2. Ledger Tab (`admin/index.html` & `admin.js`)**
> Add a "Ledger" tab to the admin sidebar. Build a table listing EVERY document from `orders`, sorted by date.
> Columns: Date, Request ID, Total Amount, Amount Paid, and Status.
> Add a "Delete Test Data" button to each row. Clicking it permanently deletes `orders/{id}` AND its `orders/{id}/payments` subcollection.
>
> **3. Analytics & Cascading Deletes (`admin.js`)**
> Update `initAnalytics()`. Ignore `orders` data where `status === "VOIDED"` or where the parent Request is deleted.
> Update the existing Delete Request and Delete Customer functions to perform a cascading delete on any associated `orders` and `payments` documents.
