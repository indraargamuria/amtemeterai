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
    /// Lead time in days (expected delivery duration from SAP)
    /// </summary>
    public int? LeadTimeDays { get; set; }

    public ICollection<DeliveryHeader> Deliveries { get; set; } = new List<DeliveryHeader>();
}