
# PHASE 2 + 2.5 SPECIFICATION: CRM-lite, Dashboard & Invoicing

**Primary Goal**: Make the existing 2-step website order request form save into a database and appear in a private dashboard.
**Phase 2.5 Goal (Required Immediately)**: Create Quote and Invoice flow that auto-generates a branded PDF from a template and emails it from inside the dashboard.

## NON-NEGOTIABLE UX REQUIREMENTS
- **No Mailgun Login**: Admin (Kristen) does not log into Mailgun. All sending happens from a dashboard button.
- **UI Preservation**: Public site keeps its current look and form UI. Connect it, do not replace it.
- **Low Friction**: Order requests remain low-friction (Step 1 short, Step 2 optional).
- **Speed**: Invoice generation reduced to ~2 minutes.

## SYSTEM OVERVIEW

### Public Site
- Step 1 modal form
- Step 2 order details page
- Gallery with 300+ images and tags
- "Request Like This" button on each gallery image

### Admin
- Private dashboard with login

### Backend
- Database for requests, customers, orders, quotes, invoice PDFs
- Email sending via API (Mailgun)

### Email Infra
- `hello@bakedbybostik.com` as real mailbox (Hostinger/Forwarder)
- Mailgun used ONLY for application sending (API)
- SPF+DKIM+DMARC configuration required

---

## SECTION A: DATA MODEL

### A1) Customer
- `customer_id` (uuid)
- `name`
- `email` (unique)
- `phone` (optional)
- `notes` (internal)
- `tags` (repeat, corporate, etc.)

### A2) Request
- `request_id` (uuid)
- `status`: NEW | AWAITING_DETAILS | QUOTING | QUOTED | DEPOSIT_PENDING | BOOKED | IN_PRODUCTION | READY | COMPLETED | DECLINED
- **Step 1 Fields**: 
  - `category` (COOKIES, CAKE, CUPCAKES)
  - `event_date`
  - `quantity_type`, `quantity_value`
  - `fulfillment` (PICKUP, DELIVERY), `delivery_zip`
  - `rush_flag` (boolean)
- **Step 2 Fields**: 
  - `occasion`, `occasion_other_text`
  - `theme_keywords`
  - `colors`
  - `complexity` (SIMPLE, STANDARD, DETAILED)
  - `budget_range`
  - `inspiration_image_urls[]`
- **Attribution**: 
  - `ref_gallery_image_id`, `ref_gallery_tags`
  - `utm_source`, `utm_medium`, etc.

### A3) Quote
- `line_items[]` { name, description, qty, unit_price, amount }
- `delivery_fee`, `rush_fee`, `discount`
- `deposit_percent` (default 50), `deposit_amount`, `balance_amount`
- `status`: DRAFT | SENT | ACCEPTED | DECLINED

### A4) Order (Created on Deposit)
- `agreed_total`
- `deposit_received` (boolean)
- `production_status`

---

## SECTION B: WEBSITE FORMS
**B1) Step 1**: 
- Submit -> Find/Create Customer -> Create Request -> Return ID -> Redirect to Step 2.
- **Rush Logic**: If event date < 7 days, show Rush checkbox.

**B2) Step 2**:
- Upload images to storage.
- Update Request by ID.
- Status -> AWAITING_DETAILS.

**B3) Notifications**:
- Notify `hello@` on Step 1.
- Optional customer confirmation.

---

## SECTION C: GALLERY INTEGRATION
- **"Request Like This"**: Opens Step 1 Modal, passes hidden `ref_gallery_image_id` & `ref_gallery_tags`.
- **Pre-fill**: Step 2 pre-fills `theme_keywords` from tags.
- **Admin**: Shows originating image in Request Detail.

---

## SECTION D: ADMIN DASHBOARD
**D1) Login**: Admin only.
**D2) Request Inbox**: Table view (Status, Date, Name, Action).
**D3) Request Detail**:
- Customer Card
- Summary (Specs)
- Design Details (Occasion, Colors, Images)
- Inspiration Gallery (Uploads + Referrals)
- Actions (Create Quote, Convert to Order)
**D4) Kanban**: Drag & Drop status management.
**D5) Customers**: Directory and history.
**D6) Revenue**: Simple monthly totals.

---

## SECTION E: QUOTE & INVOICE (PHASE 2.5)
**E1) Quote Builder**:
- Pre-fill from Request.
- Editable line items, fees, discount.
- Auto-calc totals and deposit.

**E2) PDF Generation**:
- **Professional Branded PDF**.
- Header: Logo, Contact.
- Body: Customer info, Event info, Line Items.
- Block: Totals, Deposit (50%), Balance.
- Footer: "Date reserved upon deposit", Payment Methods (Venmo/Zelle).

**E3) Emailing**:
- "Send Invoice" button.
- Uses template: "Your custom order invoice...".
- Attaches PDF.
- Uses Mailgun API.

**E4) Booking**:
- "Record Deposit" button -> Converts Request to Order.

---

## SECTION F: EMAIL TEMPLATES
1. Customer Confirmation
2. Request Photos (Inspiration)
3. Quote Follow-up
4. Deposit Reminder
5. Pickup/Delivery Coordination
6. Completion/Review Request

## SECTION G: ATTRIBUTION
- Capture UTM parameters on Step 1.
- Dashboard shows Source Channel.
- Support logic for Facebook/Instagram funnel links.

## SECTION H: ACCEPTANCE TESTS
1. **Form to DB**: Step 1 & 2 save correctly.
2. **Gallery**: Request linked to specific gallery image.
3. **Invoice**: PDF generated with correct math, emails successfully.
4. **Pipeline**: Status updates work via Kanban or Detail view.
