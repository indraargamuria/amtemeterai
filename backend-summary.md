# OpexNOW Backend API Documentation

## Overview

The backend is built with **ASP.NET Core 8.0** using **Entity Framework Core** with **PostgreSQL** database. It provides RESTful APIs for managing customers, deliveries, invoices, and e-Meterai operations in the delivery management system with **JWT Bearer Token Authentication** and a **Dynamic Role-Based Access Control (RBAC)** system. The system includes advanced features such as photo evidence management, GPS location tracking, document storage via MinIO, activity logging, Peruri PDS integration for e-Meterai stamping, plant-level data security, delivery cancellation, and PIN-based access verification.

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
5. Frontend polls `/api/account/me` every 60 seconds for session validation

### Default Accounts

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| sysadmin | admin@amtemeterai.com | Admin@123 | Full system access |
| finance | finance@amtemeterai.com | Testing@123 | Finance operations (dashboard:read, customer:read) |
| warehouse | warehouse@amtemeterai.com | Testing@123 | Warehouse operations (delivery:read) |
| sales | sales@amtemeterai.com | Testing@123 | Sales operations (dashboard:read, customer:read, invoice:read, delivery:read) |

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
    "permission": ["dashboard:read", "customer:read", "delivery:read", "invoice:read", "uam:read"],
    "menu": ["dashboard", "customers", "invoices", "deliveries", "uam"],
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
- `permission` - Granular permission keys for authorization checks (multiple)
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
| `finance` | Finance Staff | Dashboard read, Customer read |
| `warehouse` | Warehouse Staff | Delivery read |
| `sales` | Sales Staff | Dashboard read, Customer read, Invoice read, Delivery read |

## Permission Matrix

### Permission Keys

| ID | Permission Key | Description | Category |
|----|----------------|-------------|----------|
| 1 | `dashboard:read` | View dashboard with KPIs and analytics | Dashboard |
| 2 | `customer:read` | View customer list and profiles | Customers |
| 3 | `customer:sync` | Sync customer data from ERP system | Customers |
| 4 | `invoice:read` | View invoice records | Invoices |
| 5 | `invoice:sync` | Sync invoices from ERP system | Invoices |
| 6 | `delivery:read` | View delivery headers and details | Deliveries |
| 7 | `delivery:sync` | Sync deliveries from ERP system | Deliveries |
| 8 | `uam:read` | View system roles and permission matrices | Access Control |
| 9 | `uam:sync` | Modify and write role permissions to database | Access Control |

### Default Role Permissions

| Role | Permissions |
|------|-------------|
| `sysadmin` | All permissions (1-9) |
| `finance` | dashboard:read, customer:read |
| `warehouse` | delivery:read |
| `sales` | dashboard:read, customer:read, invoice:read, delivery:read |

## Application Menus

### Menu Structure

| ID | Menu Key | Label | Path | Icon | Required Permission |
|----|----------|-------|------|------|---------------------|
| 1 | `dashboard` | Dashboard | `/` | LayoutDashboard | dashboard:read |
| 2 | `customers` | Customers | `/customers` | Users | customer:read |
| 3 | `invoices` | Invoices | `/invoices` | FileText | invoice:read |
| 4 | `deliveries` | Deliveries | `/deliveries` | Package | delivery:read |
| 5 | `uam` | Access Management | `/admin/uam` | ShieldAlert | uam:read |

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
- Non-sysadmin users without plant assignments see no data

### Seeded Plants
The system seeds 32 plant codes including:
- `0001` - Werk 0001
- `B1G2` - Garment Tangerang Non KB
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
| ShipToAddress | string? | Ship to address |
| OrderNumber | string? | Order number from ERP (hidden from warehouse role) |
| BuyerPONumber | string? | Buyer PO number (hidden from warehouse role) |
| ReceiverToken | Guid | Unique token for receiver access |
| ReceiverName | string? | Name of receiver (nullable) |
| ReceiverNotes | string? | Receiver notes (nullable) |
| Received | bool | Delivery received status |
| ReceiveDate | DateTime? | Date when delivery was confirmed (nullable) |
| Invoiced | bool | Invoice status |
| Plant | string? | Plant/location identifier |
| SalesPersonName | string? | Sales person name |
| SalesPersonEmail | string? | Sales person email |
| Type | DeliveryType (Enum) | Delivery type (BC=1, NonBC=2) |
| Status | ReceiverStatus? (Enum) | Receiver status (FullyReceived=1, PartialReceived=2, Canceled=3) |
| Latitude | double? | GPS latitude coordinate |
| Longitude | double? | GPS longitude coordinate |
| Province | string? | Administrative province |
| CityRegency | string? | Administrative city/regency |
| District | string? | Administrative district |
| FormattedAddress | string? | Full formatted address string |
| CancelReason | string? | Reason for cancellation |

