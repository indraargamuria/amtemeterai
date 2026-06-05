# AmtemeterAI Frontend Documentation

## Overview

The frontend is a modern **React 19** application built with **TypeScript** and **Vite**. It provides a premium, enterprise-grade user interface for managing e-Meterai operations, customer data, deliveries, invoices, and user access management. The application implements a dynamic **Role-Based Access Control (RBAC)** system with permission-based authorization, JWT-based authentication, and real-time session monitoring.

---

# Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.5 | UI Framework |
| TypeScript | 6.0.2 | Type Safety |
| Vite | 8.0.10 | Build Tool & Dev Server |
| React Router DOM | 7.14.2 | Client-Side Routing |
| Tailwind CSS | 4.2.4 | Utility-First Styling |
| Lucide React | 1.14.0 | Icon Library |
| Recharts | 3.8.1 | Data Visualization |
| QRCode | 1.5.4 | QR Code Generation |

---

# Authentication & Authorization

## Authentication Flow

### Login Process
1. User enters credentials on `/login` page
2. Frontend calls `POST /api/account/login`
3. Server validates and returns JWT token
4. Token decoded to extract user claims (roles, permissions, plants)
5. Token and user data stored in `localStorage`
6. User redirected to appropriate landing page based on permissions

### Session Management
- **Token Storage:** `localStorage` with keys `auth_token` and `auth_user`
- **Session Polling:** `SecuritySessionGuard` polls `/api/account/me` every 60 seconds
- **Automatic Logout:** On 401 responses or security stamp changes
- **Token Refresh:** Automatic when new token received from `/api/account/me`

### JWT Token Structure
The JWT token includes these claims:
```typescript
{
  "nameid": "user-id",                    // User ID
  "email": "user@example.com",           // User email
  "unique_name": "Full Name",            // Full name
  "jti": "guid-token-id",                // Token ID
  "role": ["sysadmin", "finance"],       // Assigned roles
  "plant": ["B1G2", "B1F1"],             // Assigned plants
  "permission": [                        // Granular permissions
    "dashboard:read",
    "customer:read",
    "delivery:read",
    "invoice:read",
    "uam:read"
  ],
  "security_stamp": "stamp-value"        // Session revocation tracking
}
```

---

# Role-Based Access Control (RBAC)

## RBAC Implementation

### Permission-Based Access Control
The application uses **permission-based access control** where each route requires specific permission keys:

| Route | Required Permission | Description |
|-------|---------------------|-------------|
| `/`, `/dashboard` | `dashboard:read` | Dashboard with KPIs |
| `/customers` | `customer:read` | Customer management |
| `/deliveries` | `delivery:read` | Delivery tracking |
| `/invoices` | `invoice:read` | Invoice processing |
| `/admin/uam` | `uam:read` | User Access Management |

### System Roles
| Role | Description | Default Permissions |
|------|-------------|-------------------|
| `sysadmin` | System Administrator | Full access to all permissions |
| `finance` | Finance Staff | customer:read, invoice:read |
| `sales` | Sales Staff | customer:read, delivery:read, invoice:read |
| `warehouse` | Warehouse Staff | delivery:read |

