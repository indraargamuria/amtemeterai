# Backend Summary - AmtemeterAI Go-Live Preparation

## Project Structure
- **Framework**: ASP.NET Core 8.0
- **Database**: PostgreSQL with Entity Framework Core
- **Authentication**: JWT Bearer tokens with ASP.NET Core Identity
- **Authorization**: Role-based access control (RBAC) with dynamic permission matrix

## Key Backend Components

### Controllers
1. **AccountController** - Authentication endpoints (login, token management)
2. **UserManagementController** (`/api/admin/uam`) - Admin-only user access management
3. **CustomersController** - Customer data management
4. **DeliveriesController** - Delivery operations
5. **InvoicesController** - Invoice processing with e-Meterai stamping
6. **DashboardController** - KPI statistics and activity logs
7. **DocumentsController** - Document hub management

### Data Models
- **ApplicationUser** - Extends IdentityUser with FullName, CreatedAt, LastLoginAt
- **IdentityRole** - Standard ASP.NET Core roles (sysadmin, sales, finance, warehouse)
- **Plant** - Plant codes for data-level security
- **UserPlant** - Many-to-many relationship between users and plants
- **Permission** - Granular permission keys
- **RolePermission** - Maps roles to permissions
- **MenuPermission** - Maps permissions to application menus
- **ApplicationMenu** - Application menu structure

### Configuration (appsettings.json)
- **Jwt** - JWT token configuration (Issuer, Audience, Key)
- **ConnectionStrings** - Database connection
- **SapOptions** - SAP integration settings (BaseUrl, Username, Password)
- **PeruriOptions** - e-Meterai stamping service configuration
- **SmtpSettings** - Email service configuration
- **Cors** - Allowed origins for CORS policy
- **CustomerSource** - Toggle between Dummy and ERP customer source

### Services
- **IEmailService** / **EmailService** - SMTP email sending
- **ICustomerSource** / **ErpCustomerSource** / **DummyCustomerSource** - Customer sync abstraction
- **CustomerService** - Customer business logic
- **IStorageService** / **MinioStorageService** - Object storage for documents
- **IPeriuriPdsService** - Peruri PDS integration
- **IPeruriSessionService** / **IPeruriOnPremiseStampService** - e-Meterai on-premise stamping
- **SapCustomerSyncWorker** - Background service for daily customer sync at midnight

### Security Features
1. **JWT Authentication** - Token-based authentication with 24-hour expiration
2. **Role-Based Authorization** - sysadmin, sales, finance, warehouse roles
3. **Permission Matrix** - Dynamic menu and permission mapping
4. **Data-Level Security** - Plant-based data filtering
5. **Security Stamp** - Session invalidation on permission changes

### Database Migrations
- Initial identity tables
- RBAC security matrix (permissions, role-permissions, menu-permissions, application-menus)
- Plant data level security (UserPlant junction table)
- Geolocation tracking for deliveries
- Invoice and document management
- QR code generation for invoices

### API Endpoints Summary

#### Authentication
- `POST /api/account/login` - User login, returns JWT token

#### User Management (Admin Only)
- `GET /api/admin/uam/users` - List all users
- `GET /api/admin/uam/users/{id}/matrix` - Get user's plant and role assignments
- `POST /api/admin/uam/users/{id}/matrix` - Update user permissions
- `GET /api/admin/uam/roles` - List all roles and menus
- `GET /api/admin/uam/roles/{roleName}/menus` - Get role's menu assignments
- `POST /api/admin/uam/roles/{roleName}/menus` - Update role menu permissions
- `POST /api/admin/uam/users/register` - **[NEW]** Register new user with role assignment

#### Dashboard
- `GET /api/dashboard/stats` - KPI metrics
- `GET /api/dashboard/charts` - 30-day chart data
- `GET /api/dashboard/logs` - Activity log entries

#### Customers
- `GET /api/customers` - List customers
- `POST /api/customers/sync` - Sync customers from ERP

#### Deliveries
- `GET /api/deliveries` - List deliveries
- `GET /api/deliveries/{id}` - Delivery details
- `POST /api/deliveries/{id}/receive` - Receive delivery items
- `POST /api/deliveries/by-token/{token}` - Public token-based delivery confirmation

#### Invoices
- `GET /api/invoices` - List invoices
- `GET /api/invoices/{id}` - Invoice details
- `POST /api/invoices/{id}/stamp` - Trigger e-Meterai stamping
- `POST /api/invoices/{id}/upload-printout` - Upload invoice printout

### Recent Changes (Task 1 - GoLive Prep)
**Implemented: Admin-Only User Registration Panel**

#### Backend Changes
1. Added `POST /api/admin/uam/users/register` endpoint to `UserManagementController`
2. Endpoint secured with `[Authorize(Roles = "sysadmin")]` attribute
3. Request payload accepts:
   - Username (required)
   - Email (required)
   - Password (required)
   - FullName (optional)
   - TargetRole (required)
4. Validation includes:
   - Email uniqueness check
   - Username uniqueness check
   - Role existence verification
   - Identity password validation
5. Uses `UserManager<ApplicationUser>` and `RoleManager<IdentityRole>` for secure user creation and role assignment

### Pending Go-Live Tasks
- Task 2: Environment Variable Configuration Provider Mapping
- Task 3: Resilient Fallback for Missing Google Maps API Key
- Task 4: Daily Midnight Customer Sync Background Job
