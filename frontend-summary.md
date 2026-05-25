# AmtemeterAI Frontend Documentation

## Overview

The frontend is built with **React 19** and **Vite** using **TypeScript**. It provides a premium, enterprise SaaS interface for the e-Meterai delivery management system with a clean, modern design following strict color constraints. The application includes **JWT-based authentication** with protected routes, GPS location capture, photo evidence management, and Google Maps integration.

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.5 | UI Framework |
| Vite | 8.0.10 | Build Tool |
| TypeScript | 6.0.2 | Type Safety |
| React Router | 7.14.2 | Client-side Routing |
| Tailwind CSS | 4.2.4 | Styling |
| @tailwindcss/postcss | 4.2.4 | Tailwind PostCSS Plugin |
| class-variance-authority | 0.7.1 | Component Variants |
| clsx | 2.1.1 | Class Name Utilities |
| tailwind-merge | 3.5.0 | Tailwind Class Merging |
| lucide-react | 1.14.0 | Icons |
| qrcode | 1.5.4 | QR Code Generation |
| recharts | 3.8.1 | Data Visualization & Charts |

---

## Project Structure

```
frontend/src/
├── App.tsx                          # Main App with Routing & AuthProvider
├── main.tsx                         # Application Entry Point
├── index.css                        # Tailwind CSS Imports
├── pages/                           # Route Pages
│   ├── Login/
│   │   ├── LoginPage.tsx            # Login Form with API Integration
│   │   └── index.ts
│   ├── Dashboard/
│   │   ├── DashboardPage.tsx        # Dashboard with Metrics
│   │   └── index.ts
│   ├── Customers/
│   │   ├── CustomersPage.tsx        # Customers Table + Pagination
│   │   └── index.ts
│   ├── Deliveries/
│   │   ├── DeliveriesPage.tsx       # Deliveries Table + Status Badges
│   │   ├── DeliveryDetailPage.tsx   # Delivery Details with QR Code, Photos, Maps
│   │   └── index.ts
│   └── Public/
│       ├── DeliveryReceivePage.tsx  # Public Delivery Receive Form with Photos & GPS
│       ├── Obsolete.tsx
│       └── index.ts
├── shared/
│   ├── contexts/
│   │   └── AuthContext.tsx           # Authentication State & Context
│   ├── layouts/
│   │   ├── DashboardLayout.tsx      # Sidebar Layout Wrapper (with logout)
│   │   └── index.ts
│   ├── components/
│   │   ├── ProtectedRoute.tsx        # Route Protection Component
│   │   └── ui/                     # shadcn-style Components
│   │       ├── Button.tsx           # Button with variants
│   │       ├── Badge.tsx            # Status Badges
│   │       ├── Card.tsx             # Card Components
│   │       ├── Input.tsx            # Text Input
│   │       ├── Label.tsx            # Form Label
│   │       ├── Table.tsx            # Table Components
│   │       ├── Pagination.tsx       # Pagination Component
│   │       └── index.ts
│   └── utils/
│       ├── api.ts                   # Authenticated API Helper Functions
│       └── cn.ts                    # className Utility (clsx + tailwind-merge)
├── assets/                          # Static Assets
│   ├── amtlogo.png                  # Company Logo
│   ├── amtlandscape.jpg             # Background image
│   ├── hero.png
│   └── react.svg, vite.svg
├── nginx.conf                       # Nginx configuration for SPA routing
├── Dockerfile                      # Docker build configuration
└── package.json                     # Dependencies and scripts
```

---

## Color System (STRICT)

### Brand Colors
| Color | Hex | Usage |
|-------|-----|-------|
| Primary Blue | `#1d2351` | Primary buttons, active states, sidebar, text |
| Accent Red | `#e61920` | Focus states, pending status, highlights |
| White | `#FFFFFF` | Background |