### Route Protection Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│  SecuritySessionGuard (App Root)                            │
│  ├─ Polls /api/account/me every 60s                         │
│  └─ Detects security stamp changes                           │
├─────────────────────────────────────────────────────────────┤
│  ProtectedRoute                                               │
│  └─ Checks if user is authenticated                          │
├─────────────────────────────────────────────────────────────┤
│  RootRouteGuard (for / route only)                          │
│  └─ Redirects users without dashboard:read to first available│
├─────────────────────────────────────────────────────────────┤
│  RouteGuard                                                   │
│  └─ Checks if user has permission for current route          │
├─────────────────────────────────────────────────────────────┤
│  DashboardLayout                                              │
│  └─ Filters sidebar menu based on user permissions           │
└─────────────────────────────────────────────────────────────┘
```

### Permission Checks

#### `hasRouteAccess(pathname: string): boolean`
```typescript
// Logic:
1. Decode JWT token from localStorage
2. Extract roles and permissions claims
3. If sysadmin role → allow all routes
4. Check if route has required permission
5. Verify user has the required permission
```

#### `getUserClaims(): UserClaims | null`
```typescript
// Returns:
{
  roles: string[],       // User's assigned roles
  permissions: string[], // User's permission keys
  menus: string[]       // Legacy menu codes (for compatibility)
}
```

---

# Project Structure

```
frontend/src/
├── App.tsx                        # Main app with routing configuration
├── main.tsx                       # Application entry point
├── index.css                      # Tailwind CSS imports
│
├── pages/                         # Page Components
│   ├── Login/                     # Login page with split-screen design
│   │   ├── LoginPage.tsx         # Login form component
│   │   └── index.ts              # Export barrel
│   ├── Dashboard/                 # Dashboard with KPIs and charts
│   │   ├── DashboardPage.tsx     # Main dashboard component
│   │   └── index.ts              # Export barrel
│   ├── Customers/                 # Customer management with sync
│   │   ├── CustomersPage.tsx     # Customer list and sync
│   │   └── index.ts              # Export barrel
│   ├── Deliveries/                # Delivery tracking and details
│   │   ├── DeliveriesPage.tsx    # Delivery list with filtering
│   │   ├── DeliveryDetailPage.tsx # Individual delivery details
│   │   └── index.ts              # Export barrel
│   ├── Invoices/                  # Invoice processing
│   │   ├── InvoicesPage.tsx       # Invoice list and stamping
│   │   └── index.ts              # Export barrel
│   ├── UserAccessManagement/      # Admin UAM for RBAC management
│   │   ├── UserAccessManagementPage.tsx # User & role configuration
│   │   └── index.ts              # Export barrel
│   ├── Public/                    # Public delivery receive page
│   │   ├── DeliveryReceivePage.tsx # Public delivery confirmation
│   │   ├── Obsolete.tsx          # Legacy component
│   │   └── index.ts              # Export barrel
│   ├── Unauthorized/              # Access denied page
│   │   ├── UnauthorizedPage.tsx  # 403 unauthorized page
│   │   └── index.ts              # Export barrel
│   └── DashboardRedirect/         # Dynamic landing route resolver
│       ├── DashboardRedirectPage.tsx # Legacy redirect logic
│       └── index.ts              # Export barrel
│
├── shared/
│   ├── components/
│   │   ├── ui/                    # Base UI components
│   │   │   ├── Button.tsx         # Primary/secondary button variants
│   │   │   ├── Card.tsx           # Content container
│   │   │   ├── Input.tsx          # Text input with styling
│   │   │   ├── Table.tsx          # Data table with sorting
│   │   │   ├── Badge.tsx          # Status/label badges
│   │   │   ├── Checkbox.tsx       # Form checkbox
│   │   │   ├── Label.tsx          # Form labels
│   │   │   ├── Pagination.tsx     # Page navigation
│   │   │   └── index.ts           # Export barrel
│   │   ├── ProtectedRoute.tsx    # Authentication check wrapper
│   │   ├── RouteGuard.tsx        # Permission-based route guard
│   │   ├── RootRouteGuard.tsx    # Root route permission guard
│   │   └── SecuritySessionGuard.tsx # Session monitoring component
│   ├── contexts/
│   │   └── AuthContext.tsx        # Authentication state context
│   ├── layouts/
│   │   ├── DashboardLayout.tsx   # Main dashboard layout with sidebar
│   │   └── index.ts              # Export barrel
│   └── utils/
│       ├── api.ts                # API integration layer
│       ├── routePermissions.ts   # RBAC permission utilities
│       ├── routeResolver.ts      # Dynamic landing route logic
│       └── cn.ts                 # Class name utility (tailwind-merge)
│
└── assets/                        # Static assets
    ├── amtlogo.png                # Application logo
    └── amtlandscape.jpg           # Login page background
