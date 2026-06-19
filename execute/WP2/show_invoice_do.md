# Feature Prompt: Include and Display SAP Invoice Number in Delivery Details

## Context
We need to enhance the delivery details feature. When fetching delivery details by ID, the API should now lookup and return the associated `InvoiceNumber` if an invoice record exists for that delivery in the database. The frontend should capture this value and display it alongside core delivery details.

---

## 1. Backend Side Implementation (`amtemeterai.Api`)

### Step 1.1: Update the DTO Layer
Ensure the Data Transfer Object returned by the delivery details endpoint is equipped to carry the invoice string.

- **File to check/update:** `amtemeterai.Api.Dtos.DeliveryResponseDto` (or wherever your `DeliveryResponseDto` model definition lives).
- **Modification:** Add the nullable string property `InvoiceNumber`.
```csharp
public string? InvoiceNumber { get; set; }
Step 1.2: Adjust the API Endpoint
Update the GetDeliveryById method to dynamically query the Invoices table for an existing relational match and map it to the response object.

File: amtemeterai.Api.Controllers.DeliveriesController.cs

Target Method: public async Task<ActionResult<DeliveryResponseDto>> GetDeliveryById(int deliveryId)

Modifications:

Perform an asynchronous database lookup right after fetching the delivery header to check if there is an invoice matching DeliveryHeaderId == delivery.DeliveryID.

Map the evaluated InvoiceNumber into the DeliveryResponseDto initialization block.

C#
// Inside GetDeliveryById method...
var delivery = await _db.DeliveryHeaders
    .Include(d => d.Lines)
    .Include(d => d.Customer)
    .FirstOrDefaultAsync(d => d.DeliveryID == deliveryId);

if (delivery == null)
    return NotFound();

// 🆕 Lookup associated invoice number if it exists
var associatedInvoiceNumber = await _db.Invoices
    .Where(i => i.DeliveryHeaderId == delivery.DeliveryID)
    .Select(i => i.InvoiceNumber)
    .FirstOrDefaultAsync();

// ... security checks ...

var response = new DeliveryResponseDto
{
    DeliveryID = delivery.DeliveryID,
    // ... rest of existing mappings
    Invoiced = delivery.Invoiced,
    InvoiceNumber = associatedInvoiceNumber, // 🆕 Bind database invoice value here
    PublicUrl = GetPublicUrl(delivery.ReceiverToken, _configuration["App:PublicBaseUrl"]),
    // ... rest of the code
};
2. Frontend Side Implementation (React + Vite)
Step 2.1: Update Type Layout definitions
Ensure the detail view matches the API schema structure changes.

File: DeliveryDetailPage.tsx

Target Interface: interface DeliveryDetail

Modification: The type signature matches what is already declared in your file template. Just ensure it is mapped out correctly:

TypeScript
interface DeliveryDetail {
  // ... existing fields
  invoiced: boolean
  invoiceNumber?: string | null // Confirmed ready
  // ... existing fields
}
Step 2.2: Implement UI Render Element
Display the evaluated property gracefully within the Core Dispatch Information layout section.

File: DeliveryDetailPage.tsx

Target Location: Inside the layout card titled "Core Dispatch Information", right around the existing conditional block checking for delivery.invoiceNumber.

Modification: Replace or complement the existing placeholder badge logic so it evaluates dynamically. Change the static badge layout to display under the appropriate section header if an invoice string exists.

TypeScript


{delivery.received && delivery.receiveDate && (
  <div className="space-y-1">
    <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
      Receive Date
    </p>
    <p className="text-sm text-brand-blue/80">
      {formatDate(delivery.receiveDate)}
    </p>
  </div>
)}


{delivery.invoiceNumber && (
  <div className="space-y-1">
    <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
      SAP Invoice Number
    </p>
    <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-normal text-xs" variant="outline">
      {delivery.invoiceNumber}
    </Badge>
  </div>
)}
3. Verification Steps
Recompile backend API server and ensure all schemas align without throwing data casting errors.

Open a delivery detail view panel that has an existing invoice generated. Verify the badge component populates the authentic SAP alphanumeric payload string safely.