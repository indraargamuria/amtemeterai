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
    // AmountForeign / AmountLocal represent the NETT amount (Base + DownPay)
    public decimal AmountForeign { get; set; }
    public decimal AmountLocal { get; set; }
    public decimal BaseAmountForeign { get; set; }
    public decimal BaseAmountLocal { get; set; }
    public decimal DownPayAmountForeign { get; set; }
    public decimal DownPayAmountLocal { get; set; }
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
    public string? DeliveryPrintoutUrl { get; set; }
}