# AmtemeterAI Backend API Documentation

## Overview

The backend is built with **ASP.NET Core 8.0** using **Entity Framework Core** with **PostgreSQL** database. It provides RESTful APIs for managing customers and deliveries in the e-Meterai delivery management system.

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| .NET | 8.0 | Framework |
| ASP.NET Core | 8.0 | Web API |
| Entity Framework Core | 8.0.0 | ORM |
| PostgreSQL | 16 | Database |
| Npgsql | 8.0.0 | PostgreSQL Provider |
| Swashbuckle.AspNetCore | 6.5.0 | Swagger/OpenAPI |

---

## Project Structure

```
backend/amtemeterai.Api/
├── Controllers/          # API Controllers
│   ├── CustomersController.cs
│   └── DeliveriesController.cs
├── Models/               # Domain Models
│   ├── Customer.cs
│   ├── DeliveryHeader.cs
│   └── DeliveryLine.cs
├── Dtos/                 # Data Transfer Objects
│   ├── CustomerUpsertDto.cs
│   ├── DeliveryUpsertDto.cs
│   ├── DeliveryResponseDto.cs
│   ├── DeliveryLineDto.cs
│   └── DeliveryReceiveDto.cs
├── Data/                 # Database Context
│   ├── AppDbContext.cs
│   └── AppDbContextFactory.cs
├── Migrations/           # Database Migrations
│   ├── 20260430111946_InitialCreate.cs
│   ├── 20260430120637_RemoveUnusedDeliveryID.cs
│   └── 20260430153546_ChangeForeignKeyForDeliveryLine.cs
└── Program.cs            # Application Entry Point
```

---

## Database Schema

### Customer

| Column | Type | Description |
|--------|------|-------------|
| CustomerID | int (PK) | Primary Key |
| CustomerCode | string (Unique) | Customer identifier |
| CustomerName | string | Customer name |
| CustomerEmail | string? | Customer email (nullable) |
| CustomerPin | string | Customer PIN (default: "123456") |

**Relationships:**
- One-to-Many with `DeliveryHeader` (Deliveries)

---

### DeliveryHeader

| Column | Type | Description |
|--------|------|-------------|
| DeliveryID | int (PK) | Primary Key |
| CustomerID | int (FK) | Foreign Key to Customer |
| DeliveryNumber | string (Unique) | Delivery identifier |
| DeliveryDate | DateTime | Delivery date |
| DeliveryRemarks | string? | Delivery remarks (nullable) |
| ReceiverToken | Guid | Unique token for receiver access |
| ReceiverName | string? | Name of receiver (nullable) |
| ReceiverNotes | string? | Receiver notes (nullable) |
| Received | bool | Delivery received status |
| Invoiced | bool | Invoice status |

**Relationships:**
- Many-to-One with `Customer`
- One-to-Many with `DeliveryLine` (Lines)

---

### DeliveryLine

| Column | Type | Precision | Description |
|--------|------|-----------|-------------|
| DeliveryLineID | int (PK) | - | Primary Key |
| DeliveryID | int (FK) | - | Foreign Key to DeliveryHeader |
| DeliveryLineNumber | string | - | Line number |
| DeliveryItemCode | string | - | Item code |
| DeliveryItemDescription | string | - | Item description |
| SalesQuantity | decimal | 18,2 | Sales quantity |
| SalesUOM | string | - | Sales unit of measure |
| PackQuantity | decimal | 18,2 | Pack quantity |
| PackUOM | string | - | Pack unit of measure |
| PackQuantityDelivered | decimal | 18,2 | Delivered quantity |
| PackQuantityReturned | decimal | 18,2 | Returned quantity |
| PackQuantityRejected | decimal | 18,2 | Rejected quantity |

**Relationships:**
- Many-to-One with `DeliveryHeader`

---

## API Endpoints

### Base URL
```
http://localhost:8080
```

### Swagger UI
```
http://localhost:8080/swagger
```

---

## Customers API

### Upsert Customer
**Endpoint:** `POST /api/customers` or `PATCH /api/customers`

**Description:** Creates a new customer or updates an existing one based on CustomerCode.

