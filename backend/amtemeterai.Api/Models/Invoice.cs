namespace amtemeterai.Api.Models;

public class Invoice
{
    public enum InvoiceStatus
    {
        Draft = 1,
        Stamped = 2,
        SyncFailed = 3,
        SyncedToSap = 4,
        Canceled = 5,
        Voided = 6
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

    // Old single amount field - deprecated in favor of dual-currency support
    // Kept for backward compatibility during migration
    [Obsolete("Use AmountLocal and AmountForeign for dual-currency support")]
    public decimal InvoiceAmount { get; set; }

    /// <summary>
    /// Foreign currency amount (e.g., USD) from SAP ERP
    /// Precision: 18 digits, 2 decimal places
    /// </summary>
    public decimal AmountForeign { get; set; }

    /// <summary>
    /// Local currency amount (e.g., IDR) from SAP ERP
    /// Precision: 18 digits, 2 decimal places
    /// </summary>
    public decimal AmountLocal { get; set; }

    /// <summary>
    /// Currency code (ISO 4217)
    /// Required, Max Length 10 (e.g., "USD", "IDR", "EUR")
    /// </summary>
    public string Currency { get; set; } = null!;

    /// <summary>
    /// Compliance/integration classification from SAP
    /// "BC" - Bank Compliance category
    /// "NonBC" - Non-Bank Compliance category
    /// </summary>
    public string? ComplianceCategory { get; set; }

    public DateTime InvoicedDate { get; set; }

    public InvoiceStatus Status { get; set; } = InvoiceStatus.Draft;

    // Optional link to Delivery Order
    public int? DeliveryHeaderId { get; set; }
    public DeliveryHeader? DeliveryHeader { get; set; }

    // E-Meterai Tracking Fields
    public string? SerialNumber { get; set; }

    /// <summary>
    /// Storage key for the e-Meterai QR code image in MinIO
    /// Format: invoices/{invoiceId}/qr/{serialNumber}.png
    /// Replaces QrCodeBase64 to keep database lean
    /// </summary>
    public string? QrImageStorageKey { get; set; }

    /// <summary>
    /// Document ID reference to the QR code image stored in Documents table
    /// Links to Document with DocumentType = Other (for e-Meterai QR code)
    /// </summary>
    public int? QrImageDocumentId { get; set; }

    // 2. The property now references the renamed enum type perfectly
    public InvoiceStampingStatus StampingStatus { get; set; } = InvoiceStampingStatus.NotStamped;

    // Link to stamped document
    public int? StampedDocumentId { get; set; }
    public Document? StampedDocument { get; set; }

    // Collection of documents (invoice printouts, etc.)
    public ICollection<Document> Documents { get; set; } = new List<Document>();
}