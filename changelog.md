# Project Changelog & History

> [!IMPORTANT]
> **GIT SAFETY WARNING**: Before making any changes to this file or the `implementation_plan.md`, ensure the current version has been committed to Git.
> Run: `git add . && git commit -m "Backup before docs update"` to preserve history.

**Project**: Baked By Bostik CRM
**Tech Stack**: Firebase, Vanilla JS
**Status**: Milestone 4.5 Completed (Jan 27, 2026)

---

## 📅 January 2026

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
