# Task: Correct Metric Calculations to Run Exclusively at the Granular Batch/Detail Line Level

The top banner summaries (`Accepted`, `Discrepancy`, and `Pending`) are currently incorrectly calculated based on the count of aggregated parent `ItemGroups`. They must be refactored to evaluate each raw individual line item (the underlying batches) directly from the form state array.

Please refactor the calculation logic in `DeliveryReceivePage.tsx` using these specifications.

---

## 1. Metric Calculation Rules (Batch-Level Evaluation)

Locate the `useMemo` block where `totalItems`, `totalBatches`, and statuses are calculated (around line 140–180 in your code). Replace the item-group counting approach with a direct evaluation of all line items:

* **`Total Items`**: Keep this as the count of parent `ItemGroups` currently generated on the active page context.
* **`Total Batches`**: The count of all raw underlying delivery line entries.
* **`Accepted`**: The count of individual line items where `Received == Quantity` AND `Rejected == 0` AND `Returned == 0`.
* **`Discrepancy`**: The count of individual line items where the input values have been modified (`Received > 0` or `Rejected > 0` or `Returned > 0`) BUT `Received` does not equal the target baseline `Quantity` (or there is any non-zero value inside `Rejected` or `Returned`).
* **`Pending`**: The count of individual line items that are untouched, meaning `Received == 0` AND `Rejected == 0` AND `Returned == 0`.

---

## 2. Refactoring the Code Logic

Update your `useMemo` configuration code block inside `DeliveryReceivePage.tsx` to match this logic:

```tsx
const lineCalculations = useMemo(() => {
  // 1. Calculate parent grouping counts
  const totalItemGroups = itemGroups.length;
  const totalAllLines = lines.length;

  let acceptedCount = 0;
  let discrepancyCount = 0;
  let pendingCount = 0;

  // 2. Compute metrics directly from the raw data lines state
  lines.forEach((line) => {
    const received = formState[line.deliveryLineNumber]?.packQuantityDelivered ?? 0;
    const rejected = formState[line.deliveryLineNumber]?.packQuantityRejected ?? 0;
    const returned = formState[line.deliveryLineNumber]?.packQuantityReturned ?? 0;
    const targetQty = line.salesQuantity; // Original expected delivery quantity

    if (received === 0 && rejected === 0 && returned === 0) {
      // Untouched row
      pendingCount++;
    } else if (received === targetQty && rejected === 0 && returned === 0) {
      // Perfectly matched row
      acceptedCount++;
    } else {
      // Any variance, short-delivery, rejection, or return counts as a discrepancy
      discrepancyCount++;
    }
  });

  return {
    totalItems: totalItemGroups,
    totalBatches: totalAllLines,
    accepted: acceptedCount,
    discrepancy: discrepancyCount,
    pending: pendingCount
  };
}, [itemGroups, lines, formState]);
Expected Output
Please apply this updated calculation block into DeliveryReceivePage.tsx. Ensure the display metrics at the top of the grid map to these properties cleanly so the total counts match your batch data grid state perfectly.