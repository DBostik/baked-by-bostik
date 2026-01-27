# Prompt for Engineer: Milestone 3.5 - Workflow Enhancements

**Context:**
We are building a "CRM-lite" dashboard for a bakery using Firebase (Firestore, Auth, Functions) and Vanilla JS.
The core CRUD operations and Quote features are built. Now we need to polish the workflow based on user feedback.

**Primary Objective:**
Execute **Milestone 3.5** from `implementation_plan.md`. This focuses on fixing critical bugs and adding manual entry capabilities.

**Scope of Work (in recommended order):**

### 1. High-Priority Fixes
- **Email Attachments**: Modify `functions/index.js` (specifically `dispatchQuoteEmail`) to attach the actual PDF file content to the email, instead of just sending a link.
    - *Note:* You'll need to fetch the file from Storage or pass the buffer if possible (though fetching from Storage URL in the cloud function is cleaner).
- **Kanban Logic**: The "Auto-move to Quoting" logic in `admin/admin.js` currently only works if the card is in 'NEW'. Update it so sending an email moves the card to 'QUOTING' from *any* status (unless already 'BOOKED' or 'COMPLETED').

### 2. New Features (Admin Dashboard)
- **Manual Customer Entry**:
    - Add a "New Customer" button to the Customers view.
    - Open a modal to input Name, Email, Phone.
    - Save to `customers` collection.
- **Manual Request Entry**:
    - Add a "New Request" button (Sidebar or Requests View).
    - Open a modal to select an existing Customer (or create new) + input basic Order Details (Date, Category, Notes).
    - Save to `requests` collection with status 'NEW'.
- **Calendar View**:
    - Implement a new view in the dashboard (toggle between List/Board/Calendar).
    - Display requests on a monthly calendar based on `step1_data.event_date`.
- **Global Search**:
    - Implement a global search bar in the header.
    - Search across `customers` (Name/Email) and `requests` (ID).
- **Customer History**:
    - In the Customer Detail modal, display a list of their past requests/orders.

**Key Files:**
- `implementation_plan.md`: The source of truth.
- `admin/admin.js`: Frontend logic.
- `admin/index.html`: Dashboard HTML structure.
- `functions/index.js`: Backend logic for Email/PDF.

**Instructions:**
1.  Read `implementation_plan.md` carefully.
2.  Start with the **Fixes** (Email + Kanban).
3.  Then proceed to **Manual Entry** features.
4.  Verify each feature works locally or in dev.
