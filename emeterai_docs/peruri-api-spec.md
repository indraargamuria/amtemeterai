# PERURI E-Meterai On-Premise Web Service API Specification
**Version:** 1.3  
**Classification:** Confidential  
**Effective Date:** April 1, 2022 (Updated July 20, 2022)  

## Introduction
The On-premise mechanism enables e-meterai stamping using a Sign Adapter module deployed within the client/partner's internal infrastructure. This process allows localized stamping via document *hashing* without sending the actual file to Peruri's external servers, ensuring maximum data privacy and security.

---

## Core Stamping Workflow

### 1. User Login API
Authenticates the client and returns a JWT Token required to authorize all subsequent API calls.

*   **Method:** `POST`
*   **URL:** `{{backend_stg}}api/users/login`[cite: 4]
*   **Content-Type:** `application/json`

#### Request Body
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `user` | String | Registered account email |
| `password` | String | Account password |

#### Response Body
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `statusCode` | String | "00" = Success; any other value indicates a failure |
| `message` | String | Status response description |
| `token` | String | JWT Token for subsequent API authorization |

---

### 2. Generate Serial Number API (Single)
Requests a single e-meterai serial number alongside its corresponding QR code image in Base64 format.

*   **Method:** `POST`
*   **URL:** `{{stampv2_stg}}chanel/stampv2`[cite: 4]
*   **Authentication:** `Bearer Token`

#### Request Body
| Parameter | Type | Required (M/O) | Description |
| :--- | :--- | :--- | :--- |
| `isUpload` | Boolean | M | Set to `false` |
| `namadoc` | String | M | Document type code from the Document Type API |
| `namafile` | String | M | Original file name (e.g., `invoice.pdf`) |
| `nilaidoc` | String | O | Transaction/document value (Mandatory for Tax Collector accounts) |
| `namejidentitas`| String | O | Identity type liable for tax (`KTP` / `NPWP`) |
| `noidentitas` | String | O | Identity number (15/16 digits) |
| `namedipungut` | String | O | Name of the liable party |
| `snOnly` | Boolean | M | Set to `false` |
| `nodoc` | String | M | Document number; use `"0"` if unavailable |
| `tgldoc` | String | M | Document date (`YYYY-MM-DD`) |

#### Response Body
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `result.sn` | String | Generated e-meterai serial number |
| `result.filenameQR`| String | Base64-encoded QR code image data |

---

### 3. Generate Serial Number API (Batch)
Asynchronously requests multiple e-meterai serial numbers in a single bulk operation. Your system must provide a `return_url` webhook to receive the execution callback.

*   **Method:** `POST`
*   **URL:** `{{inventory_stg}}api/v2/serialnumber/batch`[cite: 4]

#### Request Body (Summary)
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `return_url` | String | Your system's webhook endpoint to receive serial numbers & QR data |
| `tipe` | String | E-meterai face value nominal (e.g., `"10000"`)[cite: 4] |
| `document` | Array | Array of document metadata objects (`idfile`, `file`, `namadoc`, etc.) |

---

### 4. Stamping API (On-Premise PDF Signing)
Executes the local embedding of the e-meterai into the PDF document using the on-premise Docker Sign Adapter without file extraction.

*   **Method:** `POST`
*   **URL:** `{{keystamp}}adapter/pdfsigning/rest/docSigningZ`[cite: 4]

#### Request Body
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `certificatelevel`| String | Certification level; set to `"NOT_CERTIFIED"`[cite: 4] |
| `src` | String | Path to the unsigned local PDF (Maps to Docker `/sharefolder/UNSIGNED`)[cite: 4] |
| `dest` | String | Destination path for the stamped PDF (Maps to Docker `/sharefolder/SIGNED`)[cite: 4] |
| `spesimenPath` | String | Path to the saved QR image file (Maps to Docker `/sharefolder/STAMP`)[cite: 4] |
| `refToken` | String | E-meterai serial number obtained from the generation step[cite: 4] |
| `jwToken` | String | JWT Token obtained from login[cite: 4] |
| `visSignaturePage`| Integer | Target page number for the e-meterai placement[cite: 4] |
| `visLLX`, `visLLY` | Double | Lower-Left X and Y coordinates for stamp placement[cite: 4] |
| `visURX`, `visURY` | Double | Upper-Right X and Y coordinates for stamp placement[cite: 4] |
| `retryFlag` | String | Pass `"1"` if re-attempting a failed stamping process |

---

## Utility & Verification Services

### 5. Document Type API
Retrieves the standard legal codes for various document categories (e.g., Notarial Deed, Agreement) needed for the `namadoc` field.
*   **Method:** `GET` | **URL:** `{{stampv2_stg}}jenisdoc`[cite: 4]

### 6. Check Serial Number Status API
Verifies the current real-time state of a specific Serial Number (`STAMP` or `NOTSTAMP`).
*   **Method:** `GET` | **URL:** `{{backend_stg}}api/chanel/stamp/ext?filter={SN}`[cite: 4]

### 7. Check Batch Request Status API
Queries the processing state of a bulk request if the webhook callback fails to trigger.
*   **Method:** `GET` | **URL:** `{{stampv2_stg}}snqr/status-batch?batchId={ID}`[cite: 4]

### 8. Check Quota Balance API (POS / SCM Collector)
Queries remaining e-meterai balances or item allocations within the distribution network.
*   **POS Method:** `POST` | **URL:** `{{backend_stg}}function/saldopos`[cite: 4]
*   **Collector Method:** `GET` | **URL:** `{{backend_stg}}sale/saldo-scm?idLoc={ID}&db=true`[cite: 4]

### 9. Update Stamping Metadata API
Modifies tax obligation or identification metadata for a generated Serial Number, provided its state is still `NOTSTAMP`.
*   **Method:** `POST` | **URL:** `{{stampv2_stg}}stamping/update-data/{SN}`[cite: 4]