**Relationships:**
- Many-to-One with `Customer`
- One-to-Many with `DeliveryLine` (Lines)
- One-to-Many with `Document` (Photos)
- One-to-Many with `Invoice`

**Enums:**
```csharp
public enum DeliveryType { BC = 1, NonBC = 2 }
public enum ReceiverStatus { FullyReceived = 1, PartialReceived = 2, Canceled = 3 }
```

## DeliveryLine

| Column | Type | Precision | Description |
|--------|------|-----------|-------------|
| DeliveryLineID | int (PK) | - | Primary Key |
| DeliveryID | int (FK) | - | Foreign Key to DeliveryHeader |
| DeliveryLineNumber | string | - | Line number |
| DeliveryItemCode | string | - | Item code |
| DeliveryItemDescription | string | - | Item description |
| BatchNumber | string? | - | Batch number |
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
│   ├── SapSimulationController.cs  # Simulated SAP billing endpoint
│   ├── TestController.cs           # Test endpoints for settlement processing
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
│   ├── DeliveryLineResponseDto.cs
│   ├── DeliveryPhotoResponseDto.cs
│   ├── DeliveryEditConfirmationDto.cs
│   ├── InvoiceResponseDto.cs
│   ├── InvoiceCreateDto.cs
│   ├── PinRequestDto.cs
│   ├── RequestPinDto.cs
│   ├── CancelDeliveryDto.cs
│   ├── SapDeliveryConfirmationDto.cs
│   ├── SapBillingRequestDto.cs     # SAP billing simulation request/response
│   ├── DeliverySettlementResponseDto.cs # Settlement processing response
│   ├── PeruriApiDtos.cs           # Peruri API request/response DTOs
│   ├── GoogleGeocodeResponse.cs
│   └── GeoLocationResult.cs
├── Data/                           # Database Context
│   ├── AppDbContext.cs
│   ├── AppDbContextFactory.cs
│   └── DbInitializer.cs           # RBAC & Master Data Seeding
├── Services/                       # Business Logic Layer
│   ├── CustomerService.cs
│   ├── ICustomerSource.cs
│   ├── DummyCustomerSource.cs
│   ├── ErpCustomerSource.cs
│   ├── IStorageService.cs
│   ├── MinioStorageService.cs
│   ├── IPeriuriPdsService.cs       # e-Meterai cloud integration
│   ├── PeriuriPdsService.cs
│   ├── IPeruriSessionService.cs    # Peruri JWT session management
│   ├── PeruriSessionService.cs
│   ├── IPeruriOnPremiseStampService.cs # On-premise e-Meterai stamping
│   ├── PeruriOnPremiseStampService.cs
│   ├── IEmailService.cs
│   ├── EmailService.cs
│   └── BillingBackgroundService.cs # Background invoice creation
├── Helpers/                        # Helper Utilities
│   └── QrCodeHelper.cs
├── Config/                         # Configuration Options
│   ├── SapOptions.cs
│   ├── PeruriOptions.cs           # Peruri on-premise configuration
│   └── SmtpSettings.cs
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
- Token includes role, plant, permission, and menu claims

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

**Notes:**
- Returns a new token with updated claims
- Used by frontend for session validation polling

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
    "customerEmail": "contact@majujaya.co.id",
    "customerPin": "123456"
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

**Plant-Level Security:** Non-sysadmin users only see deliveries from their assigned plants

