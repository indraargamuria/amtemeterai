# 📦 Feature: Public Delivery Link & QR Code (Clean Implementation)

## 🧠 Context

This is an existing full-stack system:

* Backend: ASP.NET Core 8 (REST API)
* Frontend: React + TypeScript + Vite + Tailwind
* Deliveries already have:

  * `ReceiverToken`
  * Public confirmation page at: `/receive/:token`

---

## 🎯 Objective

Enhance the system to support:

1. Public delivery confirmation link (`publicUrl`)
2. QR code (Base64) — ONLY for external system on POST
3. Display link + QR in frontend (QR generated on frontend, NOT backend)

---

## ⚠️ IMPORTANT ARCHITECTURE RULES

### DO:

* Generate QR code ONLY during POST response
* Return QR as Base64 ONLY in POST response
* Store ONLY `ReceiverToken` in database
* Generate QR dynamically in frontend for dashboard

### DO NOT:

* ❌ Do NOT store QR code in database
* ❌ Do NOT return QR code in GET endpoints
* ❌ Do NOT regenerate token on update (token must be stable)

---

## 🔧 BACKEND CHANGES

### 1. Add Config

In `appsettings.json`:

```json
"App": {
  "PublicBaseUrl": "http://localhost:3000"
}
```

---

### 2. Create QR Helper

Use a C# QR library (e.g., QRCoder)

Create helper method:

```csharp
string GenerateQrBase64(string text)
```

Return Base64 PNG string.

---

### 3. Update POST /api/deliveries

After creating delivery:

* Generate:

```csharp
var publicUrl = $"{publicBaseUrl}/receive/{delivery.ReceiverToken}";
var qrCodeBase64 = GenerateQrBase64(publicUrl);
```

---

### 4. Update POST Response DTO

Create or update DTO:

```csharp
public class DeliveryCreateResponseDto
{
    public string DeliveryNumber { get; set; }
    public string PublicUrl { get; set; }
    public string QrCodeBase64 { get; set; }
}
```

Return:

```json
{
  "deliveryNumber": "...",
  "publicUrl": "...",
  "qrCodeBase64": "..."
}
```

---

### 5. Update GET Endpoints

For:

* GET /api/deliveries
* GET /api/deliveries/{id}

Add ONLY:

```csharp
public string PublicUrl { get; set; }
```

Do NOT include QR code.

---

### 6. Token Behavior

Ensure:

* `ReceiverToken` is generated ONLY when creating new delivery
* Do NOT regenerate token on update

---

## 🎨 FRONTEND CHANGES

### 1. Install QR Library

```bash
npm install qrcode
```

---

### 2. Update Delivery Detail Page

File:
`DeliveryDetailPage.tsx`

---

### 3. Add "Receiver Access" Section

Inside page, add a Card:

#### Show:

* Public URL (readonly input or text)
* Copy button
* Open link button

---

### 4. Generate QR in Frontend

```ts
import QRCode from "qrcode"

const qrCode = await QRCode.toDataURL(publicUrl)
```

Store in state.

---

### 5. Display QR Code

* Show image
* Add Download button

---

### 6. Add Actions

#### Copy:

```ts
navigator.clipboard.writeText(publicUrl)
```

#### Open:

```ts
window.open(publicUrl, "_blank")
```

#### Download:

```ts
const link = document.createElement("a")
link.href = qrCode
link.download = `delivery-${deliveryNumber}.png`
link.click()
```

---

## 🧠 UX RULES

* Do NOT show QR in Deliveries table
* Show only in Delivery Detail page
* Keep layout clean and mobile-friendly
* Use existing Card, Button, Input components

---

## ✅ OUTPUT EXPECTATION

Provide:

### Backend:

* Config update
* QR helper
* Updated POST logic
* Updated DTOs
* Ensure token stability

### Frontend:

* Updated DeliveryDetailPage.tsx
* QR generation logic
* UI section for link + QR
* Copy/Open/Download actions

Keep code clean, typed, and consistent with existing project.
