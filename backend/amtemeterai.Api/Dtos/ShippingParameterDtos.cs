using System.Text.Json.Serialization;

namespace amtemeterai.Api.Dtos;

/// <summary>
/// DTO returned for a ShippingParameter row (list/get endpoints).
/// </summary>
public class ShippingParameterDto
{
    public int Id { get; set; }

    [JsonPropertyName("country")]
    public string Country { get; set; } = null!;

    [JsonPropertyName("region")]
    public string? Region { get; set; }

    [JsonPropertyName("ship_mode")]
    public string ShipMode { get; set; } = null!;

    [JsonPropertyName("is_default")]
    public bool IsDefault { get; set; }

    [JsonPropertyName("lead_time_days")]
    public int LeadTimeDays { get; set; }
}

/// <summary>
/// DTO received when creating/updating a ShippingParameter row (POST/PATCH).
/// </summary>
public class ShippingParameterUpsertDto
{
    [JsonPropertyName("country")]
    public string Country { get; set; } = null!;

    [JsonPropertyName("region")]
    public string? Region { get; set; }

    [JsonPropertyName("ship_mode")]
    public string ShipMode { get; set; } = null!;

    [JsonPropertyName("is_default")]
    public bool IsDefault { get; set; }

    [JsonPropertyName("lead_time_days")]
    public int LeadTimeDays { get; set; }
}

/// <summary>
/// SAP source item structure — aligns with the new SAP Z_REST_SHIPPING_PARAMETER endpoint.
/// </summary>
public record SapShippingParameterItem
{
    [JsonPropertyName("country")]
    public string? Country { get; init; }

    [JsonPropertyName("region")]
    public string? Region { get; init; }

    [JsonPropertyName("ship_mode")]
    public string? ShipMode { get; init; }

    [JsonPropertyName("leadtime")]
    public int? LeadTime { get; init; }
}

/// <summary>
/// Mapping helpers from SAP source item to DTO.
/// </summary>
public static class ShippingParameterMapper
{
    /// <summary>Maps a single SAP item to a DTO.</summary>
    public static ShippingParameterDto ToDto(this SapShippingParameterItem item)
    {
        return new ShippingParameterDto
        {
            Country = item.Country ?? string.Empty,
            Region = item.Region,
            ShipMode = item.ShipMode ?? string.Empty,
            IsDefault = string.Equals(item.ShipMode, "DEFAULT", StringComparison.OrdinalIgnoreCase),
            LeadTimeDays = item.LeadTime ?? 0
        };
    }
}