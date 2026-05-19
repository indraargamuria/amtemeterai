namespace amtemeterai.Api.Dtos;

public class DeliveryReceiveDto
{
    public string? ReceiverName { get; set; }
    public string? ReceiverNotes { get; set; }

    public List<DeliveryLineReceiveDto> Lines { get; set; } = new();
    
    //2026-05-19 14:00:55 - Arga - Multiple File
    public List<IFormFile>? PhotoFiles { get; set; } = new();

    // New Location Inputs from Client Mobile App - 2026-05-19 16:14:16 - Arga
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}

public class DeliveryLineReceiveDto
{
    public string DeliveryLineNumber { get; set; } = null!;
    public decimal PackQuantityDelivered { get; set; }
    public decimal PackQuantityReturned { get; set; }
    public decimal PackQuantityRejected { get; set; }
}