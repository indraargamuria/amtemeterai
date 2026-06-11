You are an expert Frontend Architect specializing in high-density Enterprise SaaS engineering, React, TypeScript, and Tailwind CSS.

We need to rewrite and refactor the component rendering blocks inside `DeliveryReceivePage.tsx`. The layout must be highly compact, consistent, and intuitive for warehouse operators. Refactor the tree rendering components (`SingleBatchRow`, `SplitBatchParentRow`, and `ChildRow`) based on the following structural constraints:

### 📐 Mandatory Design & Layout Constraints

1. **Identical Visual Container Layout for All Parent Rows:**
   - The interactive layout shell for a **Parent Single Batch** (`SingleBatchRow`) and a **Parent with Split Batch** (`SplitBatchParentRow`) must be *exactly identical* in spacing, padding, typography, height, and content alignment.
   - **The Only Structural Exception:** The Parent with Split Batch card must render the expand/collapse icon (`ChevronDown`/`ChevronUp`), whereas the Parent Single Batch card must leave that space empty or hidden (no toggle indicator), as it cannot be expanded.

2. **Strict Line Number Inclusion on All Parents:**
   - Every parent container (`SingleBatchRow` and `SplitBatchParentRow`) must clearly and prominently render its `deliveryLineNumber` at the far front or top of the line item card (e.g., Prefixed as `Line #10` or `L10`).

3. **High Contrast Child vs. Parent Distinction:**
   - While parent containers render as full standalone high-density row components, **Child Lines** (`ChildRow`) must be rendered inside a nested stack container underneath an expanded parent.
   - The child stack must utilize clear indicators to separate it from its parent visually: a subtle structural indentation margin (`ml-6`), a left-border connection track marker (`border-l-2 border-slate-200 pl-4`), and a alternating zebra background (`bg-slate-50/70`) to distinguish children instantly at a glance.
   - Child rows must also display their own `deliveryLineNumber` (e.g., `Line #11`), styled cleanly so it is readable but hierarchically subordinate to the parent's line label.

4. **Contextual Omission of Redundant Child Attributes:**
   - **Child Rows MUST NOT** display `buyerPONumber`, `orderNumber`, or the unit of measure (`packUOM`/`salesUOM`). Because these attributes are consistent across the batch family and already explicitly displayed at the parent level, remove them from the child row layout to save line density.

5. **Conditional Batch Field Display Logic:**
   - For a **Parent Single Batch**: Render its `batchNumber` directly inside the parent line's description detail row.
   - For a **Parent with Split Batch**: Do not display a batch number on the parent card (leave that meta-field omitted or hidden). Instead, render each unique `batchNumber` exclusively inside its corresponding nested child component row (`ChildRow`).

### 🛠️ Sub-Component Structure Optimization
- Make sure that `SingleBatchRow` and `ChildRow` map their respective granular form values (`Received`, `Rejected`, `Returned`) to the input fields on the right, utilizing hyper-compact design tokens (`h-7`, text-xs, compact inner padding, and clear top labels).
- Ensure that updating form state at the Child level dynamically cascades calculations upward via the updated `linesMap` to trigger instant live-totals changes and badge updates on the Parent with Split Batch card.
- Retain performance protections (`memo`, `useMemo`, `useCallback`) to avoid typing lags on massive sheets.

Please output the completely refactored and functional `DeliveryReceivePage.tsx` source code in a single code block without any internal truncation or skipped sections.