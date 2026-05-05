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
| QRCoder | 1.5.1 | QR Code Generation |

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
│   ├── CustomerResponseDto.cs
│   ├── CustomerUpsertDto.cs
│   ├── DeliveryCreateResponseDto.cs
│   ├── DeliveryHeaderDto.cs
│   ├── DeliveryLineDto.cs
│   ├── DeliveryLineResponseDto.cs
│   ├── DeliveryReceiveDto.cs
│   ├── DeliveryResponseDto.cs
│   └── DeliveryUpsertDto.cs
├── Data/                 # Database Context
│   ├── AppDbContext.cs
│   └── AppDbContextFactory.cs
├── Services/             # Business Logic Layer
│   ├── CustomerService.cs
│   ├── ICustomerSource.cs
│   ├── DummyCustomerSource.cs
│   └── ErpCustomerSource.cs
├── Helpers/              # Helper Utilities
│   └── QrCodeHelper.cs
├── Migrations/           # Database Migrations
│   ├── 20260430111946_InitialCreate.cs
│   ├── 20260430120637_RemoveUnusedDeliveryID.cs
│   └── 20260430153546_ChangeForeignKeyForDeliveryLine.cs
├── Properties/           # .NET Project Properties
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

### Get All Customers
**Endpoint:** `GET /api/customers`

**Description:** Retrieves all customers from the database.

**Response Body:**
```json
[
  {
    "customerId": 1,
    "customerCode": "CUST001",
    "customerName": "PT Maju Jaya Logistics",
    "customerEmail": "contact@majujaya.co.id"
  }
]
```

**Response:** `200 OK`

---

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

### Sync Customers
**Endpoint:** `POST /api/customers/sync`

**Description:** Synchronizes customers from the configured external source (Dummy or ERP).

**Response Body:**
```json
{
  "inserted": 5,
  "updated": 3,
  "total": 8,
  "message": "Sync completed: 5 inserted, 3 updated"
}
```

**Response:** `200 OK`

**Logic:**
- Fetches customers from `ICustomerSource` implementation
- Upserts all customers using `CustomerService`
- Returns count of inserted and updated customers

---

## Deliveries API

### Get All Deliveries
**Endpoint:** `GET /api/deliveries`

**Description:** Retrieves all delivery headers with customer information, ordered by delivery date descending.

**Response Body:**
```json
[
  {
    "deliveryId": 1,
    "deliveryNumber": "DLV1001",
    "deliveryDate": "2025-05-03T10:00:00",
    "deliveryRemarks": "Express delivery",
    "customerCode": "CUST001",
    "customerName": "PT Maju Jaya Logistics",
    "received": false,
    "invoiced": false,
    "publicUrl": "http://localhost:5173/receive/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
]
```

**Response:** `200 OK`

---

### Get Delivery by ID
**Endpoint:** `GET /api/deliveries/{deliveryId}`

**Description:** Retrieves delivery details including lines by delivery ID.

**URL Parameter:**
- `deliveryId` (int) - The delivery ID

**Response Body:**
```json
{
  "deliveryNumber": "DLV1001",
  "deliveryDate": "2025-05-03T10:00:00",
  "deliveryRemarks": "Express delivery",
  "customerCode": "CUST001",
  "customerName": "PT Maju Jaya Logistics",
  "receiverToken": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "receiverName": null,
  "receiverNotes": null,
  "received": false,
  "invoiced": false,
  "publicUrl": "http://localhost:5173/receive/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "lines": [...]
}
```

**Response:** `200 OK` or `404 Not Found`

---

### Create Delivery
**Endpoint:** `POST /api/deliveries`

**Description:** Creates a new delivery. Returns conflict if delivery number already exists.

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

