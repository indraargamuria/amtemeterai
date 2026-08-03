# OpexNOW / e-meterai - System Architecture

## Project Overview

**OpexNOW / e-meterai** is an Integration Layer and Low-Code Connector for ERP systems (Epicor/SAP), providing a unified delivery and invoice management platform with e-Meterai compliance stamping for Indonesian tax regulations.

---

## Container Topology

### Unified Docker Stack Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Docker Network (amtemeterai_default)             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐         ┌──────────────┐                         │
│  │   frontend   │────────▶│ reverse-proxy│───[Port 80]───▶ External │
│  │  (React 19)  │         │   (Nginx)    │                         │
│  └──────────────┘         └──────┬───────┘                         │
│                                   │                                 │
│                          ┌────────▼────────┐                        │
│                          │       api        │                        │
│                          │ (ASP.NET 8.0)  │                        │
│                          └────────┬────────┘                        │
│                                   │                                 │
│           ┌────────────────────────┼────────────────────────┐      │
│           ▼            ▼            ▼            ▼             ▼      │
│  ┌─────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │  postgres   │ │  minio   │ │signadapter│ │  Peruri  │ │  SAP   │ │
│  │   (16)      │ │ (S3 API) │ │(Docker)   │ │ (Cloud)  │ │ (ERP) │ │
│  └─────────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Container Services

| Service | Container | Image | Ports | Purpose |
|---------|-----------|-------|-------|---------|
| frontend | amtemeterai-frontend | amtemeterai-frontend:v5 | 5173 | React 19 UI |
| api | amtemeterai-api | amtemeterai-api:v5 | 8080 | ASP.NET Core 8.0 API |
| postgres | amtemeterai-postgres | postgres:16 | 5432 | PostgreSQL 16 Database |
| minio | amtemeterai-minio | minio/minio:RELEASE.2024-02-17T01-15-57Z | 9000, 9001 | S3-Compatible Object Storage |
| signadapter | signadapter | registry.perurica.co.id/e-meterai/signadapter:2.0 | 7777 | Peruri e-Meterai Signing |
| reverse-proxy | amtemeterai-reverse-proxy | nginx:alpine | 80 | Nginx Reverse Proxy |
| createbuckets | amtemeterai-minio-init | minio/mc:latest | - | MinIO Initialization |

### Shared Named Volumes

| Volume | Purpose | Mount Paths |
|--------|---------|-------------|
| `postgres_data` | PostgreSQL persistence | `postgres:/var/lib/postgresql/data` |
| `minio_data` | MinIO object storage | `minio:/data` |
| `stamping-share` | PDF exchange for e-Meterai | `api:/app/sharefolder`<br>`signadapter:/app/sharefolder` |

---

## Unified Stack Layout

### Backend: ASP.NET Core 8.0

```
backend/amtemeterai.Api/
├── Controllers/           # API Endpoints
├── Models/                # Domain Entities
├── Dtos/                  # Data Transfer Objects
├── Data/                  # EF Core DbContext
├── Services/              # Business Logic Layer
├── Helpers/               # Utilities (QR Code)
├── Config/                # Configuration Options
├── Migrations/            # Database Migrations
└── Program.cs             # Application Entry Point
```

### Frontend: React 19

```
frontend/src/
├── pages/                 # Page Components
├── shared/
│   ├── components/        # UI Components & Guards
│   ├── contexts/          # Auth Context
│   ├── layouts/           # Dashboard Layout
│   └── utils/             # API & Route Helpers
└── assets/                # Static Assets
```

---

## JWT RBAC System

### Authentication Flow

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  User    │─────▶│ Frontend │─────▶│   API    │─────▶│ Database │
│ (Login)  │      │  (React) │      │ (JWT)    │      │ (Postgres)│
└──────────┘      └──────────┘      └──────────┘      └──────────┘
                       │                   │
                       │                   ▼
                       │            ┌──────────────┐
                       │            │ JWT Token    │
                       │            │ Claims:      │
                       │            │ - Roles      │
                       │            │ - Permissions│
                       │            │ - Plants     │
                       │            │ - Menu       │
                       │            │ - Security   │
                       │            │   Stamp      │
                       │            └──────────────┘
                       └──────────────────▶ (localStorage)
                                            Polls /api/account/me
                                            every 60s
```

### Role Hierarchy

| Role | Level | Access Pattern |
|------|-------|----------------|
| `sysadmin` | 1 | Full system access + User Management |
| `finance` | 2 | Dashboard + Customers + Invoices |
| `sales` | 3 | Dashboard + Customers + Deliveries + Invoices |
| `warehouse` | 4 | Deliveries only |

### Permission Matrix

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     DYNAMIC RBAC PERMISSION MATRIX                     │
├─────────────────────────────────────────────────────────────────────────┤
│                         │ sysadmin │ finance │ warehouse │ sales        │
├─────────────────────────┼──────────┼─────────┼───────────┼─────────────┤
│ dashboard:read          │    ✓     │    ✓    │     ✗     │     ✓       │
│ customer:read           │    ✓     │    ✓    │     ✗     │     ✓       │
│ customer:sync           │    ✓     │    ✗    │     ✗     │     ✗       │
│ delivery:read           │    ✓     │    ✗    │     ✓     │     ✓       │
│ delivery:sync           │    ✓     │    ✗    │     ✗     │     ✗       │
│ invoice:read            │    ✓     │    ✓    │     ✗     │     ✓       │
│ invoice:sync            │    ✓     │    ✗    │     ✗     │     ✗       │
│ uam:read                │    ✓     │    ✗    │     ✗     │     ✗       │
│ uam:sync                │    ✓     │    ✗    │     ✗     │     ✗       │
└─────────────────────────┴──────────┴─────────┴───────────┴─────────────┘
```

