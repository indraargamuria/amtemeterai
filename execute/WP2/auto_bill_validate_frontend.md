# Target Specification: Manual Billing Trigger & Idempotent SAP Synchronization

Please implement the manual SAP billing generation and re-synchronization workflow. This requires adding a transactional idempotency guardrail in the backend API, mounting a new interactive action structure in the frontend detail page view, and updating the system architecture documentation.

---

## 1. Backend API Changes (`DeliveriesController.cs`)

Locate the `CreateSapInvoice` endpoint (`POST api/deliveries/{deliveryNumber}/invoice`) inside `DeliveriesController.cs`. Modify its logic flow to transition from a single-use lock to an idempotent synchronization gateway.

### 🔄 Logic Modifications:
1. **Remove the `Invoiced` Block Guardrail:** Remove or bypass the condition that throws a `BadRequest` if `delivery.Invoiced` is already `true`. We must allow this endpoint to be executed multiple times for the same delivery number to enable data re-synchronization.

2. **Implement Local Database Idempotency Check:**
   Before dispatching any outbound network payload to the external SAP endpoint, check the `Invoices` table to see if an invoice record already exists for this delivery:
   ```csharp
   var existingInvoice = await _db.Invoices
       .FirstOrDefaultAsync(i => i.DeliveryHeaderId == delivery.DeliveryID);
Conditional Flow Execution:

Case A (New Billing Request): If existingInvoice == null, proceed with the active outbound SAP network transaction (POST http://10.2.38.138:8000/sap/bc/zr_createinv?sap-client=250), commit the database records inside the existing transaction block, and return the standard successful DeliverySettlementResponseDto.

Case B (Re-sync / Record Already Exists): If existingInvoice != null, do not call the SAP API. Immediately short-circuit the execution flow safely and return an Ok() status code with a payload matching your standard response schema, flagging that it was already processed previously:

C#
return Ok(new DeliverySettlementResponseDto
{
    Success = true,
    Message = "Invoice already created previously",
    InvoiceNumber = existingInvoice.InvoiceNumber,
    InvoiceAmount = existingInvoice.InvoiceAmount,
    BillingDate = existingInvoice.InvoicedDate,
    DeliveryNumber = deliveryNumber
});
2. Frontend Changes (DeliveryDetailPage.tsx)
Update the UI dashboard layout inside DeliveryDetailPage.tsx to handle the endpoint trigger, process conditional responses, and render live tracking components.

🔄 UI & State Updates:
State Tracking Variables:

Add a processingBilling boolean state variable to handle loading states, blocking user interactions during execution.

Ensure that upon a successful billing callback, the local delivery details data object is mutated or re-fetched inline so that the state matches the real-time invoice parameters.

Dynamic Action Button Mounting:

Add a primary action <Button> to the main actions layout block (e.g., in the header toolbar next to printing or back controls).

Label Rules:

If delivery.invoiced is true OR delivery.invoiceNumber is populated in state, label the button: "Sync SAP Invoice".

Otherwise, label the button: "Generate SAP Invoice".

Disable the button if processingBilling is active.

Response Validation & Dialog Logic:
Invoke the endpoint using your standard useApi utility. Within the successful resolve callback block, evaluate the message parameter returned inside the JSON response payload:

Condition A: If the message matches exactly "Invoice already created previously", trigger a success popup/toast notification displaying:

"Invoice {InvoiceNumber} successfully synchronized."

Condition B: For any standard new creation sequence, display a success popup/toast notification displaying:

"Invoice {InvoiceNumber} successfully created."

Invoice Number Badge Render:
In the summary detail row grids (where fields like Delivery Number, Date, and Customer Code are mapped), check if delivery.invoiceNumber exists. If present, render it cleanly with an explicit label and a visual <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"> component.

3. Documentation Sync (backend-summary.md)
Locate the backend-summary.md file in your root workspace.

Update the "Delivery settlement processing" section or the API endpoint route listings to reflect these architectural changes. Explicitly update the file to clarify that POST /api/deliveries/{deliveryNumber}/invoice now supports an idempotent execution flow that safely prevents duplicate ledger creation by performing pre-flight database cross-checks, allowing safe re-sync actions from the client app.


4. Documentation Sync (frontend-summary.md)
Locate the frontend-summary.md file in your root workspace.
Also update the changes on frontend-summary.md