**Role-Based Data Filtering:**
- **Warehouse role users:** `customerCode` and `customerName` are returned as empty strings (confidential)
- **Other roles:** Full customer information is included

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
    "receiveDate": null,
    "invoiced": false,
    "plant": "B1G2",
    "cityRegency": "Jakarta Selatan",
    "province": "DKI Jakarta",
    "type": 1,
    "status": 1,
    "isCanceled": false,
    "cancelReason": null,
    "salesPersonName": "John Doe",
    "salesPersonEmail": "john@example.com",
    "photosCount": 3
  }
]
```

### Get Delivery by ID
**Endpoint:** `GET /api/deliveries/{deliveryId}`

**Authorization:** `delivery:read` permission required

**Plant-Level Security:** Users can only view deliveries from their assigned plants

**Role-Based Data Filtering:**
- **Warehouse role users:** `customerCode`, `customerName`, `orderNumber`, and `buyerPONumber` are hidden/empty
- **Other roles:** All fields including `orderNumber` and `buyerPONumber` are included

**Response:** Full delivery details with lines and photos

### Create Delivery
**Endpoint:** `POST /api/deliveries`

**Authorization:** `delivery:sync` permission required

**Request Body:**
```json
{
  "customerCode": "CUST001",
  "deliveryNumber": "DLV1001",
  "deliveryDate": "2025-05-03T10:00:00",
  "deliveryRemarks": "Urgent delivery",
  "plant": "B1G2",
  "salesPersonName": "John Doe",
  "salesPersonEmail": "john@example.com",
  "orderNumber": "SO12345",
  "buyerPONumber": "PO67890",
  "type": 1,
  "lines": [
    {
      "deliveryLineNumber": "1",
      "deliveryItemCode": "ITEM001",
      "deliveryItemDescription": "Product A",
      "batchNumber": "BATCH123",
      "salesQuantity": 100,
      "salesUOM": "PCS",
      "packQuantity": 10,
      "packUOM": "ROLL"
    }
  ]
}
```

**Response Body:**
```json
{
  "deliveryNumber": "DLV1001",
  "publicUrl": "http://192.168.110.183/receive/{token}",
  "qrCodeBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

### Update Delivery (by Token)
**Endpoint:** `PATCH /api/deliveries/{token}`

**Authorization:** None (public access via receiver token)

**Request:** Multipart form data with delivery confirmation, photos, GPS coordinates, and receive date

**Request Fields:**
- `ReceiverName` (required): Name of the person receiving the delivery
- `ReceiverNotes` (optional): Additional notes about the delivery
- `ReceiveDate` (optional): Date when delivery was received (defaults to current UTC timestamp if not provided, validated to prevent future dates)
- `Latitude`/`Longitude`: GPS coordinates
- `Lines[]`: Array of line item confirmations
- `NewPhotoFiles`: Photos to upload
- `KeysToDelete`: Photos to delete

**Notes:**
- Validates PIN before allowing access
- Records delivery confirmation with GPS coordinates
- Sets `receiveDate` to provided date or current UTC timestamp when delivery is confirmed
- Performs reverse geocoding for address
- Syncs to SAP ERP

### Get Delivery by Token (Public)
**Endpoint:** `GET /api/deliveries/{token}`

**Authorization:** None (public access via receiver token)

**Response:** Delivery details with lines and photos, including `receiveDate` if delivery has been confirmed

### Verify PIN
**Endpoint:** `POST /api/deliveries/{token}/verify-pin`

**Authorization:** None (public access)

**Request Body:**
```json
{
  "pin": "123456"
}
```

**Response:**
```json
{
  "valid": true
}
```

### Request PIN
**Endpoint:** `POST /api/deliveries/public/request-pin`

**Authorization:** None (public access)

**Request Body:**
```json
{
  "receiverToken": "guid-token"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification PIN dispatched successfully.",
  "sentTo": "j***@example.com"
}
```

**Notes:**
- Sends PIN to customer's email
- Email address is masked in response

### Cancel Delivery
**Endpoint:** `POST /api/deliveries/cancel/{deliveryNumber}`

**Authorization:** Required

**Request Body:**
```json
{
  "reason": "Customer request cancellation"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Delivery DLV1001 has been successfully canceled and reason recorded."
}
```

**Business Rules:**
- Cannot cancel invoiced deliveries
- Cannot cancel already confirmed deliveries
- Sets status to Canceled
- Clears receiver token
- Records cancellation reason

### Upload Delivery Printout (by ID - Legacy)
**Endpoint:** `POST /api/deliveries/{deliveryId}/upload-printout`

**Authorization:** Required

**Request:** Multipart form data with file

**Response:**
```json
{
  "documentId": 1,
  "fileName": "delivery.pdf",
  "storageKey": "deliveries/1/printouts/{guid}.pdf",
  "downloadUrl": "http://localhost:8080/api/deliveries/files/download?key=...",
  "uploadedAt": "2025-05-20T10:30:00Z"
}
```

### Upload Delivery Printout (by Number - SAP Native)
**Endpoint:** `POST /api/deliveries/by-number/{deliveryNumber}/upload-printout`

**Authorization:** Required

**Request:** Multipart form data with file

**Response:**
```json
{
  "documentId": 1,
  "fileName": "delivery.pdf",
  "storageKey": "deliveries/{deliveryId}/printouts/{guid}.pdf",
  "downloadUrl": "http://localhost:8080/api/deliveries/files/download?key=...",
  "uploadedAt": "2025-05-20T10:30:00Z"
}
```

**Notes:**
- Uses SAP-native business key (deliveryNumber) instead of internal database ID
- Preferred method for SAP integration
- Accepts PDF and image files

### Download File
**Endpoint:** `GET /api/deliveries/files/download?key={storageKey}`

**Authorization:** None (public access for delivery photos)

**Response:** File stream

### Seed Test Deliveries (Dev Only)
**Endpoint:** `POST /api/deliveries/dev/seed-deliveries`

**Authorization:** Development only

**Response:**
```json
{
  "created": 20,
  "status": "All deliveries are on-going (not delivered)",
  "message": "Successfully seeded 20 deliveries with 85 total lines"
}
```

### Create SAP Invoice (Production) - Idempotent
**Endpoint:** `POST /api/deliveries/{deliveryNumber}/invoice`

**Authorization:** Required

**Request Parameters:**
- `deliveryNumber` (route parameter): The delivery number to create invoice for

**Process Flow (Idempotent):**
1. Validates delivery exists in the database
2. **Idempotency Check:** Checks if an invoice already exists in the `Invoices` table for this delivery (via `DeliveryHeaderId`)
   - **Case A (New Billing):** If no existing invoice, proceeds to call SAP billing endpoint
   - **Case B (Re-sync):** If existing invoice found, returns existing invoice data without calling SAP API
3. For new billing: Sends POST request to SAP billing endpoint: `http://10.2.38.138:8000/sap/bc/zr_createinv?sap-client=250`
4. Returns error if SAP server responds with non-success status
5. Creates invoice record and marks delivery as invoiced in a transaction
6. Logs activity for audit trail

**Request Body:**
```json
{
  "deliveryNumber": "DLV1001"
}
```

**Response Body (New Invoice Created):**
```json
{
  "success": true,
  "message": "SAP Invoice SAP-INV-20250520123456 created successfully.",
  "invoiceNumber": "SAP-INV-20250520123456",
  "invoiceAmount": 1500000,
  "billingDate": "2025-05-20T10:30:00Z",
  "deliveryNumber": "DLV1001"
}
```

**Response Body (Existing Invoice - Re-sync):**
```json
{
  "success": true,
  "message": "Invoice already created previously",
  "invoiceNumber": "SAP-INV-20250520123456",
  "invoiceAmount": 1500000,
  "billingDate": "2025-05-20T10:30:00Z",
  "deliveryNumber": "DLV1001"
}
```

**Error Responses:**
- `404 Not Found` - Delivery not found
- `502 Bad Gateway` - SAP server error with details

**Business Rules:**
- **Idempotent Execution:** Endpoint can be safely called multiple times for the same delivery
- **Local Database Check:** Pre-flight check in `Invoices` table prevents duplicate SAP API calls
- **Re-sync Support:** Returns existing invoice data without calling SAP API
- Uses clean HTTP client instance (not named client) to avoid base address issues
- All database operations wrapped in transaction for atomicity
- Returns same data structure as settlement simulation for consistency

---

## SAP Simulation API

### Generate Simulated Billing
**Endpoint:** `POST /api/sap-sim/billing`

**Authorization:** Required

**Request Body:**
```json
{
  "deliveryNumber": "DLV1001"
}
```

**Response Body:**
```json
{
  "sapInvoiceNumber": "SAP-INV-20250520123456",
  "billingDate": "2025-05-20T10:30:00Z",
  "amount": 1500000,
  "currency": "IDR",
  "customerNumber": "CUST001",
  "customerName": "PT Maju Jaya Logistics",
  "poNumber": "PO67890",
  "deliveryNumber": "DLV1001"
}
```

**Notes:**
- Simulates the future SAP billing endpoint contract
- Calculates invoice amount from delivery lines
- Generates unique SAP invoice number
- Used for development and testing until SAP endpoint is ready

---

## Test API (sysadmin only)

### Process Delivery Settlement
**Endpoint:** `POST /api/test/deliveries/{deliveryNumber}/process-settlement`

**Authorization:** `sysadmin` role required

**Process Flow:**
1. **Step A**: Calls SAP simulation endpoint to generate invoice details
2. **Step B**: Uploads dummy PDF as delivery printout
3. **Step C**: Creates invoice record and marks delivery as invoiced

**Response Body:**
```json
{
  "success": true,
  "message": "Settlement completed successfully. Invoice SAP-INV-20250520123456 created.",
  "invoiceNumber": "SAP-INV-20250520123456",
  "invoiceAmount": 1500000,
  "billingDate": "2025-05-20T10:30:00Z",
  "documentId": 123,
  "storageKey": "deliveries/1/printouts/{guid}.pdf",
  "downloadUrl": "http://localhost:8080/api/deliveries/files/download?key=...",
  "deliveryNumber": "DLV1001"
}
```

**Business Rules:**
- Can only process deliveries that are not yet invoiced
- All database operations are wrapped in a transaction
- Creates activity logs for success/failure

### Get Available Deliveries for Settlement
**Endpoint:** `GET /api/test/deliveries/available-for-settlement`

**Authorization:** `sysadmin` role required

**Response Body:**
```json
[
  {
    "deliveryID": 1,
    "deliveryNumber": "DLV1001",
    "deliveryDate": "2025-05-20T10:00:00Z",
    "customerCode": "CUST001",
    "customerName": "PT Maju Jaya Logistics",
    "plant": "B1G2",
    "lineCount": 5
  }
]
```

**Notes:**
- Returns only deliveries that are fully received and not yet invoiced
- Useful for finding candidates for settlement processing

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
    "hasPrintoutDocument": true,
    "stampedDocumentUrl": "http://localhost:8080/api/deliveries/files/download?key=..."
  }
]
```

### Get Invoice by ID
**Endpoint:** `GET /api/invoices/{id}`

**Authorization:** `invoice:read` permission required

**Response:** Full invoice details

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

**Response:** Created invoice with location header

**Notes:**
- Marks linked delivery as invoiced
- Cannot link to already invoiced delivery

### Upload Invoice Printout (by ID - Legacy)
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

### Upload Invoice Printout (by Number - SAP Native)
**Endpoint:** `POST /api/invoices/by-number/{invoiceNumber}/upload-printout`

**Authorization:** `invoice:sync` permission required

**Request:** Multipart form data with file

**Response:**
```json
{
  "documentId": 1,
  "fileName": "invoice.pdf",
  "storageKey": "invoices/{invoiceId}/printouts/{guid}.pdf",
  "downloadUrl": "http://localhost:8080/api/deliveries/files/download?key=...",
  "uploadedAt": "2025-05-20T10:30:00Z"
}
```

**Notes:**
- Uses SAP-native business key (invoiceNumber) instead of internal database ID
- Preferred method for SAP integration
- Accepts PDF and image files

### Stamp Invoice with e-Meterai
**Endpoint:** `POST /api/invoices/{id}/stamp`

**Authorization:** `invoice:sync` permission required

**Process:**
1. Validates invoice has printout
2. Sets stamping status to Pending
3. Downloads the invoice printout from MinIO
4. Calls Peruri PDS API to stamp the PDF
5. Uploads the stamped PDF back to MinIO
6. Updates invoice with serial number and status

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

### Stamp Invoice by SAP Number (Preferred for SAP Integration)
**Endpoint:** `POST /api/invoices/by-sap-number/{invoiceNumber}/stamp`

**Authorization:** `invoice:sync` permission required

**Process:**
1. Validates invoice has printout
2. Sets stamping status to Pending
3. Downloads the invoice printout from MinIO
4. If on-premise Peruri is configured:
   - Writes PDF to shared folder (`/sharefolder/UNSIGNED/{invoiceNumber}.pdf`)
   - Gets JWT token from Peruri session service
   - Calls Peruri Stamp v2 API to get serial number and QR code
   - Decodes QR code and saves to shared folder
   - Calls Docker KeyStamp adapter for signing
   - Reads signed PDF from shared folder
   - Cleans up transient files
5. If on-premise is not configured, falls back to cloud Peruri PDS API
6. Uploads the stamped PDF back to MinIO
7. Updates invoice with serial number and status

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

### Cloud Configuration (Legacy)
```json
"Periuri": {
  "BaseUrl": "https://api.peruri.go.id",
  "ApiKey": "${PERIURI_API_KEY}"
}
```

### On-Premise Configuration (New - WP2 - Corrected)
```json
"Peruri": {
  "BackendStg": "https://backendservicestg.e-meterai.co.id",
  "Stampv2Stg": "https://stampv2stg.e-meterai.co.id",
  "InventoryStg": "https://inventory.peruri.co.id",
  "User": "${PERIURI_USER}",
  "Password": "${PERIURI_PASSWORD}",
  "KeyStamp": "http://localhost:9999",
  "SharedFolder": "/sharefolder",
  "TokenExpiryBufferMinutes": 5
}
```

**Properties (Corrected - WP2):**
- `BackendStg`: Peruri backend staging URL for user authentication
  - Full endpoint: `POST https://backendservicestg.e-meterai.co.id/api/users/login`
