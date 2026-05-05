namespace amtemeterai.Api.Dtos;

public class DeliveryCreateResponseDto
{
    public string DeliveryNumber { get; set; } = null!;
    public string PublicUrl { get; set; } = null!;
    public string QrCodeBase64 { get; set; } = null!;
}
