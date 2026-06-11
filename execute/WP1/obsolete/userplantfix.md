Here is the complete engineering specification prompt you can hand off directly to Claude to solve the data isolation bug and ensure sysadmin retains global vision across all manufacturing and warehousing hubs.

Markdown
# Engineering Specification: Enforce Plant-Level Row Security on Deliveries Grid

## 1. Objective
Fix a data isolation leak on the Deliveries page. Currently, the UI shows all system delivery documents globally to every user, completely bypassing the user-specific plant restrictions configured in the User Access Management page. 

The frontend must dynamically filter out delivery records that do not match the logged-in user's authorized plant codes, while allowing a master override if the user belongs to the `sysadmin` identity role.

## 2. Core Business Requirements
- **Standard Operators (`warehouse`, `sales`, `finance`):** The data table rows must be strictly filtered. A delivery record must only be visible if its `delivery.plant` property is included within the user's assigned plant scope (`assignedPlants`).
- **`sysadmin` Bypass:** If the active user has the `sysadmin` role assigned, skip all plant matching constraints and show all system deliveries unconditionally.

---

## 3. Implementation Steps for Claude Code

### Task 3.1: Expose Auth Identity Data to the Component
Open `DeliveriesPage.tsx`. Ensure that your authentication state hook or context provider exposes both the `assignedPlants` code string array and the user's `roles` list.

*If your existing auth hook structure matches standard patterns, verify it looks similar to:*
```typescript
// Inside DeliveriesPage.tsx
// TODO: Ensure useAuth() or your session context provides these properties
const { user } = useAuth(); 
const assignedPlants: string[] = user?.assignedPlants || [];
const isSysAdmin = user?.roles?.includes('sysadmin') || false;
Task 3.2: Refactor filteredAndSortedDeliveries Dependency Matrix
Locate the useMemo block processing the table filters around lines 45–70 inside DeliveriesPage.tsx. Update the closure to process the plant matching parameters safely alongside the text searches and date pickers:

TypeScript
const filteredAndSortedDeliveries = useMemo(() => {
  return deliveries
    .filter((delivery) => {
      // 1. Existing Search Criteria Filter
      const matchesSearch =
        delivery.deliveryNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        delivery.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        delivery.customerCode.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Existing Date Range Constraints
      const deliveryDate = new Date(delivery.deliveryDate);
      const matchesStartDate = !startDate || deliveryDate >= new Date(startDate);
      const matchesEndDate = !endDate || deliveryDate <= new Date(endDate);

      // 🚀 3. NEW: Multi-Plant Cross-Tenant Security Boundary Check
      // Master Override: Sysadmin roles bypass tracking and view all lines
      if (isSysAdmin) {
        return matchesSearch && matchesStartDate && matchesEndDate;
      }

      // Strict enforcement for operational roles
      const matchesPlant = delivery.plant 
        ? assignedPlants.includes(delivery.plant) 
        : false;

      return matchesSearch && matchesStartDate && matchesEndDate && matchesPlant;
    })
    .sort((a, b) => {
      // Keep your exact existing sorting implementation here...
    });
}, [deliveries, searchTerm, startDate, endDate, sortField, sortOrder, assignedPlants, isSysAdmin]);
Task 3.3: Sync Page Summary Counters
Verify that the record summary label at the bottom of the grid reads directly from the filtered results length so pagination totals remain pixel-perfect:

TypeScript
<p className="text-sm text-brand-blue/50">
  Showing {currentDeliveries.length} of {filteredAndSortedDeliveries.length} deliveries
</p>
4. Acceptance Criteria for Verification
Test User A (Warehouse - Plant PL01 only): Logs in and navigates to /deliveries. The table rows display only records where the Plant column reads exactly PL01.

Test User B (Sales - Plant PL02 & PL03): Logs in and can see rows belonging to both PL02 and PL03 mixed together, but nothing from PL01.

Test User C (Sysadmin): Logs in and can see all rows regardless of the plant codes assigned to their specific individual user profile mapping.