namespace amtemeterai.Api.Dtos;

public class DeliveryResponseDto
{
    public int DeliveryID { get; set; }
    public string DeliveryNumber { get; set; } = null!;
    public DateTime DeliveryDate { get; set; }

    public string? DeliveryRemarks { get; set; }

    public Guid ReceiverToken { get; set; }

    public string CustomerCode { get; set; }
    public string CustomerName { get; set; }
    public string? ReceiverName { get; set; }
    public string? ReceiverNotes { get; set; }

    public bool Received { get; set; }
    public bool Invoiced { get; set; }

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