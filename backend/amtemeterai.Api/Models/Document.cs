// Models/Document.cs
using System;

namespace amtemeterai.Api.Models
{
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
        public string StorageKey { get; set; }   // e.g., "deliveries/12/photos/uuid.jpg"
        public string FileName { get; set; }     // Original upload name: "photo.jpg"
        public string ContentType { get; set; }   // e.g., "image/jpeg"
        public DocumentType Type { get; set; }
        public DateTime UploadedAt { get; set; }

        // --- POLYMORPHIC RELATIONSHIPS (Nullable Foreign Keys) ---
        
        // Link to Delivery
        public int? DeliveryID { get; set; }
        public DeliveryHeader? DeliveryHeader { get; set; }

        // Link to Invoice (Ready for future use)
        public int? InvoiceID { get; set; }
        // public InvoiceHeader? InvoiceHeader { get; set; } // Uncomment when InvoiceHeader is added
    }
}