- `Stampv2Stg`: Peruri stamp v2 staging URL for e-meterai allotment
  - Full endpoint: `POST https://stampv2stg.e-meterai.co.id/chanel/stampv2`
- `InventoryStg`: Peruri inventory staging URL for inventory management
- `User`: Peruri service account username
- `Password`: Peruri service account password
- `KeyStamp`: KeyStamp Docker adapter URL for on-premise PDF signing
  - Full endpoint: `POST http://localhost:9999/adapter/pdfsigning/rest/docSigningZ`
- `SharedFolder`: Shared folder path for Docker volume
- `TokenExpiryBufferMinutes`: Token expiry buffer in minutes

### Cloud Stamping Flow (Legacy)
1. Upload invoice printout via `/api/invoices/{id}/upload-printout`
2. Call `/api/invoices/{id}/stamp` to initiate stamping
3. System calls Peruri PDS API with PDF file
4. Peruri returns serial number and stamp coordinates
5. Stamped PDF is stored and linked to invoice

### On-Premise Stamping Flow (New - WP2 - Corrected)
1. Upload invoice printout via `/api/invoices/{id}/upload-printout`
2. Call `/api/invoices/by-sap-number/{invoiceNumber}/stamp` to initiate stamping
3. System authenticates with Peruri backend to get JWT token (cached)
   - Endpoint: `POST https://backendservicestg.e-meterai.co.id/api/users/login`
