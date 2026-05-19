# AmtemeterAI Backend API Documentation

## Overview

The backend is built with **ASP.NET Core 8.0** using **Entity Framework Core** with **PostgreSQL** database. It provides RESTful APIs for managing customers and deliveries in the e-Meterai delivery management system with **JWT Bearer Token Authentication**. The system includes advanced features such as photo evidence management, GPS location tracking, document storage via MinIO, and activity logging.

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| .NET | 8.0 | Framework |
| ASP.NET Core | 8.0 | Web API |
| Entity Framework Core | 8.0.0 | ORM |
| ASP.NET Core Identity | 8.0.0 | User Management & Authentication |
| ASP.NET Core Authentication.JwtBearer | 8.0.0 | JWT Token Authentication |
| System.IdentityModel.Tokens.Jwt | 8.0.0 | JWT Token Handling |
| PostgreSQL | 16 | Database |
| Npgsql | 8.0.0 | PostgreSQL Provider |
| Swashbuckle.AspNetCore | 6.5.0 | Swagger/OpenAPI |
| QRCoder | 1.5.1 | QR Code Generation |
| AWSSDK.S3 | - | MinIO Storage Client |

---

## Authentication & Authorization

### Overview
The API uses **JWT (JSON Web Token)** Bearer authentication for securing endpoints. ASP.NET Core Identity is used for user management.

### Authentication Flow
1. User registers or logs in via `/api/account/register` or `/api/account/login`
2. Server validates credentials and generates a JWT token
3. Client includes the token in the `Authorization` header: `Bearer {token}`
4. Server validates the token on each protected request

### Default Admin Account
- **Email:** admin@amtemeterai.com
- **Password:** Admin@123
- **Role:** Admin

### JWT Configuration
```json
"Jwt": {
  "Key": "af326aa84d2198e82c5a8dce01f26d96cb29539d3c92e8028f10b58aa3df7204",
  "Issuer": "amtemeterai-api",
  "Audience": "amtemeterai-web"
}
```

### Token Expiration
- **Valid for:** 7 days
- **Clock Skew:** 0 (strict validation)

---

## Project Structure

