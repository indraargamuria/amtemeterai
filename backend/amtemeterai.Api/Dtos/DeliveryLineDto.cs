namespace amtemeterai.Api.Dtos;

public class DeliveryLineDto
{
    public string DeliveryLineNumber { get; set; } = null!;
    public string DeliveryItemCode { get; set; } = null!;
    public string DeliveryItemDescription { get; set; } = null!;

    public decimal SalesQuantity { get; set; }
    public string SalesUOM { get; set; } = null!;

    public decimal PackQuantity { get; set; }
    public string PackUOM { get; set; } = null!;
}