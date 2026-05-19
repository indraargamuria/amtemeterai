namespace amtemeterai.Api.Dtos; // Changed to root Dtos namespace

public class GeoLocationResult
{
    public string? Province { get; set; }
    public string? CityRegency { get; set; }
    public string? District { get; set; }
    public string? FormattedAddress { get; set; }
}