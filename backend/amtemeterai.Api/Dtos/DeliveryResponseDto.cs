namespace amtemeterai.Api.Dtos;

public class DeliveryResponseDto
{
    public int DeliveryID { get; set; }
    public string DeliveryNumber { get; set; } = null!;
    public DateTime DeliveryDate { get; set; }

    public string? DeliveryRemarks { get; set; }
    public string? ShipToAddress { get; set; }

    // Note: OrderNumber and BuyerPONumber moved to DeliveryLineResponseDto for heterogeneous routing support

    public Guid ReceiverToken { get; set; }

    public required string CustomerCode { get; set; }
    public required string CustomerName { get; set; }
    public string? ReceiverName { get; set; }
    public string? ReceiverNotes { get; set; }

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

    public string PublicUrl { get; set; } = null!;

    // --- Added: New Header Context Fields --- 2026-05-19 21:19:14
    public string? Plant { get; set; }
    public int Type { get; set; }                 // 1 = BC, 2 = NonBC
    public string? SalesPersonName { get; set; }
    public string? SalesPersonEmail { get; set; }
    public int? Status { get; set; }              // 1 = FullyReceived, 2 = PartialReceived

    // --- Added: Full Geographical Telemetry --- 2026-05-19 21:19:17
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? Province { get; set; }
    public string? CityRegency { get; set; }
    public string? District { get; set; }
    public string? FormattedAddress { get; set; }

    public bool IsCanceled { get; set; }
    public string? CancelReason { get; set; }

    public List<DeliveryLineResponseDto> Lines { get; set; } = new();
    //2026-05-19 21:19:04
    public List<DeliveryPhotoResponseDto> Photos { get; set; } = new();
}