4. System writes PDF to shared folder: `/sharefolder/UNSIGNED/{invoiceNumber}.pdf`
5. System calls Peruri Stamp v2 API with JWT token to get:
   - Serial Number (`result.sn`)
   - QR Code image (Base64 `result.filenameQR`)
   - Endpoint: `POST https://stampv2stg.e-meterai.co.id/chanel/stampv2`
6. System decodes QR code and saves to: `/sharefolder/STAMP/{invoiceNumber}_qr.png`
7. System calls KeyStamp Docker adapter with signing coordinates
   - Endpoint: `POST http://localhost:9999/adapter/pdfsigning/rest/docSigningZ`
8. Docker adapter stamps the PDF and saves to: `/sharefolder/SIGNED/stamped_{invoiceNumber}.pdf`
9. System reads signed PDF and uploads to MinIO
10. System cleans up transient files
11. Stamped PDF is stored and linked to invoice with serial number

### Peruri API Request Business Rules (WP2 - Dynamic Mappings with Safe Fallbacks)

The Peruri Stamp v2 request payload uses dynamic business mappings derived from invoice records with safe fallbacks to ensure process reliability:

| Field | Source | Mapping Rule | Fallback |
|-------|--------|--------------|----------|
| `nodoc` | `invoice.InvoiceID` | Internal database Primary Key (string) | `"0"` |
| `namedipungut` | `request.CustomerName` | Customer name (as-is for compatibility) | `"Customer"` |
| `namejidentitas` | - | Hardcoded to `"NPWP"` for business invoices | `"NPWP"` |
| `noidentitas` | `request.CustomerNumber` | Customer's Tax ID / NPWP number | `"-"` |
| `namafile` | `invoiceNumber` | Sanitize: Remove special chars + `.pdf` | `"Invoice.pdf"` |
| `nilaidoc` | `request.Amount` | Invoice amount (no decimals) | `"0"` |
| `tgldoc` | `invoice.InvoicedDate` | Format: `yyyy-MM-dd` | Today's date |
| `namadoc` | - | Hardcoded to `"4b"` (Invoice/Faktur code) | `"4b"` |
| `isUpload` | - | Hardcoded to `false` | `false` |
| `snOnly` | - | Hardcoded to `false` (returns SN + image) | `false` |