**Request Body:**
```json
{
  "customerCode": "CUST001",
  "customerName": "PT Maju Jaya Logistics",
  "customerEmail": "contact@majujaya.co.id",
  "customerPin": "123456"
}
```

**Response:** `200 OK`

**Logic:**
- If customer with `CustomerCode` doesn't exist → Create new customer
  - Default `CustomerPin` is "123456" if not provided
- If customer exists → Update `CustomerName`, `CustomerEmail`, and optionally `CustomerPin`

---

## Deliveries API

### Upsert Delivery
**Endpoint:** `POST /api/deliveries` or `PATCH /api/deliveries`

**Description:** Creates a new delivery or updates an existing one based on DeliveryNumber.

**Request Body:**
```json
{
  "customerCode": "CUST001",
  "deliveryNumber": "DLV1001",
  "deliveryDate": "2025-05-03T10:00:00",
  "deliveryRemarks": "Express delivery",
  "lines": [
    {
      "deliveryLineNumber": "1",
      "deliveryItemCode": "ITEM001",
      "deliveryItemDescription": "e-Meterai Roll",
      "salesQuantity": 1000.00,
      "salesUOM": "PCS",
      "packQuantity": 10.00,
      "packUOM": "ROLL"
    }
  ]
}
```

**Response:** `200 OK` or `400 Bad Request` (if customer not found)

**Logic:**
- Validates customer exists by `CustomerCode`
- If delivery with `DeliveryNumber` doesn't exist:
  - Creates new `DeliveryHeader` with new `ReceiverToken` (Guid)
  - Creates all `DeliveryLine` records
- If delivery exists:
  - Updates `DeliveryDate`, `DeliveryRemarks`
  - Generates new `ReceiverToken`
  - **Replaces** all existing lines with new lines (delete old, insert new)

---

### Get Delivery by Token
**Endpoint:** `GET /api/deliveries/{token}`

**Description:** Retrieves delivery details using the receiver token.

**URL Parameter:**
- `token` (Guid) - The receiver token

**Response Body:**
```json
{
  "deliveryNumber": "DLV1001",
  "deliveryDate": "2025-05-03T10:00:00",
  "deliveryRemarks": "Express delivery",
  "receiverToken": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "receiverName": "John Doe",
  "receiverNotes": "Received in good condition",
  "received": true,
  "invoiced": false,
  "lines": [
    {
      "deliveryLineNumber": "1",
      "deliveryItemCode": "ITEM001",
      "deliveryItemDescription": "e-Meterai Roll",
      "salesQuantity": 1000.00,
      "salesUOM": "PCS",
      "packQuantity": 10.00,
      "packUOM": "ROLL",
      "packQuantityDelivered": 10.00,
      "packQuantityReturned": 0.00,
      "packQuantityRejected": 0.00
    }
  ]
}
```

**Response:** `200 OK` or `404 Not Found`

---

### Update Delivery by Token (Receive)
**Endpoint:** `PATCH /api/deliveries/{token}`

**Description:** Updates delivery receipt information and line quantities.

**URL Parameter:**
- `token` (Guid) - The receiver token

**Request Body:**
```json
{
  "receiverName": "John Doe",
  "receiverNotes": "Received in good condition",
  "lines": [
    {
      "deliveryLineNumber": "1",
      "packQuantityDelivered": 10.00,
      "packQuantityReturned": 0.00,
      "packQuantityRejected": 0.00
    }
  ]
}
```

**Response:** `200 OK` or `404 Not Found`

**Logic:**
- Finds delivery by `ReceiverToken`
- Updates `ReceiverName`, `ReceiverNotes`
- Sets `Received` to `true`
- Updates line quantities for matching `DeliveryLineNumber`

---

## Data Transfer Objects (DTOs)

### CustomerUpsertDto
| Property | Type | Required |
|----------|------|----------|
| CustomerCode | string | Yes |
| CustomerName | string | Yes |
| CustomerEmail | string? | No |
| CustomerPin | string? | No |

### DeliveryUpsertDto
| Property | Type | Required |
|----------|------|----------|
| CustomerCode | string | Yes |
| DeliveryNumber | string | Yes |
| DeliveryDate | DateTime | Yes |
| DeliveryRemarks | string? | No |
| Lines | List\<DeliveryLineDto\> | Yes |

