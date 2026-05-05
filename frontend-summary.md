# AmtemeterAI Frontend Documentation

## Overview

The frontend is built with **React 19** and **Vite** using **TypeScript**. It provides a premium, enterprise SaaS interface for the e-Meterai delivery management system with a clean, modern design following strict color constraints.

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
| lucide-react | 1.14.0 | Icons (used in Dashboard) |
| qrcode | 1.5.4 | QR Code Generation |

---

## Project Structure

```
frontend/src/
├── App.tsx                          # Main App with Routing
├── main.tsx                         # Application Entry Point
├── index.css                        # Tailwind CSS Imports
├── pages/                           # Route Pages
│   ├── Login/
│   │   ├── LoginPage.tsx            # Login Form (Split Screen)
│   │   └── index.ts
│   ├── Dashboard/
│   │   ├── DashboardPage.tsx        # Dashboard with Metrics
│   │   └── index.ts
│   ├── Customers/
│   │   ├── CustomersPage.tsx        # Customers Table + Pagination
│   │   └── index.ts
│   ├── Deliveries/
│   │   ├── DeliveriesPage.tsx       # Deliveries Table + Status Badges
│   │   ├── DeliveryDetailPage.tsx   # Delivery Details with QR Code
│   │   └── index.ts
│   └── Public/
│       ├── DeliveryReceivePage.tsx  # Public Delivery Receive Form
│       └── index.ts
├── shared/
│   ├── layouts/
│   │   ├── DashboardLayout.tsx      # Sidebar Layout Wrapper
│   │   └── index.ts
│   ├── components/
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
│       └── cn.ts                    # className Utility (clsx + tailwind-merge)
└── assets/                          # Static Assets
    └── amtlogo.png                  # Company Logo
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

The frontend uses environment variables for API URL configuration based on the runtime environment:

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

This allows seamless switching between local development and Docker environments.

---

## Routes

| Path | Page | Layout |
|------|------|--------|
| `/login` | Login Page | Standalone (Split Screen) |
| `/` | Dashboard | DashboardLayout (Sidebar) |
| `/customers` | Customers | DashboardLayout (Sidebar) |
| `/deliveries` | Deliveries List | DashboardLayout (Sidebar) |
| `/deliveries/:deliveryId` | Delivery Detail | DashboardLayout (Sidebar) |
| `/receive/:token` | Public Delivery Receive | Standalone (No Layout) |
| `*` | Redirect to `/` | - |

---

## Pages

### 1. Login Page (`/login`)

**Layout:** Split Screen (50% left form, 50% right pattern on large screens)

**Left Side (Form):**
- Company logo (amtlogo.png, w-32)
- Title: "Welcome Back"
- Subtitle: "Sign in to access your account"
- Form fields:
  - Email input
  - Password input
  - "Sign In" button (full width, blue)

**Right Side (Pattern):**
- Solid blue background (`bg-brand-blue`)
- Subtle diagonal dot pattern (5% opacity)
- Decorative concentric circles
- Small accent dots

**State Management:**
- `email`: string
- `password`: string

**Styling:**
- Background: `bg-brand-blue/[0.02]`
- Premium rounded corners (`rounded-lg`)
- Subtle shadows and transitions

---

### 2. Dashboard Page (`/`)

**Layout:** DashboardLayout with Sidebar

**Components:**
- Page Header: Title + Description
- Metrics Grid: 3 Cards with Icons
- Recent Activity: List with Dot Indicators

**Metrics Cards:**
1. **Ongoing Deliveries** - Value: "24", Description: "Currently in transit"
2. **Pending Invoice** - Value: "156", Description: "Delivered but not invoiced"
3. **e-Meterai Quota** - Value: "8,432", Description: "Remaining stamps this month"

Each card includes:
- Icon in rounded container (`bg-brand-blue/5`)
- Uppercase tracking-wider label
- Large bold value
- Description text

**Recent Activity Section:**
- Displays 3 mock activities
- Each item: Dot indicator + text + timestamp
- Hover effects on rows

---

### 3. Customers Page (`/customers`)

**Layout:** DashboardLayout with Sidebar

**Components:**
- Page Header: Title + Description + "Sync Customers" button
- Card with Table
- Pagination

**Table Columns:**
| Column | Style |
|--------|-------|
| Customer Code | `font-medium text-brand-blue` |
| Customer Name | Default |
| Email | `text-brand-blue/70` |
| Address | `text-brand-blue/70` |

**Header Styling:**
- Uppercase, tracking-wider
- `text-brand-blue/50`

**API Integration:**
- Fetches customer data from `GET /api/customers` on mount
- Uses environment variable `VITE_API_URL` for endpoint configuration
- Displays `customerId`, `customerCode`, `customerName`, `customerEmail` from API response
- Loading state with `loading` boolean

**Pagination:**
- 10 items per page (`ITEMS_PER_PAGE`)
- Smart ellipsis display for 7+ pages
- Previous/Next buttons
- Page number buttons with active state

---

### 4. Deliveries Page (`/deliveries`)

**Layout:** DashboardLayout with Sidebar

**Components:**
- Page Header: Title + Description
- Card with Table
- Pagination

**Table Columns:**
| Column | Style |
|--------|-------|
| Delivery Code | `font-medium text-brand-blue` |
| Customer Code | Default |
| Status | Badge component (currently commented out) |
| Date | `text-brand-blue/70` |

**Status Badges:**
- `OnGoing` → `default` variant (blue)
- `Delivered` → `default` variant (blue)
- `Pending` → `accent` variant (red)

**API Integration:**
- Fetches delivery data from `GET /api/deliveries` on mount
- Uses environment variable `VITE_API_URL` for endpoint configuration
- Displays `deliveryId`, `deliveryNumber`, `customerCode`, `deliveryDate`, `received`, `invoiced` from API response
- Loading state with `loading` boolean

**Pagination:**
- 5 items per page (`ITEMS_PER_PAGE`)
- Smart ellipsis display

---

### 5. Delivery Detail Page (`/deliveries/:deliveryId`)

**Layout:** DashboardLayout with Sidebar

**Components:**
- Page Header: Title + Description + Back Button
- Delivery Header Card: Delivery info with customer details
- Receiver Access Card: Public URL + QR Code
- Delivery Lines Table: Detailed line items

**Delivery Info Displayed:**
- Delivery Number, Date, Remarks
- Customer Code and Name
- Received Status (Badge: "Received" / "Not Received")
- Invoice Status (Badge: "Invoiced" / "Not Invoiced")
- Receiver Name and Notes (if received)

**Receiver Access Features:**
- Public URL input field (read-only)
- Copy URL button with success feedback
- "Open Link in New Tab" button
- QR Code display (200x200px, generated with qrcode library)
- Download QR Code button (saves as PNG)

**Delivery Lines Table Columns:**
| Column | Style |
|--------|-------|
| Line # | `font-medium text-brand-blue` |
| Item Code | `text-brand-blue/70` |
| Description | Default |
| Sales Qty | `text-right text-brand-blue/80` |
| Pack Qty | `text-right text-brand-blue/80` |
| Delivered | `text-right text-brand-blue/80` |
| Returned | `text-right text-brand-blue/80` |
| Rejected | `text-right text-brand-blue/80` |

**API Integration:**
- Fetches delivery data from `GET /api/deliveries/{deliveryId}` on mount
- Uses `useParams` hook to get `deliveryId` from URL
- Generates QR code in frontend using `qrcode` library
- Error handling with back button navigation
- Loading state display

**QR Code Generation:**
```typescript
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

