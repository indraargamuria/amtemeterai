# AmtemeterAI Frontend Documentation

## Overview

The frontend is a modern **React 19** application built with **TypeScript** and **Vite**. It provides a premium, enterprise-grade user interface for managing e-Meterai operations, customer data, deliveries, invoices, and user access management. The application implements a dynamic **Role-Based Access Control (RBAC)** system with permission-based authorization, JWT-based authentication, and real-time session monitoring.

---

# Performance Optimizations

## React Performance Best Practices Applied

### DeliveryReceivePage (`/receive/:token`)
- **Component Extraction**: Modals and LineItemRow extracted as memoized sub-components
- **useCallback Hooks**: Event handlers wrapped for stable references
- **useMemo Hooks**: Expensive calculations memoized (lineCalculations, photoUrls)
- **Search Debouncing**: 200ms debounce to reduce filter recalculations
- **Lazy Rendering**: Modals only render when visible
- **Photo URL Memoization**: Object URLs created once and reused

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

### Auth Response DTO
```typescript
interface AuthResponseDto {
  token: string
  email: string
  fullName: string
}
```

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

#### Route Permission Constants
```typescript
export const routePermissions: Record<string, string> = {
  '/': 'dashboard:read',
  '/dashboard': 'dashboard:read',
  '/customers': 'customer:read',
  '/deliveries': 'delivery:read',
  '/invoices': 'invoice:read',
  '/documents': 'invoice:read',
  '/admin/uam': 'uam:read',
}

export const sysAdminOnlyRoutes = new Set(['/admin/uam'])
```

#### JWT Decoding
```typescript
function decodeJWT(token: string): any {
  const base64Url = token.split('.')[1]
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => `%${('00' + c.charCodeAt(0).toString(16)).slice(-2)}`)
      .join('')
  )
  return JSON.parse(jsonPayload)
}
```

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
│   ├── Documents/                 # Document Hub - Unified invoices + deliveries
│   │   ├── DocumentsPage.tsx     # Transaction-agnostic document view
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
- **SAP Invoice Number Badge** (shown when invoice exists)
- **SAP Invoice Generate/Sync Button** (shown for received deliveries)
- Line items breakdown with batch number and variance percentage
- Photo gallery
- GPS location data
- Proof of delivery documents

### Role-Based Visibility
- **Warehouse role:** Customer code/name, Buyer PO Number, and Order Number are hidden (shows "Confidential")
- **Other roles:** All delivery details including customer information and order numbers are displayed

### SAP Invoice Generation
- **Dynamic Button Label:**
  - "Generate SAP Invoice" - when delivery is not yet invoiced
  - "Sync SAP Invoice" - when invoice already exists (re-sync scenario)
- **Button Visibility:** Only shown for received (non-canceled) deliveries
- **Loading State:** Button disabled and shows "Processing..." during API call
- **Toast Notifications:**
  - On new invoice creation: "Invoice {InvoiceNumber} successfully created."
  - On re-sync: "Invoice {InvoiceNumber} successfully synchronized."
  - On error: Shows appropriate error message
- **Data Refresh:** Delivery details are automatically refreshed after successful operation

### Invoice Number Badge
- Displayed in "Core Dispatch Information" card when `invoiceNumber` exists
- Styled with blue background and border (`bg-blue-50 text-blue-700 border-blue-200`)
- Shows the SAP invoice number returned from the billing endpoint

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

## Document Hub (`/documents`)

### Features
- **Transaction-Agnostic Paradigm**: Unified view of both linked invoices (with delivery) and standalone invoices
- **Top-Level Filter Toggles**: All Documents, Delivery-Centric, Invoice-Centric
- **High-Density Table Layout**:
  - **Billing Invoice Ref**: Monospace font with document icon
  - **Fulfillment Tracking**: Shows `deliveryNumber` for linked, "Direct Standalone Bill" badge for standalone
  - **Financial Weight**: Rp currency format (Indonesian Rupiah)
  - **Compliance Status**: Stamped (emerald), Unsigned/Draft (slate), Pending (amber)
  - **Operations Matrix**: DO button (disabled for standalone with tooltip), Inspect Workspace button
- **Inspect Workspace**: Right-side sliding sheet (40% width / 480px)
- **Dynamic Sheet Tabs**:
  - Linked flow: [View Delivery Order] + [View Invoice PDF]
  - Standalone flow: Only [View Invoice PDF] tab
- **Summary Cards**: Total, Linked Flow, Standalone, Stamped, Pending Stamp

### Design Philosophy
The Document Hub implements a **"Refined Industrial Utility"** aesthetic inspired by financial trading terminals and logistics command centers:

