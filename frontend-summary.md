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
│   └── Deliveries/
│       ├── DeliveriesPage.tsx       # Deliveries Table + Status Badges
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

## Routes

| Path | Page | Layout |
|------|------|--------|
| `/login` | Login Page | Standalone (Split Screen) |
| `/` | Dashboard | DashboardLayout (Sidebar) |
| `/customers` | Customers | DashboardLayout (Sidebar) |
| `/deliveries` | Deliveries | DashboardLayout (Sidebar) |
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

**Pagination:**
- 7 items per page
- Smart ellipsis display for 7+ pages
- Previous/Next buttons
- Page number buttons with active state

**Dummy Data:** 8 customers (CUST001 - CUST008)

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
| Customer Name | Default |
| Status | Badge component |
| Date | `text-brand-blue/70` |

**Status Badges:**
- `OnGoing` → `default` variant (blue)
- `Delivered` → `default` variant (blue)
- `Pending` → `accent` variant (red)

**Pagination:**
- 5 items per page
- Smart ellipsis display

**Dummy Data:** 7 deliveries (DLV1001 - DLV1007)

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

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |

### Dev Server
- Default port: 5173 (auto-increments if in use)
- Hot Module Replacement (HMR) enabled

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

## Future Enhancements

- Mobile sidebar (drawer/modal)
- Real API integration (currently using dummy data)
- Loading states
- Empty states
- Error handling
- Form validation on login
- Data fetching from backend API
- Search and filter functionality
- Sortable tables
