# Milestone 26: Seasonal Page — Teacher Appreciation Cookie Sale

> [!CAUTION]
> **AGENTS: DO NOT DELETE OR OVERWRITE THIS FILE.**
> This is the Architect's detailed spec for the Seasonal Page. Read it fully before building.

> [!IMPORTANT]
> **PRIORITY: 🔴 HIGH — Must be live by April 28, 2026**
> This is the first iteration of a rotating seasonal page (`/seasonal`) that will change 3-4× per year.

---

## Overview

Add a new **Seasonal Page** to the website at `seasonal.html` (clean URL: `/seasonal`). The inaugural campaign is an **End-of-Year Teacher Appreciation Cookie Sale** — a limited-edition gift box of 3 personalized cookies at $20/box, capped at 15 total orders, with a free crayon cookie box for orders of 3+ sets. Payment via Venmo only (upfront required). Pickup in May, Glen Ellyn.

---

## 📸 Available Assets

All images are already in the project:

| File | Content |
|------|---------|
| `assets/images/Season Page/IMG_3877.jpeg` | Gift box — 3 cookies (notebook heart, "Thank You" apple, pencil) in white box with Baked By Bostik sticker |
| `assets/images/Season Page/IMG_3878.jpeg` | Crayon cookie box — "Freshly Baked Crayons" packaging with 4 crayon cookies |
| `assets/images/Season Page/IMG_3881.jpeg` | Close-up — pencil cookie on wood board |
| `assets/images/Season Page/IMG_3882.jpeg` | Close-up — green & blue crayon cookies |
| `assets/images/Season Page/IMG_3883.jpeg` | Close-up — personalized "Thank You / Mrs. Smith" apple cookie |
| `assets/images/Season Page/IMG_3921.jpeg` | Flat-lay — 3 cookies on wood board (notebook heart, apple, pencil) with crayons surrounding |
| `assets/images/Venmo Info.JPEG` | Venmo QR code — Kristen Bostik / @Kristen-Bostik |

---

## 🎯 Sales-Optimized Page Copy

### Hero Section
- **Headline:** "The Sweetest Way to Say Thank You 🍎"
- **Subheadline:** "Personalized end-of-year teacher appreciation cookie gift boxes — handcrafted with love in Glen Ellyn."
- **Urgency Badge:** "⚡ Limited Edition — Only 15 Sets Available"
- **CTA Button:** "Reserve Your Set Now →"

### Product Section
- **Section Title:** "What's Inside Each Gift Box"
- **Body:** "Each beautifully packaged gift box contains **3 hand-decorated sugar cookies** personalized with your teacher's name:"
  - 🍎 **"Thank You" Apple** — personalized with the teacher's name
  - 📓 **Notebook Heart** — because every great teacher writes on your heart
  - ✏️ **Pencil** — the classic symbol of learning
- **Price Callout:** "$20 per gift box"
- **Bonus Callout (prominent):** "🖍️ **Order 3 or more sets and receive a FREE Crayon Cookie Box** — 4 colorful crayon-shaped cookies in a fun "Freshly Baked Crayons" box!"

### Urgency / Scarcity Section
- **Callout Box:** "⏰ **Limited to just 15 orders** — once they're gone, they're gone! Pickup available throughout May in Glen Ellyn. Payment via Venmo is required upfront to confirm your spot."

### How It Works (3 Steps)
1. **Fill out the form below** — Tell us your name, how many sets, and each teacher's name
2. **Pay via Venmo** — Send payment to @Kristen-Bostik (QR code below) to lock in your order
3. **Pick up in May** — Grab your beautifully packaged gift boxes in Glen Ellyn

### Sold Out State
- **Headline:** "🎉 SOLD OUT — Thank You!"
- **Body:** "All 15 sets have been claimed! Join our waitlist to be first in line for our next seasonal drop."
- **Form:** Email + Name waitlist signup

---

## 🏗️ Technical Architecture

### New Files to Create
| File | Purpose |
|------|---------|
| `seasonal.html` | Main seasonal landing page |
| `css/seasonal.css` | Page-specific styles |
| `js/seasonal.js` | Order form logic, price calculator, Firestore submission |

