# AmtemeterAI Backend API Documentation

## Overview

The backend is built with **ASP.NET Core 8.0** using **Entity Framework Core** with **PostgreSQL** database. It provides RESTful APIs for managing customers, deliveries, invoices, and e-Meterai operations in the delivery management system with **JWT Bearer Token Authentication** and a **Dynamic Role-Based Access Control (RBAC)** system. The system includes advanced features such as photo evidence management, GPS location tracking, document storage via MinIO, activity logging, Peruri PDS integration for e-Meterai stamping, and plant-level data security.

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
| QRCoder | 1.8.0 | QR Code Generation |
| AWSSDK.S3 | 4.0.23.3 | MinIO Storage Client (S3-compatible) |

---

# Authentication & Authorization

## Authentication System

### Overview
The API uses **JWT (JSON Web Token)** Bearer authentication for securing endpoints. ASP.NET Core Identity is used for user management.

### Authentication Flow
1. User registers or logs in via `/api/account/register` or `/api/account/login`
2. Server validates credentials and generates a JWT token with dynamic claims
3. Client includes the token in the `Authorization` header: `Bearer {token}`
4. Server validates the token on each protected request

### Default Accounts

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| sysadmin | admin@amtemeterai.com | Admin@123 | Full system access |
| finance | finance@amtemeterai.com | Testing@123 | Finance operations |
| warehouse | warehouse@amtemeterai.com | Testing@123 | Warehouse operations |
| sales | sales@amtemeterai.com | Testing@123 | Sales operations |

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

### JWT Token Claims Structure
The JWT token includes the following dynamic claims:

```json
{
  "claims": {
    "nameid": "user-id",
    "email": "user@example.com",
    "unique_name": "Full Name",
    "jti": "guid-token-id",
    "role": ["sysadmin", "finance"],
    "plant": ["B1G2", "B1F1"],
    "menu": ["customers", "invoices", "deliveries"],
    "security_stamp": "security-stamp-value"
  }
}
```

**Claim Types:**
- `nameid` - User ID
- `email` - User email
- `unique_name` - Full name
- `role` - Assigned system roles (multiple)
- `plant` - Assigned plant codes for data filtering (multiple)
- `menu` - Accessible menu keys based on permissions (multiple)
- `security_stamp` - Session revocation tracking

---

# Role-Based Access Control (RBAC)

## RBAC Architecture Overview

The system implements a **dynamic, database-driven RBAC matrix** that allows runtime modification of permissions without code changes. The authorization system operates at multiple levels:

1. **System Roles** - Predefined organizational roles
2. **Permissions** - Granular permission keys for operations
3. **Menu Permissions** - UI menu visibility control
4. **Plant-Level Data Security** - Data filtering by plant assignment

## System Roles

Four system roles are seeded by default:

| Role | Description | Access Level |
|------|-------------|--------------|
| `sysadmin` | System Administrator | Full access to all features and configurations |
| `finance` | Finance Staff | Customer/invoice read & sync, no delivery access |
| `warehouse` | Warehouse Staff | Delivery read-only access |
| `sales` | Sales Staff | Customer/invoice read-only, no sync operations |

## Permission Matrix

### Permission Keys

| ID | Permission Key | Description | Category |
|----|----------------|-------------|----------|
| 1 | `customer:read` | View customer list and profiles | Customers |
| 2 | `customer:sync` | Sync customer data from ERP system | Customers |
| 3 | `invoice:read` | View invoice records | Invoices |
| 4 | `invoice:sync` | Sync invoices from ERP system | Invoices |
| 5 | `delivery:read` | View delivery headers and details | Deliveries |
| 6 | `delivery:sync` | Sync deliveries from ERP system | Deliveries |

### Default Role Permissions

| Role | Permissions |
|------|-------------|
| `sysadmin` | All permissions (1-6) |
| `finance` | customer:read, customer:sync, invoice:read, invoice:sync |
| `warehouse` | delivery:read |
| `sales` | customer:read, invoice:read, delivery:read |

## Application Menus

### Menu Structure