### Opacity Variants
Use these instead of adding new colors:
- `brand-blue/5` - Page background sections
- `brand-blue/8` - Card borders
- `brand-blue/10` - Hover states, selected state, badge backgrounds
- `brand-blue/20` - Button borders, input borders
- `brand-blue/30` - Disabled text, timestamps
- `brand-blue/40` - Activity dots
- `brand-blue/50` - Muted text, labels, placeholder
- `brand-blue/60` - Descriptions, secondary text
- `brand-blue/70` - Secondary information, navigation items
- `brand-red/10` - Accent badges, pending status

---

## Environment Configuration

### Development (`.env.development`)
```env
VITE_API_URL=http://localhost:8080
```

### Docker (`.env.docker`)
```env
VITE_API_URL=http://api:8080
```

**Usage:**
```typescript
const API_URL = import.meta.env.VITE_API_URL
const res = await fetch(`${API_URL}/api/customers`)
```

---

## Authentication System

### Overview
The application uses **JWT (JSON Web Token)** authentication with React Context for state management. Protected routes require a valid JWT token, while public routes (like the delivery receive page) are accessible without authentication.

### Auth Context (`AuthContext.tsx`)
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

### Auth Provider (`AuthProvider`)
- Automatic token persistence in `localStorage`
- User state management
- Session restoration on page reload

### Protected Route (`ProtectedRoute`)
- Redirects to `/login` if not authenticated
- Shows loading state while checking authentication
- Only renders children when authenticated

### API Helper (`api.ts`)
```typescript
const api = useApi()
const res = await api.get("/api/customers")
```
Features:
- Automatically adds `Authorization: Bearer {token}` header
- Handles 401 responses by clearing tokens and redirecting to login
- Provides `get`, `post`, `patch`, `delete` helper methods

### Route Protection
| Route | Protected | Description |
|-------|-----------|-------------|
| `/login` | No | Public login page |
| `/` | Yes | Dashboard |
| `/customers` | Yes | Customers page |
| `/deliveries` | Yes | Deliveries list |
| `/deliveries/:deliveryId` | Yes | Delivery details |
| `/receive/:token` | No | Public delivery receive (PIN-protected) |

---

## Routes

| Path | Page | Layout | Protected |
|------|------|--------|-----------|
| `/login` | Login Page | Standalone (Split Screen) | No |
| `/` | Dashboard | DashboardLayout (Sidebar) | Yes |
| `/customers` | Customers | DashboardLayout (Sidebar) | Yes |
| `/deliveries` | Deliveries List | DashboardLayout (Sidebar) | Yes |
| `/deliveries/:deliveryId` | Delivery Detail | DashboardLayout (Sidebar) | Yes |
| `/receive/:token` | Public Delivery Receive | Standalone (No Layout) | No |
| `*` | Redirect to login or home | - | - |

---

## Pages

### 1. Login Page (`/login`)

**Layout:** Split Screen (50% left form, 50% right pattern on large screens)

**Features:**
- Company logo (amtlogo.png)
- Title: "Welcome Back"
- Email and password inputs
- Error message display (brand-red accent)
- "Sign In" button with loading state
- Demo credentials hint

**Demo Credentials:**
- Email: admin@amtemeterai.com
- Password: Admin@123

**API Integration:**
- Posts to `POST /api/account/login`
- Stores JWT token and user info via `AuthContext`
- Redirects to originally requested page or `/`

---

### 2. Dashboard Page (`/`)

**Layout:** DashboardLayout with Sidebar

**Features:**
- KPI cards:
  - Total Deliveries
  - Pending Invoice
  - Rejection Rate (with alert styling when >5%)
- Interactive area chart showing delivery trends (30-day)
- Recent activity feed with severity indicators
- ERP connectivity status indicator

**API Integration:**
- Fetches stats from `GET /api/dashboard/stats`
- Fetches chart data from `GET /api/dashboard/charts`
- Fetches activity logs from `GET /api/dashboard/logs`

**Components:**
- Page Header with title and description
- Metrics Grid with icons and conditional alert styling
- Activity Log feed with color-coded severity indicators

---

### 3. Customers Page (`/customers`)

**Layout:** DashboardLayout with Sidebar

