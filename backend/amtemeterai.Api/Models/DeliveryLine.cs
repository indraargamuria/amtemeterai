namespace amtemeterai.Api.Models;

public class DeliveryLine
{
    public int DeliveryLineID { get; set; }

    public int DeliveryID { get; set; }
    public DeliveryHeader DeliveryHeader { get; set; } = null!;

    public string DeliveryLineNumber { get; set; } = null!;

    public string DeliveryItemCode { get; set; } = null!;
    public string DeliveryItemDescription { get; set; } = null!;

    public decimal SalesQuantity { get; set; }
    public string SalesUOM { get; set; } = null!;

    public decimal PackQuantity { get; set; }
    public string PackUOM { get; set; } = null!;

    public decimal PackQuantityDelivered { get; set; }
    public decimal PackQuantityReturned { get; set; }
    public decimal PackQuantityRejected { get; set; }
}