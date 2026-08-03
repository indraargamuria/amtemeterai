# AmtemeterAI System Documentation: Backend, Frontend, and Infrastructure

This document provides a comprehensive overview of the AmtemeterAI system, merging backend specifications, frontend implementation details, and infrastructure configuration into a single technical reference.

---

## 1. System Overview
AmtemeterAI is a premium e-Meterai delivery management system designed to streamline the lifecycle of digital stamp deliveries. It features a secure administrative dashboard and a public, PIN-protected delivery receipt interface.

- **Primary URL:** `http://localhost` (via Nginx Reverse Proxy)
- **API Base:** `http://localhost/api`
- **Swagger Documentation:** `http://localhost/api/swagger`

---

## 2. Infrastructure & Deployment
The system is containerized using Docker, with an Nginx reverse proxy orchestrating traffic between the frontend and backend services.

### Docker Architecture (`docker-compose.yml`)
The orchestration includes four primary services:
1.  **Reverse-Proxy (Nginx):** Entry point on port 80. Routes `/api/*` to the backend and `/` to the frontend.
2.  **Frontend (React/Vite):** Serves the SPA.
3.  **API (ASP.NET Core):** Handles business logic and database interactions.
4.  **PostgreSQL:** Persistent data storage.

### Nginx Configuration
The reverse proxy ensures seamless communication between decoupled services:
- **Upstream Frontend:** `frontend:80`
- **Upstream API:** `api:8080`
- **Max Body Size:** 50M

---

## 3. Backend Architecture (ASP.NET Core 8.0)

### Tech Stack
- **Framework:** .NET 8.0 / ASP.NET Core
- **Database:** PostgreSQL 16 (Entity Framework Core 8.0)
- **Identity:** ASP.NET Core Identity with JWT Bearer Authentication
- **Utilities:** QRCoder (QR Generation), Swashbuckle (Swagger)

### Database Schema
- **Customer:** Stores `CustomerCode`, `CustomerName`, `CustomerEmail`, and `CustomerPin` (Default: "123456").
- **DeliveryHeader:** Tracks `DeliveryNumber`, `ReceiverToken` (Guid), `Received` status, and `Invoiced` status. Linked to Customer.
- **DeliveryLine:** Itemized details including `SalesQuantity`, `PackQuantity`, and quantities for `Delivered`, `Returned`, and `Rejected` items.

### Key API Endpoints
| Category | Endpoint | Method | Auth | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Account** | `/api/account/login` | POST | Public | Returns JWT and user info. |
| **Customers** | `/api/customers/sync` | POST | Bearer | Syncs customers from ERP/Dummy source. |
| **Deliveries** | `/api/deliveries` | POST | Bearer | Creates delivery + generates QR/Public URL. |
| **Public** | `/api/deliveries/{token}` | GET | Public | Fetches delivery details via token. |
| **Public** | `/api/deliveries/{token}/verify-pin` | POST | Public | Validates PIN against Customer table. |

---

## 4. Frontend Implementation (React 19)

### Tech Stack
- **Core:** React 19, TypeScript, Vite.
- **Styling:** Tailwind CSS 4 (Strict Brand Palette: `#1d2351` Blue, `#e61920` Red).
- **Routing:** React Router 7.
- **Icons:** Lucide-React.

### Authentication & Security
- **AuthContext:** Manages JWT lifecycle and user state.
- **ProtectedRoute:** Wraps administrative routes (Dashboard, Customers, Deliveries).
- **PIN Verification Gate:** A specialized security layer for the `/receive/:token` route. Delivery data is not fetched until the server validates the PIN.

### Key Pages
1.  **Dashboard:** High-level metrics (Ongoing deliveries, e-Meterai quota).
2.  **Customers:** Table view with sync capabilities and pagination.
3.  **Delivery Details:** Admin view showing delivery status, line items, and a generated QR code for sharing.
4.  **Public Receive Page:** PIN-protected form for receivers to confirm delivery quantities and provide notes.

---

## 5. Key Business Logic

### Delivery Lifecycle
1.  **Creation:** Admin creates a delivery. The system generates a unique `ReceiverToken` and a corresponding `PublicUrl`.
2.  **Access:** The customer/receiver scans a QR code or clicks the link.
3.  **Verification:** The receiver enters the PIN (provided by the sender).
4.  **Confirmation:** The receiver updates quantities for delivered, returned, or rejected items.
5.  **Completion:** The system marks `Received = true`, which is then visible in the Admin Dashboard.

### QR Code & URL Generation
- **Format:** `{PublicBaseUrl}/receive/{ReceiverToken}`
- **Generation:** Frontend uses the `qrcode` library to render the link as a PNG for administrative download and distribution.

---

## 6. Development & Migrations
- **Local Dev:** Run `npm run dev` in the root to start both frontend and backend concurrently.
- **Database Updates:** Use `dotnet ef database update` to sync PostgreSQL with the latest migrations.
- **CORS:** Configured dynamically via `appsettings.json` to allow specified origins (e.g., `localhost:5173`).