---

## System Boundaries

### Internal Boundaries

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION BOUNDARY                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ JWT Token Boundary                                               │  │
│  │ - Token issued on login                                         │  │
│  │ - Validated on each request                                     │  │
│  │ - Polled for session validation (/api/account/me)              │  │
│  │ - Invalidated on security stamp change                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│                         AUTHORIZATION BOUNDARY                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Permission-Based Access Control                                 │  │
│  │ - Route-level protection via RouteGuard                        │  │
│  │ - API-level protection via [Authorize] attributes              │  │
│  │ - Plant-level data filtering                                    │  │
│  │ - Role-based menu visibility                                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│                         DATA ISOLATION BOUNDARY                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Plant-Level Security                                            │  │
│  │ - Non-sysadmin users see only assigned plants                   │  │
│  │ - Warehouse role: Customer data hidden                         │  │
│  │ - Users without plants: No data visible                         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### External Boundaries

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL INTEGRATION BOUNDARIES                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐   │
│  │   SAP ERP       │    │    Peruri       │    │     MinIO       │   │
│  │   Integration   │    │   e-Meterai     │    │   Storage       │   │
│  │                 │    │   Stamping      │    │                 │   │
│  │ - Delivery Sync │    │ - JWT Auth      │    │ - S3 Protocol   │   │
│  │ - Invoice Gen   │    │ - Stamp v2 API  │    │ - Buckets       │   │
│  │ - Billing API   │    │ - Docker Adapter│    │ - Presigned URLs│   │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘   │
│                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐   │
│  │   Google Maps  │    │   SMTP Email    │    │  Activity Log   │   │
│  │   Geocoding    │    │   Service       │    │   (Internal)    │   │
│  │                 │    │                 │    │                 │   │
│  │ - Reverse Geo  │    │ - PIN Dispatch  │    │ - Audit Trail   │   │
│  │ - Address Res  │    │ - Confirm Email │    │ - Event Track   │   │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack Matrix

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Frontend Framework** | React | 19.2.5 | UI Rendering |
| **Frontend Language** | TypeScript | 6.0.2 | Type Safety |
| **Frontend Build** | Vite | 8.0.10 | Build Tool |
| **Frontend Styling** | Tailwind CSS | 4.2.4 | Utility-First CSS |
| **Frontend Routing** | React Router DOM | 7.14.2 | Client-Side Routing |
| **Backend Framework** | ASP.NET Core | 8.0 | Web API |
| **Backend Language** | C# | 12 (.NET 8.0) | Server Logic |
| **Backend ORM** | Entity Framework Core | 8.0.0 | Database Access |
| **Database** | PostgreSQL | 16 | Data Persistence |
| **Authentication** | JWT Bearer | 8.0.0 | Token-Based Auth |
| **User Management** | ASP.NET Core Identity | 8.0.0 | Identity Framework |
| **Object Storage** | MinIO (S3-Compatible) | RELEASE.2024-02-17T01-15-57Z | File Storage |
| **API Documentation** | Swagger/OpenAPI | 6.5.0 | API Specs |
| **Email** | MailKit | 4.16.0 | SMTP Client |
| **QR Generation** | QRCoder | 1.8.0 | QR Codes |
| **PDF Processing** | PdfPig | 0.1.15 | PDF Parsing |
| **Reverse Proxy** | Nginx | alpine | HTTP Routing |

---

## Data Flow Architecture

### Delivery Creation Flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  SAP    │───▶│   API   │───▶ Database│───▶  MinIO  │───▶ Frontend│
│  ERP    │    │ /create │    │ (EF)    │    │ (QR)    │    │ (React) │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                     │
                     ▼
              ┌─────────────┐
              │ Public Link │
              │ + QR Code   │
              │ + Email     │
              └─────────────┘
```

### Delivery Confirmation Flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Customer│───▶│ Public  │───▶   API   │───▶ Database│───▶   SAP   │
│ (Email) │    │   Link  │    │ /confirm│    │ (EF)    │    │  ERP    │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                                   │
                                   ▼
                            ┌─────────────┐
                            │ GPS + Photo │
                            │ Upload     │
                            │ MinIO      │
                            └─────────────┘
```

### Invoice Stamping Flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│Frontend │───▶│   API   │───▶ Peruri  │───▶signadapt│───▶  MinIO  │
│ /stamp  │    │ /stamp  │    │ Stamp v2│    │   (PDF) │    │(Signed) │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                     │              │
                     ▼              ▼
              ┌─────────────┐ ┌─────────────┐
              │ Shared Vol  │ │ JWT Token   │
              │ /sharefolder│ │ + QR Code   │
              └─────────────┘ └─────────────┘
