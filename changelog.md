# Project Changelog & History

> [!CAUTION]
> **STOP! DATA LOSS VISIBLE**
> **AGENTS**: You **MUST** run a git commit *before* editing this file.
> If you overwrite this file without committing, history will be lost.
> 
> **RUN THIS NOW**: `git add . && git commit -m "Pre-edit backup"`

**Project**: Baked By Bostik CRM
**Tech Stack**: Firebase, Vanilla JS
**Status**: Milestone 10 Started (Jan 27, 2026)

---

## 📅 February 2026

### 🟢 Milestone 11: Gallery Enhancements (COMPLETE) - Feb 15, 2026
- **Drag-and-Drop Reordering**:
    - Installed `sortablejs` for intuitive artwork management.
    - Implemented Firestore batch updates to persist custom sort order.
    - Added "Reorder Mode" toggle to prevent accidental moves.
- **Clean URLs & SEO**:
    - Configured `firebase.json` for extension-less URLs (`/gallery` instead of `/gallery.html`).
    - Implemented absolute paths across all public pages to ensure stability on sub-paths (`/gallery/`).
    - Fixed 404 errors by properly handling trailing slashes.
- **UI/UX Polish**:
    - Fixed broken layout on Admin Dashboard.
    - Corrected relative path issues for CSS and Images on public pages.
    - Added "Back to Top" functionality (implied by cleaner navigation).


### 🟢 Milestone 5: Analytics & Reporting (COMPLETE) - Jan 28, 2026
- **Analytics Dashboard**:
    - Charts: Monthly Revenue (Bar) and Product Mix (Doughnut).
    - Data: Tracks "Cash Collected" vs "Outstanding Balance".
    - Revenue Table with clickable rows for details.
- **Export**: CSV Export functionality for Orders.
- **Automation**: `scheduledWeeklyReport` Cloud Function sends revenue/schedule summary every Monday.

### 🟡 Milestone 10: Admin Refinement
- **Editable Details**:
    - **Logic**: Refactored `admin/admin.js` `openModal` to support "Edit Mode".
    - **UI**: Added "Edit Details" button to modal footer.
    - **Functions**: Admins can now modify Event Specs (Date, Category, Qty, Fulfillment) and Design Details (Theme, Budget, Notes) directly; changes persist to Firestore.

### 🟢 Milestone 4.5: Premium Invoice Design (COMPLETE)
**Goal**: Visual overhaul of the PDF Invoice to match "Premium" Mockup.
- **Visuals**:
    - **Header**: Implemented Dark Navy (`#1F2937`) header with Circular Logo (`functions/logo.JPG`).
    - **Layout**: Added Pink (`#E5B8B7`) accent borders & Boxed Totals layout.
    - **Footer**: Added Signature & Date lines.
- **Logic**:
    - **File**: `functions/index.js`
    - **Pagination**: Implemented dynamic Y-coordinate check to add new pages if footer content exceeds print area.
    - **Notes**: Integrated `req.body.notes` from Quote Modal directly into PDF body side-by-side with totals.

### 🟢 Milestone 4: Order Conversion & Payments (COMPLETE)
**Goal**: Convert Quotes to Orders and track revenue.
- **Data Model**:
    - created `orders` collection linked to `requests`.
    - created `payments` sub-collection for tracking deposits.
- **Dashboard Logic (`admin/admin.js`)**:
    - **Revenue Card**: Calculates sum of all `amount_paid` across orders (Cash Flow).
    - **Deposit Modal**:
        - "Record Deposit" button triggers `openDepositModal`.
        - Pre-fills amount from `quote_total`.
        - Submitting creates Order doc and updates Request status to `BOOKED`.
- **Quote Tracking**:
    - Persisted `quote_pdf_url` and `quote_last_sent` to Firestore `requests` doc.
    - Displayed in Request Detail Modal for easy access.

### 🟢 Milestone 3.5: Workflow Enhancements (COMPLETE)
- **Manual Entry**:
    - **Requests**: Added "New Request" button (`openManualRequestModal`) to create orders without a web inquiry.
    - **Customers**: Added "New Customer" button (`openCustomerModal`) for direct CRM entry.
- **Views**:
    - **Calendar**: Implemented `renderCalendarView` mapping `event_date`.
    - **Global Search**: Implemented string-matching across Customer Names and Request IDs.
- **History**:
    - Linked Customer ID to show past orders in the Customer Detail Modal.

### 🟢 Milestone 3: Quote System (COMPLETE)
- **Quote Builder**:
    - Frontend: Dynamic line-item addition, automated calculating of Delivery/Rush fees.
- **Backend (`functions/index.js`)**:
    - `createQuotePDF`: Generates PDF using `pdfkit`, uploads to Firebase Storage (`quotes/` bucket).
    - `dispatchQuoteEmail`: Sends email via `nodemailer` using Hostinger SMTP.

### 🟢 Milestone 2: Core Admin Dashboard (COMPLETE)
- **UI Architecture**:
    - File: `admin/index.html` (Single Page App structure).
    - Components: Sidebar, Header, Dynamic "Page" Sections (`#page-requests`, `#page-calendar`).
- **Lists**: Implemented customizable sort/filter logic for Request Table.
- **Kanban**: Drag-and-Drop state management updates Firestore status (`NEW` -> `CONTACTED` -> `QUOTING`).

### 🟢 Milestone 1: Foundation (COMPLETE)
- **Setup**: Initialized Firebase Project (Auth, Firestore, Hosting, Functions).
- **Web**: Public "Get a Quote" form submits to `requests` collection.
- **Auth**: Secured `admin/` route with `onAuthStateChanged` check.