| ID | Menu Key | Label | Path | Icon | Required Permission |
|----|----------|-------|------|------|---------------------|
| 1 | `customers` | Customers | `/customers` | Users | customer:read |
| 2 | `invoices` | Invoices | `/invoices` | FileText | invoice:read |
| 3 | `deliveries` | Deliveries | `/deliveries` | Package | delivery:read |
| 4 | `settings` | Access Management | `/settings/rbac` | ShieldAlert | customer:sync |

### Menu Visibility Logic
Menus are shown/hidden based on user's role permissions:
1. Get user's roles from JWT claims
2. Get permissions assigned to those roles
3. Get menus linked to those permissions
4. Return accessible menu list to frontend

---

# Plant-Level Data Security

## Plant Assignment System

### Plant Entity
```csharp
public class Plant
{
    public string PlantCode { get; set; }  // Primary Key (e.g., "B1G2")
    public string PlantName { get; set; }  // Human-readable name
    public DateTime CreatedAt { get; set; }
}
```

### UserPlant Assignment
```csharp
public class UserPlant
{
    public string UserId { get; set; }      // Foreign Key to ApplicationUser
    public string PlantCode { get; set; } // Foreign Key to Plant
    public DateTime AssignedAt { get; set; }
}
```

### Data Filtering Logic
- Users are assigned to specific plants via `UserPlant` table
- Plant claims are embedded in JWT token during login
- Data queries filter by user's assigned plants
- System administrators (sysadmin role) bypass plant filtering

### Seeded Plants
The system seeds 32 plant codes including:
- `0001` - Werk 0001
- `B1G2` - Cotton Processing - Tangerang
- `B1F1` - FP Tangerang
- `B1S1` - Spinning Salatiga
- `Z999` - Plant
- ... (28 more plants)

---

# Database Schema

## RBAC Tables

### Permission
| Column | Type | Description |
|--------|------|-------------|
| Id | int (PK) | Primary Key |
| PermissionKey | string | Unique permission identifier |
| Description | string | Human-readable description |
| Category | string | Permission category |
| DisplayOrder | int | UI display order |

### RolePermission
| Column | Type | Description |
|--------|------|-------------|
| RoleId | string (FK) | Foreign Key to IdentityRole |
| PermissionId | int (FK) | Foreign Key to Permission |

### ApplicationMenu
| Column | Type | Description |
|--------|------|-------------|
| Id | int (PK) | Primary Key |
| MenuKey | string | Unique menu identifier |
| Label | string | Display label |
| Path | string | Route path |
| IconName | string? | Lucide icon name |
| ParentMenuId | int? | Parent menu for nesting |
| DisplayOrder | int | UI display order |

### MenuPermission
| Column | Type | Description |
|--------|------|-------------|
| MenuId | int (FK) | Foreign Key to ApplicationMenu |
| PermissionId | int (FK) | Foreign Key to Permission |

### Plant
| Column | Type | Description |
|--------|------|-------------|
| PlantCode | string (PK) | Plant code identifier |
| PlantName | string | Plant name |
| CreatedAt | DateTime | Creation timestamp |

### UserPlant
| Column | Type | Description |
|--------|------|-------------|
| UserId | string (FK) | Foreign Key to ApplicationUser |
| PlantCode | string (FK) | Foreign Key to Plant |
| AssignedAt | DateTime | Assignment timestamp |

---

# Core Entities

## ApplicationUser
Extends `IdentityUser` with custom fields:

| Column | Type | Description |
|--------|------|-------------|
| Id | string (PK) | Inherited from IdentityUser |
| Email | string | Inherited from IdentityUser |
| FullName | string? | User's full name |
| CreatedAt | DateTime | Account creation timestamp |
| LastLoginAt | DateTime? | Last login timestamp |
| SecurityStamp | string | Session revocation tracking |

**Relationships:**
- Many-to-Many with `IdentityRole` via `UserRole`
- One-to-Many with `UserPlant`

## Customer

| Column | Type | Description |
|--------|------|-------------|
| CustomerID | int (PK) | Primary Key |
| CustomerCode | string (Unique) | Customer identifier |
| CustomerName | string | Customer name |
| CustomerEmail | string? | Customer email (nullable) |
| CustomerPin | string | Customer PIN (default: "123456") |

**Relationships:**
- One-to-Many with `DeliveryHeader` (Deliveries)

## DeliveryHeader

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

## DeliveryLine

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

