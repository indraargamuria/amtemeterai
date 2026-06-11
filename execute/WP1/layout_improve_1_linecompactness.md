You are an expert Frontend Architect specializing in high-density Enterprise SaaS engineering, React, TypeScript, and Tailwind CSS.

We need to rewrite and refactor the component rendering blocks and search filtering mechanisms inside `DeliveryReceivePage.tsx`. 

### 📐 1. UI/UX Structural Refinements

1. **Eliminate Expand/Collapse Friction for Parent Single Batch Rows:**
   - Modify the layout structure of a **Parent Single Batch** row so that it visually mimics an *already expanded* split-parent container card.
   - It must feature the exact same styling tokens, outer border wrappers, and spacing elements as the split-parent layout.
   - **The Core Difference:** Remove the toggle chevron icon completely. Instead, render its tracking input fields (`Received`, `Rejected`, `Returned`, and `Notes`) directly inline on the right-hand column, matching the exact dual vertical stacked metadata layout on the left side (`Line Number` + `Item Code` on top; `Batch Number` + `Intended Qty` on the bottom line). No expanding or clicking interaction is allowed.

2. **Nested Children Multi-Column Row Layout:**
   - Keep the split-batch parent rows collapsible/expandable via the chevron toggle as they are currently.
   - Inside an expanded split-parent card, each **Child Line** must follow your tight two-column arrangement layout to prevent horizontal overflow:
     * **Left-Hand Column (Metadata Stack - Max 40% Width):** Top Line shows `Line Number` beside `Item Code`. Bottom Line (directly underneath) shows the `Batch Number` beside the intended quantity.
     * **Right-Hand Column (Input Dashboard - Flex-1):** Arranges tracking and comments horizontally side-by-side in a single row (`[Received Input] -> [Rejected Input] -> [Returned Input] -> [Notes / Line Comment Input]`), where the Notes input uses `flex-1` to naturally consume all remaining right-side horizontal space.

### 🔍 2. Advanced Search Filtering Rules (`useMemo`)

Refactor the client-side search indexing loop inside your data filtering `useMemo` block to support granular keyword matching (matching by Item Code, Description, Order Number, PO Number, or Batch Number):

1. **For a Parent Single Batch:** If it matches the search term (e.g., via its code, description, or its native batch string), display the row. Otherwise, filter it out.
2. **For a Parent with Split Batch:** - Check if any of its **nested Child records** contain the search keyword (specifically checking the child's `batchNumber`).
   - If a child row matches, display the parent card, but **filter the visible children stack so that ONLY the specific matching child line items are rendered underneath it**.
   - If the parent text itself matches the search query (like matching an overall Item Code or Order Number), display the parent row along with *all* of its associated children.

### ⚠️ Constraints & Safeguards
- Do not break or modify the existing flat state model (`linesMap`), native event handlers (`onInputChange`), camera/upload mechanics, or validation modals (`VarianceModal`, `GuardrailModal`).
- Ensure that updates to fields inside both Single Batch rows and filtered Child rows cleanly cascade up to trigger your live calculations and total summary badges seamlessly.
- Output the complete, fully operational `DeliveryReceivePage.tsx` file inside a single code block without any truncation.