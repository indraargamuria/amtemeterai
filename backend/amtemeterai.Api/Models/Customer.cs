namespace amtemeterai.Api.Models;

public class Customer
{
    public int CustomerID { get; set; }

    public string CustomerCode { get; set; } = null!;
    public string CustomerName { get; set; } = null!;
    public string? CustomerEmail { get; set; }

    public string CustomerPin { get; set; } = "123456";

    /// <summary>
    /// Region code from SAP (short text, less than 20 characters)
    /// </summary>
    public string? Region { get; set; }

    /// <summary>
    /// Country code from SAP (e.g., "ID", "SG")
    /// Lead time moved to ShippingParameter master data (T3)
    /// </summary>
    public string? Country { get; set; }

    public ICollection<DeliveryHeader> Deliveries { get; set; } = new List<DeliveryHeader>();
}