## Invoice

| Column | Type | Description |
|--------|------|-------------|
| InvoiceID | int (PK) | Primary Key |
| InvoiceNumber | string | Invoice identifier |
| CustomerNumber | string | Customer number |
| InvoiceAmount | decimal | Invoice total amount |
| InvoicedDate | DateTime | Invoice date |
| Status | InvoiceStatus (Enum) | Invoice status (Draft=1, Stamped=2, SyncFailed=3, SyncedToSap=4, Canceled=5) |
| DeliveryHeaderId | int? (FK) | Optional link to Delivery |
| SerialNumber | string? | e-Meterai serial number |
| StampingStatus | InvoiceStampingStatus (Enum) | Stamping status (NotStamped=1, Pending=2, Stamped=3, Failed=4) |
| StampedDocumentId | int? (FK) | Link to stamped document |

**Relationships:**
- Many-to-One with `DeliveryHeader`
- One-to-Many with `Document`

## Document

| Column | Type | Description |
|--------|------|-------------|
| DocumentID | int (PK) | Primary Key |
| StorageKey | string | MinIO storage key path |
| FileName | string | Original file name |
| ContentType | string | MIME type (e.g., "image/jpeg") |
| Type | DocumentType (Enum) | Document type (DeliveryPhoto=1, DeliveryPrintOut=2, InvoicePrintOut=3) |
| UploadedAt | DateTime | Upload timestamp |
| DeliveryID | int? (FK) | Optional link to Delivery |
| InvoiceID | int? (FK) | Optional link to Invoice |

**Enums:**
```csharp
public enum DocumentType { DeliveryPhoto = 1, DeliveryPrintOut = 2, InvoicePrintOut = 3 }
```

## ActivityLog

| Column | Type | Description |
|--------|------|-------------|
| LogID | int (PK) | Primary Key |
| Timestamp | DateTime | Event timestamp (UTC) |
| EventType | string | Type of event (e.g., "DeliveryCreated") |
| ReferenceID | string | Reference identifier (e.g., delivery number) |
| Message | string | Event description |
| Severity | string | Severity level (Info, Success, Warning) |

---

# Project Structure

```
backend/amtemeterai.Api/
├── Controllers/                     # API Controllers
│   ├── AccountController.cs        # Authentication endpoints
│   ├── DashboardController.cs      # Dashboard stats, charts, and logs
│   ├── CustomersController.cs      # Customer management
│   ├── DeliveriesController.cs     # Delivery management
│   ├── InvoicesController.cs        # Invoice management & e-Meterai stamping
│   └── UserManagementController.cs # RBAC & User Administration
├── Models/                          # Domain Models
│   ├── ApplicationUser.cs          # Identity User extension
│   ├── Customer.cs
│   ├── DeliveryHeader.cs
│   ├── DeliveryLine.cs
│   ├── Invoice.cs
│   ├── Document.cs
│   ├── ActivityLog.cs
│   ├── Plant.cs
│   ├── UserPlant.cs
│   ├── Permission.cs               # RBAC Permission entity
│   ├── RolePermission.cs          # Role-Permission mapping
│   ├── ApplicationMenu.cs          # Menu structure
│   └── MenuPermission.cs          # Menu-Permission mapping
├── Dtos/                           # Data Transfer Objects
│   ├── AuthResponseDto.cs
│   ├── LoginDto.cs
│   ├── RegisterDto.cs
│   ├── CustomerResponseDto.cs
│   ├── DeliveryHeaderDto.cs
│   ├── DeliveryResponseDto.cs
│   ├── InvoiceResponseDto.cs
│   └── UpdateUserMatrixDto.cs      # RBAC user assignment
├── Data/                           # Database Context
│   ├── AppDbContext.cs
│   ├── AppDbContextFactory.cs
│   └── DbInitializer.cs           # RBAC & Master Data Seeding
├── Services/                       # Business Logic Layer
│   ├── CustomerService.cs
│   ├── IStorageService.cs
│   ├── MinioStorageService.cs
│   ├── IPeriuriPdsService.cs       # e-Meterai integration
│   ├── PeriuriPdsService.cs
│   ├── IEmailService.cs
│   └── EmailService.cs
├── Helpers/                        # Helper Utilities
│   └── QrCodeHelper.cs
├── Config/                         # Configuration Options
│   └── SapOptions.cs
├── Migrations/                     # Database Migrations
└── Program.cs                       # Application Entry Point
```

