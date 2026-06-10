# Comprehensive Task: Storage Conventions, State Validation, Schema Migration, and High-Density Batching UI Refactor

Please execute the following four interconnected tasks across our .NET backend and React frontend. Ensure code safety, maintain strict data integrity, and adhere to our high-density Enterprise SaaS UX standards.

---

## Task 1: Standardized Object Storage Naming Conventions (MinIO)
Align both the automated stamping workspace pipeline and manual file uploads to use a clean, deterministic, `InvoiceNumber`-driven file structure inside MinIO. 

### Implementation Requirements:
* **Target Layout Mapping:**
  * **Unsigned Documents:** Save to `invoices/{invoiceId}/InvoiceNumber.pdf`
  * **QR Specimen Graphics:** Save to `invoices/{invoiceId}/InvoiceNumber_QR.png`
  * **Signed/Stamped Documents:** Save to `invoices/{invoiceId}/InvoiceNumber_stamped.pdf`
* **File Locations:** Update `PeruriOnPremiseStampService.cs`, upload controllers, and any related storage abstraction configurations to drop old naming patterns (like random hashes or naked serial numbers) in favor of this uniform standard.

---

## Task 2: Strict Workflow Lifecycle Validation Guards
Invoices must not be generated or stamped prematurely. Prevent compliance loops from executing on incomplete operations.

### Implementation Requirements:
* **Business Rule:** An Invoice creation or e-Meterai Stamping trigger is **only valid** if its upstream delivery workflow state is fully completed.
* **Backend Validation:** In the respective Controller endpoints (e.g., `InvoicesController.cs` or billing orchestration services), intercept incoming requests with a database context check:
  * Verify that the linked `DeliveryHeader.Status` is explicitly marked as `Received`.
  * If the delivery is pending, missing, or rejected, abort execution early and return a typed error response: `400 Bad Request` or a custom validation envelope with the message: `"Invoice processing and e-Meterai stamping are unavailable until the linked Delivery Order is fully received."`

---

## Task 3: Relational Schema De-normalization (Database & Entities)
Shift the tracking metadata for Buyer Purchase Orders (PO) and Order Numbers from the high-level delivery header down into individual line items to support heterogeneous routing.

### Step A: Entity Model Modification
1. **`DeliveryHeader.cs`**: Completely remove the structural fields for `BuyerPoNumber` and `OrderNumber`.
2. **`DeliveryLine.cs`**: Add properties for `BuyerPoNumber` (string) and `OrderNumber` (string).

### Step B: Database Lifecycle Management
* Scaffold an EF Core infrastructure code migration from the command line interface:
  ```bash
  dotnet ef migrations add MovePoAndOrderToDeliveryLine
  dotnet ef database update
Ensure that you verify that the data context updates successfully without breaking existing foreign-key bindings before moving on to the interface adjustments.

Task 4: DeliveryReceivePage Interface Refactoring (High-Density Aggregation Grid)
Optimize the delivery receipt interface (/receive/:token) to support high-density processing, batch containerization, contextual text lookups, and aggregate status calculation metrics.

1. Label and Unit Conversions
Change the column or metric label text from "Delivery" to "Quantity" across the item grids.

Implement a runtime data mutation transformer: if the row unit of measure (UOM) text evaluates to "ST", always automatically map and display it as "PC" on the interface screens.

2. Hierarchical Batch Grouping (The ItemGroup Pivot Pattern)
When presenting items to the user, evaluate the line list using a conditional split architecture:

A. Batched Flow (If BatchNumber is NOT Empty/Null):
Collapse the rows into a parent wrapper component: ItemGroup.

Group items matching identical parameters: Item Description + Order Number + Buyer PO Number + UOM.

Index Sorting Matrix: Sort the layout by the absolute minimum DeliveryLineNumber recorded per unique ItemGroup. Assign clean, uniform 100-interval indexing coordinates for the layout elements (100, 200, 300, etc.).

Display Elements: The parent ItemGroup row must clearly expose the shared BuyerPoNumber and OrderNumber.

State Operations: * Show calculated totals for Received, Rejected, and Returned quantities summarized from the child rows.

Embed an expand/collapse toggle button on the row. When clicked, it smoothly reveals the inner child rows containing the detailed line-item batches underneath.

Crucial UX Requirement: Users must be allowed to modify and input numbers for Received, Rejected, and Returned values directly on this parent batch/aggregate view level.

B. Standalone Flow (If BatchNumber IS Empty/Null):
Bypass the ItemGroup aggregation entirely. Render these direct elements directly into the main list sequence at the raw detail line view level without child collapse dependencies.

3. Grid Workspace Features (Pagination & Search)
High-Density Pagination: Restrict visible rows. Implement client-side or server-side pagination displaying exactly 10 items per page at the primary view level.

Contextual Search Targeting: Add a global text filter input targeting specific row metadata. The text search match must filter down items dynamically based on:

Item Description

Buyer PO Number

Order Number

Batch Number

4. Top-Level Workflow Dashboard Summaries
Add a high-density analytics scorecard banner directly above the data entry table containing the following operational indicators:

Total Items: The integer count of all active root elements/ItemGroup entries on the current manifest.

Total Batches: The cumulative integer count of all concrete child delivery lines mapped inside the document.

Dynamic Batch Status Indicators: Compute a live calculated status rollup based on user inputs:

Accepted: Evaluates as true if the user's input for Received Quantity perfectly equals the manifest's original Delivery Quantity.

Discrepancy: Evaluates as true if the inputs do not equal zero, but fail to match the original delivery target exactly (or if there is any numerical value entered inside the Rejected or Returned fields).

Pending: Evaluates as true if the inputs for Received, Rejected, and Returned quantities are all currently sitting at exactly 0.

Expected Output
Please update the database entities, generate the migrations pipeline script, refactor the backend validation checks, and update the React frontend structure to incorporate these comprehensive architectural rules. Maintain a clean codebase following all existing design rules.