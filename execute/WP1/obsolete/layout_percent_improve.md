# Task: Implement ItemGroup Discrepancy Percentage Badges, Header Layout Optimization, and Card Component UI Consistency

We are applying a refined user experience polish to `DeliveryReceivePage.tsx`. This iteration introduces a bi-directional discrepancy rate metric badge at the parent `ItemGroup` header level (handling both short-deliveries and over-deliveries with distinct alert styling), strips out header fields to ensure optimal information layout proportion, and harmonizes the card elements using a consistent, modern enterprise layout aesthetic.

Please refactor `DeliveryReceivePage.tsx` exactly as outlined below.

---

## 1. Bi-Directional Discrepancy Percentage Badge Logic
Within the metadata row of each parent **`ItemGroup`**, add a live-calculated discrepancy percentage indicator badge.

### A. Mathematical Evaluation Rules
* **Activation Guard:** Only calculate and render the discrepancy badge if the total received quantity across the group is greater than zero (`totalReceived > 0`). If it is `0`, omit or completely hide the element to maintain text clarity on untouched rows.
* **Calculation Formula:**
  $$\text{Raw Variance} = \left( \frac{\text{Total Intended Quantity} - \text{Total Received Quantity}}{\text{Total Intended Quantity}} \right) \times 100$$
* Use `Math.abs(Raw Variance).toFixed(1)` for clean display presentation (e.g., `8.5%`).

### B. Proportional Color-Coding Based on Variance State
* **Perfect Match ($\text{Variance} == 0\%$):** * Render a subtle, low-contrast slate or neutral emerald badge.
  * *Classes:* `bg-slate-100 text-slate-700 border-slate-200` or `bg-emerald-50 text-emerald-700 border-emerald-100`
  * *Text:* `0.0% Discrepancy`
* **Short-Delivery ($\text{Received} < \text{Intended}$):** * Render a warning alert state signifying missing inventory.
  * *Classes:* `bg-amber-50 text-amber-700 border-amber-200`
  * *Text:* `⚠️ -X.X% Short` (e.g., `⚠️ -12.5% Short`)
* **Over-Delivery ($\text{Received} > \text{Intended}$):** * Render a distinct surplus notice badge state.
  * *Classes:* `bg-blue-50 text-blue-700 border-blue-200`
  * *Text:* `📦 +X.X% Surplus` (e.g., `📦 +5.0% Surplus`)

---

## 2. Header Grid Layout Clean-Up and Re-Proportioning

Locate the main overview block rendering delivery metadata at the top of the interface layout.

### A. Code Deletion
* Completely remove the layout cells, label definitions, Lucide icons, and text tags for `Buyer PO Number` and `Order Number`.

### B. Proportional Layout Redistribution
* Because two data metrics have been removed from the panel framework, reconfigure the Tailwind responsive responsive layout settings to distribute remaining cells symmetrically across the screen.
* Modify the layout wrapper from its previous structure to an optimal grid layout to prevent empty voids or alignment clipping:
  ```tsx
  // Example of optimized layout distribution grid
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {/* Remaining cells: Delivery Number, Status, Customer Info, Plant Destination */}
  </div>
3. High-Density Unified Card UI Component Harmonization
To ensure consistent visual continuity across the entire workspace layout, review all containers (Card, CardHeader, CardTitle, CardContent) on this page.

Ensure every block element inherits matching border radii, border metrics, and box shadows (e.g., matching our Tailwind v4 custom tokens style blueprint: shadow-sm border border-slate-200/80 rounded-xl bg-white).

Prevent layout jarring: the top indicator summary banner card, the delivery master header container, the photo file upload dropzone dashboard, and the core batch grid data layout container must look completely cohesive in high-density sizing and padding consistency.

Expected Output
Please provide the fully updated code for DeliveryReceivePage.tsx. Keep the strict 10-item page pagination limits bound exclusively to parent ItemGroups, the read-only row totals calculations, and child batch line data inputs working flawlessly together without losing context.