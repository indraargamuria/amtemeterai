namespace amtemeterai.Api.Config;

/// <summary>
/// Configuration options for JWT Bearer token authentication
/// </summary>
public class JwtOptions
{
    public const string SectionName = "Jwt";

    /// <summary>
    /// Signing key for JWT token validation (HMACSHA256)
    /// RECOMMENDED: Use 256+ bit key for production
    /// Can be configured via environment variable: Jwt__Key
    /// </summary>
    public string Key { get; set; } = string.Empty;

    /// <summary>
    /// Token issuer claim
    /// Example: "amtemeterai-api"
    /// </summary>
    public string Issuer { get; set; } = string.Empty;

    /// <summary>
    /// Token audience claim
    /// Example: "amtemeterai-web"
    /// </summary>
    public string Audience { get; set; } = string.Empty;
}
