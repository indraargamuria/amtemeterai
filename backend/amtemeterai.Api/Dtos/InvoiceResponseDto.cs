namespace amtemeterai.Api.Dtos;

public class InvoiceResponseDto
{
    public int InvoiceID { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public string CustomerNumber { get; set; } = string.Empty;
    public string? CustomerName { get; set; }
    public decimal InvoiceAmount { get; set; }
    public DateTime InvoicedDate { get; set; }
    public int Status { get; set; }
    public string StatusText { get; set; } = string.Empty;
    public int? DeliveryHeaderId { get; set; }
    public string? DeliveryNumber { get; set; }
    public string? SerialNumber { get; set; }
    public int StampingStatus { get; set; }
    public string StampingStatusText { get; set; } = string.Empty;
    public bool HasPrintoutDocument { get; set; }
    public string? StampedDocumentUrl { get; set; }
    public DateTime CreatedAt { get; set; }
}