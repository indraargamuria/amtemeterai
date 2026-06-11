# Engineering Specification: Client-Side Route Guards & Comprehensive UAM Role Management

## 1. Context & Objectives
We have successfully bound structural `plant` and `menu` claims into our JWT token payload on the backend, and we are dynamically filtering the sidebar links. However, two gaps remain:
1. **URL Direct Injection Vulnerability**: Users can still bypass sidebar visibility by typing protected URLs directly into the browser address bar. We need global route/middleware guards.
2. **Unified UAM Dashboard**: System administrators (`sysadmin`) need to manage both a user's **Plant assignments** and their **System Role/Menu Access** directly inside the same User Management panel.

---

## 2. Part 1: Implementing Frontend Client-Side Route Guards (Astro / React)

We need a centralized mechanism that intercepts route changes and evaluates whether the logged-in user has the required `menu` claim code to view that URL page container.

### Task 1.1: Map Route Permissions
Ensure every protected dashboard route configuration declares its corresponding authorization `accessCode`:

```typescript
export const routePermissions: Record<string, string> = {
  '/dashboard/deliveries': 'deliveries',
  '/dashboard/invoices': 'invoices',
  '/dashboard/admin/uam': 'uam',
  // Add other client paths here
};
Task 1.2: Build the Global Route Interceptor (RouteGuard.tsx)
Create or modify a wrapper component (or an Astro middleware/React Router block depending on your exact routing engine setup) to validate direct URL hits before rendering the page content.

Guard Logic Requirements:

Extract and decode the active JWT token from localStorage.

Check if the user has the sysadmin role claim. If yes, automatically bypass all checks (full clearance).

Match the current window location path (window.location.pathname) against the routePermissions matrix mapping.

If the route matches an access code (e.g., invoices) and that code is NOT present in the token's menu claims array, intercept the cycle, block rendering, and redirect the user immediately to an unauthorized fallback page (e.g., /dashboard/unauthorized or back to the home page).

3. Part 2: Extending Backend UAM with Role/Menu Assignment Engine
Task 2.1: Update UserManagementController.cs
Modify the endpoints in Controllers\UserManagementController.cs to handle both UserPlant rows and ASP.NET Identity roles inside a unified DTO transaction payload.

Refactor Requirements:

Update GET api/admin/uam/users/{id}/matrix:
Return a unified matrix response containing:

UserId (string)

AssignedPlants (List of active plant codes from UserPlant)

AssignedRoles (List of active role strings fetched via _userManager.GetRolesAsync(user))

Update POST api/admin/uam/users/{id}/matrix:
Accept an updated composite request DTO layout:

C#
public class UpdateUserMatrixDto
{
    public List<string> SelectedPlants { get; set; } = new();
    public List<string> SelectedRoles { get; set; } = new(); // e.g., ["sales"], ["finance"]
}
Execution Steps inside the Update Method:

Fetch the target user profile from _userManager.

Plants Sync: Flush previous UserPlant configuration rows matching the target ID and insert the fresh list elements.

Roles Sync: Fetch currently assigned roles using await _userManager.GetRolesAsync(user). Use await _userManager.RemoveFromRolesAsync(user, currentRoles) to clear them, followed by await _userManager.AddToRolesAsync(user, dto.SelectedRoles) to apply the new choices.

Invalidate Client Session: Call await _userManager.UpdateSecurityStampAsync(user) to force the user's browser context to fetch fresh menu claims on its next background polling loop.

Commit and save changes atomically to PostgreSQL.

4. Part 3: Frontend Admin UI Expansion (shadcn/ui + Tailwind)
Task 3.1: Enhance the Access Grid Layout
Refactor your administration grid panel view at /dashboard/admin/uam.

UI Requirements:

Split Panel Structure:

Keep the Left Column data table tracking all active system employee profiles.

Expand the Right Column detail pane into two clear, high-density structural sections or tabs using shadcn/ui components:

Tab A (Plant Authorizations): A checklist matrix displaying all 32 enterprise plant master choices (checking boxes maps codes like B1G2, B1T1 into the save payload).

Tab B (System Role / Menu Access): A clear radio button list or checkbox group listing available structural system access roles (sales, finance). Add small descriptive labels mapping out what menus they give access to (e.g., “Finance Role: Grants access to the Invoice processing workspace”).

Persistence Layer: Ensure the core "Apply Permissions Matrix" action button packages up both checkboxes lists and triggers the updated POST endpoint layout in a single unified API hit.

5. Verification Checklist for Claude Code
Ensure the frontend client-side router completely blocks access to unauthorized paths on direct URL input.

Verify that assigning a user to a different role instantly resets their role rows inside the AspNetRoles schema system on the backend.

Validate that dotnet build executes successfully with zero schema mapping warnings or type mismatch breaks.