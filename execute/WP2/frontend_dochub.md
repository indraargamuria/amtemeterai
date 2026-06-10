# Task: Design and Implement a Unified, Standalone-Compatible "Document Hub" UI

We are extending the frontend workspace to introduce a centralized **Document Hub** (`/documents`). 

Currently, our screens (such as `/deliveries` and `/invoices`) assume a strict sequential connection. However, the system is evolving to support **Direct Standalone Invoices** that originate directly from ERP billing without any associated warehouse Delivery Order (DO). 

Please design and implement a high-density, enterprise-grade React component using our **Tailwind v4** configuration and **Shadcn UI** design tokens that gracefully unifies both document types.

---

## 1. Architectural Strategy: The Transaction-Agnostic Paradigm

To prevent duplicating code paths or breaking layouts when a relation is missing, the system must process data entries dynamically:
* If an item has **both a Delivery Order and an Invoice**, provide controls to preview/interact with both assets.
* If an item is a **Standalone Invoice** (`deliveryHeaderId` or `deliveryNumber` is `null`/`undefined`), adapt the layout seamlessly. Replace missing delivery fields with an explicit fallback state rather than leaving blank gaps or breaking the row layout.

---

## 2. Interface Component Blueprint

### A. Top-Level Workspace Filter Toggles
Implement a clean, segmented tab design at the top of the workspace:
* **All Documents View**: Merges all entries chronologically or by ID.
* **Delivery-Centric View**: Highlights shipping status and downstream billing records.
* **Invoice-Centric View**: Tailored around e-Meterai regulatory compliance metrics.

### B. High-Density Layout Columns
The grid layout must maximize data density using compact paddings (e.g., `py-2` or `py-2.5`). Use the following columns structure:
1. **Billing Invoice Ref**: Displays the unique `invoiceNumber` styled in a clean monospace font with a document icon helper.
2. **Fulfillment Tracking (The Pivot Point)**: 
   * **Linked Flow:** Render a tracking badge containing the `deliveryNumber` with a warehouse/truck icon helper.
   * **Standalone Flow:** Render an explicit, low-contrast placeholder badge reading `"Direct Standalone Bill"` or `"No Delivery Link"`.
3. **Financial Weight**: The local formatted monetary valuation (`Rp` currency layout).
4. **Compliance Status**: A color-coded status badge indicating the e-Meterai lifecycle phase:
   * Stamped: `bg-emerald-50 text-emerald-700 border-emerald-200`
   * Unsigned/Draft: `bg-slate-100 text-slate-600 border-slate-200`
5. **Operations Matrix**:
   * A secondary button targeting the Delivery Order (`DO`). **Crucial UX:** This button must automatically change to `disabled` if the current invoice row is a standalone entry, with a tooltip indicating no upstream manifest exists.
   * A prominent primary action button reading `"Inspect Workspace"`.

---

## 3. Core Interaction & Preview Flow

When an operator clicks **"Inspect Workspace"**, execute the following interface response pattern:
* Toggle a right-side sliding sheet overlay drawer component (`Sheet` / `Drawer`) to occupy 40%–50% of the screen width without disrupting the underlying scroll/search status of the data grid.
* Inside the preview panel header, provide view toggles:
  * For linked pairs, show tabs for `[ View Delivery Order ]` and `[ View Invoice PDF ]`.
  * For standalone invoices, omit the delivery tab entirely, giving the invoice preview container 100% of the viewport context automatically.

---

## Expected Output
Please provide the fully functional TypeScript React component code, utilizing `lucide-react` icons and our existing Shadcn custom style tokens. Ensure clean conditional evaluation rules for all optional delivery parameters.

Upon complete, update frontend-summary.md