```

---

# Pages & Features

## Login Page (`/login`)

### Features
- **Split-screen design** with logo/form on left, branded image on right
- **Demo credentials** dropdown for quick access
- **Form validation** with error messaging
- **Password show/hide** toggle
- **Staggered animations** for modern UX
- **Dynamic redirect** to user's appropriate landing page

### Demo Credentials
```
Email: admin@amtemeterai.com
Password: Admin@123
```

## Dashboard (`/dashboard`)

### Features
- **KPI Cards:** Total Deliveries, Pending Invoice, Rejection Rate
- **Delivery Trends Chart:** 30-day delivery data visualization
- **Activity Feed:** Recent system events with timestamps
- **ERP Connectivity Status:** Visual indicator of system connection
- **Real-time updates:** Data refreshed on mount

### API Endpoints Used
- `GET /api/dashboard/stats` - KPI metrics
- `GET /api/dashboard/charts` - Chart data
- `GET /api/dashboard/logs?count=20` - Activity logs

## Customers (`/customers`)

### Features
- **Customer directory** with ERP sync capability
- **Search & filter** by name, code, email, or PIN
- **Sortable columns** with visual indicators (code, name, email, PIN)
- **Pagination** for large datasets
- **Analytics cards:** Total customers, verified domains, missing emails
- **Sync from ERP** with status messaging

### Required Permission
- `customer:read` - To view customers page

### API Endpoints Used
- `GET /api/customers` - List all customers
- `POST /api/customers/sync` - Sync from ERP

## Deliveries (`/deliveries`)

### Features
- **Delivery list** with status indicators
- **Plant-level security filtering** (non-sysadmin users see only assigned plants)
- **Role-based data filtering:** Warehouse role users see "Confidential" for customer information
- **Compliance type filtering:** All, BC, Non-BC
- **Pipeline status filtering:** Active, Canceled, All
- **Discrepancy filter:** Show only problematic deliveries
- **Search** by delivery number, customer, salesperson, or cancellation reason
- **Sort** by delivery date, delivery number, or status
- **Cancellation tracking** with reason display
- **Photos count indicator** for each delivery
- **Geographic routing** (district, city/province display)
- **Destination owner** (plant and salesperson info)

### Required Permission
- `delivery:read` - To view deliveries

### Delivery Status Flow
```
Pending Delivery → Fully Received → Invoiced
                  ↓
            Partial / Discrepancy
```

### Cancellation Status
- Canceled deliveries display with special styling (strikethrough, reduced opacity)
- Cancel reason shown in status column
- Invoiced badge hidden for canceled deliveries

### API Endpoints Used
- `GET /api/deliveries` - List all deliveries

## Delivery Detail (`/deliveries/:deliveryId`)

### Features
- Detailed delivery information view
- Ship to address display
- Customer information (conditional - hidden for warehouse role)
- **Buyer PO Number** display (conditional - shown only for non-warehouse roles)
- **Order Number** display (conditional - shown only for non-warehouse roles)
- **Receive Date** display (shown when delivery is confirmed)
- Line items breakdown with batch number and variance percentage
- Photo gallery
- GPS location data
- Proof of delivery documents

### Role-Based Visibility
- **Warehouse role:** Customer code/name, Buyer PO Number, and Order Number are hidden (shows "Confidential")
- **Other roles:** All delivery details including customer information and order numbers are displayed

### Variance Display
- Shows variance percentage for each line item
- Green background (+): Over-received (excess quantity)
- Red background (-): Shortage/discrepancy
- Neutral (0%): Perfect match
- Formula: `((delivered + returned + rejected - packQuantity) / packQuantity) * 100`

## Invoices (`/invoices`)

### Features
- **Invoice list** with status indicators
- **Document upload** for invoice printouts (PDF/image)
- **e-Meterai stamping** with status tracking
- **Invoice detail panel** with document links
- **Summary cards:** Total invoices, Pending stamps, Stamped
- **Status tracking:** Draft, Stamped, Sync Failed, Synced to SAP, Canceled
- **Stamping status:** Not Stamped, Pending, Stamped, Failed

### Required Permission
- `invoice:read` - To view invoices page

### API Endpoints Used
- `GET /api/invoices` - List all invoices
- `POST /api/invoices/{id}/upload-printout` - Upload invoice document
- `POST /api/invoices/{id}/stamp` - Trigger e-Meterai stamping

## User Access Management (`/admin/uam`)

### Features

#### User Mapping Tab
- **User selection list** with search functionality
- **Plant authorization management** with checkbox grid
- **System role assignment** with role descriptions
- **Visual change indicators** for unsaved changes
- **Save feedback** with success/error messages
- **User sub-tabs:** Plant Authorizations, System Role Access

#### Role Menu Matrix Tab
- **Role selection** with color-coded badges
- **Menu permission configuration** with checkboxes
- **Select all functionality** for efficiency
- **Impact indicators** showing affected users
- **Real-time updates** via security stamp

### Required Permission
- `uam:read` and `sysadmin` role

### API Endpoints Used
- `GET /api/admin/uam/users` - List all users
- `GET /api/admin/uam/users/{id}/matrix` - Get user permissions
- `POST /api/admin/uam/users/{id}/matrix` - Update user permissions
- `GET /api/admin/uam/roles` - Get roles and menus
- `GET /api/admin/uam/roles/{roleName}/menus` - Get role menus
- `POST /api/admin/uam/roles/{roleName}/menus` - Update role menus

### Role Descriptions
| Role | Title | Description | Color |
|------|-------|-------------|-------|
| `sysadmin` | System Administrator | Full system access including user management | Red |
| `finance` | Finance User | Access to invoice processing and financial reporting | Emerald |
| `sales` | Sales User | Access to customer management and delivery operations | Blue |
| `warehouse` | Warehouse User | Delivery operations only | Blue |

## Unauthorized Page (`/unauthorized`)

### Features
- **Access denied** message
- **Return to login** option
- Clean, minimal design

## Public Delivery Receive (`/receive/:token`)

### Features
- **Public access** via delivery token
- **PIN verification** for access
- **Delivery confirmation** workflow
- **Ship to address display**
- **Line items with batch number and variance percentage badge**
- **Photo upload** capability
- **GPS location** capture
- **Variance percent calculation** for quantity discrepancies

### Variance Percent Display
- Shown as badge on each line item in the collapsed view
- Green badge: Over-received (excess quantity)
- Red badge: Shortage/discrepancy
- Hidden when variance is 0% (perfect match)
- Formula: `((delivered + returned + rejected - packQuantity) / packQuantity) * 100`

### Variance Percent Calculation
The variance percent is calculated on each line item:
```typescript
const delivered = parseFloat(lineState.delivered) || 0
const returned = parseFloat(lineState.returned) || 0
const rejected = parseFloat(lineState.rejected) || 0
const totalActual = delivered + returned + rejected

