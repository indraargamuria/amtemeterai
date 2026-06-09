# Task: Complete e-Meterai Business Rules Payload Mapping

We have successfully refined our on-premise Peruri stamping infrastructure (including the zero-footprint workspace layout, MinIO QR code separation, and bottom-right coordinate targeting). Now, we need to replace the temporary static staging values inside the Peruri Stamp V2 request payload with proper, dynamic business mappings derived from the active invoice records.

Please refactor `PeruriOnPremiseStampService.cs` to map the payload parameter data exactly as outlined below.

---

## 1. Peruri API Request DTO Definition
Ensure your internal DTO properties inside `PeruriApiDtos.cs` or within your service use clean string/bool fields that match the Peruri API contract signature exactly:
```csharp
public class PeruriStampRequestDto
{
    public bool isUpload { get; set; }
    public string namadoc { get; set; } = "4b"; // Standard code for Invoice/Faktur
    public string namafile { get; set; } = string.Empty;
    public string nilaidoc { get; set; } = string.Empty;
    public string namejidentitas { get; set; } = string.Empty;
    public string noidentitas { get; set; } = string.Empty;
    public string namedipungut { get; set; } = string.Empty;
    public bool snOnly { get; set; }
    public string nodoc { get; set; } = string.Empty;
    public string tgldoc { get; set; } = string.Empty;
}
2. Dynamic Business Mapping Logic (PHASE 4 Refinement)Locate PHASE 4: CALL PERURI API STAMP V2 inside PeruriOnPremiseStampService.cs. Replace the hardcoded staging fallback data with the following calculated properties based on the loaded database invoice entity:  nodoc (Document ID Bridge): Set this parameter to invoice.InvoiceID.ToString(). Use the internal database Primary Key integer string representation rather than the alphanumeric invoice identifier.namedipungut (Taxpayer Name Case Sanitization): Extract the customer name from the joined records (or fallback to request.CustomerName). Transform this string into proper Title Case (Capitalize the first letter of each word) and strip out all spaces completely (e.g., "pt. adhi karya (persero)" $\rightarrow$ "Pt.AdhiKarya(Persero)").  namejidentitas (Identity Framework Type): Hardcode this parameter value strictly to "NPWP".noidentitas (Tax Registration Identification Number): Map this property dynamically to the customer's NPWP identifier stored inside request.CustomerNumber (or the appropriate database column holding customer tax identification details).  namafile (File Name Data Masking): Sanitize the invoiceNumber string code. Strip out any whitespace, slashes, or special symbols using regex patterns/masking, and append a clean .pdf extension suffix before assigning it to the field (e.g., "INV/2026-009" $\rightarrow$ "INV2026009.pdf").  nilaidoc (Document Monetary Price Evaluation): Extract the raw financial invoice tier from request.Amount (e.g., convert the decimal value safely to a string representation matching standard Peruri formatting specifications).  Expected OutputPlease review the full context of PeruriOnPremiseStampService.cs, keep the existing zero-footprint cleanups, MinIO workflows, and bottom-right coordinates intact[cite: 2], and implement these precise business contract mappings seamlessly.  