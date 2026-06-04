# AmtemeterAI Frontend Documentation

## Overview

The frontend is a modern **React 19** application built with **TypeScript** and **Vite**. It provides a premium, enterprise-grade user interface for managing e-Meterai operations, customer data, deliveries, invoices, and user access management. The application implements a dynamic **Role-Based Access Control (RBAC)** system with JWT-based authentication and real-time session monitoring.

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
4. Token decoded to extract user claims (roles, menus, plants)
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
  "nameid": "user-id",           // User ID
  "email": "user@example.com",   // User email
  "unique_name": "Full Name",     // Full name
  "jti": "guid-token-id",        // Token ID
  "role": ["sysadmin", "finance"], // Assigned roles
  "plant": ["B1G2", "B1F1"],     // Assigned plants
  "menu": ["customers", "invoices"], // Accessible menus
  "security_stamp": "stamp-value" // Session revocation tracking
}
```

---

# Role-Based Access Control (RBAC)

## RBAC Implementation

### System Roles
| Role | Description | Access Level |
|------|-------------|--------------|
| `sysadmin` | System Administrator | Full access to all features and UAM |
| `finance` | Finance Staff | Customer/invoice read & sync |
| `warehouse` | Warehouse Staff | Delivery read-only |
| `sales` | Sales Staff | Customer/invoice/delivery read-only |

### Menu Access Codes
| Route | Access Code | Description |
|-------|-------------|-------------|
| `/customers` | `customers` | Customer management page |
| `/deliveries` | `deliveries` | Delivery tracking page |
| `/invoices` | `invoices` | Invoice processing page |
| `/admin/uam` | `uam` | User Access Management (sysadmin only) |

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
│  RouteGuard                                                   │
│  └─ Checks if user has menu access for current route         │
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
2. Extract roles and menus claims
3. If sysadmin role → allow all routes
4. Check if route has required access code
5. Verify user has the required menu permission
```

#### `getUserClaims(): UserClaims | null`
```typescript
// Returns:
{
  roles: string[],  // User's assigned roles
  menus: string[]   // User's accessible menu codes
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
│   ├── Dashboard/                 # Dashboard with KPIs and charts
│   ├── Customers/                 # Customer management with sync
│   ├── Deliveries/                # Delivery tracking and details
│   ├── Invoices/                  # Invoice processing (commented out)
│   ├── UserAccessManagement/      # Admin UAM for RBAC management
│   ├── Public/                    # Public delivery receive page
│   ├── Unauthorized/              # Access denied page
│   └── DashboardRedirect/         # Dynamic landing route resolver
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
│   │   │   └── Pagination.tsx     # Page navigation
│   │   ├── ProtectedRoute.tsx     # Authentication check wrapper
│   │   ├── RouteGuard.tsx         # Permission-based route guard
│   │   └── SecuritySessionGuard.tsx # Session monitoring component
│   ├── contexts/
│   │   └── AuthContext.tsx        # Authentication state context
│   ├── layouts/
│   │   └── DashboardLayout.tsx    # Main dashboard layout with sidebar
│   └── utils/
│       ├── api.ts                 # API integration layer
│       ├── routePermissions.ts    # RBAC permission utilities
│       ├── routeResolver.ts       # Dynamic landing route logic
│       └── cn.ts                  # Class name utility (tailwind-merge)
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
- **Real-time updates:** Data refreshed on mount

### API Endpoints Used
- `GET /api/dashboard/stats` - KPI metrics
- `GET /api/dashboard/charts` - Chart data
- `GET /api/dashboard/logs?count=20` - Activity logs

## Customers (`/customers`)

### Features
- **Customer directory** with ERP sync capability
- **Search & filter** by name, code, email, or PIN
- **Sortable columns** with visual indicators
- **Pagination** for large datasets
- **Analytics cards:** Total customers, verified domains, missing emails
- **Sync from ERP** with status messaging

### Required Permission
- `customer:read` - To view customers page
- `customer:sync` - To execute sync operation

## Deliveries (`/deliveries`)

### Features
- **Delivery list** with status indicators
- **Search and filtering** capabilities
- **Delivery detail view** with photos and GPS data
- **Sort by** date, customer, status

### Required Permission
- `delivery:read` - To view deliveries

## User Access Management (`/admin/uam`)

### Features

#### User Mapping Tab
- **User selection list** with search functionality
- **Plant authorization management** with checkbox grid
- **System role assignment** with role descriptions
- **Visual change indicators** for unsaved changes
- **Save feedback** with success/error messages

#### Role Menu Matrix Tab
- **Role selection** with color-coded badges
- **Menu permission configuration** with checkboxes
- **Select all functionality** for efficiency
- **Impact indicators** showing affected users
- **Real-time updates** via security stamp

### Required Permission
- `sysadmin` role required

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
- **Photo upload** capability
- **GPS location** capture

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
/admin/uam                      // User Access Management (sysadmin only)

// Error Routes
/unauthorized                    // Access denied page
/*                              // Catch-all redirect
```

## Dynamic Landing Route (`resolveDefaultLandingRoute()`)

```typescript
// Route Priority List (ordered by preference)
1. deliveries → /deliveries
2. customers → /customers
3. invoices → /invoices

// Logic:
if (user has 'sysadmin' role) {
  return '/admin/uam'
}
else {
  return first available route from priority list
}
```

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

The sidebar menu is dynamically filtered based on user's menu claims:

```typescript
// Menu Items Configuration
const menuItems = [
  { path: "/", label: "Dashboard", accessCode: "dashboard" },
  { path: "/customers", label: "Customers", accessCode: "customers" },
  { path: "/deliveries", label: "Deliveries", accessCode: "deliveries" },
  { path: "/invoices", label: "Invoices", accessCode: "invoices" },
  { path: "/admin/uam", label: "User Management", accessCode: "uam" }
]

// Filter Logic
if (user.roles.includes('sysadmin')) {
  // Show all menus
  return menuItems
}

// Filter by menu access codes
return menuItems.filter(item =>
  !item.accessCode || user.menus.includes(item.accessCode)
)
```

## Active State Styling
- **Active route:** `bg-brand-blue/10` with left border
- **Hover state:** `bg-brand-blue/5`
- **Inactive state:** Transparent border

---

# State Management

## Authentication Context (`AuthContext`)

```typescript
interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (email, password) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}
```

## Local State Management
- **No global state library** - Uses React's built-in state
- **Context API** for authentication only
- **Component-level state** for page-specific data
- **localStorage** for token persistence

---

# Security Features

## Session Monitoring
- **Polling Interval:** 60 seconds
- **Endpoint:** `GET /api/account/me`
- **Detects:** Security stamp changes, token expiry
- **Action:** Automatic logout and redirect to login

## Route Protection
- **Multi-layer protection:** Session guard → Protected route → Route guard
- **Automatic redirects:** Unauthorized users sent to login or unauthorized page
- **Token validation:** On every API call via 401 handling

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
- **Pagination:** Large datasets paginated client-side
- **Code Splitting:** Lazy loading for route components (future)

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
- Verify user has menu claims in JWT
- Check route permissions configuration
- Ensure RBAC seeded correctly on backend

---

# Summary

The AmtemeterAI frontend is a modern, enterprise-grade React application with:
- **Premium UI/UX** following brand guidelines
- **Dynamic RBAC** with multi-layer route protection
- **Real-time session monitoring** for security
- **Responsive design** with mobile-first approach
- **Clean architecture** with separation of concerns
- **Type-safe** development with TypeScript
- **Production-ready** build and deployment pipeline
