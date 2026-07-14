namespace amtemeterai.Api.Config;

/// <summary>
/// Configuration options for Google Maps Geocoding API
/// </summary>
public class GoogleMapsOptions
{
    public const string SectionName = "GoogleMaps";

    /// <summary>
    /// Google Maps API key for geocoding services
    /// Used for reverse geocoding (GPS coordinates to addresses)
    /// </summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Google Maps Geocoding API base URL
    /// Default: "https://maps.googleapis.com"
    /// </summary>
    public string BaseUrl { get; set; } = "https://maps.googleapis.com";
}