---

# API Endpoints

## Base URL
```
http://localhost:8080
```

## Swagger UI
```
http://localhost/api/swagger
```

---

## Authentication API

### Register
**Endpoint:** `POST /api/account/register`

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

**Notes:**
- New users are automatically assigned the `sales` role
- Token includes role, plant, and menu claims

### Login
**Endpoint:** `POST /api/account/login`

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
  "fullName": "System Administrator"
}
```

### Get Current User
**Endpoint:** `GET /api/account/me`

**Headers:**
```
Authorization: Bearer {token}
```

**Response Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "email": "admin@amtemeterai.com",
  "fullName": "System Administrator"
}
```

---

## User Management API (sysadmin only)

### Get All Users
**Endpoint:** `GET /api/admin/uam/users`

**Authorization:** `sysadmin` role required

**Response Body:**
```json
[
  {
    "id": "user-id",
    "fullName": "John Doe",
    "email": "john@example.com",
    "lastLoginAt": "2025-05-20T10:30:00Z",
    "createdAt": "2025-01-01T00:00:00Z"
  }
]
```

### Get User Matrix
**Endpoint:** `GET /api/admin/uam/users/{id}/matrix`

**Authorization:** `sysadmin` role required

**Response Body:**
```json
{
  "userId": "user-id",
  "fullName": "John Doe",
  "email": "john@example.com",
  "assignedPlants": ["B1G2", "B1F1"],
  "assignedRoles": ["sales"],
  "allPlants": [
    {"plantCode": "B1G2", "plantName": "Garment Tangerang Non KB"},
    {"plantCode": "B1F1", "plantName": "FP Tangerang"}
  ],
  "allRoles": [
    {"id": "role-id", "name": "sysadmin"},
    {"id": "role-id-2", "name": "sales"}
  ]
}
```

### Update User Matrix
**Endpoint:** `POST /api/admin/uam/users/{id}/matrix`

**Authorization:** `sysadmin` role required

**Request Body:**
```json
{
  "selectedPlants": ["B1G2", "B1F1"],
  "selectedRoles": ["sales", "warehouse"]
}
```

**Response:**
```json
{
  "message": "User permissions updated successfully",
  "userId": "user-id",
  "plantCount": 2,
  "roleCount": 2
}
```

**Notes:**
- Users cannot remove their own `sysadmin` role
- Security stamp is updated to invalidate existing tokens

### Get Roles and Menus
**Endpoint:** `GET /api/admin/uam/roles`

**Authorization:** `sysadmin` role required

**Response Body:**
```json
{
  "roles": ["sysadmin", "finance", "warehouse", "sales"],
  "menus": [
    {"menuCode": "customers", "menuName": "Customers"},
    {"menuCode": "invoices", "menuName": "Invoices"}
  ]
}
```

### Get Role Menus
**Endpoint:** `GET /api/admin/uam/roles/{roleName}/menus`

**Authorization:** `sysadmin` role required

**Response Body:**
```json
{
  "roleName": "finance",
  "menuCodes": ["customers", "invoices"]
}
```

### Update Role Menus
**Endpoint:** `POST /api/admin/uam/roles/{roleName}/menus`

**Authorization:** `sysadmin` role required

**Request Body:**
```json
{
  "selectedMenus": ["customers", "invoices", "settings"]
}
```

**Response:**
```json
{
  "message": "Role 'finance' menu permissions updated successfully",
  "roleName": "finance",
  "menuCount": 3,
  "affectedUsers": 5
}
```

**Notes:**
- Updates menu permissions for all users in the role
- Security stamps are updated for all affected users

---

## Dashboard API

### Get Dashboard Stats
**Endpoint:** `GET /api/dashboard/stats`

**Authorization:** Required

**Response Body:**
```json
{
  "totalDeliveries": 45,
  "pendingDeliveries": 12,
  "pendingInvoice": 8,
  "rejectionRate": 3.5
}
```

### Get Delivery Charts Data
**Endpoint:** `GET /api/dashboard/charts`