**Response Body:**
```json
{
  "deliveryNumber": "DLV1001",
  "publicUrl": "http://localhost:5173/receive/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "qrCodeBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

**Response:** `200 OK`, `400 Bad Request` (customer not found), or `409 Conflict` (delivery exists)

**Logic:**
- Validates customer exists by `CustomerCode`
- Creates new `DeliveryHeader` with new `ReceiverToken` (Guid)
- Creates all `DeliveryLine` records
- Generates `PublicUrl` and `QrCodeBase64` for the delivery

---

### Update Delivery
**Endpoint:** `PATCH /api/deliveries`

**Description:** Updates an existing delivery. Does NOT regenerate the ReceiverToken.

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
- If delivery doesn't exist → Returns `404 Not Found`
- If delivery exists:
  - Updates `DeliveryDate`, `DeliveryRemarks`
  - **Does NOT** regenerate `ReceiverToken` (token must remain stable)
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

### Seed Deliveries (Dev Only)
**Endpoint:** `POST /api/deliveries/dev/seed-deliveries`

**Description:** Seeds the database with 20 random deliveries for development testing. Only works in development environment.

**Response Body:**
```json
{
  "created": 20,
  "status": "All deliveries are on-going (not delivered)",
  "message": "Successfully seeded 20 deliveries with 85 total lines"
}
```

**Response:** `200 OK` or `400 Bad Request` (not in dev or no customers)

**Logic:**
- Only works in development environment
- Requires existing customers in database
- Creates 20 random deliveries with:
  - Random customer assignment
  - Random delivery date within last 30 days
  - 3-6 delivery lines per delivery
  - All deliveries start as not received and not invoiced

---

## Data Transfer Objects (DTOs)

### CustomerResponseDto
| Property | Type |
|----------|------|
| CustomerId | int |
| CustomerCode | string |
| CustomerName | string |
| CustomerEmail | string? |

### DeliveryHeaderDto
| Property | Type |
|----------|------|
| DeliveryId | int |
| DeliveryNumber | string |
| DeliveryDate | DateTime |
| DeliveryRemarks | string? |
| CustomerCode | string |
| CustomerName | string |
| Received | bool |
| Invoiced | bool |
| PublicUrl | string |

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
| CustomerCode | string |
| CustomerName | string |
| ReceiverToken | Guid |
| ReceiverName | string? |
| ReceiverNotes | string? |
| Received | bool |
| Invoiced | bool |
| PublicUrl | string |
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

### DeliveryCreateResponseDto
| Property | Type | Description |
|----------|------|-------------|
| DeliveryNumber | string | The created delivery number |
| PublicUrl | string | Public URL for receiver access |
| QrCodeBase64 | string | Base64-encoded QR code image |

---

## Services Architecture

### Customer Service Layer

The customer service follows a strategy pattern for customer data sources:

#### `ICustomerSource` (Interface)
Defines the contract for fetching customer data from external sources.

```csharp
Task<List<CustomerDto>> GetCustomersAsync();
```

#### `DummyCustomerSource`
- Provides mock/dummy customer data for testing
- Returns a list of sample customers with fixed data
- Used for development and demonstration purposes

#### `ErpCustomerSource`
- Integrates with external ERP system
- Fetches real customer data from ERP
- Placeholder for actual ERP integration implementation

#### `CustomerService`
- Business logic for customer upsert operations
- Method: `UpsertCustomersAsync(List<CustomerDto> customers)`
- Returns: `(int inserted, int updated)` tuple
- Logic:
  - If customer code doesn't exist → Insert new customer
  - If customer exists → Update name, email, and optionally PIN
  - Default PIN: "123456"

### QR Code Helper

#### `QrCodeHelper`
- Static utility class for QR code generation
- Method: `GenerateQrBase64(string text)`
- Returns: Base64-encoded PNG image of QR code
- Uses QRCoder library for generation

---

## CORS Configuration

The API is configured to allow CORS for frontend applications dynamically based on `appsettings.json`:

```json
"Cors": {
  "Origins": [
    "http://localhost:5173",
    "http://localhost:3000"
  ]
}
```

This allows the frontend running on ports 5173 (Vite dev) or 3000 (Docker) to access the API.

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

### Customer Sync
- Fetches customers from configured `ICustomerSource` (Dummy or ERP)
- Upserts all customers using `CustomerService`
- Returns counts of inserted and updated records

### Customer Upsert
- Idempotent operation based on `CustomerCode`
- Preserves existing `CustomerPin` if not provided in update
- Default PIN: "123456"

### Delivery Create
- Requires valid `CustomerCode`
- Creates new `DeliveryHeader` with new `ReceiverToken` (Guid)
- Creates all `DeliveryLine` records
- Generates `PublicUrl` and `QrCodeBase64` for delivery sharing
- `DeliveryNumber` must be unique (returns 409 Conflict if exists)

### Delivery Update
- Requires valid `CustomerCode` and existing `DeliveryNumber`
- Updates `DeliveryDate`, `DeliveryRemarks`
- **Does NOT** regenerate `ReceiverToken` (token must remain stable for QR codes to work)
- Replaces all delivery lines (delete + insert pattern)

### Delivery Receipt
- Accessible only via `ReceiverToken`
- Sets `Received = true` on update
- Updates line quantities by matching `DeliveryLineNumber`

### Public URL Generation
- Format: `{App:PublicBaseUrl}/receive/{ReceiverToken}`
- Default base URL: `http://localhost:5173`
- Configurable via `appsettings.json`

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
