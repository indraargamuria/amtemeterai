namespace amtemeterai.Api.Dtos;

public class DeliveryEditConfirmationDto
{
    public string ReceiverName { get; set; } = string.Empty;
    public string? ReceiverNotes { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    // Line item array updates
    public List<DeliveryLineEditDto> Lines { get; set; } = new();

    // Multipart files for newly appended photos
    public List<IFormFile>? NewPhotoFiles { get; set; }

    // List of storage keys the user chose to delete from the UI
    public List<string> KeysToDelete { get; set; } = new();
}

public class DeliveryLineEditDto
{
    public string DeliveryLineNumber { get; set; } = string.Empty;
    public decimal PackQuantityDelivered { get; set; }
    public decimal PackQuantityReturned { get; set; }
    public decimal PackQuantityRejected { get; set; }
    public string? LineComment { get; set; }
}