**Implementation Notes:**
- All dynamic mappings include safe fallbacks to prevent API failures when source data is missing
- `namedipungut` currently uses raw customer name for compatibility (can be enhanced with Title Case + space removal in future)
- The response parsing and QR upload code is commented out to conserve Peruri quota during development

**Helper Methods:**
- `SanitizeFileName(string invoiceNumber)`: Removes all non-alphanumeric characters using regex with `"Invoice.pdf"` fallback on error

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
      "lineComment": "Good condition",
      "variancePercent": 0.0
    }
  ]
}
```

**VariancePercent Calculation:**
```csharp
decimal totalActual = PackQuantityDelivered + PackQuantityReturned + PackQuantityRejected;
decimal rawVariance = totalActual - PackQuantity;
decimal percentCalc = PackQuantity > 0 ? (rawVariance / PackQuantity) * 100 : 0;
// Returns numeric value only (e.g., 200 for 200%, 12.5 for 12.5%)
```

### SAP Invoice Creation
- Endpoint: `POST /api/deliveries/{deliveryNumber}/invoice`
- SAP Billing URL: `http://10.2.38.138:8000/sap/bc/zr_createinv?sap-client=250`
- Method: POST
- Authentication: None specified (uses clean HTTP client)
- Triggered manually to create SAP invoice for a delivery

