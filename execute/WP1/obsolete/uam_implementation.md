# Engineering Specification: User Access Management (UAM) & Plant-Level Token Security

## 1. Context & Architecture Review
We have an existing multi-tenant/multi-plant data-level security mechanism inside our ASP.NET Core Web API backend. 
Our entities utilize singular naming conventions:
- `Plant` (Master plant records)
- `UserPlant` (Mapping table for ApplicationUser -> PlantCode)
- `ApplicationMenu` / `MenuPermission` / `Permission` / `RolePermission` (Menu and feature security layout architecture)

### Objective
Implement an end-to-end management workflow that allows `sysadmin` users to map specific plant authorizations to internal user profiles. Changes must trigger an automatic state sync to the Astro/React frontend within 60 seconds without relying on WebSockets, by leveraging ASP.NET Identity Security Stamps.

---

## 2. Backend Enhancements

### Task 2.1: Update `AccountController.cs` JWT Claims Engine
Locate the private method `GenerateJwtTokenAsync(ApplicationUser user)`. We need to append structural menu codes alongside our singular `UserPlant` claims processing block.

**Implementation Rules:**
1. Fetch authorized plants using the singular table mapping context `_context.UserPlant`.
2. Fetch distinct `MenuCode` values from `MenuPermission` based on the user's role memberships.
3. Add the `SecurityStamp` of the user profile directly into the token payload as a security track version.

```csharp
// 1. Fetch authorized plants using the singular table mapping context
var assignedPlants = await _context.UserPlant
    .Where(up => up.UserId == user.Id)
    .Select(up => up.PlantCode)
    .ToListAsync();

foreach (var plantCode in assignedPlants)
{
    claims.Add(new System.Security.Claims.Claim("plant", plantCode));
}

// 2. Fetch and aggregate structural Menu permissions
var assignedMenus = await _context.MenuPermission
    .Where(mp => _context.UserRoles.Where(ur => ur.UserId == user.Id).Select(ur => ur.RoleId).Contains(mp.RoleId))
    .Select(mp => mp.MenuCode)
    .Distinct()
    .ToListAsync();

foreach (var menuCode in assignedMenus)
{
    claims.Add(new System.Security.Claims.Claim("menu", menuCode)); 
}
Task 2.2: Implement UserManagementController.cs
Create a new API controller at Controllers\UserManagementController.cs.

Requirements:

Protect the entire controller with [Authorize(Roles = "sysadmin")].

Expose three primary actions:

GET api/admin/uam/users -> Return a clean list of all registered team members (Id, FullName, Email, LastLoginAt).

GET api/admin/uam/users/{id}/matrix -> Return active PlantCode assignments from UserPlant for a single target profile.

POST api/admin/uam/users/{id}/matrix -> Accept a payload of List<string> selectedPlants. Wrap database updates inside a safe execution thread: wipe prior UserPlant rows matching the target ID, insert fresh mappings, and execute await _userManager.UpdateSecurityStampAsync(user) before saving to invalidate old client sessions.

3. Frontend Implementation (Astro / React / Tailwind / shadcn/ui)
Task 3.1: Session Guard Token Refresher
Create a high-order React hook or standalone context-aware security layout component (SecuritySessionGuard.tsx) to pull updates downstream silently.

Behavior:

Poll /api/account/me every 60 seconds using an interval lifecycle hook.

Ensure the active JWT bearer token is appended to the request authorization header.

If the endpoint returns an upgraded response containing a fresh signature token, overwrite the browser's storage element.

If a 401 Unauthorized status is caught, flush local storage tokens and push the browser context back to the /login route.

Task 3.2: Dynamic Sidebar Menu Navigation Filtering
Refactor your primary navigation component (NavigationSidebar.tsx) to accept decoded JWT elements.

TypeScript
const appRoutes = [
  { name: 'Deliveries', path: '/dashboard/deliveries', accessCode: 'deliveries' },
  { name: 'Invoices', path: '/dashboard/invoices', accessCode: 'invoices' },
  { name: 'UAM Configuration', path: '/dashboard/admin/uam', accessCode: 'uam' }
];
If userClaims.role === 'sysadmin', bypass processing controls entirely and display all entries.

Otherwise, filter the active route list array using .filter(route => userClaims.menus?.includes(route.accessCode)).

Task 3.3: High-Density Administration Panel View
Build a dedicated interface route at /dashboard/admin/uam.

Layout Specs:

Use a minimalist, high-density split layout view (shadcn/ui and Tailwind CSS components).

Left Column: Render an elegant data grid component listing all platform operator user rows fetched from api/admin/uam/users.

Right Column: Displays a loading card state until a user row is highlighted. Once selected, load the user's mapping matrix and populate a structural grid layout of standard check-box form inputs mapping out the enterprise plant options.

Footer Actions: Provide a persistent "Apply Permissions Matrix" trigger button that executes the atomic save transaction straight to the backend update endpoint.

4. Verification Checklists
Execution Instructions for Claude Code:
Review the existing project structure and dependency definitions across AppDbContext.cs and identity setups.

Compile and insert backend files, keeping naming layouts singular (UserPlant, Plant).

Execute dotnet build to guarantee there are zero compilation errors or structural type warnings.

Scaffold the frontend components using React and clean styling primitives matching the existing system codebase.