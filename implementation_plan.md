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