```
backend/amtemeterai.Api/
├── Controllers/          # API Controllers
│   ├── AccountController.cs    # Authentication endpoints
│   ├── CustomersController.cs  # Customer management (requires auth)
│   └── DeliveriesController.cs # Delivery management (mixed auth)
├── Models/               # Domain Models
│   ├── ApplicationUser.cs   # Identity User (extends IdentityUser)
│   ├── Customer.cs
│   ├── DeliveryHeader.cs   # Enhanced with GPS & location fields
│   ├── DeliveryLine.cs     # Enhanced with LineComment field
│   ├── Document.cs         # NEW: Unified document storage
│   └── ActivityLog.cs      # NEW: Activity logging
├── Dtos/                 # Data Transfer Objects
│   ├── AuthResponseDto.cs
│   ├── LoginDto.cs
│   ├── RegisterDto.cs
│   ├── CustomerResponseDto.cs
│   ├── CustomerUpsertDto.cs
│   ├── DeliveryCreateResponseDto.cs
│   ├── DeliveryHeaderDto.cs
│   ├── DeliveryLineDto.cs
│   ├── DeliveryLineResponseDto.cs
│   ├── DeliveryPhotoResponseDto.cs   # NEW: Photo response format
│   ├── DeliveryReceiveDto.cs
│   ├── DeliveryResponseDto.cs
│   ├── DeliveryUpsertDto.cs
│   ├── DeliveryEditConfirmationDto.cs # NEW: Delivery confirmation updates
│   ├── PinRequestDto.cs
│   ├── GeoLocationResult.cs           # NEW: GPS location result
│   └── GoogleGeocodeResponse.cs       # NEW: Google Maps API response
├── Data/                 # Database Context
│   ├── AppDbContext.cs
│   └── AppDbContextFactory.cs
├── Services/             # Business Logic Layer
│   ├── CustomerService.cs
│   ├── ICustomerSource.cs
│   ├── DummyCustomerSource.cs
│   ├── ErpCustomerSource.cs
│   ├── IStorageService.cs        # NEW: Storage interface
│   └── MinioStorageService.cs    # NEW: MinIO implementation
├── Helpers/              # Helper Utilities
│   └── QrCodeHelper.cs
├── Config/               # Configuration Options
│   └── SapOptions.cs
├── Migrations/           # Database Migrations
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
- One-to-Many with `Document` (if applicable)

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
| Plant | string? | Plant/location identifier |
| SalesPersonName | string? | Sales person name |
| SalesPersonEmail | string? | Sales person email |
| Type | DeliveryType (Enum) | Delivery type (BC=1, NonBC=2) |
| Status | ReceiverStatus? (Enum) | Receiver status (FullyReceived=1, PartialReceived=2) |
| Latitude | double? | GPS latitude coordinate |
| Longitude | double? | GPS longitude coordinate |
| Province | string? | Administrative province |
| CityRegency | string? | Administrative city/regency |
| District | string? | Administrative district |
| FormattedAddress | string? | Full formatted address string |

**Relationships:**
- Many-to-One with `Customer`
- One-to-Many with `DeliveryLine` (Lines)
- One-to-Many with `Document` (Photos)

**Enums:**
```csharp
public enum DeliveryType { BC = 1, NonBC = 2 }
public enum ReceiverStatus { FullyReceived = 1, PartialReceived = 2 }
```

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
| LineComment | string? | - | Line-specific comments |

**Relationships:**
- Many-to-One with `DeliveryHeader`

---

### Document (NEW)

| Column | Type | Description |
|--------|------|-------------|
| DocumentID | int (PK) | Primary Key |
| StorageKey | string | MinIO storage key path |
| FileName | string | Original file name |
| ContentType | string | MIME type (e.g., "image/jpeg") |
| Type | DocumentType (Enum) | Document type (DeliveryPhoto=1, DeliveryPrintOut=2, InvoicePrintOut=3) |
| UploadedAt | DateTime | Upload timestamp |
| DeliveryID | int? (FK) | Optional link to Delivery |
| InvoiceID | int? (FK) | Optional link to Invoice (future) |

**Enums:**
```csharp
public enum DocumentType { DeliveryPhoto = 1, DeliveryPrintOut = 2, InvoicePrintOut = 3 }
```

**Storage Key Pattern:**
```
deliveries/{deliveryId}/photos/{guid}.{ext}
```

**Relationships:**
- Many-to-One with `DeliveryHeader` (polymorphic, nullable)

---

### ActivityLog (NEW)

| Column | Type | Description |
|--------|------|-------------|
| LogID | int (PK) | Primary Key |
| Timestamp | DateTime | Event timestamp (UTC) |
| EventType | string | Type of event (e.g., "DeliveryCreated") |
| ReferenceID | string | Reference identifier (e.g., delivery number) |
| Message | string | Event description |
| Severity | string | Severity level (Info, Success, Warning) |

---

## API Endpoints

### Base URL
```
http://localhost:8080
```

### Swagger UI
```
http://localhost/api/swagger
```

---

## Account API

### Register
**Endpoint:** `POST /api/account/register`

**Description:** Creates a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password123",
  "fullName": "John Doe"
}
```

**Response Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "email": "user@example.com",
  "fullName": "John Doe"
}
```

**Response:** `200 OK` or `400 Bad Request` (validation errors)

---

### Login
**Endpoint:** `POST /api/account/login`

**Description:** Authenticates a user and returns a JWT token.

**Request Body:**
```json
{
  "email": "admin@amtemeterai.com",
  "password": "Admin@123"
}
```

**Response Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "email": "admin@amtemeterai.com",
  "fullName": "Administrator"
}
```

**Response:** `200 OK` or `401 Unauthorized` (invalid credentials)

---

