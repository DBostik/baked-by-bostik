# Implementation Plan: Baked By Bostik CRM

> [!CAUTION]
> **STOP! DATA LOSS VISIBLE**
> **AGENTS**: You **MUST** run a git commit *before* editing this file.
> If you overwrite this file without committing, previous milestones and notes will be lost forever.
> 
> **RUN THIS NOW**: `git add . && git commit -m "Pre-edit backup"`

## Project Overview
**Goal**: Build a custom, "premium" CRM and Admin Dashboard to manage a bakery business.
**Tech Stack**: Firebase (Auth, Firestore, Storage, Functions), Vanilla JS, Tailwind-like CSS.

> [!NOTE]
> **Completed History**: For a detailed list of completed milestones (1 through 4.5), please refer to [changelog.md](./changelog.md).

---

##  ROADMAP (Future Milestones)



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

### Phase 5: Deployment & Cleanup (COMPLETED)
#### [MODIFY] [implementation_plan.md](file:///Users/davebostik/Desktop/BBB%20Website/implementation_plan.md)
Marks Milestone 11 as complete.

---

## Milestone 12: Future Enhancements (Backlog)

### 1. Thumbnail Generation Cloud Function
**Why**: Optimization for performance. Currently, the gallery loads full-size images (~100KB-500KB each). On slow connections, this effectively slows down the grid loading.
- **Plan**:
  - Create Cloud Function `onGalleryUpload`
  - Use `sharp` to resize images to 400px width
  - Upload to `gallery/thumbs/`
  - Update Firestore `thumb_url`

### 2. Drag-and-Drop Reordering (COMPLETED)
**Why**: Easier management than manually editing `sort_order` numbers.
- [x] Install `sortablejs` library
- [x] Enable drag-and-drop on admin gallery grid
- [x] On drop, calculate new sort orders
- [x] Batch update Firestore documents

### 3. Clean URLs (COMPLETED)
**Why**: `gallery.html` looks cleaner as just `gallery`.
- [x] Update `firebase.json` with `"cleanUrls": true`

---

## Verification Plan (Completed)

### Manual Verification Results
- **Migration**: 316 unique images successfully migrated to Firestore/Storage.
- **Admin UI**: Fully functional (Upload, Edit, Delete, Category Management working).
- **Public Gallery**:
  - Loads 316 images dynamically.
  - Filtering by category works correctly.
  - Pagination works and "Load More" button is centered.
  - Lightbox opens with correct details.
  - URL params (`?theme=cookies`) work.
- **Deployment**: Live on `bakedbybostik.com` via Firebase Hosting.

## User Questions (Resolved)
1. **Service Account Key**: Handled during migration.
2. **Unique "All" folder file**: Handled during migration.
3. **Migration timing**: Completed successfully.
