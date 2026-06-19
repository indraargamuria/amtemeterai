I need you to implement a new API endpoint inside `DeliveriesController.cs` to trigger an actual SAP Invoice creation for a delivery number. 

### Context & Goals:
1. Currently, `TestController.ProcessDeliverySettlement` handles a simulation workflow where it hits a dummy internal API (`/api/sap-sim/billing`) to get invoice details, updates the `DeliveryHeader.Invoiced` flag, and saves the invoice metadata to the `Invoices` table.
2. I want a production version of this flow added to `DeliveriesController.cs`. Instead of a dummy API, it should invoke the real SAP server endpoint.

### Specifications:
- **HTTP Method & Route**: `HttpPost("{deliveryNumber}/invoice")`
- **Payload**: Same as the simulation, a JSON object containing only `DeliveryNumber` (you can reuse `SapBillingRequestDto` or build it inline).
- **Target SAP URL**: `http://10.2.38.138:8000/sap/bc/zr_createinv?sap-client=250`
- **HTTP Client Strategy**: 
  - Do NOT use the Named Client `"SapClient"` directly if it overrides the base address config incorrectly for this IP. Instead, use `_httpClientFactory.CreateClient()` to create a clean client instance, and post directly to the absolute URL string: `http://10.2.38.138:8000/sap/bc/zr_createinv?sap-client=250` (or extract it gracefully if configurations exist, but hardcoding/string formatting this destination path directly for this explicit network routing is acceptable here).
- **Response Shape**: Same structure as `SapBillingResponseDto` (which includes `SapInvoiceNumber`, `CustomerNumber`, `Amount`, `BillingDate`, etc.).

### Step-by-Step Flow Required in the Endpoint:
1. **Validation**: Check if the `deliveryNumber` exists in `_db.DeliveryHeaders`. If not, return `NotFound`.
2. **Locking**: Check if `delivery.Invoiced` is already `true`. If so, return a `BadRequest` stating that the delivery is already invoiced.
3. **Outbound Request**: Send a `POST` request to `http://10.2.38.138:8000/sap/bc/zr_createinv?sap-client=250` with the `SapBillingRequestDto` body payload.
4. **Error Handling**: If the SAP server returns a non-success status code, capture the response content and return a `502 Bad Gateway` / `StatusCode((int)response.StatusCode)` with the SAP error message details.
5. **Database Updates (Transactional)**:
   - Use an atomic database transaction (`using var transaction = await _db.Database.BeginTransactionAsync();`).
   - Set `delivery.Invoiced = true`.
   - Instantiate and insert a new `Invoice` entry matching the pattern seen in `TestController`:
     ```csharp
     var invoice = new Invoice
     {
         InvoiceNumber = sapBillingData.SapInvoiceNumber,
         CustomerNumber = sapBillingData.CustomerNumber,
         InvoiceAmount = sapBillingData.Amount,
         InvoicedDate = sapBillingData.BillingDate,
         Status = Invoice.InvoiceStatus.Draft,
         DeliveryHeaderId = delivery.DeliveryID,
         StampingStatus = Invoice.InvoiceStampingStatus.NotStamped
     };
     ```
   - Log the action using the local controller helper `await LogActivity("SapInvoiceCreated", ...);`.
   - Commit the transaction.
6. **Return Values**: Return an `Ok()` statement passing the data back to the system (OpexNOW), preserving a uniform return data scheme similar to the simulation response or a clean transaction summary object.

Please write the complete code modification for `DeliveriesController.cs`, maintaining consistency with the logging structure, existing dependencies, and asynchronous architecture pattern already defined in the file.