### Get Current User
**Endpoint:** `GET /api/account/me`

**Description:** Gets information about the currently authenticated user.

**Headers:**
```
Authorization: Bearer {token}
```

**Response Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "email": "admin@amtemeterai.com",
  "fullName": "Administrator"
}
```

**Response:** `200 OK`, `401 Unauthorized`, or `404 Not Found`

---

## Customers API

**Note:** All Customers API endpoints require authentication (`[Authorize]`).

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

---

## Deliveries API

**Authentication:**
- Most endpoints require authentication (`[Authorize]`)
- Public endpoints (no auth required):
  - `GET /api/deliveries/{token}` - Get delivery by receiver token
  - `POST /api/deliveries/{token}/verify-pin` - Verify PIN for delivery access
  - `PATCH /api/deliveries/{token}` - Update delivery by receiver token
  - `GET /api/deliveries/files/download` - Download file from storage

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
    "publicUrl": "http://192.168.110.183/receive/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "plant": "JAKARTA",
    "salesPersonName": "John Doe",
    "salesPersonEmail": "john@example.com",
    "cityRegency": "Jakarta Selatan",
    "district": "Tebet",
    "province": "DKI Jakarta",
    "photosCount": 2,
    "type": 1,
    "status": null
  }
]
```

**Response:** `200 OK`

---

### Get Delivery by ID
**Endpoint:** `GET /api/deliveries/{deliveryId}`

**Description:** Retrieves delivery details including lines, photos, and location data.

**Response Body:**
```json
{
  "deliveryID": 1,
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
  "publicUrl": "http://192.168.110.183/receive/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "plant": "JAKARTA",
  "salesPersonName": "John Doe",
  "salesPersonEmail": "john@example.com",
  "type": 1,
  "status": null,
  "latitude": -6.2088,
  "longitude": 106.8456,
  "province": "DKI Jakarta",
  "cityRegency": "Jakarta Selatan",
  "district": "Tebet",
  "formattedAddress": "Tebet, South Jakarta City, Jakarta, Indonesia",
  "photos": [
    {
      "fileName": "photo1.jpg",
      "storageKey": "deliveries/1/photos/abc123.jpg",
      "downloadUrl": "http://localhost:8080/api/deliveries/files/download?key=deliveries%2F1%2Fphotos%2Fabc123.jpg",
      "uploadedAt": "2025-05-20T00:00:00Z"
    }
  ],
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
  "plant": "JAKARTA",
  "salesPersonName": "John Doe",
  "salesPersonEmail": "john@example.com",
  "type": 1,
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
  "publicUrl": "http://192.168.110.183/receive/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "qrCodeBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

**Response:** `200 OK`, `400 Bad Request`, or `409 Conflict`

---

### Update Delivery
**Endpoint:** `PATCH /api/deliveries`

**Description:** Updates an existing delivery. Does NOT regenerate the ReceiverToken.

**Request Body:** Same as Create Delivery

**Response:** `200 OK` or `400 Bad Request`

---

### Get Delivery by Token (Public)
**Endpoint:** `GET /api/deliveries/{token}`

**Description:** Retrieves delivery details using the receiver token (public access).

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
  "publicUrl": "http://192.168.110.183/receive/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
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
      "packQuantityRejected": 0.00,
      "lineComment": "Good condition"
    }
  ],
  "photos": [...]
}
```

**Response:** `200 OK` or `404 Not Found`

---

### Update Delivery by Token (Public Receive)
**Endpoint:** `PATCH /api/deliveries/{token}`

**Description:** Updates delivery receipt information, line quantities, photos, and GPS location.

**URL Parameter:**
- `token` (Guid) - The receiver token

**Request Body (multipart/form-data):**
```
ReceiverName: string
ReceiverNotes: string?
Latitude: double?
Longitude: double?
NewPhotoFiles: IFormFile[] (new photo uploads)
KeysToDelete[]: string[] (storage keys to delete)
Lines[0].DeliveryLineNumber: string
Lines[0].PackQuantityDelivered: decimal
Lines[0].PackQuantityReturned: decimal
Lines[0].PackQuantityRejected: decimal
Lines[0].LineComment: string?
```