**Authorization:** Required

**Response Body:**
```json
[
  {"date": "2025-04-22", "count": 3},
  {"date": "2025-04-23", "count": 5}
]
```

### Get Activity Logs
**Endpoint:** `GET /api/dashboard/logs?count=20`

**Authorization:** Required

**Response Body:**
```json
[
  {
    "logID": 1,
    "timestamp": "2025-05-20T10:30:00Z",
    "eventType": "DeliveryConfirmationUpdated",
    "referenceID": "DLV1001",
    "message": "Delivery DLV1001 confirmed and synced to SAP.",
    "severity": "Success"
  }
]
```

---

## Customers API

### Get All Customers
**Endpoint:** `GET /api/customers`

**Authorization:** `customer:read` permission required

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

### Upsert Customer
**Endpoint:** `POST /api/customers` or `PATCH /api/customers`

**Authorization:** `customer:sync` permission required

**Request Body:**
```json
{
  "customerCode": "CUST001",
  "customerName": "PT Maju Jaya Logistics",
  "customerEmail": "contact@majujaya.co.id",
  "customerPin": "123456"
}
```

### Sync Customers
**Endpoint:** `POST /api/customers/sync`

**Authorization:** `customer:sync` permission required

**Response Body:**
```json
{
  "inserted": 5,
  "updated": 3,
  "total": 8,
  "message": "Sync completed: 5 inserted, 3 updated"
}
```

---

## Deliveries API

### Get All Deliveries
**Endpoint:** `GET /api/deliveries`

**Authorization:** `delivery:read` permission required

**Response Body:**
```json
[
  {
    "deliveryId": 1,
    "deliveryNumber": "DLV1001",
    "deliveryDate": "2025-05-03T10:00:00",
    "customerCode": "CUST001",
    "customerName": "PT Maju Jaya Logistics",
    "received": false,
    "invoiced": false,
    "plant": "JAKARTA",
    "cityRegency": "Jakarta Selatan",
    "province": "DKI Jakarta"
  }
]
```

### Create Delivery
**Endpoint:** `POST /api/deliveries`

**Authorization:** `delivery:sync` permission required

