namespace amtemeterai.Api.Models;

public class DeliveryHeader
{
    public int DeliveryID { get; set; }

    public int CustomerID { get; set; }
    public Customer Customer { get; set; } = null!;

    public string DeliveryNumber { get; set; } = null!;
    public DateTime DeliveryDate { get; set; }

    public string? DeliveryRemarks { get; set; }

    public Guid ReceiverToken { get; set; }

    public string? ReceiverName { get; set; }
    public string? ReceiverNotes { get; set; }

    public bool Received { get; set; }
    public bool Invoiced { get; set; }

    public ICollection<DeliveryLine> Lines { get; set; } = new List<DeliveryLine>();
}