**Features:**
- Search/filter by name, code, email, or PIN
- Sort functionality on all columns
- Analytics cards showing:
  - Total customers
  - Verified domains
  - Missing communications
- "Sync Customers" button
- Table with pagination

**Table Columns:**
- Customer Code
- Customer Name
- Email
- Address

**API Integration:**
- Fetches customer data from `GET /api/customers`
- Syncs via `POST /api/customers/sync`
- Uses authenticated API helper

---

### 4. Deliveries Page (`/deliveries`)

**Layout:** DashboardLayout with Sidebar

**Features:**
- Multi-column sorting (date, number, status)
- Compliance type filters (BC, Non-BC, All)
- Discrepancy-only filter
- Photo proof indicators
- Location-based routing information
- Status badges with visual indicators

**Table Columns:**
- Delivery Code
- Customer Code
- Type (BC/Non-BC)
- Status (Badge)
- Date
- Photos count
- Location info (Province, City, District)

**Status Badges:**
- `OnGoing` → `default` variant (blue)
- `Delivered` → `default` variant (blue)
- `Pending` → `accent` variant (red)

---

### 5. Delivery Detail Page (`/deliveries/:deliveryId`)

**Layout:** DashboardLayout with Sidebar

**Components:**
- Page Header: Title + Description + Back Button
- Delivery Info Card: Basic delivery info + status badge
- Receiver Access Card: Public URL + QR Code
- Photo Gallery Card: Photo evidence with preview modal
- Location Map Card: Google Maps embed with delivery location
- Delivery Lines Table: Detailed line items

**Delivery Info Displayed:**
- Delivery Number, Date, Remarks
- Customer Code and Name
- Plant, Sales Person info
- Delivery Type (BC/Non-BC)
- Receiver Status (Fully/Partial Received)
- GPS Coordinates (Latitude, Longitude)
- Structured Address (Province, CityRegency, District, FormattedAddress)
- Photos count
- Received/Invoiced Status

**Receiver Access Features:**
- Public URL input field (read-only)
- Copy URL button with success feedback
- "Open Link in New Tab" button
- QR Code display (200x200px, generated with qrcode library)
- Download QR Code button

**Photo Gallery Features:**
- Grid display of delivery photos
- Click to enlarge in preview modal
- Show photo metadata (filename, upload date)
- Visual indicators for photo status

**Location Map Features:**
- Google Maps embed showing delivery location
- Display coordinates
- Link to open in Google Maps
- Structured address display

**API Integration:**
- Fetches delivery data from `GET /api/deliveries/{deliveryId}`
- Generates QR code client-side using `qrcode` library

---

### 6. Public Delivery Receive Page (`/receive/:token`)

**Layout:** Standalone (No sidebar, no layout wrapper)

**States:**
- Loading
- Error
- Not Verified (PIN verification)
- Verified (delivery details and form)
- Already Received (read-only mode)
- Not Received (editable form)
- Submitted (success message)

**PIN Verification:**
- Lock icon in centered circle
- Title: "Delivery Verification"
- PIN Input (password, numeric, maxLength=6)
- Auto-focused on mount
- Enter key submits
- Error message display (red background)
- "Access Delivery" button
- Verification persists in sessionStorage

**Delivery Items Form:**
Each line item has:
- Delivered (number, step 0.01)
- Returned (number, step 0.01)
- Rejected (number, step 0.01)
- Remarks/Comment (text input)

**Validation:**
- Total (Delivered + Returned + Rejected) cannot exceed Pack Quantity
- Per-line validation errors displayed in red
- Receiver Name is required
- Inputs disabled when already received or after submission

**Receiver Information:**
- Receiver Name (required text input)
- Notes (optional text input)

**Photo Management:**
- Max 5 photos per delivery
- Max file size: 5MB
- Supported formats: JPG, PNG
- Hybrid display:
  - **Legacy photos** - Already stored on server
  - **Staged photos** - New uploads pending submission
- Legacy photo actions:
  - Toggle delete (🗑️ Wipe / ↩️ Keep)
  - Visual dimming when marked for deletion
  - "Legacy" badge