### 6. Public Delivery Receive Page (`/receive/:token`)

**Layout:** Standalone (No sidebar, no layout wrapper)

**Components:**
- Page Header: Title + Description
- Delivery Info Card: Basic delivery info + status badge
- Delivery Items Card: Line items with quantity inputs
- Receiver Information Card: Name and notes (if not received)
- Success Message Card: Displayed after submission
- Submit Button

**States:**
- Loading: Shows loading message
- Error: Shows error message in centered card
- Already Received: Shows delivery in read-only mode
- Not Received: Shows form with editable inputs
- Submitted: Shows success message

**Delivery Items Form:**
Each line item has three quantity inputs:
- Delivered (number, step 0.01)
- Returned (number, step 0.01)
- Rejected (number, step 0.01)

**Validation:**
- Total (Delivered + Returned + Rejected) cannot exceed Pack Quantity
- Per-line validation errors displayed in red
- Receiver Name is required
- Inputs disabled when already received or after submission

**Receiver Information:**
- Receiver Name (required text input)
- Notes (optional text input)
- Only shown for new (not received) deliveries

**API Integration:**
- Fetches delivery data from `GET /api/deliveries/{token}` on mount
- Submits delivery confirmation to `PATCH /api/deliveries/{token}`
- Request body includes:
  ```json
  {
    "receiverName": "John Doe",
    "receiverNotes": "Received in good condition",
    "lines": [
      {
        "deliveryLineNumber": "1",
        "packQuantityDelivered": 10.00,
        "packQuantityReturned": 0.00,
        "packQuantityRejected": 0.00
      }
    ]
  }
  ```
