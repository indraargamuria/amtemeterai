You are an expert Frontend Architect specializing in high-density layout design with Tailwind CSS, Flexbox/Grid, and React.

We need to fix the layout structure of the `ChildRow` component in `DeliveryReceivePage.tsx`. The layout must be highly compact, perfectly proportional, completely eliminate any horizontal scrolling, and stack information cleanly to match our exact structural requirements.

### 📐 Mandatory Visual Layout Requirements for `ChildRow`

Please split each child row into a clear, balanced two-column layout using a horizontal flex container (`flex flex-row items-center justify-between w-full gap-4`):

1. **Left-Hand Column (Metadata Stack - 40% Width max):**
   * Do not stretch this horizontally. Arrange information into two super-compact vertical rows:
   * **Top Line:** Show the Child's `deliveryLineNumber` directly beside the `deliveryItemCode` / `deliveryItemDescription`.
   * **Bottom Line (Directly Underneath):** Show the `batchNumber` directly beside the intended/sales quantity text.

2. **Right-Hand Column (Input Dashboard - 60% Width flex-1):**
   * Arrange all tracking and comment inputs horizontally side-by-side in a single, unified row segment.
   * The fields must sequence exactly from left to right: 
     `[Received Input] -> [Rejected Input] -> [Returned Input] -> [Notes / Line Comment Input]`

3. **Proportional Field Widths & Scaling Protection:**
   * To prevent horizontal overflow or broken spacing, apply strict structural boundaries to the inputs:
   * The quantitative input elements (`Received`, `Rejected`, `Returned`) must have tight, fixed identical scaling widths (e.g., `w-16` or `w-20`) and use minified heights (`h-7`).
   * The `Notes` / `Line Comment` input field must be placed **directly beside the Returned field** on that same line, using `flex-1` or `w-full` so it naturally stretches to consume all the remaining horizontal space in the right-hand container.
   * Ensure any top labels for these inputs are extremely small (`text-[10px]` or hidden if managed by a header row) to maintain a flat, low-profile row height.

### ⚠️ Execution Constraints
* Maintain all functional state hooks (`linesMap`) and change handlers (`onInputChange`).
* Ensure that when the child input values change, the calculations cleanly cascade up to update the Parent Split Batch totals in real-time.
* Do not truncate code blocks. Output the full functional file.