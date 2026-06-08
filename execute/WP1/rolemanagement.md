# Engineering Specification: Dynamic Role-to-Menu Mapping Management UI & API

## 1. Context & Architecture Goal
Currently, we have database tables corresponding to `ApplicationMenu`, `MenuPermission`, and ASP.NET Identity Roles. While we can assign roles to users, the relationship mapping determining *which menu belongs to which role* is static or lacks a management interface.

### Objective
Build a dynamic Role-Management workspace under the `sysadmin` UAM panel. This will allow administrators to select a Role (e.g., `sales`, `finance`), view its authorized system menus via checkable lists, update them in real-time, and automatically synchronize the changes to active client sessions using our existing Security Stamp invalidation strategy.

---

## 2. Part 1: Backend API Additions (`UserManagementController.cs`)

We need to add two additional REST endpoints inside our `[Authorize(Roles = "sysadmin")]` protected `UserManagementController.cs` to handle Role-to-Menu configurations.

### Task 1.1: Implement Role-Menu Schema Operations
Add the following endpoint workflows to manage `MenuPermission` rows dynamically:

1. **`GET api/admin/uam/roles`**
   - **Purpose**: Fetch all defined system roles and all master layout menus available to map.
   - **Response Structure**:
     ```json
     {
       "roles": ["sysadmin", "sales", "finance", "operator"],
       "menus": [
         { "menuCode": "deliveries", "menuName": "Deliveries Workspace" },
         { "menuCode": "customer", "menuName": "Customer Management" },
         { "menuCode": "invoices", "menuName": "Invoices & Billing" }
       ]
     }
     ```

2. **`GET api/admin/uam/roles/{roleName}/menus`**
   - **Purpose**: Fetch the array of `MenuCode` values currently bound to a selected role from the `MenuPermission` table.

3. **`POST api/admin/uam/roles/{roleName}/menus`**
   - **Purpose**: Overwrite menu access assignments for a specific system role.
   - **Execution Sequence**:
     - Accept a payload of `List<string> selectedMenus`.
     - Find the core structural `RoleId` corresponding to the target `roleName` string from the `AspNetRoles` repository.
     - Within a safe database tracking transaction context, wipe all previous `MenuPermission` rows tied to that `RoleId`.
     - Insert a fresh collection of `MenuPermission` records linking the `RoleId` to each chosen `MenuCode`.
     - **Mass Session Update**: To ensure users currently logged into that specific role instantly get their sidebars updated, update the Security Stamp for all users belonging to that role:
       ```csharp
       var usersInRole = await _userManager.GetUsersInRoleAsync(roleName);
       foreach (var user in usersInRole)
       {
           await _userManager.UpdateSecurityStampAsync(user);
       }
       ```
     - Save changes atomically to PostgreSQL.

---

## 3. Part 2: Frontend Admin UI Implementation (React + shadcn/ui)

### Task 2.1: Expand the UAM Dashboard Workspace
Modify your administrator dashboard path at `/dashboard/admin/uam` to add a secondary workspace tab framework using `shadcn/ui` tabs.

- **Tab 1: User Plant & Role Mapping** (Our existing working panel setup).
- **Tab 2: Role Menu Matrix** (The new view container).

### Task 2.2: Design the Role Menu Grid Layout
Inside **Tab 2 (Role Menu Matrix)**, implement a clean, high-density split layout:

- **Left Action Bar / List Group**: Renders a vertical layout list showing the available system access roles (`sysadmin`, `sales`, `finance`, etc.) retrieved from `GET api/admin/uam/roles`.
- **Right Detail Card**: Displays a checklist structure containing all system master options (`Deliveries`, `Customer`, `Invoices`).
  - Selecting a role on the left populates the checkboxes with its active permissions fetched from `GET api/admin/uam/roles/{roleName}/menus`.
- **Action Control**: Provide an elegant "Save Role Configuration" action button that sends the compiled `selectedMenus` array straight to the updated `POST api/admin/uam/roles/{roleName}/menus` configuration endpoint.

---

## 4. Verification & Guardrails Checklist for Claude Code
1. Ensure modifying a role's permissions automatically changes the `MenuPermission` table configurations inside PostgreSQL cleanly.
2. Verify that our existing `SecuritySessionGuard` interval catches the updated stamp and pulls the updated token downstream for active workers under that role within 60 seconds.
3. Validate that `dotnet build` succeeds with absolutely zero unused type reference issues or structural compile warnings.