- Staged photo actions:
  - Remove from staged uploads
  - Amber border styling
  - "Staged" badge
- Real-time photo count display

**GPS Location Capture:**
- Automatic geolocation on page load using browser Geolocation API
- High accuracy mode enabled
- 5-second timeout
- Coordinates sent with form submission:
  - Latitude
  - Longitude
- Backend performs reverse geocoding to address

**API Integration:**
- Verifies PIN via `POST /api/deliveries/{token}/verify-pin`
- Fetches delivery via `GET /api/deliveries/{token}`
- Submits confirmation via `PATCH /api/deliveries/{token}` (multipart/form-data)

**Form Submission Payload:**
```typescript
formData.append("ReceiverName", ...)
formData.append("ReceiverNotes", ...)
formData.append("Latitude", ...)
formData.append("Longitude", ...)
photoFiles.forEach(file => formData.append("NewPhotoFiles", file))
keysToDelete.forEach((key, index) => formData.append(`KeysToDelete[${index}]`, key))
lines.forEach((line, index) => {
  formData.append(`Lines[${index}].DeliveryLineNumber`, ...)
  formData.append(`Lines[${index}].PackQuantityDelivered`, ...)
  formData.append(`Lines[${index}].PackQuantityReturned`, ...)
  formData.append(`Lines[${index}].PackQuantityRejected`, ...)
  formData.append(`Lines[${index}].LineComment`, ...)
})
```

**Financial Lock:**
- Banner displayed when delivery is invoiced
- Form inputs disabled for invoiced deliveries
- Message: "This record has already been invoiced and cannot be modified."

---

## Layouts

### DashboardLayout

**Structure:**
- Left Sidebar (fixed width: 256px)
- Main Content (flex-grow, max-width: 6xl)

**Sidebar Components:**
1. **Logo Section:**
   - Company logo (amtlogo.png, w-24)
   - Link to home page

2. **Navigation Menu:**
   - Dashboard (`/`)
   - Customers (`/customers`)
   - Deliveries (`/deliveries`)

   **Active State:** `bg-brand-blue/10` + solid blue left border
   **Hover State:** `bg-brand-blue/5`
   **Default State:** `text-brand-blue/70`

3. **User Section:**
   - Avatar circle with initial "A"
   - User name: "Admin User"
   - Email: "admin@amtemeterai.com"
   - Logout button

**Main Content:**
- Background: `bg-brand-blue/[0.02]`
- Padding: `p-8`
- Max width: `max-w-6xl mx-auto`

---

## UI Components

### Button

**Variants:**
| Variant | Style |
|---------|-------|
| `default` | Blue background, white text, shadow-sm |
| `outline` | Blue border, blue text, hover bg-blue/5 |
| `ghost` | No border, muted text, hover bg-blue/5 |

**Sizes:**
| Size | Dimensions |
|------|------------|
| `sm` | h-9, text-xs |
| `default` | h-10 |
| `lg` | h-11 |

---

### Card

**Components:**
- `Card` - Main container (`rounded-xl`, `border-brand-blue/8`, `shadow-sm`)
- `CardHeader` - Header section (`p-6`)
- `CardTitle` - Title (`text-lg`, `font-semibold`, `tracking-tight`)
- `CardDescription` - Description (`text-sm`, `text-brand-blue/60`)
- `CardContent` - Content (`p-6 pt-0`)

---

### Badge

**Variants:**
| Variant | Style |
|---------|-------|
| `default` | `bg-brand-blue/10 text-brand-blue` |
| `outline` | `border brand-blue/20 text-brand-blue` |
| `accent` | `bg-brand-red/10 text-brand-red` |

---

### Input

**Features:**
- `h-10` height
- `rounded-lg` corners
- `border-brand-blue/10`
- `bg-white/50` background
- Placeholder: `text-brand-blue/30`
- Focus: red ring (`ring-brand-red/50`) + border highlight
- Disabled state handling

---

### Table

