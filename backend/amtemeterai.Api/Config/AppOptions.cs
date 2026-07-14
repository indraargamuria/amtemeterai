namespace amtemeterai.Api.Config;

/// <summary>
/// Configuration options for application URLs
/// Used for generating download URLs, public links, and API base paths
/// </summary>
public class AppOptions
{
    public const string SectionName = "App";

    /// <summary>
    /// Public base URL for frontend (used in email links, QR codes, public delivery pages)
    /// Example: "http://localhost:5173" (development)
    /// Example: "https://app.opexnow.com" (production)
    /// </summary>
    public string PublicBaseUrl { get; set; } = string.Empty;

    /// <summary>
    /// API base URL for backend service calls
    /// Example: "http://localhost:8080" (development)
    /// Example: "https://api.opexnow.com" (production)
    /// </summary>
    public string ApiBaseUrl { get; set; } = string.Empty;
}