**Response Body:**
```json
{
  "deliveryNumber": "DLV1001",
  "publicUrl": "http://192.168.110.183/receive/{token}",
  "qrCodeBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

### Get Delivery by Token (Public)
**Endpoint:** `GET /api/deliveries/{token}`

**Authorization:** None (public access via receiver token)

**Response:** Delivery details with lines and photos

---

## Invoices API

### Get All Invoices
**Endpoint:** `GET /api/invoices`

**Authorization:** `invoice:read` permission required

**Response Body:**
```json
[
  {
    "invoiceID": 1,
    "invoiceNumber": "INV001",
    "customerNumber": "CUST001",
    "invoiceAmount": 1500000,
    "invoicedDate": "2025-05-20T00:00:00Z",
    "status": 2,
    "statusText": "Stamped",
    "deliveryNumber": "DLV1001",
    "serialNumber": "EM-2025-123456",
    "stampingStatus": 3,
    "stampingStatusText": "Stamped",
    "stampedDocumentUrl": "http://localhost:8080/api/deliveries/files/download?key=..."
  }
]
```

### Create Invoice
**Endpoint:** `POST /api/invoices`

**Authorization:** `invoice:sync` permission required

**Request Body:**
```json
{
  "invoiceNumber": "INV001",
  "customerNumber": "CUST001",
  "invoiceAmount": 1500000,
  "invoicedDate": "2025-05-20T00:00:00Z",
  "deliveryHeaderId": 1
}
```

### Upload Invoice Printout
**Endpoint:** `POST /api/invoices/{id}/upload-printout`

**Authorization:** `invoice:sync` permission required

**Request:** Multipart form data with file

**Response:**
```json
{
  "documentId": 1,
  "fileName": "invoice.pdf",
  "storageKey": "invoices/1/printouts/{guid}.pdf",
  "downloadUrl": "http://localhost:8080/api/deliveries/files/download?key=...",
  "uploadedAt": "2025-05-20T10:30:00Z"
}
```

### Stamp Invoice with e-Meterai
**Endpoint:** `POST /api/invoices/{id}/stamp`

**Authorization:** `invoice:sync` permission required

**Process:**
1. Downloads the invoice printout from MinIO
2. Calls Peruri PDS API to stamp the PDF
3. Uploads the stamped PDF back to MinIO
4. Updates invoice with serial number and status

**Response:**
```json
{
  "invoiceId": 1,
  "invoiceNumber": "INV001",
  "serialNumber": "EM-2025-123456",
  "status": "Stamped",
  "stampedDocumentUrl": "http://localhost:8080/api/deliveries/files/download?key=..."
}
```

**Errors:**
- `404` - Invoice not found
- `400` - Invoice already stamped or no printout found
- `500` - Stamping failed or server error

---

# External Integrations

## Peruri PDS API (e-Meterai Stamping)

### Configuration
```json
"Periuri": {
  "BaseUrl": "https://api.peruri.go.id",
  "ApiKey": "${PERIURI_API_KEY}"
}
```

### Stamping Flow
1. Upload invoice printout via `/api/invoices/{id}/upload-printout`
2. Call `/api/invoices/{id}/stamp` to initiate stamping
3. System calls Peruri PDS API with PDF file
4. Peruri returns serial number and stamp coordinates
5. Stamped PDF is stored and linked to invoice

### Stamp Coordinates
```csharp
public record StampCoordinates
{
    public int PageNumber { get; init; }  // Page to stamp (default: 1)
    public double X { get; init; }        // X coordinate
    public double Y { get; init; }        // Y coordinate
    public double Width { get; init; }    // Stamp width
    public double Height { get; init; }   // Stamp height
}
```

## SAP ERP Integration

### Configuration
```json
"SapConfig": {
  "BaseUrl": "https://your-sap-server.com",
  "Client": "800",
  "Username": "${SAP_USERNAME}",
  "Password": "${SAP_PASSWORD}"
}
```

### Delivery Confirmation Sync
- Endpoint: `/sap/bc/zrest_doconfirm?sap-client={client}`
- Method: POST
- Authentication: HTTP Basic
- Triggered when customer confirms delivery receipt

### Payload Structure
```json
{
  "customerCode": "CUST001",
  "deliveryNumber": "DLV1001",
  "receiverName": "John Doe",
  "receiverStatus": "1",
  "receiverNotes": "Received in good condition",
  "lines": [
    {
      "deliveryLineNumber": "1",
      "deliveredQuantity": 10.00,
      "rejectedQuantity": 0.00,
      "returnedQuantity": 0.00,
      "lineComment": "Good condition"
    }
  ]
}
```

## MinIO/S3 Storage

### Configuration
```json
"Minio": {
  "Endpoint": "minio:9000",
  "AccessKey": "${MINIO_ACCESS_KEY}",
  "SecretKey": "${MINIO_SECRET_KEY}",
  "BucketName": "amtemeterai-documents"
}
```

### Storage Key Patterns
- Delivery Photos: `deliveries/{deliveryId}/photos/{guid}.{ext}`
- Invoice Printouts: `invoices/{invoiceId}/printouts/{guid}.{ext}`
- Stamped Invoices: `invoices/{invoiceId}/stamped/{guid}_stamped.pdf`

---

# Middleware Pipeline (Program.cs)

```
1. Database Migrations
2. RBAC Seeding (DbInitializer.SeedRbacAsync)
3. Plant Master Data Seeding
4. Default Admin Account Creation
5. Test Role Accounts Creation
6. HTTPS Redirection
7. Swagger Configuration
8. Routing
9. CORS (Dynamic Origins)
10. Authentication (JWT)
11. Authorization
12. Controllers Mapping
```

---

# Database Seeding

## RBAC Seeding (DbInitializer.SeedRbacAsync)

### Seed Sequence
1. **System Roles** - Create sysadmin, finance, warehouse, sales roles
2. **Permissions** - Create 6 default permissions
3. **Application Menus** - Create 4 default menu items
4. **Menu Permissions** - Link menus to required permissions
5. **Role Permissions** - Assign permissions to roles

### Default Admin Account
- Email: `admin@amtemeterai.com`
- Password: `Admin@123`
- Role: `sysadmin`

### Test Accounts
- `finance@amtemeterai.com` (Password: `Testing@123`) - finance role
- `warehouse@amtemeterai.com` (Password: `Testing@123`) - warehouse role
- `sales@amtemeterai.com` (Password: `Testing@123`) - sales role

---

# Security Features

## Authentication Security
- **JWT Token Expiry:** 7 days
- **Security Stamp:** Embedded in token for session revocation
- **Password Requirements:** Minimum 6 characters (configurable)

## Authorization Security
- **Dynamic RBAC:** Runtime permission modification
- **Plant-Level Filtering:** Data isolation by plant assignment
- **Role-Based Menu Visibility:** UI adapts to user permissions
- **API-Level Authorization:** `[Authorize(Roles = "sysadmin")]` attributes

## Data Security
- **Financial Lock:** Deliveries cannot be modified after invoicing
- **PIN Verification:** Server-side validation for delivery access
- **Activity Logging:** Audit trail for all significant operations

## Session Management
- **Security Stamp Update:** When roles/plants change, existing tokens invalidated
- **Token Claims:** All permissions embedded in token for efficient auth checks

---

# CORS Configuration

```json
"Cors": {
  "Origins": [
    "http://localhost:5173",
    "http://localhost:3000"
  ]
}
```

---

# Database Configuration

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

# API Response Codes

| Code | Description |
|------|-------------|
| 200 OK | Request successful |
| 201 Created | Resource created successfully |
| 400 Bad Request | Invalid request data, resource not found, or business rule violation |
| 401 Unauthorized | Invalid credentials or token |
| 403 Forbidden | Insufficient permissions |
| 404 Not Found | Resource not found |
| 409 Conflict | Resource already exists |
| 500 Internal Server Error | Server or storage error |
| 502 Bad Gateway | External service (SAP) failure |

---

# Key Business Logic

## Customer Sync
- Fetches customers from configured `ICustomerSource`
- Upserts all customers using `CustomerService`
- Returns counts of inserted and updated records

## Delivery Create
- Requires valid `CustomerCode`
- Creates new `DeliveryHeader` with unique `ReceiverToken`
- Creates all `DeliveryLine` records
- Generates `PublicUrl` and `QrCodeBase64`
- `DeliveryNumber` must be unique

## Delivery Confirmation
- Accessible only via `ReceiverToken`
- Guard: Rejects updates if delivery is invoiced
- Sets `Received = true` on update
- Auto-calculates status (FullyReceived/PartialReceived)
- Updates GPS coordinates and reverse geocodes
- Uploads/deletes photos in MinIO
- Syncs confirmation to SAP ERP

## Invoice Stamping
- Downloads printout PDF from MinIO
- Calls Peruri PDS API for stamping
- Uploads stamped PDF to MinIO
- Updates invoice with serial number and status

## User Permission Updates
- Replaces all plant assignments for user
- Replaces all role assignments for user
- Updates security stamp (invalidates existing tokens)
- Affects all active sessions for the user

---

# Development Notes

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

# Swagger Configuration

- Swagger JSON endpoint: `/api/swagger/v1/swagger.json`
- Swagger UI: `/api/swagger`

---

# Services Architecture

### IStorageService Interface
```csharp
Task<string> UploadFileAsync(string objectKey, Stream fileStream, string contentType);
Task<Stream> GetFileStreamAsync(string storageKey);
Task<string> GetPresignedUrlAsync(string objectKey, double expiryMinutes = 60);
Task DeleteFileAsync(string storageKey);
```

### IPeriuriPdsService Interface
```csharp
Task<PeriuriStampingResult> StampPdfAsync(byte[] pdfContent, string invoiceNumber, string customerName);
Task<PeriuriStampingStatusResponse> CheckStampingStatusAsync(string transactionId);
```

### IEmailService Interface
```csharp
Task SendEmailAsync(string to, string subject, string htmlBody);
Task SendDeliveryConfirmationAsync(string email, string deliveryNumber, string receiverName);
```

---

# Root Scripts (Concurrent Development)

| Command | Description |
|---------|-------------|
| `npm run dev` | Runs both backend and frontend concurrently |
| `npm run dev:backend` | Runs backend only (`dotnet run`) |
| `npm run dev:frontend` | Runs frontend only (`npm run dev` in frontend directory) |

---
