namespace amtemeterai.Api.Dtos;

public class DeliveryUpsertDto
{
    public string CustomerCode { get; set; } = null!;
    public string DeliveryNumber { get; set; } = null!;

    public DateTime DeliveryDate { get; set; }
    public string? DeliveryRemarks { get; set; }

    public List<DeliveryLineDto> Lines { get; set; } = new();
}