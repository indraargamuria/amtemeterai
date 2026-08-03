# Product Requirements - Frontend UI

## Scope
Frontend UI only (no backend, no API integration)

---

# 1. Login Page

## Layout
- Split screen (2 columns)

### Left side:
- Login form
- Company logo (top)
- Title: "Welcome Back"
- Subtitle (optional)

### Form:
- Email input
- Password input
- Login button

### Style:
- Clean
- Centered vertically
- Large whitespace

---

### Right side:
- Full-height image
- Represents company / logistics / delivery
- No text overlay required

---

## Colors:
- Background: white
- Button: blue (#1d2351)
- Accent (focus/error): red (#e61920)

---

# 2. Main Dashboard Layout

## Structure:
- Left Sidebar (fixed)
- Main Content (dynamic)

---

## Sidebar:
Menu items:
- Dashboard
- Customers
- Deliveries

Style:
- Background: blue (#1d2351)
- Text: white
- Active item: red accent or highlighted

---

# 3. Dashboard Page

## Content:
Display 3 key metrics (cards):

1. Ongoing Deliveries
2. Delivered but Pending Invoice
3. Remaining e-Meterai Quota

---

## UI:
- Use cards
- Each card:
  - Title
  - Big number
  - Small description

---

# 4. Customers Page

## Content:
Table with:

- Customer Code
- Customer Name
- Email
- Address

---

## Features:
- Pagination (bottom)
- "Sync Customers" button (top right)

---

## UI:
- Use shadcn Table
- Clean spacing
- Readable rows

---

# 5. Deliveries Page

## Content:
Table with:

- Delivery Code
- Customer Name

---

## UI:
- Same style as Customers page

---

# Notes

- No real data needed (use dummy data)
- No API calls
- Focus on UI consistency
- All pages must follow the color rules