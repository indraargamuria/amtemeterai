# Engineering Specification: Dynamic Landing Page Redirects & Root Route Protection

## 1. Objective
Fix the post-login routing issue where users (like the `warehouse` role) are hardcoded to redirect to the root dashboard path (`/`), allowing them to see layouts they lack permissions for. The system must dynamically determine the home path based on user permissions immediately after login and protect the root route (`/`) from unauthorized rendering.

## 2. Core Business Requirements
- **`sysadmin`**, **`sales`**, and **`finance`** hold `dashboard:read` and should land on `/`.
- **`warehouse`** holds only `delivery:read` and must automatically land on `/deliveries` upon login.
- If an authorized user navigates to `/` but does not possess `dashboard:read`, they must be auto-redirected to their first available menu route.

---

## 3. Implementation Steps for Claude

### Task 3.1: Update the Post-Login Redirection Logic
Locate the submit handler in your Login component (e.g., `Login.tsx` or `login/index.astro`). Instead of hardcoding a redirection path to `/`, implement a helper function to resolve the target route based on the decrypted token claims:

```typescript
function getLandingPage(permissions: string[]): string {
  if (permissions.includes('dashboard:read')) return '/';
  if (permissions.includes('delivery:read')) return '/deliveries';
  if (permissions.includes('customer:read')) return '/customers';
  if (permissions.includes('invoice:read')) return '/invoices';
  
  return '/unauthorized';
}

// Inside your login success handler:
const tokenData = decodeJwt(response.token);
const targetPath = getLandingPage(tokenData.permissions || []);
router.push(targetPath); // Dynamically routes warehouse to /deliveries
Task 3.2: Add an Autoredirect Guard to the Root Path (/)
Locate the main index component or layout mapping your dashboard route (/). Add a layout-level hook or router guard checking for specific capabilities before mounting the page view elements:

TypeScript
// Inside your root path route component/guard
export function RootRouteGuard({ children, userPermissions }) {
  // If they don't have dashboard access, bounce them out to their correct workspace
  if (!userPermissions.includes('dashboard:read')) {
    if (userPermissions.includes('delivery:read')) {
      return <Navigate to="/deliveries" replace />;
    }
    if (userPermissions.includes('customer:read')) {
      return <Navigate to="/customers" replace />;
    }
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
Task 3.3: Verify Route Middleware / Layout Wrapping
Ensure your page-level guards prevent raw URL manipulation:

If a warehouse account explicitly types your dashboard IP http://192.168.100.99:5173/ directly into the address bar, the updated guard should instantly catch the missing dashboard:read permission claim and force the route context right back to /deliveries.

4. Verification Checklist for Claude Code
Log in with a warehouse account: verify the browser address bar immediately updates to /deliveries right after clicking "Login".

Manually modify the browser URL to / while logged in as a warehouse worker and confirm the application instantly bounces you back to /deliveries.

Log in with a sales or finance account and ensure the behavior remains untouched, dropping them cleanly on the primary / dashboard page.