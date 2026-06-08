# Engineering Specification: Aligning UAM Logic with actual RBAC Database Tables & Fixing Menu Leaks

## 1. Context & Root Cause Diagnostic
We have verified that changing permissions for roles like `sales` or `finance` in the UI has no effect on the client dashboard because of a structural mismatch between the application logic and the database schema. 

### Database Schema Realities:
- `AspNetRoles`: Stores system roles (`sysadmin`, `finance`, `warehouse`, `sales`).
- `Permissions`: Stores explicit functional action keys (e.g., `customer:read`, `invoice:read`, `finance_menu_access`).
- `RolePermissions`: A many-to-many join table mapping `RoleId` (string) to `PermissionId` (integer).

### Identified Issues:
1. **Stale/Hardcoded Claims**: The token claims generator or frontend dashboard is checking for non-existent columns (like `MenuCode`) or running hardcoded conditional switches for `sales`/`finance`, completely bypassing the active configuration inside the `RolePermissions` table.
2. **Access Management Leak**: The "Access Management" menu item is leaking into standard operator sidebars because it lacks a strict role guard limiting it exclusively to global `sysadmin` users.
3. **Empty View Freezing**: When an account has zero permissions assigned, it drops into a blank frame with only a logo instead of handled routing.

---

## 2. Part 1: Aligning Backend Claims Engine (`AccountController.cs`)

Locate the `GenerateJwtTokenAsync(ApplicationUser user)` method in the API. Remove any hardcoded role-to-menu if-statements or switch expressions. Refactor it to dynamically query your true RBAC tables.

**Implementation Steps:**
1. Extract the current user's role strings using Identity's `_userManager.GetRolesAsync(user)`.
2. Query `_context.Roles` to resolve the corresponding string `Id` keys for those roles.
3. Perform a clean join query through `RolePermissions` to extract all authorized `PermissionKey` strings from the `Permissions` table.
4. Inject these keys as `"permission"` claims into the JWT payload.

```csharp
// Resolve active Role IDs
var userRoles = await _userManager.GetRolesAsync(user);
var roleIds = await _context.Roles
    .Where(r => userRoles.Contains(r.Name!))
    .Select(r => r.Id)
    .ToListAsync();

// Query distinct Permission Keys mapped via the join table
var assignedPermissions = await _context.RolePermissions
    .Where(rp => roleIds.Contains(rp.RoleId))
    .Select(rp => rp.Permission!.PermissionKey)
    .Distinct()
    .ToListAsync();

foreach (var permKey in assignedPermissions)
{
    claims.Add(new System.Security.Claims.Claim("permission", permKey));
}
3. Part 2: Fixing the Admin Save Transaction (UserManagementController.cs)
Update the endpoint responsible for saving a role's permissions matrix (POST api/admin/uam/roles/{roleName}/permissions or matrix equivalent).

Refactor Requirements:

Look up the destination RoleId from AspNetRoles using the roleName string parameter.

Delete all existing join references for that role:

C#
   var obsoleteRows = _context.RolePermissions.Where(rp => rp.RoleId == roleId);
   _context.RolePermissions.RemoveRange(obsoleteRows);
Map the array of checked permission integers (PermissionId) submitted by the UI, and insert them as fresh RolePermissions rows.

Enforce an automatic session invalidation using _userManager.UpdateSecurityStampAsync(user) for all users holding that role to clear out old browser tokens within 60 seconds.

4. Part 3: Frontend Sidebar Security & Guard Rails (Astro / React)
Task 3.1: Strict Isolate on the Access Management Workspace
Refactor your sidebar route dictionary configuration. Make sure that the Access Management entry requires a strict sysadmin role check, completely independent of basic permission key string checks.

TypeScript
const appRoutes = [
  { name: 'Deliveries', path: '/dashboard/deliveries', requiredPermission: 'delivery:read' },
  { name: 'Customer Management', path: '/dashboard/customer', requiredPermission: 'customer:read' },
  { name: 'Invoices & Billing', path: '/dashboard/invoices', requiredPermission: 'invoice:read' },
  // 🚀 CRITICAL REFACTOR: Lock to sysadmin role exclusively
  { name: 'Access Management', path: '/dashboard/admin/uam', requiredPermission: 'uam:manage', strictSysAdmin: true }
];

export function NavigationSidebar({ userClaims }) {
  const accessibleRoutes = appRoutes.filter(route => {
    // 1. Instantly hide sysadmin-only screens from standard roles
    if (route.strictSysAdmin && userClaims.role !== 'sysadmin') return false;
    
    // 2. Grant root sysadmin users complete system visibility
    if (userClaims.role === 'sysadmin') return true;
    
    // 3. Evaluate normal operators against their decoded permission claim keys
    return userClaims.permissions?.includes(route.requiredPermission);
  });

  // Render navigation elements...
}
Task 3.2: Render an Empty State View for Zero-Permission Users
If userClaims.permissions is empty or holds no matches against operational routes, redirect the user's route context to a clean styled page layout at /dashboard/no-access instead of leaving a blank dashboard frame.
Include a clear error card message: "Your account role currently has no permissions mapped. Please contact a system administrator." along with a functional "Log Out" button component.

5. Verification Checklist for Claude Code
Verify that ticking or unticking options in the admin dashboard directly overwrites records inside the RolePermissions table.

Log in with a sales or finance operator role: verify that the "Access Management" sidebar option disappears completely.

Attempt to force navigate to /dashboard/admin/uam using a regular account and ensure the route guard triggers an immediate unauthorized redirect block.

Execute dotnet build and frontend build steps to verify compilation success.