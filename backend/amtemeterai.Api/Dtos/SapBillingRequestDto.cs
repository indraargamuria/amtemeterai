using System.Text.Json.Serialization;

namespace amtemeterai.Api.Dtos;

/// <summary>
/// Request DTO for simulated SAP billing endpoint
/// Mimics the future SAP billing API contract
/// </summary>
public class SapBillingRequestDto
{
    /// <summary>
    /// Delivery number to generate billing for
    /// </summary>
    public string DeliveryNumber { get; set; } = string.Empty;
}

/// <summary>
/// Response DTO for simulated SAP billing endpoint
/// Updated to support dual-currency and BC/NonBC classification
/// Matches the updated SAP ERP response schema
/// </summary>
public class SapBillingResponseDto
{
    /// <summary>
    /// SAP invoice number
    /// </summary>
    [JsonPropertyName("sapInvoiceNumber")]
    public string SapInvoiceNumber { get; set; } = string.Empty;

    /// <summary>
    /// Billing date from SAP
    /// </summary>
    [JsonPropertyName("billingDate")]
    public DateTime BillingDate { get; set; }

    /// <summary>
    /// Foreign currency amount (e.g., USD)
    /// </summary>
    [JsonPropertyName("amountForeign")]
    public decimal AmountForeign { get; set; }

    /// <summary>
    /// Local currency amount (e.g., IDR)
    /// </summary>
    [JsonPropertyName("amountLocal")]
    public decimal AmountLocal { get; set; }

    /// <summary>
    /// Currency code (e.g., "USD", "IDR")
    /// </summary>
    [JsonPropertyName("currency")]
    public string Currency { get; set; } = string.Empty;

    /// <summary>
    /// Customer number from SAP
    /// </summary>
    [JsonPropertyName("customerNumber")]
    public string CustomerNumber { get; set; } = string.Empty;

    /// <summary>
    /// Customer name from SAP
    /// </summary>
    [JsonPropertyName("customerName")]
    public string CustomerName { get; set; } = string.Empty;

    /// <summary>
    /// PO Number reference from SAP
    /// </summary>
    [JsonPropertyName("poNumber")]
    public string PoNumber { get; set; } = string.Empty;

    /// <summary>
    /// Delivery number reference
    /// </summary>
    [JsonPropertyName("deliveryNumber")]
    public string DeliveryNumber { get; set; } = string.Empty;

    /// <summary>
    /// Response message from SAP (MESSAGE field)
    /// </summary>
    [JsonPropertyName("MESSAGE")]
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Compliance/Integration classification indicator from SAP
    /// Maps from "type" field in SAP response
    /// Raw values from SAP: "BC" or "Non - BC" (with space)
    /// Will be normalized to: "BC" or "NonBC" (without space)
    /// </summary>
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// Gets the normalized compliance category for database storage
    /// Converts "BC" -> "BC" and "Non - BC" -> "NonBC"
    /// </summary>
    [JsonIgnore]
    public string ComplianceCategory
    {
        get
        {
            if (string.IsNullOrWhiteSpace(Type))
                return string.Empty;

            // Normalize: "Non - BC" (with space) -> "NonBC" (without space)
            // "BC" -> "BC"
            return Type == "BC" ? "BC" : "NonBC";
        }
    }
}