**Response:** `200 OK`, `400 Bad Request` (if invoiced), or `404 Not Found`

**Logic:**
- Finds delivery by `ReceiverToken`
- **Guard:** Returns 400 if delivery is already invoiced (financial lock)
- Updates `ReceiverName`, `ReceiverNotes`
- Sets `Received` to `true`
- Updates line quantities and comments
- Auto-calculates status based on quantities:
  - Any returned/rejected → `PartialReceived`
  - All delivered → `FullyReceived`
- Updates GPS coordinates and reverse geocodes to get address
- Uploads new photos to MinIO
- Deletes specified photos from MinIO and database
- Logs activity with severity based on rejection count

---

### Verify Delivery PIN
**Endpoint:** `POST /api/deliveries/{token}/verify-pin`

**Description:** Verifies the PIN for accessing a delivery.

**Request Body:**
```json
{
  "pin": "123456"
}
```

**Response Body (Success):**
```json
{
  "valid": true
}
```

**Response:** `200 OK`, `401 Unauthorized`, or `404 Not Found`

---

### Download File (Public)
**Endpoint:** `GET /api/deliveries/files/download?key={storageKey}`

**Description:** Downloads a file from MinIO storage by storage key.

**Query Parameter:**
- `key` (string) - The MinIO storage key

**Response:**
- `200 OK` with file stream (content-type: image/jpeg, image/png, or application/octet-stream)
- `404 Not Found` if file not found
- `500 Internal Server Error` on storage errors

---

### Seed Deliveries (Dev Only)
**Endpoint:** `POST /api/deliveries/dev/seed-deliveries`

**Description:** Seeds the database with 20 random deliveries for development testing.

**Response Body:**
```json
{
  "created": 20,
  "status": "All deliveries are on-going (not delivered)",
  "message": "Successfully seeded 20 deliveries with 85 total lines"
}
```

**Response:** `200 OK` or `400 Bad Request`

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
| Plant | string? |
| SalesPersonName | string? |
| SalesPersonEmail | string? |
| CityRegency | string? |
| District | string? |
| Province | string? |
| PhotosCount | int |
| Type | int? (DeliveryType enum cast) |
| Status | int? (ReceiverStatus enum cast) |

### DeliveryResponseDto
| Property | Type |
|----------|------|
| DeliveryID | int |
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
| Plant | string? |
| SalesPersonName | string? |
| SalesPersonEmail | string? |
| Type | int |
| Status | int? |
| Latitude | double? |
| Longitude | double? |
| Province | string? |
| CityRegency | string? |
| District | string? |
| FormattedAddress | string? |
| Photos | List<DeliveryPhotoResponseDto> |
| Lines | List<DeliveryLineResponseDto> |

### DeliveryPhotoResponseDto (NEW)
| Property | Type |
|----------|------|
| FileName | string |
| StorageKey | string |
| DownloadUrl | string |
| UploadedAt | DateTime |

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
| LineComment | string? |

### DeliveryEditConfirmationDto (NEW)
| Property | Type |
|----------|------|
| ReceiverName | string |
| ReceiverNotes | string? |
| Latitude | double? |
| Longitude | double? |
| Lines | List<DeliveryLineEditDto> |
| NewPhotoFiles | List<IFormFile>? |
| KeysToDelete | List<string> |

### DeliveryLineEditDto (NEW)
| Property | Type |
|----------|------|
| DeliveryLineNumber | string |
| PackQuantityDelivered | decimal |
| PackQuantityReturned | decimal |
| PackQuantityRejected | decimal |
| LineComment | string? |

### GeoLocationResult (NEW)
| Property | Type |
|----------|------|
| Province | string? |
| CityRegency | string? |
| District | string? |
| FormattedAddress | string? |

