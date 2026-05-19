namespace amtemeterai.Api.Dtos;

public class DeliveryReceiveDto
{
    public string? ReceiverName { get; set; }
    public string? ReceiverNotes { get; set; }

    public List<DeliveryLineReceiveDto> Lines { get; set; } = new();
    // NEW PROPERTY: Captures the binary photo stream from the HTTP multi-part form-data envelope
    public IFormFile? PhotoFile { get; set; }
}

public class DeliveryLineReceiveDto
{
    public string DeliveryLineNumber { get; set; } = null!;
    public decimal PackQuantityDelivered { get; set; }
    public decimal PackQuantityReturned { get; set; }
    public decimal PackQuantityRejected { get; set; }
}