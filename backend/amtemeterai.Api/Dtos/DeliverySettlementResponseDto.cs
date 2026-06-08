namespace amtemeterai.Api.Dtos;

/// <summary>
/// Response DTO for delivery settlement processing
/// </summary>
public class DeliverySettlementResponseDto
{
    /// <summary>
    /// Whether the settlement was successful
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// Status message
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Generated invoice number
    /// </summary>
    public string? InvoiceNumber { get; set; }

    /// <summary>
    /// Invoice amount
    /// </summary>
    public decimal? InvoiceAmount { get; set; }

    /// <summary>
    /// Billing date
    /// </summary>
    public DateTime? BillingDate { get; set; }

    /// <summary>
    /// Document ID of uploaded printout
    /// </summary>
    public int? DocumentId { get; set; }

    /// <summary>
    /// Storage key of uploaded printout
    /// </summary>
    public string? StorageKey { get; set; }

    /// <summary>
    /// Download URL for uploaded printout
    /// </summary>
    public string? DownloadUrl { get; set; }

    /// <summary>
    /// Delivery number that was processed
    /// </summary>
    public string DeliveryNumber { get; set; } = string.Empty;
}
