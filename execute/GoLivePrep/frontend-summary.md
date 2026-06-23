# Frontend Summary - AmtemeterAI Go-Live Preparation

## Project Structure
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui components (Card, Button, Input, Badge, Checkbox, Table, Pagination)
- **State Management**: React Context API for authentication

## Key Frontend Components

### Pages
1. **LoginPage** - Split-screen login with email/password authentication
2. **DashboardPage** - KPI metrics cards (ongoing deliveries, pending invoices, e-Meterai count)
3. **CustomersPage** - Customer list with sync functionality
4. **DeliveriesPage** - Delivery list with filtering
5. **DeliveryDetailPage** - Detailed delivery view with line items and documents
6. **InvoicesPage** - Invoice list with stamping functionality
7. **DocumentsPage** - Document hub for centralized document management
8. **UserAccessManagementPage** - Admin panel for user and permission management
9. **DeliveryReceivePage** - Public token-based delivery confirmation page
10. **UnauthorizedPage** - 403 access denied page

### Layouts
- **DashboardLayout** - Main application layout with:
  - Fixed sidebar navigation
  - User profile section at bottom
  - Main content area with left margin
  - Role-based menu filtering

### Shared Components
- **ProtectedRoute** - Authentication wrapper
- **RouteGuard** - Permission-based route access control
- **RootRouteGuard** - Root-level route validation
- **SecuritySessionGuard** - Session timeout monitoring

### Context
- **AuthProvider** - Provides:
  - `user` - Current user info
  - `isAuthenticated` - Auth state
  - `login()` - Login function
  - `logout()` - Logout function
  - JWT token storage in localStorage

### Utility Functions
- **api.ts** - Authenticated API calls with automatic token injection
- **routePermissions.ts** - Route-to-permission mapping
- **routeResolver.ts** - Menu configuration based on user permissions
- **cn.ts** - className utility (Tailwind merge)

### Navigation Menu
Based on user permissions (sysadmin bypasses all checks):
- `/` - Dashboard (`dashboard:read`)
- `/customers` - Customers (`customer:read`)
- `/deliveries` - Deliveries (`delivery:read`)
- `/invoices` - Invoices (`invoice:read`)
- `/documents` - Document Hub (`invoice:read`)
- `/admin/uam` - User Management (`uam:read`, sysadmin only)

### Styling System
**Brand Colors:**
- Primary Blue: `#1d2351` (CSS: `--brand-blue`)
- Accent Red: `#e61920` (CSS: `--brand-red`)

**Design Principles:**
- Clean, professional SaaS interface
- Visual hierarchy through size, spacing, weight
- Soft blue tint system using opacity variants (`bg-brand-blue/5`, `bg-brand-blue/10`)
- Card-based layouts with subtle borders
- Spacious but information-dense layouts

### User Access Management Page
The admin panel (`UserAccessManagementPage`) provides three main tabs:

1. **User Mapping** - Manage plant access and system roles for existing users
2. **User Registration** - **[NEW]** Create new users with role assignment
3. **Role Menu Matrix** - Configure menu permissions per role

### Recent Changes (GoLive Prep)

#### Task 1: Admin-Only User Registration Panel ✅
**Frontend Changes:**
1. Added "User Registration" tab to UserAccessManagementPage
2. Registration form includes:
   - Username input (required)
   - Email input (required, with validation)
   - Full Name input (optional)
   - Password input (required, min 6 characters)
   - Role dropdown selector (required)
3. Form features:
   - Client-side validation
   - Loading state during submission
   - Success message after registration
   - Error handling with detailed messages
   - Form reset after successful registration
   - Auto-refresh of user list after registration
4. Role dropdown populated from `roleDescriptions` with:
   - System Administrator (@sysadmin)
   - Sales User (@sales)
   - Finance User (@finance)
   - Warehouse User (@warehouse)

#### Task 2: Environment Variable Configuration Provider Mapping ✅
**Note:** This task is backend-only. No frontend changes were required.
The backend now supports environment variable configuration for production Docker deployments using double-underscore notation (e.g., `SapOptions__BaseUrl`, `Smtp__Host`).

### API Integration
All API calls use authenticated fetch with JWT tokens:
- Automatic token injection
- 401 handling (redirect to login)
- Consistent error handling

### Pending Go-Live Tasks
- Task 3: Resilient Fallback for Missing Google Maps API Key
- Task 4: Daily Midnight Customer Sync Background Job
