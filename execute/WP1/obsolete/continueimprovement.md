# Task: Refactor DeliveryReceivePage Component Layout and Quantity Logic Constraints

We need to make a second iteration of adjustments to the `DeliveryReceivePage` component on the frontend to correct layout aesthetics, enforce data entry isolation, ensure perfect responsive proportions, and ensure accurate summary state computations.

Please refine the React interface code following these precise specifications.

---

## 1. Line Number Formatting & Positioning
* **Requirement:** Make the 100-interval calculated line index numbers highly prominent on the layout.
* **The Fix:** Prefix and format the text clearly as **`Line No. 100`**, **`Line No. 200`**, etc. 
* Position this label directly inside the main `ItemGroup` row header context so operators can scan the manifest order instantly.

---

## 2. Parent-Level `ItemGroup` Metric Display
* **Requirement:** Render a complete financial/inventory audit breakdown right across the parent row header.
* **The Fix:** Display the following four calculated summary metrics side-by-side inside the `ItemGroup` template row:
  1. **Quantity** (The cumulative intended delivery quantity requested from the source manifest).
  2. **Total Received Quantity** (Live aggregated read-only sum of child batches).
  3. **Total Rejected Quantity** (Live aggregated read-only sum of child batches).
  4. **Total Returned Quantity** (Live aggregated read-only sum of child batches).
* **Constraint Rule:** Ensure all these three calculated variables are strictly **Read-Only** fields at this group header parent level. They must update automatically using component state loops when child values shift.

---

## 3. High-Density Nested Batch Grid Layout
When the operator clicks the expand button to reveal the inner detail elements (the **Batch Level**), apply a compact horizontal layout grid:

* **Label Conversion:** Change the historical `"Scheduled"` label text to read **`Quantity`** exactly.
* **Proportional Grid Alignment:** Instead of stacking text elements vertically, position the structural information fields and the interactive numerical inputs **side-by-side on a single row** to maximize vertical screen efficiency.
* **Target Interface Split:**
  * **Left Side (Informational Details):** Display `Quantity` (Scheduled target), `Batch Number`, `Expiry Date` (if applicable), `Buyer PO Number`, and `Order Number`.
  * **Right Side (Interactive Form Controls):** Group the input boxes for `Received`, `Rejected`, and `Returned` next to each other using a compact layout (e.g., Tailwind `flex items-center gap-2` or a proportional grid layout). Ensure input width boundaries are scaled perfectly so labels don't clip or look cramped.

---

## 4. Top-Level Analytical Indicator Computations
The scorecard statuses sitting at the top of the workspace must evaluate operational integrity at the granular **batch/detail line level** directly rather than using parent rows:

* **`Accepted`**: Evaluates as true if every individual batch row's `Received` quantity perfectly equals its original baseline `Quantity`, with `Rejected` and `Returned` values sitting exactly at `0`.
* **`Discrepancy`**: Evaluates as true if fields are modified but do not perfectly match the original target baseline (or if any non-zero value is registered inside the `Rejected` or `Returned` column variables).
* **`Pending`**: Evaluates as true if the user hasn't touched the items on the page yet (meaning `Received`, `Rejected`, and `Returned` values are all sitting at exactly `0` across the entire form state array).

---

## Expected Output
Please refactor the `DeliveryReceivePage.tsx` view code to incorporate these alignment adjustments. Maintain strict data typing across state functions and match our established minimalist styling parameters.