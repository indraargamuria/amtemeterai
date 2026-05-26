namespace amtemeterai.Api.Models;

public class Invoice
{
    public enum InvoiceStatus
    {
        Draft = 1,
        Stamped = 2,
        SyncFailed = 3,
        SyncedToSap = 4,
        Canceled = 5
    }

    // 1. Renamed the enum declaration to avoid naming conflict
    public enum InvoiceStampingStatus
    {
        NotStamped = 1,
        Pending = 2,
        Stamped = 3,
        Failed = 4
    }

    public int InvoiceID { get; set; }

    public string InvoiceNumber { get; set; } = null!;
    public string CustomerNumber { get; set; } = null!;

    public decimal InvoiceAmount { get; set; }
    public DateTime InvoicedDate { get; set; }

    public InvoiceStatus Status { get; set; } = InvoiceStatus.Draft;

    // Optional link to Delivery Order
    public int? DeliveryHeaderId { get; set; }
    public DeliveryHeader? DeliveryHeader { get; set; }

    // E-Meterai Tracking Fields
    public string? SerialNumber { get; set; }
    
    // 2. The property now references the renamed enum type perfectly
    public InvoiceStampingStatus StampingStatus { get; set; } = InvoiceStampingStatus.NotStamped;

    // Link to stamped document
    public int? StampedDocumentId { get; set; }
    public Document? StampedDocument { get; set; }

    // Collection of documents (invoice printouts, etc.)
    public ICollection<Document> Documents { get; set; } = new List<Document>();
}