**Request Payload:**
```json
{
  "deliveryNumber": "DLV1001"
}
```

**Response from SAP:**
```json
{
  "sapInvoiceNumber": "SAP-INV-20250520123456",
  "billingDate": "2025-05-20T10:30:00Z",
  "amount": 1500000,
  "currency": "IDR",
  "customerNumber": "CUST001",
  "customerName": "PT Maju Jaya Logistics",
  "poNumber": "PO67890",
  "deliveryNumber": "DLV1001"
}
```

**Business Rules:**
- Can only invoice deliveries that are not yet invoiced
- Uses transaction to ensure atomic database updates
- Marks delivery as `Invoiced = true`
- Creates `Invoice` record with `Draft` status
- Logs activity as `SapInvoiceCreated` on success

## Google Maps Geocoding

### Configuration
```json
"GoogleMaps": {
  "ApiKey": "${GOOGLE_MAPS_API_KEY}"
}
```

### Reverse Geocoding
- Called when delivery is confirmed with GPS coordinates
- Converts lat/lng to Province, CityRegency, District, and FormattedAddress
- Results stored in delivery record

## MinIO/S3 Storage

### Configuration
```json
"Minio": {
  "Endpoint": "minio:9000",
  "AccessKey": "${MINIO_ACCESS_KEY}",
  "SecretKey": "${MINIO_SECRET_KEY}",
  "BucketName": "amtemeterai-documents",
  "Secure": false
}
```

**Properties:**
- `Endpoint`: MinIO server address (host:port format)
- `AccessKey`: S3-compatible access key
- `SecretKey`: S3-compatible secret key
- `BucketName`: Storage bucket name
- `Secure`: Use HTTPS (true) or HTTP (false)

### Storage Key Patterns
- Delivery Photos: `deliveries/{deliveryId}/photos/{guid}.{ext}`
- Delivery Printouts: `deliveries/{deliveryNumber}/printouts/{guid}.{ext}` (uses descriptive delivery number)
- Invoice Printouts: `invoices/{invoiceNumber}/printouts/{guid}.{ext}` (uses descriptive invoice number)
- Stamped Invoices: `invoices/{invoiceId}/stamped/{guid}_stamped.pdf`

## Email Service

### Configuration
```json
"SmtpSettings": {
  "Server": "${SMTP_SERVER}",
  "Port": 587,
  "EnableSsl": true,
  "Username": "${SMTP_USERNAME}",
  "Password": "${SMTP_PASSWORD}",
  "SenderEmail": "noreply@amtemeterai.com",
  "SenderName": "AmtemeterAI System"
}
```

### Email Types
- PIN Request Email - Sends customer PIN for delivery access
- Delivery Confirmation Email - Sent after delivery is confirmed

## Billing Background Service

### Overview
A background service that automatically creates invoices for received deliveries after a configurable delay period.

### Configuration
```json
"BillingSync": {
  "DelayMinutes": 30,
  "CheckIntervalMinutes": 5
}
```

### Process Flow
1. **Periodic Check**: Service runs every `CheckIntervalMinutes` (default: 5 minutes)
2. **Find Eligible Deliveries**: Finds deliveries that:
   - Have been received (Status: FullyReceived or PartialReceived)
   - Were received before the cutoff time (UTC now - `DelayMinutes`)
   - Are not yet invoiced
3. **Create Invoice**: For each eligible delivery:
   - Builds SAP billing payload
   - Calls SAP billing API (simulated in current implementation)
   - Creates Invoice record with `Draft` status
   - Marks delivery as `Invoiced`
   - Logs activity as `BillingSyncSuccess` or `BillingSyncFailed`
4. **Error Handling**: Failed deliveries are logged but don't stop the process

### Business Rules
- Only processes deliveries received at least `DelayMinutes` ago
- Creates invoice numbers in format: `INV-{yyyyMMdd}-{DeliveryID:D6}`
- Calculates invoice amount from delivery lines
- Marks delivery as invoiced after successful invoice creation

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
2. **Permissions** - Create 9 default permissions
3. **Application Menus** - Create 5 default menu items
4. **Menu Permissions** - Link menus to required permissions
5. **Role Permissions** - Assign permissions to roles

### Default Admin Account
- Email: `admin@amtemeterai.com`
- Password: `Admin@123`
- Role: `sysadmin`

