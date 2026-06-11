You are an expert Frontend Architect specializing in React, TypeScript, and high-density Enterprise SaaS dashboards. 

We need to rewrite the structural data transformation and rendering pipeline inside `DeliveryReceivePage.tsx`. The database schema has shifted tracking properties down to the granular line level. We now have 3 distinct types of records mixed flat inside the API response array (`delivery.lines`), and they must be mapped cleanly based on `parentLineNumber` and `batchNumber`.

### 🎯 Core Logic Architecture (The Three Conditions)
Parse the flat lines array into these specific visual patterns:
1. **Parent Single Batch:** `parentLineNumber` is `"0"` (or empty/null) AND `batchNumber` **is populated**. 
   * *UX:* Displays independently as a normal row. No expand/collapse button. User modifies values directly on this row.
2. **Parent with Split Batch:** `parentLineNumber` is `"0"` (or empty/null) AND `batchNumber` **is empty/null**.
   * *UX:* Displays as an aggregated summary row. It is **read-only** at the parent level. Its Quantities (`Intended`, `Received`, `Returned`, `Rejected`) are dynamically calculated by summing up all of its associated Child lines. It has an expand/collapse toggle to show its children.
3. **Child Line:** `parentLineNumber` matches the `deliveryLineNumber` of a "Parent with Split Batch".
   * *UX:* Hidden by default; appears nested underneath its specific parent card when expanded. User updates values (`Received`, `Returned`, `Rejected`, `Comment`) directly at this child level.

### 🛠️ Required Code Modifications

1. **Type Definition Alignment:**
   Ensure the `DeliveryLine` interface contains:
   ```typescript
   parentLineNumber?: string | null;
   batchNumber?: string | null;
   orderNumber?: string | null;
   buyerPONumber?: string | null;
The Transformation Engine (useMemo Data Preparation):
Replace the old itemGroups logic with a tree-builder that scans the flat lines array.

Separate standalone lines (Condition 1) from grouped pairs (Condition 2 + Condition 3).

Group Condition 3 child records into a child-array inside their matching Condition 2 parent object based on child.parentLineNumber === parent.deliveryLineNumber.

For Condition 2 parents, dynamically calculate the display values (salesQuantity, packQuantityDelivered, etc.) by executing a .reduce() sum across all nested child components.

Form State Handling (linesMap Synchronization):

Keep the existing flat linesMap state map structure.

When a user changes an input field on a Condition 1 (Single Parent) row, update that item's ID in the linesMap.

When a user changes an input field on a Condition 3 (Child) row, update that specific child's ID in the linesMap.

Ensure that when the flat map updates, the useMemo transformation engine automatically cascades the calculations up to recalculate the Condition 2 parent totals dynamically in real time.

UI Layout Restructuring (High-Density Screen):

Loop through the sorted collection. Render Condition 1 as standard, flat interactive items.

Render Condition 2 using the expandable cards panel layout. Show aggregated badges. When expanded, loop through its nested children array and render them using clean, compact, side-by-side rows.

Left side of rows: Item info (Description, Batch Number, Order, PO).

Right side of rows: Compact input blocks (h-7, minified borders) for fast tracking entry.

⚠️ Execution Constraints
Do not break the existing submit logic, API save mechanisms, camera/upload handling, or guardrail validation modals (VarianceModal, GuardrailModal).

Maintain performance hooks (memo, useCallback) to avoid visual lag when users scale up typing inputs across 30+ rows simultaneously.

Do not truncate code blocks. Output the full functional file.