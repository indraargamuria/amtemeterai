# Task: Align Peruri Stamp Request Schema with Postman Contract

The current `PeruriStampRequestDto` structure fails because its properties do not match Peruri's actual specification payload. We need to overhaul the DTO properties to mirror the exact structure verified in the working Postman test payload from `image_95d6ab.png` and update the mapping inside `PeruriOnPremiseStampService.cs`.

---

## 1. Target Request Body Blueprint

```json
{
    "isUpload": false,
    "namadoc": "4b",
    "namafile": "your_filename.pdf",
    "nilaidoc": "10000",
    "namejidentitas": "KTP",
    "noidentitas": "1251038765430004",
    "namedipungut": "Santosa",
    "snOnly": false,
    "nodoc": "25",
    "tgldoc": "2026-06-08"
}
2. Refactoring Steps
Step A: Overhaul PeruriStampRequestDto
Navigate to your DTO file and replace the existing properties of PeruriStampRequestDto with the following compliance fields matching the correct JSON naming requirements:

C#
public class PeruriStampRequestDto
{
    [JsonPropertyName("isUpload")]
    public bool IsUpload { get; set; } = false;

    [JsonPropertyName("namadoc")]
    public string NamaDoc { get; set; } = "4b"; // Compliance document type code

    [JsonPropertyName("namafile")]
    public string NamaFile { get; set; } = string.Empty;

    [JsonPropertyName("nilaidoc")]
    public string NilaiDoc { get; set; } = "10000"; // eMeterai nominal price string

    [JsonPropertyName("namejidentitas")]
    public string NameJIdentitas { get; set; } = "KTP"; // ID Card Type (e.g., KTP/NPWP)

    [JsonPropertyName("noidentitas")]
    public string NoIdentitas { get; set; } = string.Empty;

    [JsonPropertyName("namedipungut")]
    public string NameDipungut { get; set; } = string.Empty;

    [JsonPropertyName("snOnly")]
    public bool SnOnly { get; set; } = false;

    [JsonPropertyName("nodoc")]
    public string NoDoc { get; set; } = string.Empty; // Document/Invoice Number

    [JsonPropertyName("tgldoc")]
    public string TglDoc { get; set; } = string.Empty; // Must be formatted as YYYY-MM-DD
}
Step B: Update Object Mapping in PeruriOnPremiseStampService.cs
Update Step 3 in your service class execution flow to map your business fields into the new compliance parameters. Make sure your local mapping supplies valid values (or uses system options/defaults) for mandatory parameters like noidentitas and namedipungut:

C#
// Step 3: Call Peruri Stamp v2 API to get serial number and QR code
_logger.LogInformation("Step 3: Calling Peruri Stamp v2 API at {Stampv2Stg}", _options.Stampv2Stg);

var stampClient = _httpClientFactory.CreateClient();
var stampUrl = $"{_options.Stampv2Stg.TrimEnd('/')}/chanel/stampv2";

var stampRequest = new PeruriStampRequestDto
{
    IsUpload = false,
    NamaDoc = "4b", // Or load from your configuration options
    NamaFile = $"{invoiceNumber}.pdf",
    NilaiDoc = "10000",
    NameJIdentitas = "KTP", 
    NoIdentitas = request.CustomerNumber ?? "1251038765430004", // Fallback placeholder if empty for staging
    NameDipungut = request.CustomerName ?? "Customer Name",
    SnOnly = false,
    NoDoc = invoiceNumber,
    TglDoc = DateTime.Today.ToString("yyyy-MM-dd") // Solves error 96 format mismatch
};

stampClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {jwtToken}");
var stampResponse = await stampClient.PostAsJsonAsync(stampUrl, stampRequest);

// Read response string for downstream validation processing
var responseString = await stampResponse.Content.ReadAsStringAsync();
3. Post-Implementation Check
Verify that fields requiring minimum lengths (like noidentitas needing 15/16 characters for NPWP/KTP validation errors) are safely populated during testing to prevent falling back into alternate error branches.