# Engineering Specification: Dynamic Login Landing Redirect & Route Guard Fix

## 1. Context & Issue Diagnostics
We have successfully implemented client-side route guards and permission matrix mappings. However, a routing deadlock occurs for non-sysadmin users upon logging in. 

### The Problem
The current post-login or base entry routing logic redirects everyone universally to a static landing page (e.g., `/dashboard` or `/dashboard/main`). Since roles like `sales` or `finance` do not have the access code or claim required for that specific route, the global `RouteGuard` instantly triggers, flags it as unauthorized, and traps the user on an unauthorized screen, preventing them from accessing the sub-menus they actually own (like `/dashboard/deliveries` or `/dashboard/customer`).

### Objective
Refactor the post-login routing engine and root dashboard entry files to dynamically calculate the landing target based on the user's highest-priority available menu claim.

---

## 2. Part 1: Defining Route Priorities & The Redirection Utility

### Task 1.1: Create a Dynamic Landing Resolver (`routeResolver.ts`)
Create a shared utility file (or extend your existing auth/route token helper) to determine the user's default route based on their parsed JWT claims payload.

```typescript
import { routePermissions } from './routePermissions'; // Your existing structural map

export interface DecodedUserToken {
  role?: string;
  menus?: string[]; // e.g., ["deliveries", "customer"]
}

/**
 * Evaluates user permissions and resolves the top available layout route.
 */
export function resolveDefaultLandingRoute(user: DecodedUserToken): string {
  // 1. System administrators always default to the core administration hub
  if (user.role === 'sysadmin') {
    return '/dashboard/admin/uam';
  }

  // 2. Ordered preference layout fallback list for standard users
  const routePriorityList = [
    { accessCode: 'deliveries', path: '/dashboard/deliveries' },
    { accessCode: 'customer', path: '/dashboard/customer' },
    { accessCode: 'invoices', path: '/dashboard/invoices' }
  ];

  // Find the first route matching the user's active menu claims
  const targetRoute = routePriorityList.find(route => 
    user.menus?.includes(route.accessCode)
  );

  // 3. Fallback if user has no menu permissions at all
  return targetRoute ? targetRoute.path : '/unauthorized';
}
3. Part 2: Frontend Integration Points (Astro / React)
Task 2.1: Refactor the Post-Login Redirection Hook
Locate your login form action handler (where your API returns the successful JWT token). Replace the hardcoded navigation target with the resolver tool.

Code Pattern Change:

TypeScript
// BEFORE:
// localStorage.setItem('token', tokenData.token);
// window.location.href = '/dashboard';

// AFTER REFACTOR:
localStorage.setItem('token', tokenData.token);
const decodedToken = decodeJwtToken(tokenData.token); // Utilizes your active jwt-decode logic
const landingPath = resolveDefaultLandingRoute(decodedToken);
window.location.href = landingPath;
Task 2.2: Update the Root Entry File (/dashboard/index.astro or Route /dashboard)
If an authenticated user explicitly types or clicks a link directly back to the bare root /dashboard path, the system should catch it and auto-forward them to their appropriate working menu.

Update the index/root dashboard layout mounting element:

TypeScript
// Inside your root /dashboard page controller or layout effect mount
useEffect(() => {
  const token = localStorage.getItem('token');
  if (token) {
    const decoded = decodeJwtToken(token);
    const destination = resolveDefaultLandingRoute(decoded);
    
    // Only redirect if they are sitting on the bare dashboard route to avoid infinite evaluation loops
    if (window.location.pathname === '/dashboard' || window.location.pathname === '/dashboard/') {
      window.location.href = destination;
    }
  }
}, []);
4. Part 3: Fixing Route Guard Deadlock Adjustments
Task 3.1: Exclude Root Contexts from Route Checking
Review your global route guard component (RouteGuard.tsx). Ensure that bare structural root paths or redirecting loading layouts do not throw false-positive unauthorized flags while the resolver calculation runs.

Logic adjustment inside RouteGuard.tsx:

TypeScript
const currentPath = window.location.pathname.replace(/\/$/, ""); // Strip trailing slashes

// If sitting on the base dashboard route, skip the strict claim validation match 
// and allow the internal index redirect loop to take care of positioning
if (currentPath === '/dashboard') {
  return <LoadingSpinner />; 
}
5. Verification Checklist for Claude Code
Log in with a sales account: verify it skips the base dashboard root page entirely and routes instantly to /dashboard/customer or /dashboard/deliveries.

Log in with a finance account: verify it routes directly to /dashboard/invoices.

Manually typing /dashboard into the URL bar for a restricted user must cleanly slide them forward into their top-priority active workspace instead of locking them up on the unauthorized fallback layout.

Execute npm run build / astro check to ensure zero frontend static route mismatches or typing breaks.