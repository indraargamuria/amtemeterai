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
    public string sapInvoiceNumber { get; set; } = string.Empty;

    /// <summary>
    /// Billing date from SAP
    /// </summary>
    public DateTime billingDate { get; set; }

    /// <summary>
    /// Foreign currency amount (e.g., USD)
    /// </summary>
    public decimal amountForeign { get; set; }

    /// <summary>
    /// Local currency amount (e.g., IDR)
    /// </summary>
    public decimal amountLocal { get; set; }

    /// <summary>
    /// Currency code (e.g., "USD", "IDR")
    /// </summary>
    public string currency { get; set; } = string.Empty;

    /// <summary>
    /// Customer number from SAP
    /// </summary>
    public string customerNumber { get; set; } = string.Empty;

    /// <summary>
    /// Customer name from SAP
    /// </summary>
    public string customerName { get; set; } = string.Empty;

    /// <summary>
    /// PO Number reference from SAP
    /// </summary>
    public string poNumber { get; set; } = string.Empty;

    /// <summary>
    /// Delivery number reference
    /// </summary>
    public string deliveryNumber { get; set; } = string.Empty;

    /// <summary>
    /// Response message from SAP (MESSAGE field)
    /// </summary>
    public string MESSAGE { get; set; } = string.Empty;

    /// <summary>
    /// Compliance/Integration classification indicator
    /// Values: "BC" or "NonBC"
    /// </summary>
    public string ComplianceCategory { get; set; } = string.Empty;

    // Legacy properties for backward compatibility (will be deprecated)
    [Obsolete("Use sapInvoiceNumber")]
    public string SapInvoiceNumber { get; set; } = string.Empty;

    [Obsolete("Use billingDate")]
    public DateTime BillingDate { get; set; }

    [Obsolete("Use amountForeign/amountLocal")]
    public decimal Amount { get; set; }

    [Obsolete("Use currency")]
    public string Currency { get; set; } = "IDR";

    [Obsolete("Use customerNumber")]
    public string CustomerNumber { get; set; } = string.Empty;

    [Obsolete("Use customerName")]
    public string CustomerName { get; set; } = string.Empty;

    [Obsolete("Use poNumber")]
    public string? PoNumber { get; set; }

    [Obsolete("Use deliveryNumber")]
    public string DeliveryNumber { get; set; } = string.Empty;

    [Obsolete("Use MESSAGE")]
    public string Message { get; set; } = string.Empty;
}
