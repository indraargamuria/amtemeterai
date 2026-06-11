# 🐛 Fix EF Core Projection Error (GetPublicUrl)

## 🧠 Context

This is an ASP.NET Core 8 API using Entity Framework Core.

We recently added `PublicUrl` generation using:

```csharp
GetPublicUrl(d.ReceiverToken)
```

But this causes runtime error:

System.InvalidOperationException:
"The client projection contains a reference to a constant expression of DeliveriesController through the instance method 'GetPublicUrl'"

---

## 🎯 Objective

Fix this error by:

1. Removing method calls inside EF `.Select()` projections
2. Moving PublicUrl generation AFTER database query
3. Keeping existing response structure unchanged

---

## ❗ ROOT CAUSE

EF Core cannot translate instance methods like:

```csharp
GetPublicUrl(d.ReceiverToken)
```

inside `.Select()`.

---

## 🔧 REQUIRED CHANGES

### 1. FIND PROBLEMATIC CODE

Look for patterns like:

```csharp
.Select(d => new DeliveryHeaderDto
{
    DeliveryId = d.DeliveryId,
    DeliveryNumber = d.DeliveryNumber,
    PublicUrl = GetPublicUrl(d.ReceiverToken) // ❌ INVALID
})
```

---

### 2. REMOVE METHOD CALL FROM QUERY

Replace with:

```csharp
.Select(d => new
{
    d.DeliveryId,
    d.DeliveryNumber,
    d.ReceiverToken,
    d.DeliveryDate,
    d.DeliveryRemarks,
    d.CustomerCode,
    d.CustomerName,
    d.Received,
    d.Invoiced
})
```

(Include all fields currently used in DTO)

---

### 3. EXECUTE QUERY FIRST

```csharp
var deliveries = await _context.DeliveryHeaders
    .Select(...)
    .ToListAsync();
```

---

### 4. MAP TO DTO IN MEMORY

After query:

```csharp
var baseUrl = _configuration["App:PublicBaseUrl"];

var result = deliveries.Select(d => new DeliveryHeaderDto
{
    DeliveryId = d.DeliveryId,
    DeliveryNumber = d.DeliveryNumber,
    DeliveryDate = d.DeliveryDate,
    DeliveryRemarks = d.DeliveryRemarks,
    CustomerCode = d.CustomerCode,
    CustomerName = d.CustomerName,
    Received = d.Received,
    Invoiced = d.Invoiced,
    PublicUrl = $"{baseUrl}/receive/{d.ReceiverToken}"
}).ToList();
```

---

### 5. RETURN RESULT

```csharp
return Ok(result);
```

---

### 6. APPLY SAME FIX TO:

* GET /api/deliveries
* GET /api/deliveries/{id}

Anywhere `GetPublicUrl()` is used inside `.Select()`

---

### 7. CLEANUP (OPTIONAL)

Remove method:

```csharp
private string GetPublicUrl(Guid token)
```

if no longer used.

---

## 🧠 RULE TO FOLLOW

Inside EF `.Select()`:

✔ Allowed:

* Entity fields
* Simple assignments

❌ Not allowed:

* Method calls
* Configuration access
* Business logic

---

## ✅ OUTPUT

Provide:

1. Updated query code (before vs after)
2. Updated mapping logic
3. Highlight removed `GetPublicUrl` usage

Keep changes minimal and do NOT rewrite entire controller.