---

## Services Architecture

### Storage Service Layer (NEW)

#### `IStorageService` (Interface)
Defines the contract for file storage operations using MinIO/S3-compatible storage:

```csharp
Task<string> UploadFileAsync(string objectKey, Stream fileStream, string contentType);
Task<Stream> GetFileStreamAsync(string storageKey);
Task<string> GetPresignedUrlAsync(string objectKey, double expiryMinutes = 60);
Task DeleteFileAsync(string storageKey);
```

#### `MinioStorageService`
Implementation using AWS S3 SDK for MinIO compatibility:
- Uploads files to configured MinIO bucket
- Streams files directly for download
- Generates presigned URLs for secure access
- Deletes files from storage
- Handles file not found scenarios gracefully

**Configuration (appsettings.json):**
```json
"Minio": {
  "Endpoint": "minio:9000",
  "AccessKey": "${MINIO_ACCESS_KEY}",
  "SecretKey": "${MINIO_SECRET_KEY}",
  "BucketName": "amtemeterai-documents"
}
```

### Customer Service Layer

The customer service follows a strategy pattern for customer data sources:

#### `ICustomerSource` (Interface)
Defines the contract for fetching customer data from external sources.

#### `DummyCustomerSource`
- Provides mock/dummy customer data for testing
- Used for development and demonstration purposes

#### `ErpCustomerSource`
- Integrates with external ERP system
- Placeholder for actual ERP integration implementation

#### `CustomerService`
- Business logic for customer upsert operations
- Returns `(int inserted, int updated)` tuple
- Default PIN: "123456"

### QR Code Helper

#### `QrCodeHelper`
- Static utility class for QR code generation
- Method: `GenerateQrBase64(string text)`
- Returns: Base64-encoded PNG image of QR code

---

## GPS & Location Services (NEW)

### Reverse Geocoding

The system integrates with Google Maps Geocoding API to convert GPS coordinates to structured addresses:

**Method:** `ReverseGeocodeAsync(double lat, double lng)`

**Process:**
1. Calls Google Maps Geocoding API with lat/lng coordinates
2. Parses address components to extract:
   - Province (administrative_area_level_1)
   - CityRegency (administrative_area_level_2)
   - District (administrative_area_level_3)
   - FormattedAddress (full address string)
3. Updates DeliveryHeader with structured location data

**Configuration (appsettings.json):**
```json
"GoogleMaps": {
  "ApiKey": "${GOOGLE_MAPS_API_KEY}"
}
```

**API Endpoint:**
```
https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&key={apiKey}
```

---

## Activity Logging (NEW)

### Overview
The system logs all significant activities for audit trails and monitoring.

### Log Levels
- **Info** - General information
- **Success** - Successful operations
- **Warning** - Operations with potential issues (e.g., deliveries with rejections)

### Logged Events
| Event Type | Description |
|------------|-------------|
| DeliveryCreated | When a new delivery is created |
| DeliveryConfirmationUpdated | When delivery confirmation is modified |

### Helper Method
```csharp
private async Task LogActivity(
    string eventType,
    string referenceId,
    string message,
    string severity = "Info"
)
```

---

## CORS Configuration

```json
"Cors": {
  "Origins": [
    "http://localhost:5173",
    "http://localhost:3000"
  ]
}
```

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
  container_name: amtemeterai-postgres
  environment:
    POSTGRES_USER: ${DB_USER}
    POSTGRES_PASSWORD: ${DB_PASSWORD}
    POSTGRES_DB: ${DB_NAME}
  volumes:
    - postgres_data:/var/lib/postgresql/data

minio:
  image: minio/minio
  container_name: amtemeterai-minio
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
    MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
  volumes:
    - minio_data:/data