- **Typography**: Monospace fonts (JetBrains Mono style) for invoice numbers and IDs; refined sans-serif for headers
- **Color Strategy**: Dominant brand-blue (#1d2351) with emerald for stamped success, slate for pending, amber for alerts
- **Density**: Compact rows (py-2.5) with generous column spacing for high information density
- **Visual States**:
  - Dotted border badge for standalone invoices (visual metaphor: "no upstream link")
  - Pulsing amber indicator for pending stamps
  - Disabled DO button with tooltip for standalone entries
- **Motion**: Smooth slide-in animation for sheet; hover reveals on rows

### Required Permission
- `invoice:read` - To view Document Hub (same as invoices page)

### API Endpoints Used
- `GET /api/invoices` - Fetch all invoices, transformed into unified document rows

### Transaction-Agnostic Implementation
The component gracefully handles missing delivery relationships:

```typescript
interface DocumentRow {
  invoiceNumber: string
  deliveryNumber: string | null  // Null for standalone
  isStandalone: boolean           // Computed flag
  // ... other fields
}
```

**Conditional Logic:**
- **Linked invoices**: Show delivery badge with truck icon, enable DO button
- **Standalone invoices**: Show "Direct Standalone Bill" badge, disable DO button with tooltip
- **Sheet tabs**: Automatically hide delivery tab for standalone invoices

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

### Performance Optimizations (Latest)
The DeliveryReceivePage component has been optimized with:
- **Component Extraction**: Modals (ToastNotification, ApplyAllReminder, VarianceModal, GuardrailModal) and LineItemRow extracted as memoized sub-components
- **useCallback Hooks**: All event handlers (handleLineChange, toggleRowExpansion, handlePhotoUpload, removePhoto, etc.) wrapped in useCallback for stable references
- **useMemo Hooks**: Expensive calculations memoized (lineCalculations Map, photoUrls, activePhotosCount, issuesCount)
- **Search Debouncing**: 200ms debounce on search input to reduce filteredLines recalculations
- **Lazy Modal Rendering**: Modals only render when `show` prop is true
- **Photo URL Memoization**: Object URLs created once and reused, cleaned up on unmount
- **Reduced Re-renders**: LineItemRow uses React.memo to prevent unnecessary re-renders of individual rows

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

### Variance Summary Interface
```typescript
interface VarianceSummary {
  lineNumber: string
  itemCode: string
  description: string
  scheduled: number
  actualTotal: number
  variancePercent: string
  uom: string
}
```

### Variance Modal
- Triggered before form submission when discrepancies are detected
- Shows summary of all line items with variance
- Displays scheduled quantity vs actual total
- Shows variance percentage with color coding (green/red)
- Allows user to review before confirming submission

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

### Photo Upload Features
- **Max photos:** 5 per delivery
- **Max file size:** 5MB per photo
- **Supported formats:** JPEG, PNG, etc.
- **Camera capture:** Direct from device camera
- **File picker:** Choose from gallery
- **Preview:** Thumbnail display before submission
- **Delete option:** Remove photos before submission

### GPS Location Features
- **Automatic capture:** On page load (with permission)
- **High accuracy:** Uses enableHighAccuracy option
- **Timeout:** 5 seconds for location request
- **Fallback:** Graceful handling if permission denied

### "Apply to All" Flow

The "Apply to All" button in the Quick Actions section allows users to quickly set all line items to their scheduled quantities (delivered = packQuantity, returned/rejected = 0, no comments).

#### Flow States

1. **Staged Post (Local State)**
   - Clicking "Apply to All" updates local component state only
   - User must still click "Post Goods Receipt" button to commit changes
   - No automatic submission occurs

2. **Info Pop-up Reminder**
   - After clicking "Apply to All", a blue info banner appears at the top
   - Message: "Apply to All Ready - All items set to scheduled quantities. Click 'Post Goods Receipt' at the bottom to confirm and submit."
   - Auto-dismisses after 8 seconds or manually dismissible

3. **Guardrail Modal (Data Overwrite Protection)**
   - Triggered when user has manually entered discrepancies before clicking "Apply to All"
   - Detects manual modifications via `issuesCount > 0`
   - Shows warning modal with:
     - Alert icon and "Warning: Manual Changes Detected" title
     - Count of affected items
     - Message explaining that manual entries will be overwritten
     - Two buttons: "Keep Manual Changes" (cancel) and "Overwrite & Apply" (confirm)
   - Prevents accidental loss of manually entered data

#### Implementation Details

```typescript
// State for new modals
const [showGuardrailModal, setShowGuardrailModal] = useState(false)
const [showApplyAllReminder, setShowApplyAllReminder] = useState(false)

// Guardrail check function
const handleReceiveAllClean = (skipGuardrail = false) => {
  // Check for receiver name
  if (!receiverName.trim()) {
    // Show error toast
    return
  }

  // Guardrail: Check for manual discrepancies
  if (!skipGuardrail && issuesCount > 0) {
    setShowGuardrailModal(true)
    return
  }

  // Apply clean values (staged - not committed)
  const cleanLines = delivery.lines.map((line) => ({
    deliveryLineNumber: line.deliveryLineNumber,
    delivered: line.packQuantity.toString(),
    returned: "0",
    rejected: "0",
    lineComment: "",
  }))

  setLines(cleanLines)
  setShowApplyAllReminder(true) // Show info pop-up
}
```

#### Issue Detection Logic

```typescript
const checkIsIssueLine = (lineState: LineFormState, originalPackQuantity: number) => {
  const delivered = parseFloat(lineState.delivered) || 0
  const returned = parseFloat(lineState.returned) || 0
  const rejected = parseFloat(lineState.rejected) || 0
  return returned > 0 || rejected > 0 ||
         (delivered + returned + rejected) !== originalPackQuantity ||
         lineState.lineComment.trim() !== ""
}

const issuesCount = useMemo(() => {
  if (!delivery) return 0
  return lines.filter(l => {
    const orig = delivery.lines.find(ol => ol.deliveryLineNumber === l.deliveryLineNumber)
    return orig ? checkIsIssueLine(l, orig.packQuantity) : false
  }).length
}, [delivery, lines])
```

---

# API Integration Layer

## Authenticated Fetch Helpers

### `createAuthenticatedFetch()`
Creates a fetch function that automatically includes JWT token in Authorization header.

```typescript
export function createAuthenticatedFetch() {
  const token = localStorage.getItem("auth_token")

  return async (url: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${API_URL}${url}`, { ...options, headers })

    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      localStorage.removeItem("auth_token")
      localStorage.removeItem("auth_user")
      window.location.href = "/login"
    }

    return response
  }
}
```

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

### Invoice Interface
```typescript
interface Invoice {
  invoiceID: number
  invoiceNumber: string
  customerNumber: string
  customerName?: string
  invoiceAmount: number
  invoicedDate: string
  status: number
  statusText: string
  deliveryHeaderId?: number
  deliveryNumber?: string
  serialNumber?: string
  stampingStatus: number
  stampingStatusText: string
  hasPrintoutDocument: boolean
  stampedDocumentUrl?: string
  createdAt: string
}
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
/documents                     // Document Hub (unified invoices + deliveries)
/admin/uam                      // User Access Management (sysadmin only)

