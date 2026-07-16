namespace amtemeterai.Api.Dtos
{
    public class DeliveryHeaderDto
    {
        public int DeliveryId { get; set; }
        public string DeliveryNumber { get; set; } = string.Empty;
        public DateTime DeliveryDate { get; set; }
        public string? DeliveryRemarks { get; set; }
        public string CustomerCode { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public bool Received { get; set; }
        public DateTime? ReceiveDate { get; set; }
        public bool Invoiced { get; set; }

        /// <summary>
        /// Calculated invoice state based on the delivery's invoice lifecycle.
        /// Possible values: "Unbilled", "Billed", "Blocked & Voided", "Ready to Re Billing"
        /// </summary>
        public string InvoiceState { get; set; } = string.Empty;

        /// <summary>
        /// The SAP invoice number when state is "Billed", otherwise "-" or empty
        /// </summary>
        public string InvoiceNumber { get; set; } = string.Empty;

        public string? Plant { get; set; }
        public int? Type { get; set; }          // 🔴 Double check this isn't returning null
        public int? Status { get; set; }        // 🔴 Double check this isn't returning null
        public string? SalesPersonName { get; set; }
        public string? SalesPersonEmail { get; set; }
        public string? CityRegency { get; set; }
        public string? District { get; set; }
        public string? Province { get; set; }
        public int PhotosCount { get; set; }    // 🔴 Ensure this maps the dynamic count
        public string PublicUrl { get; set; } = null!;
        
        public bool IsCanceled { get; set; }
        public string? CancelReason { get; set; }

        /// <summary>
        /// Indicates whether the delivery order is open for structural modifications.
        /// When false, the delivery is locked from further changes while still allowing receipt submission.
        /// </summary>
        public bool IsOpen { get; set; } = true;
    }
}