- Updates local state after successful submission
- Error handling with user-friendly messages

**Form State:**
```typescript
interface LineFormState {
  deliveryLineNumber: string
  delivered: string
  returned: string
  rejected: string
}
```

**UX Features:**
- Real-time validation as user types
- Success checkmark animation
- Disabled states for read-only view
- Responsive design (max-width: xl)
- Clear visual hierarchy

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

**Features:**
- `rounded-lg` corners
- Focus ring with red accent
- Smooth transitions (duration-200)
- Disabled state handling

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

**Features:**
- `rounded-full`
- `px-2.5 py-0.5`
- `text-xs font-medium`

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

### Label

**Features:**
- `text-sm font-medium`
- Peer-disabled support
- Proper htmlFor attribute for accessibility
- Used with Input components for form labeling

---

---

### Table

**Components:**
- `Table` - Wrapper with overflow-auto
- `TableHeader` - Thead with bottom border (`border-brand-blue/8`)
- `TableBody` - Tbody
- `TableRow` - Tr with hover state (`hover:bg-brand-blue/[0.02]`)
- `TableHead` - Th (`h-12`, `px-4`, `text-left`, `align-middle`)
- `TableCell` - Td (`p-4`, `align-middle`)

**Features:**
- Border-bottom on rows
- Hover effect on rows
- Selected state support

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
- Hover state: `hover:bg-brand-blue/10`

---

## Utilities

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

The root `package.json` provides scripts to run both backend and frontend concurrently:

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

## Assets

| File | Description |
|------|-------------|
| `amtlogo.png` | Company logo used in sidebar and login page |

---

## Key Features

### Premium UI Elements
- Light sidebar with subtle active states
- Cards with soft borders and shadows
- Subtle hover effects on all interactive elements
- Red accent only for focus states and highlights
- Consistent opacity-based color system

### Accessibility
- Proper semantic HTML
- Focus visible states with red ring
- Disabled state handling
- Proper label-input association

### Responsive
- Split-screen login collapses on mobile
- Sidebar hidden on mobile (for future enhancement)
- Table overflow handling
- Responsive grid layouts

---

## API Integration Status

| Page | API Integration | Notes |
|------|----------------|-------|
| Dashboard | Mock data | Static metrics displayed |
| Customers | ✅ Live API | Fetches from `GET /api/customers` |
| Deliveries List | ✅ Live API | Fetches from `GET /api/deliveries` |
| Delivery Detail | ✅ Live API | Fetches from `GET /api/deliveries/{id}` |
| Public Receive | ✅ Live API | Fetches/Updates via token endpoint |

---

## QR Code Generation

The application uses the `qrcode` library to generate QR codes client-side:

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

**Features:**
- Generates Data URL (base64) for direct image display
- Configurable size and colors
- Used for sharing delivery links with customers

---

## Public URL Handling

The frontend generates public URLs for delivery receiving:

**Format:**
```
{VITE_API_URL}/receive/{receiverToken}
```

**Usage:**
- Displayed in Delivery Detail page
- Can be copied to clipboard
- Opens in new tab for customer access
- Embedded in QR code for easy scanning

**Environment-Based:**
- Development: `http://localhost:5173/receive/{token}`
- Production: Configured via `VITE_API_URL`

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

  // Validation logic
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) throw new Error("Failed")

    setSubmitted(true)
    // Update local state
  } catch (err) {
    setError(err.message)
  } finally {
    setSubmitting(false)
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
