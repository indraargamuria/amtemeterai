namespace amtemeterai.Api.Models;

public class Customer
{
    public int CustomerID { get; set; }

    public string CustomerCode { get; set; } = null!;
    public string CustomerName { get; set; } = null!;
    public string? CustomerEmail { get; set; }

    public string CustomerPin { get; set; } = "123456";

    public ICollection<DeliveryHeader> Deliveries { get; set; } = new List<DeliveryHeader>();
}