// Models/Document.cs
using System;

namespace amtemeterai.Api.Models;

public enum DocumentType
{
    DeliveryPhoto = 1,
    DeliveryPrintOut = 2,
    InvoicePrintOut = 3
}

public class Document
{
    public int DocumentID { get; set; }

    // MinIO Object Metadata
    public string StorageKey { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public DocumentType Type { get; set; }
    public DateTime UploadedAt { get; set; }

    // --- POLYMORPHIC RELATIONSHIPS (Nullable Foreign Keys) ---

    // Link to Delivery
    public int? DeliveryID { get; set; }
    public DeliveryHeader? DeliveryHeader { get; set; }

    // Link to Invoice
    public int? InvoiceID { get; set; }
    public Invoice? InvoiceHeader { get; set; }
}