**Components:**
- `Table` - Wrapper with overflow-auto
- `TableHeader` - Thead with bottom border (`border-brand-blue/8`)
- `TableBody` - Tbody
- `TableRow` - Tr with hover state (`hover:bg-brand-blue/[0.02]`)
- `TableHead` - Th (`h-12`, `px-4`, `text-left`, `align-middle`)
- `TableCell` - Td (`p-4`, `align-middle`)

---

### Pagination

**Props:**
| Prop | Type |
|------|------|
| `currentPage` | number |
| `totalPages` | number |
| `onPageChange` | (page: number) => void |

**Features:**
- Previous/Next buttons (w-16 for Previous)
- Page number buttons (w-10)
- Smart ellipsis for 7+ pages
- Active state: `bg-brand-blue text-white`
- Disabled state: `text-brand-blue/30`

---

## Utilities

### API Helper Functions (`api.ts`)

Provides authenticated API calls with automatic JWT token handling and 401 error management.

**Available Functions:**
```typescript
// Authenticated HTTP methods
authGet(url: string)
authPost(url: string, body?: any)
authPatch(url: string, body?: any)
authDelete(url: string)

// Hook for accessing methods
const api = useApi()
await api.get("/api/customers")
await api.post("/api/deliveries", data)
```

**Dashboard-Specific Functions:**
```typescript
getDashboardStats()      // Returns: { totalDeliveries, pendingDeliveries, pendingInvoice, rejectionRate }
getDashboardCharts()     // Returns: Array<{ date: string, count: number }>
getDashboardLogs(count?: number) // Returns: Array<ActivityLog>
```

**Automatic Token Management:**
- Reads JWT from `localStorage.getItem("auth_token")`
- Adds `Authorization: Bearer {token}` header
- Clears tokens and redirects to `/login` on 401 responses

---

### `cn()` - className Utility

Combines `clsx` and `tailwind-merge` for intelligent class name merging.

```typescript
import { cn } from "../utils/cn"

cn("class1", condition && "class2", "class3")
```

---

## Design Principles

### Typography
- Default sans-serif (Tailwind)
- Clear hierarchy with weight and size
- `tracking-tight` on headings
- `tracking-wider` on uppercase labels

### Spacing Rhythm
- Section spacing: 32px (`space-y-8`)
- Component spacing: 20-24px
- Internal spacing: 8-12px

### Border Radius
- Cards: `rounded-xl`
- Buttons/Inputs: `rounded-lg`
- Pagination/Badges: `rounded-md` or `rounded-full`

### Transitions
- `transition-all duration-200` on interactive elements
- Smooth hover and focus states

---

## Development

### Root Scripts (Concurrent Development)

| Command | Description |
|---------|-------------|
| `npm run dev` | Runs both backend and frontend concurrently |
| `npm run dev:backend` | Runs backend only (`dotnet run`) |
| `npm run dev:frontend` | Runs frontend only (`npm run dev` in frontend directory) |

### Frontend Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |

### Dev Server
- Default port: 5173 (auto-increments if in use)
- Hot Module Replacement (HMR) enabled
- Host flag enabled for Docker compatibility (`--host`)

---

## Key Features

### Premium UI Elements
- Light sidebar with subtle active states
- Cards with soft borders and shadows
- Subtle hover effects on all interactive elements
- Red accent only for focus states and highlights
- Consistent opacity-based color system

### Authentication & Security
- JWT-based authentication
- Protected routes with automatic redirects
- Session persistence via localStorage
- PIN-based verification for public delivery access
- Financial lock for invoiced deliveries

### Photo Evidence System
- Multi-file upload with drag-and-drop support
- Real-time preview of staged uploads
- Hybrid photo management (server + client)
- Visual status indicators (Legacy/Staged)
- Delete/revert functionality
- File validation (size limits, type restrictions)

### GPS & Location Services
- Automatic geolocation on page load
- GPS coordinates sent with form submission
- Google Maps integration for visualization
- Structured address fields (Province, City, District)
- Reverse geocoding by backend

### Accessibility
- Proper semantic HTML
- Focus visible states with red ring
- Disabled state handling
- Proper label-input association