const rawVariance = totalActual - line.packQuantity
const percentCalc = ((rawVariance / line.packQuantity) * 100).toFixed(2)
const displayPercent = rawVariance > 0 ? `+${percentCalc}%` : `${percentCalc}%`
```

This same calculation is replicated on the backend when syncing to SAP ERP.

---

# API Integration Layer

## Authenticated Fetch Helpers

### `createAuthenticatedFetch()`
Creates a fetch function that automatically includes JWT token in Authorization header.

### HTTP Method Helpers
```typescript
authGet(url: string)
authPost(url: string, body?: any)
authPatch(url: string, body?: any)
authDelete(url: string)
```

### `useApi()` Hook
```typescript
const api = useApi()
// Returns: { get, post, patch, delete }
```

## API Functions

### Dashboard APIs
```typescript
getDashboardStats()      // GET /api/dashboard/stats
getDashboardCharts()     // GET /api/dashboard/charts
getDashboardLogs(count)  // GET /api/dashboard/logs?count=N
```

### Invoice APIs
```typescript
getInvoices()                    // GET /api/invoices
getInvoiceById(id)               // GET /api/invoices/{id}
createInvoice(data)              // POST /api/invoices
uploadInvoicePrintout(id, file)  // POST /api/invoices/{id}/upload-printout
stampInvoice(id)                 // POST /api/invoices/{id}/stamp
```

### Delivery APIs
```typescript
uploadDeliveryPrintout(id, file) // POST /api/deliveries/{id}/upload-printout
```

---

# Routing Architecture

## Route Configuration

```typescript
// Public Routes
/login                          // Login page (redirects if authenticated)
/receive/:token                 // Public delivery receive

// Protected Routes (require authentication)
/                               // Dynamic landing based on permissions
/dashboard                      // Dashboard with KPIs
/customers                      // Customer management
/deliveries                     // Delivery list
/deliveries/:deliveryId         // Delivery details
/invoices                       // Invoice processing
/admin/uam                      // User Access Management (sysadmin only)

