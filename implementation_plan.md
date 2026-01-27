# Implementation Plan: Baked By Bostik CRM

## Project Overview
**Goal**: Build a custom, "premium" CRM and Admin Dashboard to manage a bakery business.
**Tech Stack**: Firebase (Auth, Firestore, Storage, Functions), Vanilla JS, Tailwind-like CSS.

---

## ✅ COMPLETED MILESTONES

### 🟢 Milestone 1: Foundation
- **Setup**: Firebase Project initialized, Hosting configured.
- **Frontend**: Public website with Quote Request Form.
- **Auth**: Admin Login secured.
- **DB**: Firestore schema for `requests` and `customers`.

### 🟢 Milestone 2: Core Admin Dashboard
- **UI**: Sidebar navigation, Responsive Layout.
- **Views**:
    - **List View**: Sortable/Filterable table of requests.
    - **Kanban Board**: Drag-and-drop status management.
- **Features**: "Quick View" modals, status updates.

### 🟢 Milestone 3: Quote System
- **Quote Builder**:
    - Add/Edit line items.
    - Calculate Subtotal, Delivery, Rush Fees, Total.
- **PDF Generation**:
    - Cloud Functions integration (`pdfkit`).
    - Uploads generated PDF to Firebase Storage.
- **Email**:
    - automated email dispatch via Nodemailer (Hostinger SMTP).
    - "View Quote" link for customers.

### 🟢 Milestone 3.5: Workflow Enhancements
- **Manual Entry**:
    - "New Request" button (Manual order creation).
    - "New Customer" button (Direct customer addition).
- **Features**:
    - Calendar View (Monthly overview of events).
    - Global Search (Find requests/customers by name/ID).
    - Customer History (View past orders in Customer Modal).
    - Bulk Delete (Manage customer list).

### 🟢 Milestone 4: Order Conversion & Payments
- **Revenue Tracking**:
    - "Revenue" Card in Dashboard Stats (tracks collected cash).
- **Order Logic**:
    - `orders` collection linked to `requests`.
    - `payments` sub-collection for deposits.
- **Workflow**:
    - "Record Deposit" Modal (converts Quote -> Booked Order).
    - Pre-fill Deposit amounts from Quote Total.
    - Updates Request Status to `BOOKED`.

### 🟢 Milestone 4.5: Premium Invoice Design
- **Visual Overhaul**:
    - Dark Navy Header with Logo (`logo.JPG`).
    - Pink Accent Borders & Boxed Totals.
    - Signature & Date lines.
- **Optimization**:
    - Dynamic Footer Pagination (prevents cut-off text).
    - "Notes" field integrated from UI to PDF.

---

## � FUTURE MILESTONES (The Roadmap)

### 🟡 Milestone 5: Advanced Analytics & Reporting
**Goal**: Deep insights into business performance.
- [ ] **Charts & Graphs**: 
    - Monthly Revenue Bar Chart.
    - Orders by Category (Pie Chart).
- [ ] **Export**: CSV Export for Tax/Accounting purposes.
- [ ] **Automated Reports**: Weekly email summary of upcoming orders & revenue.

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
