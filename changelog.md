# Project Changelog & History

> [!CAUTION]
> **STOP! DATA LOSS VISIBLE**
> **AGENTS**: You **MUST** run a git commit *before* editing this file.
> If you overwrite this file without committing, history will be lost.
> 
> **RUN THIS NOW**: `git add . && git commit -m "Pre-edit backup"`

**Project**: Baked By Bostik CRM
**Tech Stack**: Firebase, Vanilla JS
**Status**: Ready for Architect

---

## 📅 September 2026

### 🟢 Milestone 24: Costing, Phase 1 (Ingredients, Prices, Recipes) - Sep 6, 2026
- **New Costing area in the admin** (sidebar group "Costing"): Costing Home, Ingredients & Supplies, Log Prices, Recipes, Costing Settings. Code lives in its own files (`admin/costing.js`, `admin/costing-units.js`, `admin/costing.css`); `admin.js` only got a one-line hook in `showPage()` and `index.html` got the nav items, page containers and script tag.
- **Ingredients & sources**: each ingredient/supply has a base unit (g, ml, each), conversion factors (grams per cup / each / ml), any number of sources (brand, store, package size, product link) with one preferred, and a dated price history in `ingredients/{id}/prices`. Stale prices are flagged after 60 days by default (per-item override).
- **Log Prices**: shopping-trip entry by store; each typed price becomes a history entry and updates the source.
- **Recipes**: lines entered as written (cups, tsp, sticks, oz, grams) and converted through the ingredient's factors; sub-recipes as components (Confetti Cake = White Cake + sprinkles); yield as batter weight, cups, or count; live batch cost, per-cup / per-cookie / per-100 g costs, and "prices as of" date. Paste-lines parser reads recipe text.
- **Starter data**: `admin/costing-seed.json` built from Kristen's sheet "Recipes + Cost Break Down" (33 ingredients, 14 placeholder supplies, 14 recipes, 29 dated prices). Values the sheet was unsure about carry review flags shown on Costing Home. Loaded once from Costing Settings.
- **Security**: `firestore.rules` now uses a named admin UID list (`isAdmin()`) instead of "any signed-in user", plus a limited `isPricebot()` identity for Phase 4. New collections locked to admins. Previous rules kept at `firestore.rules.backup-2026-09-06`.
- **Next**: Phase 2 (products, cake configurator, pricing settings, saved estimates), Phase 3 (reports and alerts), Phase 4 (monthly price bot, receipts), Phase 5 (add to quote). See the Costing plan page.

## 📅 March 2026

### 🟢 Milestone 23: Finance Ledger & Order Auditing (COMPLETE) - Mar 18, 2026
- **Order Voiding**: Added a "Void Order" button to the Admin Request Detail Modal to easily cancel orders.
- **Finance Ledger**: Created a dedicated "Ledger" tab in the admin dashboard. Displays all orders with cascading "Delete Test Data" functionality that permanently removes `orders` and their associated `payments` subcollections.
- **Analytics Accuracy & Cascading Deletes**:
    - Updated the Analytics logic to filter out revenue from `VOIDED` orders and orders tied to `DEAD`/missing requests.
    - Updated "Delete Request" and "Delete Customer" functions to perform cascading deletes on associated orders and payments to prevent orphaned data.
- **Payment Tracking**: Added a "Record Payment" button and corresponding modal for existing, non-voided orders. Payments are recorded sequentially to `orders/{id}/payments` and dynamically update `amount_paid` and `balance_due` on the parent order.
- **Ledger Retroactivity**: Relaxed "Record Deposit" constraints to appear on *any* request missing an associated order document, allowing admins to manually initialize the ledger for legacy or un-deposited BOOKED requests so they become eligible for "Record Payment".

