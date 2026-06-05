namespace amtemeterai.Api.Dtos;

public class SapDeliveryConfirmationPayload
{
    [System.Text.Json.Serialization.JsonPropertyName("customerCode")]
    public string CustomerCode { get; set; } = null!;

    [System.Text.Json.Serialization.JsonPropertyName("deliveryNumber")]
    public string DeliveryNumber { get; set; } = null!;

    [System.Text.Json.Serialization.JsonPropertyName("receiverName")]
    public string ReceiverName { get; set; } = null!;

    [System.Text.Json.Serialization.JsonPropertyName("receiverStatus")]
    public string ReceiverStatus { get; set; } = null!;

    [System.Text.Json.Serialization.JsonPropertyName("receiverNotes")]
    public string ReceiverNotes { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("lines")]
    public List<SapDeliveryLinePayload> Lines { get; set; } = new();
}

public class SapDeliveryLinePayload
{
    [System.Text.Json.Serialization.JsonPropertyName("deliveryLineNumber")]
    public string DeliveryLineNumber { get; set; } = null!;

    [System.Text.Json.Serialization.JsonPropertyName("deliveredQuantity")]
    public decimal DeliveredQuantity { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("rejectedQuantity")]
    public decimal RejectedQuantity { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("returnedQuantity")]
    public decimal ReturnedQuantity { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("lineComment")]
    public string LineComment { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("variancePercent")]
    public decimal VariancePercent { get; set; }
}