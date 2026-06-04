# Engineering Task: Secure Frontend Sidebar & Route Guards to Match New RBAC Matrix

## 1. Context & Business Requirements
We updated our database seeding configuration matrix. The app access rules are strictly isolated as follows:
- **`sysadmin`**: Has all permission claims, granted visibility across all pages and menus.
- **`sales`**: Restricted exclusively to **Dashboard** and **Customers**.
- **`finance`**: Restricted exclusively to **Dashboard** and **Customers**.
- **`warehouse`**: Restricted exclusively to **Deliveries** (no Dashboard, no Customers, no Invoices).

Two new permission tracking keys have been introduced to fully protect administrative features:
- `uam:read` -> Controls visibility of the Access Management menu item and workspace.
- `uam:sync` -> Authorizes modification payloads to save role-permission matrices.

## 2. Objective
Refactor the frontend dynamic route config arrays, layouts, and page-level security controls (Astro / React components) to render only allowed menus based on the string claims array in the active session JWT token, preventing access leaks.

---

## 3. Implementation Steps

### Task 3.1: Refactor Sidebar Configurations (`NavigationSidebar` or routes array file)
Locate your sidebar definitions component. Replace any legacy validation checks with strict map lookups against decoded session permission claims. Ensure that the Access Management item explicitly guards using `uam:read` and role checks.

```typescript
const applicationRoutes = [
  { name: 'Dashboard', path: '/', requiredPermission: 'dashboard:read' },
  { name: 'Customers', path: '/customers', requiredPermission: 'customer:read' },
  { name: 'Invoices', path: '/invoices', requiredPermission: 'invoice:read' },
  { name: 'Deliveries', path: '/deliveries', requiredPermission: 'delivery:read' },
  { name: 'Access Management', path: '/admin/uam', requiredPermission: 'uam:read', sysAdminOnly: true }
];

export function Sidebar({ userRoles, userPermissions }) {
  const permittedRoutes = applicationRoutes.filter(route => {
    // 1. Sysadmin gets an immediate master access bypass
    if (userRoles.includes('sysadmin')) return true;

    // 2. Access Management option strictly hides if designated sysAdminOnly
    if (route.sysAdminOnly && !userRoles.includes('sysadmin')) return false;

    // 3. Evaluate normal visibility criteria against token permissions array
    return userPermissions.includes(route.requiredPermission);
  });

  // Render navigation links...
}
Task 3.2: Secure Page-Level Route Guards
Ensure that if a warehouse worker manually types /customers or /invoices into the browser address bar, or if a sales operator attempts to access /deliveries, they are immediately blocked.

Implement checking mechanisms inside your router or top-level wrapper layouts.

If the required permission string (customer:read, invoice:read, delivery:read, uam:read) is missing from the user token state, block rendering and redirect the user immediately to an unauthorized message or safe default path.

Task 3.3: Handle Clean Empty State for Unauthorized Actions
When an account has no permissions or lands on an invalid context route:

Prevent infinite loader spinning.

Render a structured error screen showing: "You do not have permission to view this section. Please coordinate with your technical administrator." alongside a fully operational log out control button.

4. Verification Targets for Claude
Log in as a warehouse operator: verify that Dashboard, Customers, Invoices, and UAM disappear from the sidebar completely.

Log in as a sales or finance operator: confirm they can view the Dashboard and Customers layouts, but cannot see Invoices or Deliveries.

Attempt a hard path access to /admin/uam or /deliveries using standard staff accounts, ensuring a redirect occurs.