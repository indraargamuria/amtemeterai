namespace amtemeterai.Api.Dtos;

public class InvoiceResponseDto
{
    public int InvoiceID { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public string CustomerNumber { get; set; } = string.Empty;
    public string? CustomerName { get; set; }

    // Legacy single amount field - kept for backward compatibility
    public decimal InvoiceAmount { get; set; }

    // New dual-currency fields
    public decimal AmountForeign { get; set; }
    public decimal AmountLocal { get; set; }
    public string Currency { get; set; } = string.Empty;
    public string? ComplianceCategory { get; set; }

    public DateTime InvoicedDate { get; set; }
    public int Status { get; set; }
    public string StatusText { get; set; } = string.Empty;
    public int? DeliveryHeaderId { get; set; }
    public string? DeliveryNumber { get; set; }
    public string? SerialNumber { get; set; }
    public int StampingStatus { get; set; }
    public string StampingStatusText { get; set; } = string.Empty;
    public bool HasPrintoutDocument { get; set; }
    public string? UnstampedDocumentUrl { get; set; }
    public string? StampedDocumentUrl { get; set; }
    public DateTime CreatedAt { get; set; }
}