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

### 🟡 Milestone 14: Multi-Item Orders (Step 2 Add-ons) [/]
**Goal**: Allow customers to add secondary items (e.g. cookies with a cake) without cluttering the initial "Quick Quote" form.
**Strategy**: "Primary + Add-on" flow. Step 1 remains single-item. Step 2 offers an "Add to Order" section.
- [ ] **Frontend (order.html)**: Add "Would you like to add anything else?" section below "Design Details".
  - [ ] Checkboxes for standard types: Cookies, Cupcakes, Cake/Other.
  - [ ] Conditional logic: Show Quantity/Size input when checked.
- [ ] **Backend (order-flow.js)**: Capture `add_ons` array from form data and save to `step2_data` in Firestore.
  - Structure: `add_ons: [{ type: 'cookies', qty: '2 dozen' }]`
- [ ] **Admin Dashboard**: Update `admin.js` request modal to display "Primary Item" and list any "Add-ons" clearly below it.

---

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