### Files to Modify
| File | Change |
|------|--------|
| `index.html` | Update seasonal banner (Section F) to link to `/seasonal`, update nav + footer |
| `about.html` | Add "Seasonal" nav link to header + footer |
| `gallery.html` | Add "Seasonal" nav link to header + footer |
| `menu.html` | Add "Seasonal" nav link to header + footer |
| `policies.html` | Add "Seasonal" nav link to header + footer |
| `resources.html` | Add "Seasonal" nav link to header + footer |
| `privacy.html` | Add "Seasonal" nav link to header + footer |
| `terms.html` | Add "Seasonal" nav link to header + footer |
| `leave-review.html` | Add "Seasonal" nav link to header + footer |
| `thank-you.html` | Add "Seasonal" nav link to header + footer |
| `css/styles.css` | Add `.seasonal-nav-link` accent pill styles |
| `firestore.rules` | Add `seasonal_orders` and `seasonal_waitlist` collection rules |
| `admin/index.html` | Add seasonal orders sidebar link + container |
| `admin/admin.js` | Add `loadSeasonalOrders()` function |
| `admin/admin.css` | Add seasonal badge/tag styles |

### Firestore Data Model

**Collection: `seasonal_orders`** (separate from main `requests` for clean separation)

```javascript
{
  // Auto-generated document ID
  parent_name: "Jane Smith",
  parent_email: "jane@email.com",
  parent_phone: "(555) 123-4567",
  num_sets: 3,
  teacher_names: ["Mrs. Johnson", "Mr. Davis", "Ms. Lee"],
  pickup_date: "2026-05-15",
  total_price: 60,            // auto-calculated: $20 × num_sets
  free_crayon_box: true,      // auto-calculated: true when num_sets >= 3
  campaign: "teacher-appreciation-2026",
  status: "PENDING_PAYMENT",  // → CONFIRMED (admin toggles after Venmo received)
  created_at: serverTimestamp(),
  updated_at: serverTimestamp()
}
```

**Collection: `seasonal_waitlist`** (for sold-out state)
```javascript
{
  name: "...",
  email: "...",
  campaign: "teacher-appreciation-2026",
  created_at: serverTimestamp()
}
```

### Firestore Rules to Add (inside existing rules file)
```
match /seasonal_orders/{orderId} {
  allow create: if true;
  allow read, write: if request.auth != null;
}

match /seasonal_waitlist/{entryId} {
  allow create: if true;
  allow read, write: if request.auth != null;
}
```

---

## 🎨 Design Spec

### Color Palette (Schoolhouse Accent — supplements existing design system)
| Token | Value | Usage |
|-------|-------|-------|
| `--seasonal-red` | `#D94F4F` | Apple red, urgency badges |
| `--seasonal-green` | `#4CAF50` | Chalkboard accents, success states |
| `--seasonal-yellow` | `#F5C518` | Pencil yellow, highlights |
| `--seasonal-chalk` | `#F8F5F0` | Chalkboard-cream backgrounds |

These should be defined at the top of `css/seasonal.css` as CSS custom properties.

### Nav Link Styling
The "Seasonal" nav item gets special treatment:
- Class: `.seasonal-nav-link`
- Accent background pill: `background: var(--color-accent); border-radius: var(--radius-full); padding: 6px 16px;`
- Subtle pulse animation on load to draw the eye
- Same treatment in mobile nav drawer
- Add to `css/styles.css` since it's used across all pages

### Page Layout (Mobile-First, Top to Bottom)
1. **Sticky Header** — existing pattern, with new "Seasonal 🍎" accent nav link
2. **Hero Section** — split layout (product image left, copy + CTA right). Mobile: stacked vertically
3. **Product Showcase** — 3-column card grid showing each cookie with image + description
4. **Crayon Bonus Banner** — eye-catching callout with IMG_3878 crayon box image
5. **Urgency Bar** — "Only 15 Available" with scarcity-driven styling (dark bg, bold text)
6. **How It Works** — 3-step grid (reuse existing `.steps-grid` pattern)
7. **Order Form** — single-step, inline on page (NOT a modal). Premium glassmorphism card
8. **Payment Section** — Venmo QR + handle + instructions (hidden until form submitted)
9. **Sold Out State** — hidden by default, shown when manually toggled
10. **FAQ Accordion** — reuse existing `.faq-item` pattern
11. **Footer** — existing pattern, with "Seasonal" link added

### Responsive Breakpoints
Follow existing patterns in `css/styles.css`:
- `768px` — tablet breakpoint
- `900px` / `1024px` — desktop breakpoint
- Hero: 2-col grid → 1-col stacked on mobile
- Product cards: 3-col → 1-col on mobile
- Form: full-width on mobile

---

## 📋 Implementation Phases

### Phase 1: Foundation — ENGINEER
**Scope:** All functional code, HTML structure, Firebase, navigation updates

