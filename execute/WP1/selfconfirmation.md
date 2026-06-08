We are adding a PUBLIC delivery confirmation page using token-based access.

Read current frontend structure first.

Then implement a new feature with the following requirements:

---

## 🎯 FEATURE: Delivery Confirmation Page (Public)

### Route:
Create a new public route:

/receive/:token

This must NOT use DashboardLayout.

---

## 🎨 PAGE REQUIREMENTS

Create new page:

src/pages/Public/DeliveryReceivePage.tsx

### Layout:
- Mobile-first
- Centered container (max-w-xl)
- Clean card UI using existing Card component
- Consistent with brand colors but simpler than dashboard

---

## 🔌 API INTEGRATION

### GET
/api/deliveries/{token}

### PATCH
/api/deliveries/{token}

Use:
const API_URL = import.meta.env.VITE_API_URL

---

## 🧩 UI STRUCTURE

### 1. Delivery Info (Card)
- Delivery Number
- Date
- Customer Name
- Remarks
- Status (Received / Not)

---

### 2. Instruction Text
Short instruction for user

---

### 3. Lines Table
For each line show:
- Item Code
- Description
- Pack Quantity

Editable inputs:
- packQuantityDelivered
- packQuantityReturned
- packQuantityRejected

Use Input component

---

### 4. Receiver Info
- Receiver Name (input)
- Receiver Notes (optional)

---

### 5. Submit Button
- Full width
- Blue primary button

---

## 🧠 BEHAVIOR

### On Load:
Fetch data by token

### On Submit:
Call PATCH API with:
- receiverName
- receiverNotes
- lines

---

## ✅ VALIDATION

Ensure:
delivered + returned + rejected <= pack quantity

---

## 🔒 AFTER SUBMIT

- Show success message
- Disable all inputs

---

## 🧭 ROUTING

Add route in App.tsx:
/receive/:token

---

## ❗ IMPORTANT

- Do NOT use DashboardLayout
- This is a standalone public page
- Must be mobile friendly

---

## OUTPUT

Provide:
1. New page file
2. Route update
3. Any small helper functions if needed