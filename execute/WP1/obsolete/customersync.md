# 📦 Feature: Customer Sync (Dummy Source → Future ERP Integration)

## 🧠 Context

This is an ASP.NET Core 8 API with:

* Existing Customer table & upsert logic
* Existing GET /api/customers endpoint
* Frontend has a "Sync Customers" button

We want to implement a **Customer Sync feature** that:

* Uses dummy data for now (for demo)
* Can easily switch to ERP API later
* Reuses existing upsert logic
* Does NOT introduce breaking changes later

---

## 🎯 OBJECTIVE

Implement:

### New Endpoint

POST /api/customers/sync

This will:

1. Fetch customers from a data source (Dummy for now)
2. Upsert them into database
3. Return summary (inserted vs updated)

---

## ⚠️ ARCHITECTURE RULES

### DO:

* Use abstraction for data source (interface)
* Use service layer for upsert logic
* Use config to switch between Dummy and ERP
* Keep controller thin

### DO NOT:

* ❌ Do NOT call your own API via HTTP
* ❌ Do NOT create dummy GET endpoints
* ❌ Do NOT mix dummy logic inside controller

---

## 🔧 IMPLEMENTATION

---

## 1. CREATE INTERFACE

```csharp
public interface ICustomerSource
{
    Task<List<CustomerDto>> GetCustomersAsync();
}
```

---

## 2. CREATE DUMMY IMPLEMENTATION

```csharp
public class DummyCustomerSource : ICustomerSource
{
    public Task<List<CustomerDto>> GetCustomersAsync()
    {
        return Task.FromResult(new List<CustomerDto>
        {
            new CustomerDto { CustomerCode = "C001", CustomerName = "PT Maju Jaya Abadi" },
            new CustomerDto { CustomerCode = "C002", CustomerName = "PT Sumber Rejeki" },
            new CustomerDto { CustomerCode = "C003", CustomerName = "PT Nusantara Logistics" },
            new CustomerDto { CustomerCode = "C004", CustomerName = "PT Global Sentosa" },
            new CustomerDto { CustomerCode = "C005", CustomerName = "PT Mitra Sejahtera" },
            new CustomerDto { CustomerCode = "C006", CustomerName = "PT Indo Makmur" },
            new CustomerDto { CustomerCode = "C007", CustomerName = "PT Cahaya Abadi" },
            new CustomerDto { CustomerCode = "C008", CustomerName = "PT Bintang Timur" },
            new CustomerDto { CustomerCode = "C009", CustomerName = "PT Surya Perkasa" },
            new CustomerDto { CustomerCode = "C010", CustomerName = "PT Karya Bersama" },
            new CustomerDto { CustomerCode = "C011", CustomerName = "PT Prima Utama" },
            new CustomerDto { CustomerCode = "C012", CustomerName = "PT Andalan Nusantara" },
            new CustomerDto { CustomerCode = "C013", CustomerName = "PT Sukses Selalu" },
            new CustomerDto { CustomerCode = "C014", CustomerName = "PT Sentosa Makmur" },
            new CustomerDto { CustomerCode = "C015", CustomerName = "PT Mega Jaya" },
            new CustomerDto { CustomerCode = "C016", CustomerName = "PT Delta Industri" },
            new CustomerDto { CustomerCode = "C017", CustomerName = "PT Artha Mandiri" },
            new CustomerDto { CustomerCode = "C018", CustomerName = "PT Lintas Samudra" },
            new CustomerDto { CustomerCode = "C019", CustomerName = "PT Tirta Abadi" },
            new CustomerDto { CustomerCode = "C020", CustomerName = "PT Rajawali Nusindo" }
        });
    }
}
```

---

## 3. PREPARE ERP IMPLEMENTATION (EMPTY FOR NOW)

```csharp
public class ErpCustomerSource : ICustomerSource
{
    public async Task<List<CustomerDto>> GetCustomersAsync()
    {
        // TODO: Call ERP API later
        return new List<CustomerDto>();
    }
}
```

---

## 4. CONFIGURATION SWITCH

### appsettings.json

```json
{
  "CustomerSource": "Dummy"
}
```

---

### Program.cs (Dependency Injection)

```csharp
var sourceType = builder.Configuration["CustomerSource"];

if (sourceType == "Dummy")
{
    builder.Services.AddScoped<ICustomerSource, DummyCustomerSource>();
}
else
{
    builder.Services.AddScoped<ICustomerSource, ErpCustomerSource>();
}
```

---

## 5. CREATE CUSTOMER SERVICE

```csharp
public class CustomerService
{
    private readonly AppDbContext _context;

    public CustomerService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<(int inserted, int updated)> UpsertCustomersAsync(List<CustomerDto> customers)
    {
        int inserted = 0;
        int updated = 0;

        foreach (var c in customers)
        {
            var existing = await _context.Customers
                .FirstOrDefaultAsync(x => x.CustomerCode == c.CustomerCode);

            if (existing == null)
            {
                _context.Customers.Add(new Customer
                {
                    CustomerCode = c.CustomerCode,
                    CustomerName = c.CustomerName
                });
                inserted++;
            }
            else
            {
                existing.CustomerName = c.CustomerName;
                updated++;
            }
        }

        await _context.SaveChangesAsync();

        return (inserted, updated);
    }
}
```

Register it:

```csharp
builder.Services.AddScoped<CustomerService>();
```

---

## 6. CREATE SYNC ENDPOINT

In CustomersController:

```csharp
[HttpPost("sync")]
public async Task<IActionResult> SyncCustomers()
{
    var externalCustomers = await _customerSource.GetCustomersAsync();

    var (inserted, updated) = await _customerService.UpsertCustomersAsync(externalCustomers);

    return Ok(new
    {
        inserted,
        updated,
        total = inserted + updated
    });
}
```

---

## 7. FRONTEND EXPECTATION

Sync button calls:

POST /api/customers/sync

Then refresh:

GET /api/customers

---

## 🧠 RESULT

* Dummy data used for demo
* Real DB is populated
* Frontend remains unchanged later
* Switching to ERP = config change only

---

## ✅ OUTPUT EXPECTATION

Provide:

1. Interface (ICustomerSource)
2. Dummy implementation (with 20 customers)
3. ERP stub
4. DI configuration
5. CustomerService (upsert logic)
6. New Sync endpoint

Keep code clean, minimal, and production-ready.