1. Update `firestore.rules` — add `seasonal_orders` and `seasonal_waitlist` rules
2. Create `seasonal.html` — full page structure (see layout spec above). Include:
   - Standard header/footer copied from `about.html` pattern
   - All sections from the layout spec
   - Link to `css/variables.css`, `css/buttons.css`, `css/styles.css`, `css/seasonal.css`
   - Load `js/app.js` (non-module) and `js/seasonal.js` (module)
3. Create `js/seasonal.js` — ES module:
   - Import from `./firebase-init.js`: `db, collection, addDoc, serverTimestamp`
   - Dynamic teacher name fields: when "Number of Sets" dropdown changes, generate that many "Teacher Name" input fields with smooth transitions
   - Auto price display: `$20 × sets = total`. Show celebratory notification "🖍️ Your order includes a FREE Crayon Cookie Box!" when sets ≥ 3
   - Form validation: all fields required, date must be in May 2026
   - On submit: write to `seasonal_orders` collection with data model above. Hide form, show success message + reveal Venmo payment section
   - Waitlist form: on submit, write to `seasonal_waitlist` collection
   - Sold-out toggle: add/remove `.sold-out` class on `<body>` or main wrapper to switch between order form and sold-out state
4. Update nav across ALL pages:
   - Header: add `<li><a href="/seasonal.html" class="nav-link seasonal-nav-link">Seasonal 🍎</a></li>` to `.nav-list`
   - Footer: add `<a href="/seasonal.html">Seasonal</a>` to `.footer-nav`
   - Pages: `index.html`, `about.html`, `gallery.html`, `menu.html`, `policies.html`, `resources.html`, `privacy.html`, `terms.html`, `leave-review.html`, `thank-you.html`
5. Update `index.html` Section F (seasonal banner):
   - Change heading to "🍎 Teacher Appreciation Cookie Sale — Limited Edition!"
   - Change paragraph to "Personalized gift boxes, only 15 available. Order yours before they're gone!"
   - Change button to `<a href="/seasonal.html" class="btn btn-secondary">Shop Now →</a>`
   - Wrap in a comment for easy toggling: `<!-- SEASONAL ACTIVE: comment out this section to deactivate -->`

### Phase 2: Design & Polish — DESIGNER
**Scope:** All CSS, visual polish, animations, responsive design

1. Create `css/seasonal.css` with all page styles (see design spec above)
2. Add `.seasonal-nav-link` styles to `css/styles.css`
3. Polish any HTML in `seasonal.html` if needed for visual hierarchy (add classes, wrapper divs — do NOT change form logic or Firebase code)

### Phase 3: Admin Dashboard — ENGINEER
**Scope:** Admin visibility into seasonal orders

1. In `admin/admin.js`:
   - Add `loadSeasonalOrders()` function that queries `seasonal_orders` ordered by `created_at` desc
   - Render a sidebar badge: "🍎 Seasonal (X)" showing count
   - On click, show seasonal orders in a table: Date, Parent Name, # Sets, Teacher Names, Total, Status
   - Add button to toggle status `PENDING_PAYMENT` → `CONFIRMED`
2. In `admin/index.html`: Add sidebar link and `#page-seasonal` container div
3. In `admin/admin.css`: Add `.seasonal-badge` and `.seasonal-tag` styles

### Phase 4: QA & Deploy
1. Test everything per the verification plan below
2. Deploy: `firebase deploy --only firestore:rules,hosting`

---

## ✅ Verification Plan

### Functional Tests
- [ ] Submit a test seasonal order → verify document appears in Firestore `seasonal_orders`
- [ ] Submit a waitlist entry → verify document in `seasonal_waitlist`
- [ ] Change "Number of Sets" → verify correct number of teacher name fields appear
- [ ] Set 1 set → price shows $20, no crayon box message
- [ ] Set 3 sets → price shows $60, crayon box message appears
- [ ] Submit with missing fields → form blocks submission
- [ ] Pick a date outside May → form blocks or warns

### Visual / Responsive Tests
- [ ] Desktop (1200px+): full split-hero, 3-col product cards, inline form
- [ ] Tablet (768px): layouts adapt, images scale
- [ ] Mobile (375px): everything stacked, form full-width, Venmo QR readable

### Navigation Tests
- [ ] Click "Seasonal" from every page → arrives at `/seasonal`
- [ ] Seasonal nav link has accent pill styling
- [ ] Mobile nav drawer shows seasonal link with accent

### Admin Tests
- [ ] Seasonal orders appear in admin dashboard
- [ ] Can toggle status PENDING_PAYMENT → CONFIRMED
- [ ] Badge count updates

### Deploy
```bash
firebase deploy --only firestore:rules,hosting
```