### Responsive
- Split-screen login collapses on mobile
- Table overflow handling
- Responsive grid layouts
- Mobile-first design

---

## API Integration Status

| Page | API Integration | Authentication | Notes |
|------|----------------|----------------|-------|
| Login | Live API | No | Posts to `POST /api/account/login` |
| Dashboard | Live API | Yes | Fetches stats, charts, and logs from `/api/dashboard/*` |
| Customers | Live API | Yes | Uses authenticated API helper |
| Deliveries List | Live API | Yes | Uses authenticated API helper |
| Delivery Detail | Live API | Yes | Uses authenticated API helper |
| Public Receive | Live API | No | PIN verification, GPS, photo uploads |

---

## PIN Verification System

### Overview
- Receivers must enter correct PIN (from Customer.CustomerPin) before accessing delivery details
- Verification is performed server-side for security
- Verification status persists for the current session via sessionStorage

### Implementation Details

**Frontend (DeliveryReceivePage.tsx):**
```typescript
// States
const [isVerified, setIsVerified] = useState(false)
const [pinInput, setPinInput] = useState("")
const [verifying, setVerifying] = useState(false)
const [pinError, setPinError] = useState<string | null>(null)

// Verify PIN function
const handleVerifyPin = async () => {
  const res = await fetch(`${API_URL}/api/deliveries/${token}/verify-pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: pinInput }),
  })

  if (res.ok) {
    setIsVerified(true)
    sessionStorage.setItem(`verified-${token}`, "true")
  } else if (res.status === 401) {
    setPinError("Invalid PIN. Please try again.")
  }
}
```

**Security Considerations:**
- PIN is validated on the server, never exposed in frontend
- Delivery details are not loaded until PIN is verified
- Verification is session-based, cleared on component unmount
- PIN input is masked (password type) with numeric input mode

---

## QR Code Generation

The application uses `qrcode` library to generate QR codes client-side:

**Installation:**
```bash
npm install qrcode
```

**Usage in DeliveryDetailPage:**
```typescript
import QRCode from "qrcode"

const qrDataUrl = await QRCode.toDataURL(publicUrl, {
  width: 200,
  margin: 1,
  color: {
    dark: "#1d2351",  // Brand blue
    light: "#ffffff",
  },
})
```

---

## Form Handling Patterns

### State Management
```typescript
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const [submitting, setSubmitting] = useState(false)
const [submitted, setSubmitted] = useState(false)
```

### Validation
```typescript
const validateLines = (): boolean => {
  const errors: Record<string, string> = {}
  let isValid = true

  delivery.lines.forEach((line) => {
    const total = delivered + returned + rejected
    if (total > line.packQuantity) {
      errors[line.deliveryLineNumber] = "Total exceeds pack quantity"
      isValid = false
    }
  })

  setValidationErrors(errors)
  return isValid
}
```

### Submission Pattern
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!validate()) return

  setSubmitting(true)
  try {
    const res = await fetch(`${API_URL}/endpoint`, {
      method: "POST",
      body: formData,
    })

    if (!res.ok) throw new Error("Failed")
    setSubmitted(true)
  } catch (err) {
    setError(err.message)
  } finally {
    setSubmitting(false)
  }
}
```

---

## Docker Build Configuration

### Frontend Dockerfile

```dockerfile
# BUILD STAGE
FROM node:20 AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# RUNTIME STAGE
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

### Frontend Nginx Configuration

```nginx
server {
    listen 80;

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(?:ico|css|js|gif|jpe?g|png)$ {
        root /usr/share/nginx/html;
        expires 30d;
        add_header Cache-Control "public";
    }
}
```

---

## Future Enhancements

- Mobile sidebar (drawer/modal)
- Real-time metrics on Dashboard (fetch from API)
- Loading states and skeletons
- Empty states for no data
- Enhanced error handling
- Form validation on login
- Search and filter functionality
- Sortable tables
- Customer profile pages
- Invoice generation and download
- Email notifications for new deliveries
- Delivery history and analytics