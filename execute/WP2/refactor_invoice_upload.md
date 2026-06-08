You are an expert backend engineer working on **OpexNOW**. Complete the following tasks sequentially. Ensure code cleanliness, clear validation logging, and follow the architectural guidelines specified for each step.

Part 3
### Task 3.1: Refactor Invoice Printout Upload to use Invoice Number
Modify the route parameters of the existing delivery printout endpoint to use the SAP-native key string.
*   **Old Endpoint:** `POST /api/invoices/{id}/upload-printout`
*   **New Endpoint:** `POST /api/invoices/by-number/{invoiceNumber}/upload-printout`
*   **Behavior:** Update the underlying database queries to lookup and bind properties using the unique business `invoiceNumber` instead of the internal database sequential auto-increment ID.