### DeliveryLineDto
| Property | Type | Required |
|----------|------|----------|
| DeliveryLineNumber | string | Yes |
| DeliveryItemCode | string | Yes |
| DeliveryItemDescription | string | Yes |
| SalesQuantity | decimal | Yes |
| SalesUOM | string | Yes |
| PackQuantity | decimal | Yes |
| PackUOM | string | Yes |

### DeliveryResponseDto
| Property | Type |
|----------|------|
| DeliveryNumber | string |
| DeliveryDate | DateTime |
| DeliveryRemarks | string? |
| ReceiverToken | Guid |
| ReceiverName | string? |
| ReceiverNotes | string? |
| Received | bool |
| Invoiced | bool |
| Lines | List\<DeliveryLineResponseDto\> |

### DeliveryLineResponseDto
| Property | Type |
|----------|------|
| DeliveryLineNumber | string |
| DeliveryItemCode | string |
| DeliveryItemDescription | string |
| SalesQuantity | decimal |
| SalesUOM | string |
| PackQuantity | decimal |
| PackUOM | string |
| PackQuantityDelivered | decimal |
| PackQuantityReturned | decimal |
| PackQuantityRejected | decimal |

### DeliveryReceiveDto
| Property | Type | Required |
|----------|------|----------|
| ReceiverName | string? | No |
| ReceiverNotes | string? | No |
| Lines | List\<DeliveryLineReceiveDto\> | Yes |

### DeliveryLineReceiveDto
| Property | Type | Required |
|----------|------|----------|
| DeliveryLineNumber | string | Yes |
| PackQuantityDelivered | decimal | Yes |
| PackQuantityReturned | decimal | Yes |
| PackQuantityRejected | decimal | Yes |

---

## Database Configuration

### Connection String
```
Host=postgres;Port=5432;Database=opexdb;Username=postgres;Password=postgres
```

### Docker Setup

```yaml
postgres:
  image: postgres:16
  ports:
    - "5500:5432"
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: opexdb

api:
  build: backend\amtemeterai.Api
  ports:
    - "8080:8080"
  depends_on:
    - postgres
```

---

## Database Constraints

### Unique Indexes
- `Customer.CustomerCode` - Must be unique
- `DeliveryHeader.DeliveryNumber` - Must be unique

### Decimal Precision
All decimal fields in `DeliveryLine` use precision 18,2:
- SalesQuantity
- PackQuantity
- PackQuantityDelivered
- PackQuantityReturned
- PackQuantityRejected

---

## Migrations History

1. **InitialCreate** (2026-04-30 11:19:46)
   - Created Customer, DeliveryHeader, DeliveryLine tables
   - Set up relationships and constraints

2. **RemoveUnusedDeliveryID** (2026-04-30 12:06:37)
   - Removed unused DeliveryID column from DeliveryLine

3. **ChangeForeignKeyForDeliveryLine** (2026-04-30 15:35:46)
   - Updated foreign key relationship for DeliveryLine

---

## Key Business Logic

### Customer Upsert
- Idempotent operation based on `CustomerCode`
- Preserves existing `CustomerPin` if not provided in update
- Default PIN: "123456"

### Delivery Upsert
- Requires valid `CustomerCode`
- Generates fresh `ReceiverToken` on each upsert
- Replaces all delivery lines (delete + insert pattern)
- `DeliveryNumber` must be unique

### Delivery Receipt
- Accessible only via `ReceiverToken`
- Sets `Received = true` on update
- Updates line quantities by matching `DeliveryLineNumber`

---

## Development Notes

### Running the Application

**Using Docker:**
```bash
docker-compose up
```

**Manual:**
```bash
# Start PostgreSQL
# Update connection string in appsettings.json
dotnet run
```

### Applying Migrations
```bash
dotnet ef database update
```

### Creating New Migration
```bash
dotnet ef migrations add MigrationName
```

---

## API Response Codes

| Code | Description |
|------|-------------|
| 200 OK | Request successful |
| 400 Bad Request | Invalid request data or customer not found |
| 404 Not Found | Resource not found (delivery token invalid) |