### Test Accounts
- `finance@amtemeterai.com` (Password: `Testing@123`) - finance role, assigned to plant B1G2
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
- **Permission-Based Authorization:** Granular permission checks via `permission` claims

## Data Security
- **Financial Lock:** Deliveries cannot be modified after invoicing
- **PIN Verification:** Server-side validation for delivery access
- **Activity Logging:** Audit trail for all significant operations
- **Plant-Level Data Isolation:** Non-sysadmin users only see assigned plant data

## Session Management
- **Security Stamp Update:** When roles/plants change, existing tokens invalidated
- **Token Claims:** All permissions embedded in token for efficient auth checks
- **Session Polling:** Frontend polls `/api/account/me` for validation

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
| 403 Forbidden | Insufficient permissions or plant access |
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
- Guard: Rejects updates if delivery is already canceled
- Sets `Received = true` on update
- Auto-calculates status (FullyReceived/PartialReceived)
- Updates GPS coordinates and reverse geocodes
- Uploads/deletes photos in MinIO
- Syncs confirmation to SAP ERP
- Sends confirmation email to customer

## Delivery Cancellation
- Can only be performed before delivery is received
- Cannot cancel invoiced deliveries
- Sets status to Canceled
- Clears receiver token
- Records cancellation reason
- Logs cancellation activity

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

## PIN Request Workflow
- Validates receiver token
- Checks customer has email and PIN configured
- Sends PIN to customer's email
- Masks email address in response
- Logs PIN request activity

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

### IPeriuriPdsService Interface (Cloud)
```csharp
Task<PeriuriStampingResult> StampPdfAsync(byte[] pdfContent, string invoiceNumber, string customerName);
Task<PeriuriStampingStatusResponse> CheckStampingStatusAsync(string transactionId);
```

### IPeruriSessionService Interface (On-Premise)
```csharp
Task<string> GetAuthTokenAsync();      // Returns cached JWT token if valid, otherwise refreshes
Task<string> RefreshTokenAsync();     // Forces token refresh
```

### IPeruriOnPremiseStampService Interface (On-Premise)
```csharp
Task<PeruriStampResult> StampInvoiceAsync(PeruriStampRequest request);
// Handles complete on-premise flow: PDF prep, Peruri API, Docker signing, cleanup

// Business Rule Helper Method:
string SanitizeFileName(string invoiceNumber);
// Removes special characters with safe fallback: "INV/2026-009" → "INV2026009.pdf"
// Falls back to "Invoice.pdf" on empty input or error

// Dynamic Mappings (Peruri Stamp v2 Request) with Safe Fallbacks:
// - nodoc → invoice.InvoiceID > 0 ? invoice.InvoiceID.ToString() : "0"
// - namedipungut → CustomerName ?? "Customer"
// - namejidentitas → "NPWP" (hardcoded)
// - noidentitas → CustomerNumber ?? "-"
// - namafile → SanitizedFileName(invoiceNumber)
// - nilaidoc → Amount > 0 ? Amount.ToString("F0") : "0"
// - tgldoc → InvoicedDate.ToString("yyyy-MM-dd") ?? DateTime.Today.ToString("yyyy-MM-dd")
```

### IEmailService Interface
```csharp
Task SendEmailAsync(string to, string subject, string htmlBody);
Task SendDeliveryConfirmationEmailAsync(int deliveryId);
Task SendPinEmailAsync(string to, string pin, string deliveryNumber);
```

### ICustomerSource Interface
```csharp
Task<IEnumerable<Customer>> GetCustomersAsync();
```

---

# Root Scripts (Concurrent Development)

| Command | Description |
|---------|-------------|
| `npm run dev` | Runs both backend and frontend concurrently |
| `npm run dev:backend` | Runs backend only (`dotnet run`) |
| `npm run dev:frontend` | Runs frontend only (`npm run dev` in frontend directory) |

---

# Summary

The AmtemeterAI backend is a modern, enterprise-grade ASP.NET Core application with:
- **Dynamic RBAC** with permission-based authorization
- **Plant-level data security** for operational users
- **JWT authentication** with session monitoring
- **Real-time ERP integration** with SAP
- **SAP billing simulation** for development/testing
- **Delivery settlement processing** with automated invoice generation
- **e-Meterai stamping** via Peruri PDS
- **Document storage** via MinIO
- **GPS tracking** with reverse geocoding
- **Activity logging** for audit trails
- **Email notifications** for delivery confirmations
- **PIN-based access** for public delivery links
- **Delivery cancellation** workflow
- **Background billing service** for automatic invoice creation
- **Production-ready** Docker deployment
