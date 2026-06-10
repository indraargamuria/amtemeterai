namespace amtemeterai.Api.Dtos;

public class DeliveryUpsertDto
{
    public string CustomerCode { get; set; } = null!;
    public string DeliveryNumber { get; set; } = null!;

    public DateTime DeliveryDate { get; set; }
    public string? DeliveryRemarks { get; set; }

    public string? ShipToAddress { get; set; }

    // Note: OrderNumber and BuyerPONumber moved to DeliveryLineDto for heterogeneous routing support

    // New Creation Context Parameters - 2026-05-19 17:41:33
    public string? Plant { get; set; }
    public int Type { get; set; } // 1 = BC, 2 = NonBC
    public string? SalesPersonName { get; set; }
    public string? SalesPersonEmail { get; set; }

    public List<DeliveryLineDto> Lines { get; set; } = new();
}