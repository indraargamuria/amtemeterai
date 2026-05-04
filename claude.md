# Claude Frontend Guidelines (Opex Launchpad)

## Tech Stack
- React (Vite)
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Router

---

# 🎯 Core Design Goal

Build a **modern, premium SaaS interface** that feels:
- Clean
- Structured
- Professional
- Not generic

Focus on:
- Visual hierarchy
- Information density
- Calm but intentional color usage

---

# 🎨 Color System (STRICT BUT EXTENDED)

## Brand Colors
- Primary Blue: #1d2351
- Accent Red: #e61920
- White: #FFFFFF

---

## Usage Rules

### 1. Blue (Primary)
Used for:
- Primary buttons
- Active navigation
- Key UI elements

### 2. Red (Accent ONLY)
Used for:
- Small highlights
- Alerts
- Critical indicators
- Thin accents (borders, badges)

❌ DO NOT:
- Use red for large backgrounds
- Use red for main navigation

---

## 3. Soft Color System (IMPORTANT)

Use opacity-based variants of blue:

- blue/5 → page background sections
- blue/10 → hover / subtle surfaces
- blue/20 → selected state

Use these instead of adding new colors.

---

## 4. Background Strategy

- Main background → white
- Section separation → subtle blue tint (very light)
- Cards → white with soft border

---

# 🧠 Visual Hierarchy Rules (CRITICAL)

Not all elements should look equal.

Use:
- Size (big numbers, small labels)
- Spacing (more space = more importance)
- Weight (bold vs normal)

---

## Page Structure MUST include:

1. Page Header
   - Title (large, bold)
   - Short description (1 line, muted)

2. Content Sections
   - Clearly separated using spacing (NOT borders only)

---

# 📐 Spacing & Density System

## Spacing Rhythm
- Section spacing: large (32px+)
- Component spacing: medium (16–24px)
- Internal spacing: tight (8–12px)

---

## Density Rules
- Avoid overly empty layouts
- Avoid cramped layouts
- Use cards, grouping, and structure

---

# 🧩 Layout Rules

## Dashboard Layout

- Sidebar (fixed)
- Main content (flex)

---

## Sidebar (IMPORTANT)

### Preferred Style (Light Sidebar)

- Background: white
- Text: blue (#1d2351)

### States:
- Hover → blue/5
- Active:
  - background → blue/10
  - left border → solid blue

---

### Alternative (Dark Sidebar — if used)

- Background: blue (#1d2351)
- Text: white
- Active:
  - background → white/10
  - left border → red (thin accent only)

---

# 🧱 Component Design Rules

## Cards

Each card MUST include:
- Title (small)
- Main value (large, bold)
- Supporting text (small)
- Optional icon

❌ Avoid plain number-only cards

---

## Tables

Must include:
- Row hover state
- Proper spacing
- Clean alignment

Optional:
- Badge/status for realism

---

## Buttons

- Primary → blue
- Hover → slightly lighter blue
- Rounded, clean

---

# 🧭 UX Rules

- Every page must explain itself (title + description)
- Avoid empty feeling → add structure, not clutter
- Use grouping instead of random spacing

---

# 📄 Page Requirements

## Login Page

- Split screen layout
- Left:
  - Logo
  - Title
  - Form (email + password)
- Right:
  - Full image

Style:
- Minimal
- Spacious
- Professional

---

## Dashboard Page

Display 3 metric cards:

- Ongoing Deliveries
- Delivered but Pending Invoice
- Remaining e-Meterai

Each card:
- Icon
- Big number
- Small context text

---

## Customers Page

- Header (title + description)
- Action button (Sync Customers)

Table:
- Customer Code
- Name
- Email
- Address

+ Pagination

---

## Deliveries Page

Table:
- Delivery Code
- Customer Name

---

# 🚫 DO NOT

- Do not use random colors
- Do not use red as main UI color
- Do not leave pages visually empty
- Do not make all elements look identical
- Do not generate one large component file

---

# 📦 Output Expectations

- Clean React TSX
- Split components logically
- Use shadcn/ui components
- Use Tailwind properly
- Follow ALL design rules strictly