// Error Routes
/unauthorized                    // Access denied page
/*                              // Catch-all redirect
```

## Dynamic Landing Route (`resolveDefaultLandingRoute()`)

```typescript
// Logic:
if (user has 'sysadmin' role) {
  return '/admin/uam'
}
else if (user has 'dashboard:read' permission) {
  return '/'
}
else {
  // Check permissions in priority order
  if (user has 'customer:read') return '/customers'
  if (user has 'invoice:read') return '/invoices'
  if (user has 'delivery:read') return '/deliveries'
  return '/unauthorized'
}
```

## Root Route Protection

The `RootRouteGuard` intercepts access to `/` and handles users without `dashboard:read` permission:

1. Check if user has `dashboard:read` → allow through
2. Check if user has `delivery:read` → redirect to `/deliveries`
3. Check if user has `customer:read` → redirect to `/customers`
4. Check if user has `invoice:read` → redirect to `/invoices`
5. No permissions → redirect to `/unauthorized`

---

# UI Component System

## Design System

### Color Palette
```css
/* Brand Colors */
--brand-blue: #1d2351      /* Primary color */
--brand-red: #e61920       /* Accent color */

/* Opacity Variants */
bg-brand-blue/5            /* Page sections */
bg-brand-blue/10           /* Hover states */
bg-brand-blue/20           /* Selected states */
```

### Typography Scale
- **Page Titles:** 2xl, semibold, brand-blue
- **Section Headers:** sm, uppercase, tracking-wider
- **Body Text:** sm, brand-blue/60-70
- **Labels:** xs, font-medium

### Spacing System
- **Section spacing:** 6 (24px)
- **Component spacing:** 4 (16px)
- **Internal spacing:** 3 (12px)

## Base Components

### Button
```tsx
<Button variant="default" | "outline" size="sm" | "md" | "lg">
  Button text
</Button>
```

### Card
```tsx
<Card>
  <CardContent>
    Card content
  </CardContent>
</Card>
```

### Table
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Column</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Data</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Badge
```tsx
<Badge variant="badge" | "outline">Label</Badge>
```

---

# Sidebar Navigation

## Menu Filtering Logic

The sidebar menu is dynamically filtered based on user's permission claims:

```typescript
// Menu Items Configuration
const menuItems = [
  { path: "/", label: "Dashboard", requiredPermission: "dashboard:read" },
  { path: "/customers", label: "Customers", requiredPermission: "customer:read" },
  { path: "/deliveries", label: "Deliveries", requiredPermission: "delivery:read" },
  { path: "/invoices", label: "Invoices", requiredPermission: "invoice:read" },
  { path: "/admin/uam", label: "User Management", requiredPermission: "uam:read", sysAdminOnly: true }
]

// Filter Logic
if (user.roles.includes('sysadmin')) {
  // Show all menus
  return menuItems
}

// Filter by permission requirements
return menuItems.filter(item => {
  if (item.sysAdminOnly) return false
  return user.permissions.includes(item.requiredPermission)
})
```

## Active State Styling
- **Active route:** `bg-brand-blue/10` with left border
- **Hover state:** `bg-brand-blue/5`
- **Inactive state:** Transparent border

---

# State Management

## Authentication Context (`AuthContext`)

```typescript
interface User {
  id: string
  email: string
  fullName?: string
  roles?: string[]
  permissions?: string[]
  plants?: string[]
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (email, password) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}
```

### Claim Extraction
On login, the following claims are extracted from the JWT:
- `nameid` → User ID
- `role` → Assigned roles (array)
- `permission` → Permission keys (array)
- `plant` → Assigned plants (array)

## Local State Management
- **No global state library** - Uses React's built-in state
- **Context API** for authentication only
- **Component-level state** for page-specific data
- **localStorage** for token and user persistence

---

# Security Features

## Session Monitoring
- **Polling Interval:** 60 seconds
- **Endpoint:** `GET /api/account/me`
- **Detects:** Security stamp changes, token expiry
- **Action:** Automatic logout and redirect to login

## Route Protection
- **Multi-layer protection:** Session guard → Protected route → Root guard → Route guard
- **Automatic redirects:** Unauthorized users sent to login or unauthorized page
- **Token validation:** On every API call via 401 handling

## Plant-Level Data Security
- **Delivery filtering:** Non-sysadmin users only see deliveries from assigned plants
- **Plant claim validation:** Deliveries without plant assignment are hidden for non-admin users
- **Empty plant assignment:** Non-sysadmin users with no plants see no deliveries

## Data Protection
- **JWT Claims:** All permissions embedded in token
- **No sensitive data** in localStorage (except token)
- **Automatic cleanup** on logout

---

# Development Configuration

## Environment Variables

```bash
# API Configuration
VITE_API_URL=http://localhost:8080

