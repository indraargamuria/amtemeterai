# Task: Fix DeliveryReceivePage Pagination and ItemGroup Quantity Input Constraints

We need to make a fast correction to our `DeliveryReceivePage` component on the frontend. The current batching layout implementation contains a couple of operational deviations that need adjustment to align with our high-density data requirements.

Please adjust the pagination indexing and data entry constraints exactly as outlined below.

---

## 1. Correct Pagination Target Architecture
* **The Bug:** The previous implementation applied pagination at the raw line item level, which breaks the visual grouping layout.
* **The Fix:** Apply pagination constraints strictly at the **ItemGroup (Parent Row) level**. 
* Ensure the grid renders exactly **10 ItemGroups per page**.
* When an operator expands an `ItemGroup`, its internal batch child rows must expand inline smoothly *without* counting toward the 10-item page ceiling or being cut off by page breaks.

---

## 2. Lock Parent Row Quantities to Read-Only (Context Aggregation)
* **The Bug:** Users should not be typing overriding values into the aggregated parent headers.
* **The Fix:** Convert the `Received`, `Rejected`, and `Returned` fields on the main **ItemGroup parent row** into **Read-Only** elements (or stylized informational text metrics).
* These parent metrics must dynamically calculate and display the live mathematical sum of their underlying child lines.

---

## 3. Enforce Data Entry Strictly at the Batch Level
* Expanding the `ItemGroup` reveals the detailed individual lines (the **Batch Level**).
* **The Input Constraint:** Users must input and modify `Received`, `Rejected`, and `Returned` quantities **strictly within these expanded child batch rows**. 
* As the operator types values into a specific batch row, the parent `ItemGroup` aggregates must instantly recalculate and update in real-time.

---

## Expected Output
Please update the `DeliveryReceivePage` React component file to implement these changes.