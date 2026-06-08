# Implementation Guide: Delivery-to-Invoice Automation & Peruri E-Meterai On-Premise Integration

You are an expert backend engineer working on **OpexNOW**. Complete the following tasks sequentially. Ensure code cleanliness, clear validation logging, and follow the architectural guidelines specified for each step.

---

## Part 1: SAP Invoice Simulation & Migration Prep

### Task 1.1: Create the Simulated SAP Billing Endpoint
Since the SAP team has not yet developed their billing endpoint, create a temporary internal controller route that mimics their exact future API contract.
*   **Route:** `POST /api/sap-sim/billing`
*   **Data Structure:** Derive the Request DTO matching the existing payload structure found in the *Delivery Confirmation* process.
*   **Behavior:** Accept a delivery identifier, generate a simulated SAP invoice format, and return a payload containing `sapInvoiceNumber`, `billingDate`, `amount`, and `currency`.

### Task 1.2: Refactor Delivery Printout Upload to use Delivery Number
Modify the route parameters of the existing delivery printout endpoint to use the SAP-native key string.
*   **Old Endpoint:** `POST /api/deliveries/{deliveryId}/upload-printout`
*   **New Endpoint:** `POST /api/deliveries/by-number/{deliveryNumber}/upload-printout`
*   **Behavior:** Update the underlying database queries to lookup and bind properties using the unique business `deliveryNumber` instead of the internal database sequential auto-increment ID.

### Task 1.3: Orchestrate the Delivery Settlement Processing Loop
Create a test-triggerable handler to orchestrate the downstream data generation flow for a target delivery:
*   **Route:** `POST /api/test/deliveries/{deliveryNumber}/process-settlement`
*   **Step A:** Call the simulation route created in Task 1.1 to fetch the generated invoice details.
*   **Step B:** Parse a dummy `.pdf` asset stored within a local directory (e.g., `tests/fixtures/dummy_do.pdf`) and invoke the modified printout endpoint from Task 1.2 to commit it to the asset storage.
*   **Step C:** Write database transactional logs:
    *   Mark the delivery header record status as `Invoiced`.
    *   Insert a record into the `Invoices` table using the properties parsed from the SAP simulation payload.
    *   Insert an entry into the document attachment table referencing the newly saved storage entity (matching the structure used for delivery evidence photos).

---

## Part 2: Local Peruri On-Premise E-Meterai Loop

### Task 2.1: Implement Peruri Client Credentials & Session Management
*   **Configuration:** Inject the structural variables `backend_stg`, `stampv2_stg`, and `inventory_stg` along with service account credentials (`user`, `password`) into the application configuration (`appsettings.json`).
*   **Client Core:** Build a managed HTTP client that invokes the Peruri User Login API (`POST {{backend_stg}}api/users/login`) using the configured credentials to capture the returned JWT Bearer authentication token.

### Task 2.2: Refactor Stamp Route & Asset Preparation Pipeline
*   **Route:** Refactor `POST /api/invoices/{id}/stamp` or add an overload supporting `POST /api/invoices/by-sap-number/{invoiceNumber}/stamp`.
*   **Asset Processing:**
    *   Pull the unsigned target invoice PDF from storage and stream copy it into the Docker shared workspace input folder path: `/sharefolder/UNSIGNED/{invoiceNumber}.pdf`[cite: 4].
    *   Execute an authorization call to Peruri's Single Serial Number endpoint (`POST {{stampv2_stg}}chanel/stampv2`) using the cached JWT bearer token to retrieve an e-meterai allotment[cite: 4].
    *   Extract the returned fields `result.sn` (Serial Number) and `result.filenameQR` (Base64 QR image data) from the response data.
    *   Decode the Base64 QR block into a raw binary format image and write it to the local Docker shared workspace directory path: `/sharefolder/STAMP/{invoiceNumber}_qr.png`[cite: 4].

### Task 2.3: Execute Docker Adapter Sign Off & Status Verification
*   **Adapter Stamping:** Dispatch the payload transaction to the local on-premise Docker instance (`POST {{keystamp}}adapter/pdfsigning/rest/docSigningZ`) using the parameter schema mapped out below[cite: 4]:
```json
    {
        "certificatelevel": "NOT_CERTIFIED",
        "src": "/sharefolder/UNSIGNED/{invoiceNumber}.pdf",
        "dest": "/sharefolder/SIGNED/stamped_{invoiceNumber}.pdf",
        "spesimenPath": "/sharefolder/STAMP/{invoiceNumber}_qr.png",
        "refToken": "{extracted_serial_number}",
        "jwToken": "{current_jwt_token}",
        "visSignaturePage": 1,
        "visLLX": 237, "visLLY": 559, "visURX": 337, "visURY": 459
    }
    ```
*   **Post-Process & Cleanup:** After receiving a successful response from the signing engine, read back the verified output file located at `/sharefolder/SIGNED/stamped_{invoiceNumber}.pdf`, overwrite/update the target record pointer in your storage engine, and update the internal database status flag of the invoice record to `Stamped`. Remove the transient files from the workspace directories upon completion.