```

---

## Security Architecture

### Multi-Layer Protection

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Layer 1: Authentication (JWT)                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ - Token issued on valid credentials                              │  │
│  │ - Token validated on each request                                │  │
│  │ - Session polling every 60 seconds                              │  │
│  │ - Security stamp invalidation                                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Layer 2: Authorization (RBAC)                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ - Permission-based route access                                 │  │
│  │ - Role-based menu visibility                                    │  │
│  │ - Plant-level data filtering                                    │  │
│  │ - API-level authorization attributes                            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Layer 3: Data Protection                                               │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ - Financial lock on invoiced deliveries                          │  │
│  │ - PIN verification for public access                             │  │
│  │ - Warehouse role: Customer data hidden                           │  │
│  │ - Activity logging for audit trails                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Environment Configuration

### Development Mode
- **API URL:** `http://localhost:8080`
- **Frontend URL:** `http://localhost:5173`
- **Database:** Local PostgreSQL (localhost:5432)
- **Storage:** Local MinIO (localhost:9000)
- **Peruri:** Cloud Staging API

### Production Mode (Docker)
- **API URL:** Internal (via reverse proxy)
- **Frontend URL:** Port 80 (via reverse proxy)
- **Database:** Container (postgres:5432)
- **Storage:** Container (minio:9000)
- **Peruri:** On-premise Docker adapter (signadapter:7777)

---

## API Endpoint Structure

### Authentication & Authorization
- `POST /api/account/login`
- `POST /api/account/register`
- `GET /api/account/me`

### Dashboard
- `GET /api/dashboard/stats`
- `GET /api/dashboard/charts`
- `GET /api/dashboard/logs`

### Customers
- `GET /api/customers`
- `POST /api/customers`
- `POST /api/customers/sync`

### Deliveries
- `GET /api/deliveries`
- `GET /api/deliveries/{id}`
- `GET /api/deliveries/{token}` (Public)
- `POST /api/deliveries`
- `PATCH /api/deliveries/{token}`
- `POST /api/deliveries/cancel/{deliveryNumber}`
- `POST /api/deliveries/{deliveryNumber}/invoice`

### Invoices
- `GET /api/invoices`
- `GET /api/invoices/{id}`
- `POST /api/invoices`
- `POST /api/invoices/{id}/upload-printout`
- `POST /api/invoices/{id}/stamp`
- `POST /api/invoices/by-sap-number/{invoiceNumber}/stamp`

### User Access Management (sysadmin only)
- `GET /api/admin/uam/users`
- `GET /api/admin/uam/users/{id}/matrix`
- `POST /api/admin/uam/users/{id}/matrix`
- `GET /api/admin/uam/roles`
- `GET /api/admin/uam/roles/{roleName}/menus`
- `POST /api/admin/uam/roles/{roleName}/menus`

---

## Database Schema Summary

### Core Entities
- **ApplicationUser** (IdentityUser extension)
- **Customer**
- **DeliveryHeader** → **DeliveryLine** (1:N)
- **Invoice**
- **Document** (polymorphic: Delivery/Invoice)

### RBAC Entities
- **IdentityRole**
- **Permission**
- **RolePermission** (N:N)
- **ApplicationMenu**
- **MenuPermission** (N:N)
- **Plant**
- **UserPlant** (N:N)

### Activity Tracking
- **ActivityLog**

---

## Deployment Architecture

### Docker Compose Stack

```yaml
services:
  frontend:        # React 19 SPA
  api:             # ASP.NET Core 8.0 API
  postgres:        # PostgreSQL 16
  minio:           # S3-Compatible Storage
  signadapter:     # Peruri e-Meterai Signing
  reverse-proxy:   # Nginx Reverse Proxy
  createbuckets:   # MinIO Initialization
```

### Internal DNS Resolution
- `frontend` → `reverse-proxy` → `api`
- `api` → `postgres`, `minio`, `signadapter`
- `signadapter` ↔ `api` (via stamping-share volume)

### External Access Points
- **Frontend:** Port 80 (Nginx)
- **API:** Internal only (via reverse proxy)
- **MinIO Console:** Port 9001 (optional)
- **PostgreSQL:** Port 5432 (optional)

---

## Monitoring & Observability

### Activity Logging
- Event: `DeliveryCreated`, `DeliveryConfirmationUpdated`, `SapInvoiceCreated`
- Reference ID: Delivery/Invoice numbers
- Severity: Info, Success, Warning
- Timestamp: UTC

### Session Monitoring
- Polling: Every 60 seconds
- Endpoint: `/api/account/me`
- Detection: Security stamp changes, token expiry
- Action: Automatic logout + redirect

### Error Handling
- 401 Unauthorized: Token expired/invalid
- 403 Forbidden: Insufficient permissions
- 502 Bad Gateway: External service failure (SAP)
- 500 Internal Server Error: Application errors

---

*This architecture document is maintained as part of the OpexNOW / e-meterai project documentation.*
