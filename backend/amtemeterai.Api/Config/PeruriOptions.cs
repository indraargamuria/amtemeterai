namespace amtemeterai.Api.Config;

/// <summary>
/// Configuration options for Peruri PDS (Peruri Digital Signature) integration
/// This enables on-premise e-Meterai stamping functionality
/// </summary>
public class PeruriOptions
{
    /// <summary>
    /// Peruri backend staging URL for user authentication
    /// Example: https://backend.peruri.co.id
    /// </summary>
    public const string SectionName = "Peruri";

    /// <summary>
    /// Backend staging URL base address
    /// Used for user login API calls
    /// </summary>
    public string BackendStg { get; set; } = string.Empty;

    /// <summary>
    /// Stamp v2 staging URL base address
    /// Used for stamp/chanel operations
    /// </summary>
    public string Stampv2Stg { get; set; } = string.Empty;

    /// <summary>
    /// Inventory staging URL base address
    /// Used for inventory management operations
    /// </summary>
    public string InventoryStg { get; set; } = string.Empty;

    /// <summary>
    /// Peruri service account username for authentication
    /// </summary>
    public string User { get; set; } = string.Empty;

    /// <summary>
    /// Peruri service account password for authentication
    /// </summary>
    public string Password { get; set; } = string.Empty;

    /// <summary>
    /// KeyStamp (Docker adapter) URL base address
    /// Used for on-premise PDF signing operations
    /// Example: http://localhost:8081
    /// </summary>
    public string KeyStamp { get; set; } = string.Empty;

    /// <summary>
    /// Shared folder path for Docker volume
    /// Used for PDF file exchange between API and signing adapter
    /// Example: /sharefolder or C:\sharefolder
    /// </summary>
    public string SharedFolder { get; set; } = "/sharefolder";

    /// <summary>
    /// Token expiry buffer in minutes
    /// Tokens will be refreshed this many minutes before actual expiry
    /// </summary>
    public int TokenExpiryBufferMinutes { get; set; } = 5;
}