// Error Routes
/unauthorized                    // Access denied page
/*                              // Catch-all redirect
```

## Dynamic Landing Route (`resolveDefaultLandingRoute()`)

### Route Priority List
```typescript
const routePriorityList: Array<{ permission: string; path: string }> = [
  { permission: 'customer:read', path: '/customers' },
  { permission: 'invoice:read', path: '/invoices' },
  { permission: 'delivery:read', path: '/deliveries' },
]
```

### Resolution Logic

#### DecodedUserToken Interface
```typescript
export interface DecodedUserToken {
  roles: string[]
  permissions: string[]
}
```

#### isRootDashboardPath Function
```typescript
export function isRootDashboardPath(pathname: string): boolean {
  const normalizedPath = pathname.replace(/\/$/, '') // Strip trailing slashes
  return normalizedPath === '' || normalizedPath === '/dashboard'
}
```
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
- **Polling Interval:** 60 seconds (configurable via `POLLING_INTERVAL`)
- **Endpoint:** `GET /api/account/me`
- **Detects:** Security stamp changes, token expiry
- **Action:** Automatic logout and redirect to login
- **Token Update:** If a new token is received, it updates `localStorage`

### SecuritySessionGuard Behavior
```typescript
// On mount:
1. Initial session check via /api/account/me
2. Set up 60-second polling interval

// On each poll:
3. Fetch current user data with existing token
4. On 401 response: Clear localStorage, logout, redirect to /login
5. On success: Update token if new one received
6. On error: Silently fail, retry on next interval

// On unmount:
7. Clear polling interval
```

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

### Large Dataset Optimizations (DeliveryReceivePage - 5,000+ items)
- **Map-based State Management**: `Map<string, LineFormState>` replaces arrays for O(1) lookups
- **Set-based Issue Tracking**: `Set<string>` for O(1) issue checking
- **Uncontrolled Input Pattern**: Each LineItemRow manages local state, preventing parent re-renders on typing
- **useDeferredValue**: Search input uses deferred value to prioritize typing responsiveness
- **useTransition API**: Non-critical UI updates (issue tracking) use transitions for smooth typing
- **Custom React.memo Comparison**: `areLineItemRowPropsEqual` prevents unnecessary row re-renders
- **Lazy Render Expansion**: Expanded content only renders when `isExpanded={true}`
- **Row Handlers Cache**: Ref-based Map prevents creating new callbacks on every render
- **Early Return Optimization**: Filtered list returns original array when no search is active

### General Optimizations
- **Memoization:** `useMemo` for filtered/sorted data and expensive calculations
- **Stable References:** `useMemo` for API objects and computed values
- **Component Memoization:** `React.memo` for LineItemRow and modal components
- **useCallback Hooks:** Event handlers wrapped to prevent unnecessary re-renders
- **Lazy Rendering:** Modals and toasts only render when visible
- **Resource Cleanup:** Proper cleanup of object URLs and timers
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
