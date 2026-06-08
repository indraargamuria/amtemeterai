# Task: Fix Response Deserialization for Peruri Stamp V2 API 

The implementation needs to process the response from the `https://stampv2stg.e-meterai.co.id/chanel/stampv2` endpoint. A working integration test from Postman confirms that a successful interaction yields a flat configuration inside a `result` wrapper containing the dynamic serial number (`sn`) and base64 physical stamp (`image`).

Please update the incoming parsing DTOs and matching verification checks inside `PeruriOnPremiseStampService.cs` to explicitly support this schema configuration.

---

## 1. Verified JSON Payload Schema Reference
Use this live dynamic structure captured from Postman to design your response models:

```json
{
    "statusCode": "00",
    "message": "success",
    "result": {
        "sn": "2C5NV74I6D0HJ1EZ000DU9",
        "image": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgo..."
    }
}
2. Refactoring Adjustments
Step A: Align Response DTO Class Layout
Verify or redefine the underlying response model to capture the standard serial identifier and dynamic base64 sequence mapped from the JSON payload elements:

C#
public class PeruriStampV2Response
{
    [JsonPropertyName("statusCode")]
    public string StatusCode { get; set; } = string.Empty;

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("result")]
    public PeruriStampV2Result? Result { get; set; }
}

public class PeruriStampV2Result
{
    [JsonPropertyName("sn")]
    public string SerialNumber { get; set; } = string.Empty;

    [JsonPropertyName("image")]
    public string ImageBase64 { get; set; } = string.Empty;
}
Step B: Update Processing Block in PeruriOnPremiseStampService.cs
Update the network integration pipeline parsing block to evaluate the structure safely. If parsing fails, explicitly throw an exception mapping out the raw response to intercept any upstream validation message formats.

C#
var responseString = await response.Content.ReadAsStringAsync();

try
{
    var stampResponse = JsonSerializer.Deserialize<PeruriStampV2Response>(responseString);
    
    if (stampResponse == null)
    {
        throw new InvalidOperationException($"Deserialization returned null wrapper. Body: {responseString}");
    }

    // Capture explicit business rule error layers wrapped inside 200 OK statuses
    if (stampResponse.StatusCode != "00")
    {
        throw new InvalidOperationException($"Peruri Stamping Error Status ({stampResponse.StatusCode}): {stampResponse.Message}");
    }

    if (stampResponse.Result == null || string.IsNullOrEmpty(stampResponse.Result.SerialNumber))
    {
        throw new InvalidOperationException($"Peruri payload is missing required layout attributes. Body: {responseString}");
    }

    // Process valid variables safely downstream
    string technicalSerialNumber = stampResponse.Result.SerialNumber;
    string binaryBase64Image = stampResponse.Result.ImageBase64;
    
    // Assign to database record states and save files
}
catch (JsonException jsonEx)
{
    throw new InvalidOperationException($"Critical parsing fault on target stamp payload schema structural design. Content: {responseString}", jsonEx);
}
3. Post-Implementation Testing Checklist
Confirm that unexpected formatting anomalies or alternate business fault returns are surfaced natively inside application execution logging blocks.

Confirm that stampResponse.Result.SerialNumber extracts the standard Peruri identifier (2C5NV74I6D...) smoothly.