namespace amtemeterai.Api.Dtos;

public class DeliveryLineDto
{
    public string DeliveryLineNumber { get; set; } = null!;
    public string DeliveryItemCode { get; set; } = null!;
    public string DeliveryItemDescription { get; set; } = null!;
    
    public string? BatchNumber { get; set; }

    // PO and Order fields moved from DeliveryHeader for heterogeneous routing support
    public string? OrderNumber { get; set; }
    public string? BuyerPONumber { get; set; }

    public decimal SalesQuantity { get; set; }
    public string SalesUOM { get; set; } = null!;

    public decimal PackQuantity { get; set; }
    public string PackUOM { get; set; } = null!;
    
}