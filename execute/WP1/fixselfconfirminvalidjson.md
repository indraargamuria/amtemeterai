Fix a bug in DeliveryReceivePage.tsx related to PATCH response handling.

Read the current file carefully before making changes.

---

## 🐛 ROOT ISSUE

In handleSubmit:

```ts
const updatedData: DeliveryDetail = await res.json()
setDelivery(updatedData)
```

This causes:
"fetch JSON failed"

Reason:
PATCH /api/deliveries/{token} does NOT return JSON body (likely empty or 204).

---

## 🎯 OBJECTIVE

Fix by:

1. Removing `.json()` call on PATCH response
2. Updating delivery state locally
3. Keeping UI behavior exactly the same

---

## 🔧 REQUIRED CHANGES

### 1. REMOVE JSON PARSING

Replace:

```ts
const updatedData: DeliveryDetail = await res.json()
setDelivery(updatedData)
```

With:

```ts
// Do NOT parse response body
```

---

### 2. UPDATE LOCAL STATE MANUALLY

After PATCH success:

```ts
setDelivery((prev) => {
  if (!prev) return prev

  return {
    ...prev,
    received: true,
    receiverName: receiverName || null,
    receiverNotes: receiverNotes || null,
    lines: prev.lines.map((line) => {
      const lineState = lines.find(
        (l) => l.deliveryLineNumber === line.deliveryLineNumber
      )

      return {
        ...line,
        packQuantityDelivered: parseFloat(lineState?.delivered || "0"),
        packQuantityReturned: parseFloat(lineState?.returned || "0"),
        packQuantityRejected: parseFloat(lineState?.rejected || "0"),
      }
    }),
  }
})
```

---

### 3. KEEP THIS

```ts
setSubmitted(true)
```

---

### 4. DO NOT ADD RE-FETCH

Do NOT call GET /api/deliveries/{token} again after PATCH.

---

## 🧠 WHY THIS FIX

PATCH endpoint does not return JSON, so calling `.json()` throws error.

Updating local state:

* avoids unnecessary API call
* prevents parsing error
* keeps UI responsive

---

## ✅ OUTPUT

Provide:

1. Updated handleSubmit function
2. Highlight removed `.json()` line
3. Show new state update clearly