# Application (Optional)
VITE_APP_TITLE=AmtemeterAI
VITE_APP_ENV_TAG=DEV
```

## Vite Configuration
- **Port:** 5173 (strict)
- **Host:** All interfaces (0.0.0.0)
- **Build:** TypeScript compilation + Vite bundling
- **Dev Server:** Hot module replacement enabled

## Build Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

---

# Browser Compatibility

- Modern browsers with ES6+ support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

# Performance Considerations

## Optimization Techniques
- **Memoization:** `useMemo` for filtered/sorted data
- **Stable References:** `useMemo` for API object
- **Pagination:** Large datasets paginated client-side (10 items per page)
- **Efficient filtering:** Multiple filter conditions combined in single pass

## Data Fetching Patterns
- **Parallel requests:** `Promise.all()` for independent data
- **Optimistic updates:** UI updates before API confirmation (future)
- **Error boundaries:** Graceful error handling (future)

---

# Design Patterns

## Component Patterns
- **Functional Components:** All components are functions
- **Custom Hooks:** Reusable logic extraction (e.g., `useApi`)
- **Composition:** Small components composed into larger ones
- **Props Drilling:** Minimal, using context where appropriate

## Code Organization
- **Feature-based folders:** Pages organized by feature
- **Shared components:** Reusable UI in `shared/components`
- **Utility functions:** Helper functions in `shared/utils`
- **Type definitions:** Inline or adjacent to usage

---

# Future Enhancements

## Planned Features
- [ ] Code splitting for route-based lazy loading
- [ ] Error boundaries for graceful error handling
- [ ] Optimistic UI updates
- [ ] Advanced filtering and sorting
- [ ] Export functionality
- [ ] Real-time notifications via WebSocket

## Technical Debt
- [ ] Migrate to proper state management (if needed)
- [ ] Implement comprehensive error boundaries
- [ ] Add end-to-end testing
- [ ] Performance monitoring and optimization

---

# Deployment

## Production Build
```bash
npm run build
# Output: dist/ directory
```

## Docker Deployment
The frontend is built into the Docker image and served by Nginx.

## Environment-Specific Configuration
- **Development:** Reads from root `.env` file
- **Production:** Uses placeholder for Nginx substitution

---

# External Dependencies

## NPM Packages
- **@tailwindcss/postcss:** Tailwind CSS v4 integration
- **class-variance-authority:** Component variant management
- **clsx & tailwind-merge:** Conditional className utilities
- **lucide-react:** Icon library
- **qrcode:** QR code generation
- **recharts:** Chart library

## Dev Dependencies
- **@vitejs/plugin-react:** React support for Vite
- **typescript:** Type checking
- **eslint:** Code linting
- **autoprefixer:** CSS vendor prefixes
- **postcss:** CSS processing

---

# Troubleshooting

## Common Issues

### "Loading..." stuck on screen
- Check token in localStorage
- Verify API URL in environment variables
- Check network tab for API errors

### Route redirects to login
- Token may be expired
- Security stamp may have changed
- Check `/api/account/me` response

### Menu items missing
- Verify user has permission claims in JWT
- Check route permissions configuration
- Ensure RBAC seeded correctly on backend

### Deliveries not showing
- Check if user has plants assigned
- Verify plant claims in JWT token
- Sysadmin users should see all plants

---

# Summary

The AmtemeterAI frontend is a modern, enterprise-grade React application with:
- **Premium UI/UX** following brand guidelines
- **Permission-based RBAC** with multi-layer route protection
- **Plant-level data security** for operational users
- **Real-time session monitoring** for security
- **Responsive design** with mobile-first approach
- **Clean architecture** with separation of concerns
- **Type-safe** development with TypeScript
- **Production-ready** build and deployment pipeline
