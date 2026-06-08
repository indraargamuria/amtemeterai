Here is the precise engineering specification prompt you can hand off to Claude to securely expose and design the buyerPoNumber, orderNumber, and customerName fields on your public-facing receipt verification view.

Markdown
# Engineering Specification: Display Buyer PO, Order Number, and Customer Details on public deliveryreceivepage.tsx

## 1. Objective
Enhance the public-facing `deliveryreceivepage.tsx` screen to show additional tracking identifiers—specifically the Buyer PO Number, Order Number, and the full Customer Name—extracted right from the underlying delivery data structure. This ensures the receiving counter clerk or external customer has immediate context matching their physical paper procurement trails.

## 2. Data Contract Expectation
Ensure the state model representing your delivery object or the backend response tracking fields maps the following properties cleanly (or can fall back to empty placeholders if unassigned):
- `delivery.buyerPoNumber` (string)
- `delivery.orderNumber` (string)
- `delivery.customerName` (string) — *Note: Ensure your data fetching hook joins or fetches this string cleanly alongside `customerCode`.*

---

## 3. Implementation Steps for Claude Code

### Task 3.1: Verify State & Data Properties
Open `deliveryreceivepage.tsx`. Inspect the primary fetch payload response state object (e.g., `delivery`). Ensure the interface contract safely maps the incoming reference values:
```typescript
interface DeliveryReceiveData {
  deliveryNumber: string;
  customerName: string;
  buyerPoNumber?: string | null;
  orderNumber?: string | null;
  // ... rest of your existing receive line items properties
}
Task 3.2: Insert a High-Density Context Summary Banner
Locate the top layout section of the page, directly underneath the main delivery number header. Add a clean, minimalist metadata grid section utilizing your project's Card components or an information panel box to house the new identifiers:

TypeScript
{/* Document Identification Panel */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
  <div>
    <span className="block text-xs font-medium uppercase tracking-wider text-slate-400">
      Customer Name
    </span>
    <span className="text-sm font-semibold text-brand-blue">
      {delivery?.customerName || "N/A"}
    </span>
  </div>
  
  <div>
    <span className="block text-xs font-medium uppercase tracking-wider text-slate-400">
      Buyer PO Number
    </span>
    <span className="text-sm font-mono font-medium text-slate-700">
      {delivery?.buyerPoNumber || "—"}
    </span>
  </div>
  
  <div>
    <span className="block text-xs font-medium uppercase tracking-wider text-slate-400">
      Order Number
    </span>
    <span className="text-sm font-mono font-medium text-slate-700">
      {delivery?.orderNumber || "—"}
    </span>
  </div>
</div>
Task 3.3: Verify Null Safety and Fallbacks
Ensure the fields remain layout-resilient. If a legacy invoice or rapid warehouse dispatch delivery document bypasses standard ERP structures and doesn't record a buyerPoNumber or an orderNumber, the UI must handle the null/undefined state cleanly using conditional short-circuits (rendering "—" or "N/A") instead of crashing the client runtime or leaving raw blanks.

4. Verification & Testing Criteria
Access a public delivery receipt record that has an active PO string assignment (e.g., PO-2026-9901). Verify the panel displays the code string accurately using a clean monospace variant layout font.

Verify that customerName displays the full company name string cleanly alongside the structural data elements.

Verify that adding this panel does not overlap or conflict with the validation behavior or element reordering applied on the receiver name input section.