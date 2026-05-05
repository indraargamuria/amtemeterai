# 📦 Feature: Seed Deliveries (20 Records - All On-Going)

## 🧠 Context

This is an ASP.NET Core 8 API with:

* DeliveryHeader (master)
* DeliveryDetail (lines)
* Customer table already exists
* Existing Delivery creation logic already implemented

We want to add a **DEV-ONLY seeder endpoint** to generate demo data.

---

## 🎯 OBJECTIVE

Create an endpoint:

POST /api/dev/seed-deliveries

This will:

* Insert **20 Delivery Headers**
* Each with **3–5 Delivery Details**
* All deliveries are **NOT delivered yet (on-going)**

---

## ⚠️ IMPORTANT RULES

### DO:

* Use existing Customer data
* Use realistic values
* Keep all deliveries in **Pending / On-going state**
* Reuse existing service logic if available

### DO NOT:

* ❌ Do NOT manually set "status"
* ❌ Do NOT generate delivered quantities
* ❌ Do NOT duplicate business logic if service exists

---

## 🔧 IMPLEMENTATION

---

## 1. CREATE ENDPOINT

In a controller (can be DeliveriesController or DevController):

```csharp
[HttpPost("dev/seed-deliveries")]
public async Task<IActionResult> SeedDeliveries()
```

---

## 2. LOAD CUSTOMERS

```csharp
var customers = await _context.Customers.ToListAsync();

if (!customers.Any())
{
    return BadRequest("No customers found. Please sync customers first.");
}
```

---

## 3. SETUP RANDOM

```csharp
var rnd = new Random();
```

---

## 4. GENERATE 20 DELIVERIES

Loop:

```csharp
for (int i = 1; i <= 20; i++)
```

---

## 5. FOR EACH DELIVERY

### Select random customer:

```csharp
var customer = customers[rnd.Next(customers.Count)];
```

---

### Create DeliveryHeader:

```csharp
var header = new DeliveryHeader
{
    DeliveryNumber = $"DLV-{DateTime.Now:yyyyMMddHHmmss}-{i}",
    CustomerCode = customer.CustomerCode,
    CustomerName = customer.CustomerName,
    DeliveryDate = DateTime.UtcNow,
    DeliveryRemarks = "Seeded demo delivery",
    ReceiverToken = Guid.NewGuid(),
    Received = false,
    Invoiced = false
};
```

---

## 6. CREATE DELIVERY DETAILS

Random 3–5 lines:

```csharp
int lineCount = rnd.Next(3, 6);
```

Loop:

```csharp
for (int j = 1; j <= lineCount; j++)
```

---

### Detail logic:

```csharp
var orderedQty = rnd.Next(5, 25);
```

---

### IMPORTANT: Keep all NOT delivered

```csharp
var detail = new DeliveryDetail
{
    ItemCode = $"ITEM-{rnd.Next(100,999)}",
    ItemName = $"Sample Item {j}",
    QtyOrdered = orderedQty,
    QtyDelivered = 0,
    QtyReturned = 0,
    QtyRejected = 0
};
```

---

## 7. ASSIGN DETAILS

```csharp
header.DeliveryDetails.Add(detail);
```

---

## 8. SAVE TO DATABASE

After loop:

```csharp
_context.DeliveryHeaders.Add(header);
```

After all deliveries:

```csharp
await _context.SaveChangesAsync();
```

---

## 9. RETURN RESPONSE

```csharp
return Ok(new
{
    created = 20,
    status = "All deliveries are on-going (not delivered)"
});
```

---

## 🔒 OPTIONAL (RECOMMENDED)

Restrict endpoint to development only:

```csharp
if (!_env.IsDevelopment())
{
    return BadRequest("Not allowed outside development");
}
```

---

## 🧠 RESULT

After calling this endpoint:

* 20 deliveries created
* Each has 3–5 items
* All quantities NOT delivered
* All deliveries appear as **Pending / On-going**

---

## ✅ OUTPUT EXPECTATION

Provide:

1. Full endpoint implementation
2. Proper entity usage (DeliveryHeader + DeliveryDetail)
3. Clean and minimal code
4. No duplication of business logic if service exists