api:
  build: backend\amtemeterai.Api
  image: amtemeterai-api:v2
  container_name: amtemeterai-api
  environment:
    ConnectionStrings__DefaultConnection: Host=postgres;Port=${DB_PORT};Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASSWORD}
    Jwt__Key: ${JWT_SECRET}
    Jwt__Issuer: ${JWT_ISSUER}
    Jwt__Audience: ${JWT_AUDIENCE}
    App__PublicBaseUrl: ${PUBLIC_BASE_URL}
    App__ApiBaseUrl: ${API_BASE_URL}
    GoogleMaps__ApiKey: ${GOOGLE_MAPS_API_KEY}
    Minio__Endpoint: minio:9000
    Minio__AccessKey: ${MINIO_ACCESS_KEY}
    Minio__SecretKey: ${MINIO_SECRET_KEY}
    Minio__BucketName: amtemeterai-documents
  depends_on:
    - postgres
    - minio
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

Recent migrations include:
1. **InitialCreate** - Created Customer, DeliveryHeader, DeliveryLine tables
2. **RemoveUnusedDeliveryID** - Removed unused DeliveryID column from DeliveryLine
3. **ChangeForeignKeyForDeliveryLine** - Updated foreign key relationship
4. **ActivityLog** - Added ActivityLog table
5. **AddDocumentsTable** - Added unified Documents table
6. **AddGpsFieldsToDeliveries** - Added Latitude, Longitude, Province, CityRegency, District, FormattedAddress
7. **AddSalesPersonTypeAndLineComment** - Added Plant, SalesPersonName, SalesPersonEmail, Type enums, Status enum, LineComment

---

## Key Business Logic

### Customer Sync
- Fetches customers from configured `ICustomerSource`
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
- Generates `PublicUrl` and `QrCodeBase64`
- `DeliveryNumber` must be unique
- Logs activity on creation

### Delivery Update
- Requires valid `CustomerCode` and existing `DeliveryNumber`
- Updates delivery header fields
- **Does NOT** regenerate `ReceiverToken`
- Replaces all delivery lines (delete + insert pattern)

### Delivery Confirmation (Public Token-Based)
- Accessible only via `ReceiverToken`
- **Guard:** Rejects updates if delivery is invoiced (financial lock)
- Sets `Received = true` on update
- Updates line quantities and comments
- Auto-calculates status:
  - `PartialReceived` if any returned/rejected items
  - `FullyReceived` otherwise
- Updates GPS coordinates and reverse geocodes to address
- Uploads new photos to MinIO storage
- Deletes specified photos from both MinIO and database
- Logs activity with severity based on rejection count

### Photo Management
- Photos stored in MinIO with structured key pattern
- Maximum 5 photos per delivery (frontend-enforced)
- Supports JPEG and PNG formats
- Files downloaded via streaming endpoint
- Photos linked via polymorphic Document relationship

### Public URL Generation
- Format: `{App__PublicBaseUrl}/receive/{ReceiverToken}`
- Example: `http://192.168.110.183/receive/{token}`

---

## Security Features

### PIN Verification
- Server-side PIN validation using `Customer.CustomerPin`
- PIN never exposed in frontend responses
- Delivery details not returned until PIN verified
- Session-based verification persistence

### Financial Lock
- Deliveries cannot be modified after being invoiced
- Guard implemented in `UpdateByToken` endpoint
- Returns `400 Bad Request` if modification attempted

### Activity Logging
- All significant operations logged
- Includes event type, reference ID, message, and severity
- Supports audit trail and monitoring

---

## Development Notes

### Running the Application

**Using Docker:**
```bash
docker-compose up -d
```

**Manual:**
```bash
# Start PostgreSQL and MinIO
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
| 400 Bad Request | Invalid request data, customer not found, or delivery invoiced |
| 401 Unauthorized | Invalid credentials or PIN |
| 404 Not Found | Resource not found |
| 409 Conflict | Delivery number already exists |
| 500 Internal Server Error | Storage or server errors |

---

## Swagger Configuration

- Swagger JSON endpoint: `/api/swagger/v1/swagger.json`
- Swagger UI: `/api/swagger`