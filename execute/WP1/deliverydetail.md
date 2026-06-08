You are working on an existing full-stack project with:

* Backend: ASP.NET Core 8 (REST API)
* Frontend: React 19 + TypeScript + Vite + Tailwind
* Current Deliveries page already calls: `GET /api/deliveries`

---

## 🎯 OBJECTIVE

Enhance the Deliveries feature with:

1. Show ALL Delivery Header fields in the table (except DeliveryId)
2. Add ability to open Delivery Detail page
3. Create a new Delivery Detail page using existing API

---

## 🧩 BACKEND CONTEXT

From API `/api/deliveries`, current response includes:

* deliveryId
* deliveryNumber
* deliveryDate
* deliveryRemarks
* customerCode
* customerName
* received
* invoiced

There is also:

* `GET /api/deliveries/{deliveryId}` → returns full detail including lines

DO NOT modify backend unless absolutely necessary.

---

## 🎨 FRONTEND TASKS

### 1. UPDATE Deliveries Table

File:
`src/pages/Deliveries/DeliveriesPage.tsx`

### Add missing columns:

* Delivery Number (already exists)
* Customer Code (already exists)
* Customer Name ✅ NEW
* Delivery Date (already exists)
* Delivery Remarks ✅ NEW
* Received ✅ NEW (badge or boolean display)
* Invoiced ✅ NEW (badge or boolean display)

### UI Rules:

* Follow existing Table component
* Keep styling consistent (brand-blue system)
* Use Badge component for:

  * Received → blue
  * Not Received → red (accent)
  * Invoiced → blue
  * Not Invoiced → muted

---

### 2. MAKE ROW CLICKABLE

Each row should be clickable and navigate to:

```
/deliveries/:deliveryId
```

Use `useNavigate()` from React Router.

---

### 3. CREATE DELIVERY DETAIL PAGE

Create new file:

```
src/pages/Deliveries/DeliveryDetailPage.tsx
```

### Route:

Update router:

```
/deliveries/:deliveryId
```

---

### 4. FETCH DELIVERY DETAIL

Call:

```
GET /api/deliveries/{deliveryId}
```

Use:

```
const API_URL = import.meta.env.VITE_API_URL
```

---

### 5. DISPLAY STRUCTURE

#### A. HEADER SECTION (Card)

Show:

* Delivery Number
* Delivery Date
* Customer Code
* Customer Name
* Delivery Remarks
* Received (Badge)
* Invoiced (Badge)

---

#### B. DELIVERY LINES TABLE

Columns:

* Line Number
* Item Code
* Description
* Sales Qty + UOM
* Pack Qty + UOM
* Delivered Qty
* Returned Qty
* Rejected Qty

---

### 6. LOADING + ERROR STATE

* Add loading spinner or simple "Loading..."
* Handle API error gracefully

---

### 7. NAVIGATION UX

Add:

* Back button → `/deliveries`

---

## 🧠 DESIGN DECISION (IMPORTANT)

DO NOT use modal.

Use dedicated page because:

* Data is complex (header + lines)
* Future extensibility (edit, receive, invoicing)
* Better UX and scalability

---

## ✅ OUTPUT EXPECTATION

Provide:

1. Updated `DeliveriesPage.tsx`
2. New `DeliveryDetailPage.tsx`
3. Router update snippet
4. Any small reusable helper if needed

Keep code clean, typed, and consistent with existing structure.
