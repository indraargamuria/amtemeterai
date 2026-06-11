You are an expert Frontend Architect specializing in high-density layout design with Tailwind CSS and React.

We want to optimize the layout of the `ChildRow` component within `DeliveryReceivePage.tsx` to make it much more compact and eliminate the empty space created by removing the Buyer PO and Order Number attributes.

### 📐 Mandatory Layout Adjustments for `ChildRow`

1. **Shift to a Full Horizontal Grid Row:**
   - Eliminate the separate bottom line row where the Notes input field currently sits.
   - Integrate the Notes input directly into the main horizontal input tracking layout.

2. **Horizontal Grid Placement:**
   - Arrange the input components side-by-side using a clean, compact flex layout or a grid alignment block on the right-hand side.
   - The final sequential arrangement of tracking fields from left to right should be:
     `[Intended Qty Label/Text] -> [Received Input] -> [Rejected Input] -> [Returned Input] -> [Notes / Line Comment Input]`

3. **Sizing and Flex Weight Constraints:**
   - Keep the quantitative inputs (`Received`, `Rejected`, `Returned`) strictly compact with fixed minimum widths (e.g., `w-16` or `w-20`) and heights (`h-7`).
   - The `Notes` / `Line Comment` input field should be given a flexible fill structural wrapper (`flex-1` or `min-w-[180px]`) so it expands naturally to consume the remaining horizontal space to the right of the `Returned` quantity field.
   - Match the compact styling tokens (`h-7`, `text-xs`, tight internal padding) used on the other quantity elements for the Notes field.

4. **Label Cleanliness:**
   - Ensure input element labels remain perfectly aligned above their respective tracking fields. If label headings are handled globally at the parent header level or child stack wrapper to save vertical space, ensure the inline layout matches perfectly.

Please output the completely updated and operational `DeliveryReceivePage.tsx` code in a single code block without any internal truncations or skipped sections.