# Task: Fix and Adjust Peruri On-Premise Stamping Integration Flow

There is a misconception regarding the endpoints and domain configurations read from the Peruri WP2 documentation versus the actual intended implementation flow. Please apply the following adjustments and corrections to the on-premise stamping services (specifically around `PeruriSessionService`, `PeruriOnPremiseStampService`, and the `InvoiceController` stamping endpoint).

---

## 1. Authentication Domain Correction
* **Current Config / Code State:** Using a generic or legacy domain for staging.
* **Correction:** The base URL domain used for staging authentication (and obtaining the cached JWT token) must be explicitly set to:
https://backendservicestg.e-meterai.co.id/api/users/login

* **Instruction:** Replace the current base URL or authentication endpoint configurations in your HTTP Client/Service setup to route to this exact domain for staging operations (ensure this remains configurable for a seamless switch to production later).

---

## 2. Allotment (QR & Serial Number) Endpoint Adjustment
* **Current Config / Code State:** Calling standard Stamp V2 endpoints based on documentation defaults.
* **Correction:** Fetching the serial number and the QR code configuration must go through this specific endpoint:
https://stampv2stg.e-meterai.co.id/chanel/stampv2

* **Instruction:** 
* Replace the current Base URL and resource path for the allotment service with the domain and endpoint listed above.
* Adjust the HTTP method matching the Peruri Stamp V2 request contract accordingly (ensure the payload properly maps to this endpoint).
* **Keep Unchanged:** The existing downstream data mapping logic—decoding the Base64 QR code, saving it into the designated `sharefolder` location, and capturing/storing the e-Meterai serial number into the `Invoice` table—remains identical.

---

## 3. PDF Signing / Stamping Engine Redirection
* **Current Config / Code State:** Pointing to `http://localhost:8081` or standard KeyStamp defaults.
* **Correction:** The signing engine configuration needs to hit the local adapter endpoint specifically built for PDF document transformation.
* **Instruction:** 
* Inspect the current execution flow after receiving the serial number and QR code.
* Direct the signing engine request to use the following URL:
http://localhost:9999/adapter/pdfsigning/rest/docSigningZ
```
Update both the base URL configuration and ensure the underlying HTTP client invokes the correct matching HTTP method required by this adapter route.

Execution Checklist for Code Updates
[ ] Update configuration files (appsettings.json) or code constants to handle the updated staging domains gracefully.

[ ] Verify that IPeruriSessionService successfully hits the new login domain.

[ ] Verify that IPeruriOnPremiseStampService sends the allocation request to the updated chanel/stampv2 path.

[ ] Ensure the local HTTP request payload targeting port 9999 matches the expected format for docSigningZ.