### 🟢 Milestone 21: The Reviews Pipeline (COMPLETE) - Mar 18, 2026
- **Public Submission**: Created `leave-review.html` for customers to submit reviews to a `pending_reviews` Firestore collection.
- **Admin Moderation**: Added a "Reviews" moderation tab to the admin dashboard for viewing, approving, and rejecting pending reviews. Approving a review moves it to the `reviews` collection.
- **Homepage Display**: Updated `index.html` and `js/app.js` to dynamically fetch and display the latest approved reviews on the homepage instead of using hardcoded HTML.
- **Security**: Updated `firestore.rules` to correctly permit public writes to `pending_reviews` and public reads from `reviews`.

### 🟢 Milestone 20: Homepage Image CMS & Global Background (COMPLETE) - Mar 18, 2026
- **Admin Interface**: 
    - Added a new "Site Content" tab to the Admin dashboard UI.
    - Added "Global Background Image" upload section.
    - Created an interface to manage 4 Hero Carousel images and 8 Theme Cards (image upload + title update).
    - Implemented Firebase Storage uploads and Firestore saving to the `site_content/homepage` document.
- **Public UI**: 
    - Updated `js/firebase-handler.js` to fetch the `site_content/homepage` collection on window load for `index.html`.
    - Dynamically injects the fetched image URLs into the `.hero-img` implementing a continuous cross-fade transition and overwrites the `.theme-card` images and titles dynamically.
    - Dynamically overrides the `body::before` global background image if a custom background is uploaded.

### 🟢 Milestone 22: Menu Cookie FAQ & Extras (COMPLETE) - Mar 18, 2026
- **Little Extras**: Replaced the basic "Cookie Add-Ons" box in `menu.html` with a premium styled `.little-extras-box` matching tier cards, offering Character Add-On and Individual Packaging.
- **FAQ Accordion**: Added semantic `<details>` and `<summary>` for a "What moves a cookie from one tier to a different tier?" FAQ, detailing premium techniques, utilizing the existing global `.faq-item` CSS for a cohesive look.

### 🟢 Milestone 17.4: Cookie Menu Page Overhaul (COMPLETE) - Mar 18, 2026
- **Cookie Summary Card**: Updated `menu.html` pricing card to use a `.price-row` layout with updated tiers ($60/$72/$84+) and added an anchor link to details.
- **The Cookie Menu Section**: Added a new full-width `#cookie-tiers` section featuring storytelling copy and a 3-column `.tiers-grid` detailing "The Simply Sweet", "The Masterpiece", and "The Luxe Elite".
- **Mixed Tiers Note**: Updated policies section to reflect custom line-by-line quoting.

### 🟢 Milestone 19: Admin & Automation Features (COMPLETE) - Mar 18, 2026
- **Dead Leads Pipeline Status**:
    - Added a `DEAD` board column to the Kanban board in `admin/index.html`.
    - Styled with new `.status-DEAD` class using `#F87171` background and `#450A0A` text.
    - Updated `admin.js` to initialize the `DEAD` column and allow drag-and-drop to/from it.
    - Excluded `DEAD` status requests from the Calendar View.
    - Added "Conversion Rate" stat card to the dashboard calculated as `(BOOKED + COMPLETED) / (BOOKED + COMPLETED + DEAD) * 100`.
- **Thank You Card Reminders (Calendar)**:
    - Automatically adds a reminder event to the Calendar 14 days after the `event_date` for any `COMPLETED` order.
    - Rendered in purple (`#8b5cf6`) with the title `💌 Send Card: [Customer Name]`.
    - Clicking the reminder opens the standard Request Modal.

### 🟢 Milestone 18: Quote Modal Improvements (COMPLETE) - Mar 18, 2026
- **Intake Summary Panel**:
    - Added a collapsible panel at the top of the Quote Modal to display customer request details (Category, Event Date, Fulfillment, Theme, Allergies, Notes, Inspiration Photos).
    - Auto-populates from `step1_data` and `step2_data` and defaults to an expanded state for immediate context while building quotes.
    - Allergies are highlighted in red for visibility.
- **Quote Image Attachments**:
    - Added a file upload area below Quote Notes to select multiple images.
    - Selected images are previewed with thumbnails and can be removed before generation.
    - Uploads attached images to Firebase Storage (`quote_attachments/{requestId}/...`) when generating the PDF.
