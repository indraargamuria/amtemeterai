namespace amtemeterai.Api.Dtos;

public class DeliveryResponseDto
{
    public string DeliveryNumber { get; set; } = null!;
    public DateTime DeliveryDate { get; set; }

    public string? DeliveryRemarks { get; set; }

    public Guid ReceiverToken { get; set; }

    public string? ReceiverName { get; set; }
    public string? ReceiverNotes { get; set; }

    public bool Received { get; set; }
    public bool Invoiced { get; set; }

    public List<DeliveryLineResponseDto> Lines { get; set; } = new();
}