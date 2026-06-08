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
/// Contains the simulated SAP invoice data
/// </summary>
public class SapBillingResponseDto
{
    /// <summary>
    /// Simulated SAP invoice number
    /// </summary>
    public string SapInvoiceNumber { get; set; } = string.Empty;

    /// <summary>
    /// Billing date from SAP
    /// </summary>
    public DateTime BillingDate { get; set; }

    /// <summary>
    /// Invoice amount
    /// </summary>
    public decimal Amount { get; set; }

    /// <summary>
    /// Currency code (e.g., IDR)
    /// </summary>
    public string Currency { get; set; } = "IDR";

    /// <summary>
    /// Customer number from SAP
    /// </summary>
    public string CustomerNumber { get; set; } = string.Empty;

    /// <summary>
    /// Customer name from SAP
    /// </summary>
    public string CustomerName { get; set; } = string.Empty;

    /// <summary>
    /// PO Number reference
    /// </summary>
    public string? PoNumber { get; set; }

    /// <summary>
    /// Delivery number reference
    /// </summary>
    public string DeliveryNumber { get; set; } = string.Empty;
}