- **Email Cloud Function (`dispatchQuoteEmail`)**:
    - Updated Cloud Function to accept an array of `imageUrls`.
    - Automatically attaches the images to the email via Nodemailer alongside the PDF quote.
    - Adds an inline layout of image thumbnails in the email body for quick viewing.

### 🟢 Order Form: Pickup/Delivery Time Window + Cake Flavor Fields (COMPLETE) - Mar 18, 2026
- **Pickup/Delivery Time Window (Step 1)**:
    - Added `<select>` dropdown (Not sure yet / 9am–11am / 11am–1pm / 1pm–3pm / 3pm–5pm) to the Step 1 modal in `js/app.js`.
    - `pickup_window` saved to Firestore `requests` under `step1_data` via `js/firebase-handler.js`.
    - Hidden input `id="hiddenPickupWindow"` added to `order.html` and populated in `js/order-flow.js` `loadStep1Data()`.
    - Displayed in Admin Request Detail Modal → EVENT SPECS card (only when a specific window is chosen).
- **Cake Flavor & Filling Dropdowns (Step 2)**:
    - Two `<select>` dropdowns added to the Design Details section of `order.html` (Cake Flavor: 7 options + default; Filling: 6 options + default).
    - `cake_flavor` and `filling_flavor` saved to Firestore `requests` under `step2_data` via `js/order-flow.js`.
    - Displayed in Admin Request Detail Modal → DESIGN & INSPO card alongside Theme, Colors, Occasion, Budget, and Complexity.
- **All new fields are optional with "Not sure yet" defaults** — no impact on existing form submission flow.

---

## 📅 February 2026

### 🟢 Milestone 16: Content & UX Expansion (COMPLETE) - Feb 24, 2026
- **Phone Number Integration**:
    - Added required phone input to Step 1 Order form.
    - Persisted phone number to Firestore `customers` and `requests` collections.
    - Flowed phone data to Step 2 Review Box and Admin Dashboard tables/modals.
- **Backend Notifications**:
    - Implemented `onNewOrderRequest` v2 Cloud Function to email the admin via SMTP upon new requests.
    - Configured Google Cloud Secret Manager to securely handle `SMTP_EMAIL` and `SMTP_PASSWORD` for 2nd Gen backend capabilities.
- **Content Pages**:
    - Built and styled `policies.html` with an accordion format linked in the footer.
    - Built and styled `menu.html` outlining pricing and services linked in the main nav.
    - Built and styled `resources.html` providing downloadable PDFs linked in the footer.
    - Updated navigation headers and footers across all site pages to include the new links.
    - Migrated UI styles from ad-hoc inline blocks to dedicated selectors in `styles.css`.

### 🟢 Milestone 11.5: Post-Launch Refinements (COMPLETE) - Feb 15, 2026
- **Order Form**:
    - Added "How did you hear about us?" to Step 2.
    - Implemented conditional "Who should we thank?" input for referrals.
- **Admin Dashboard**:
    - Request Modal now displays "Source" and "Allergies" information.
    - Added bold RED warning for allergies in Event Specs.
- **Content**:
    - Updated FAQ on About page to reflect correct payment methods (Cash/Check).

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

### � Milestone 10: Admin Refinement (COMPLETE) - Feb 16, 2026
- **Order Management**:
    - **Edit Mode**: Admins can now modify all order details, including "Add-ons" (Cookies, Cupcakes, Cake) via checkboxes.
    - **Dropdowns**: Standardized Occasion, Budget, Source, and Complexity inputs to match customer-facing dropdowns.
- **Gallery Management**:
    - **Image Upload**: Added "Add New Inspiration Images" file input to append images to existing requests.
    - **Image Deletion**: Added ability to delete specific inspiration images with a **confirmation dialog** to prevent accidents.
    - **Security**: Implemented **Storage Cleanup** to permanently delete image files from Firebase Storage when they are removed from a request or when a request is deleted.

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
