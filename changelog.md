# Project Changelog & History

**Project**: Baked By Bostik CRM
**Tech Stack**: Firebase, Vanilla JS
**Status**: Milestone 4.5 Completed (Jan 27, 2026)

---

## 📅 January 2026

### 🟢 Milestone 4.5: Premium Invoice Design (COMPLETE)
**Goal**: Visual overhaul of the PDF Invoice to match "Premium" Mockup.
- **Visuals**:
    - Implemented Dark Navy Header with Circular Logo (`logo.JPG`).
    - Added Pink Accent Borders & Boxed Totals layout.
    - Added Signature & Date lines.
- **Logic**:
    - Implemented Dynamic Footer Pagination to prevent text cut-off on long invoices.
    - Integrated "Notes" field from Quote Modal to PDF.
- **Deployment**:
    - Cloud Functions updated and deployed.

### 🟢 Milestone 4: Order Conversion & Payments (COMPLETE)
**Goal**: Convert Quotes to Orders and track revenue.
- **Revenue**: Added "Revenue" Card in Dashboard Stats tracking collected cash (sum of payments).
- **Deposits**: 
    - Created "Record Deposit" Modal.
    - Logic converts Quote -> Booked Order (`orders` collection).
    - Updates Request Status to `BOOKED`.
- **Tracking**:
    - Quote PDF Link and "Last Sent" date now visible in Request Detail modal.
    - Pre-fill Deposit amounts from Quote Total.

### 🟢 Milestone 3.5: Workflow Enhancements (COMPLETE)
- **Manual Entry**: Added ability to manually create Requests and Customers via Admin UI.
- **Views**: Added Calendar View and Global Search.
- **History**: Added Customer History to the detail modal.

### 🟢 Milestone 3: Quote System (COMPLETE)
- **Quote Builder**: UI for adding line items and calculating totals (Delivery, Rush, etc.).
- **Backend**: Implemented `createQuotePDF` Cloud Function using `pdfkit`.
- **Email**: Implemented `dispatchQuoteEmail` using Nodemailer + Hostinger SMTP.

### 🟢 Milestone 2: Core Admin Dashboard (COMPLETE)
- **UI**: Built responsive Sidebar, Header, and Stats Cards.
- **Lists**: Implemented Request List View (Sort/Filter).
- **Kanban**: Implemented Drag-and-Drop Board View.

### 🟢 Milestone 1: Foundation (COMPLETE)
- **Setup**: Initialized Firebase (Auth, Firestore, Hosting, Functions).
- **Web**: Built public "Get a Quote" form.
- **Auth**: Secured Admin Dashboard with Firebase Auth.
