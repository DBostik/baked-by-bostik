# Prompt for Engineer: Milestone 5 - Advanced Analytics & Reporting

**Context:**
We are building a "premium" custom CRM for a bakery using Firebase (Firestore, Functions) and Vanilla JS.
Milestone 4 (Orders & Payments) is complete. We now have an `orders` collection with payment data.

**Primary Objective:**
Execute **Milestone 5** from `implementation_plan.md`. This focuses on visualizing business performance (Analytics) and automating reports.

**Scope of Work (in recommended order):**

### 1. Analytics Dashboard (Frontend)
-   **Files**: `admin/index.html`, `admin/admin.js`
-   **Task**: Create a new "Analytics" tab/view.
-   **Tech**: Use **Chart.js** (load via CDN in `index.html`, do not use npm/bundlers for this).
-   **Components**:
    -   **Revenue Chart**: Bar chart showing monthly revenue for the current year. Data source: Aggregate `orders` collection (sum `amount_paid`).
    -   **Product Mix**: Pie chart showing orders by Category (Cake, Cookie, etc). Data source: Aggregate `requests` or `orders`.

### 2. Data Export
-   **Task**: Add an "Export CSV" button in the Analytics view.
-   **Logic**: Generate a CSV file client-side from the `orders` data.
-   **Columns**: Date, Customer Name, Items Summary, Amount Paid.

### 3. Automated Weekly Report (Backend)
-   **Files**: `functions/index.js`
-   **Task**: Create a Scheduled Cloud Function (`scheduledWeeklyReport`).
-   **Trigger**: Weekly (e.g., Every Monday @ 9:00 AM).
-   **Logic**:
    1.  Query `orders` for "Last Week's Revenue".
    2.  Query `requests` for "Upcoming Orders" (next 7 days).
    3.  Send an email summary to the admin email using `nodemailer` (reuse existing email logic).

**Key Resources:**
-   `implementation_plan.md`: Detailed specs.
-   `admin/admin.js`: Existing frontend logic (reference `fetchOrders` and `orders` array).
-   `functions/index.js`: Existing email/PDF logic.

**Instructions:**
1.  Read `implementation_plan.md` carefully.
2.  Implement the Frontend Analytics first (Charts).
3.  Implement the CSV Export.
4.  Implement the Backend Scheduled Function.
5.  Verify the charts render correctly with existing data.
