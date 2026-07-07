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
    /// Compliance/Integration classification indicator
    /// Values: "BC" or "NonBC"
    /// </summary>
    [JsonPropertyName("ComplianceCategory")]
    public string ComplianceCategory { get; set; } = string.Empty;
}
