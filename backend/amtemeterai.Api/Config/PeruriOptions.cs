namespace amtemeterai.Api.Config;

/// <summary>
/// Configuration options for Peruri PDS (Peruri Digital Signature) integration
/// This enables on-premise e-Meterai stamping functionality
///
/// Corrected staging endpoints (WP2):
/// - Authentication: https://backendservicestg.e-meterai.co.id/api/users/login
/// - Allotment: https://stampv2stg.e-meterai.co.id/chanel/stampv2
/// - Local Signing: http://localhost:9999/adapter/pdfsigning/rest/docSigningZ
/// </summary>
public class PeruriOptions
{
    /// <summary>
    /// Peruri backend staging URL for user authentication
    /// Corrected staging endpoint: https://backendservicestg.e-meterai.co.id
    /// Login API path: /api/users/login
    /// </summary>
    public const string SectionName = "Peruri";

    /// <summary>
    /// Backend staging URL base address
    /// Used for user login API calls
    /// Configured via appsettings.json: Peruri:BackendStg
    /// </summary>
    public string BackendStg { get; set; } = string.Empty;

    /// <summary>
    /// Stamp v2 staging URL base address
    /// Used for stamp/chanel operations
    /// Allotment path: /chanel/stampv2
    /// Configured via appsettings.json: Peruri:Stampv2Stg
    /// </summary>
    public string Stampv2Stg { get; set; } = string.Empty;

    /// <summary>
    /// Inventory staging URL base address
    /// Used for inventory management operations
    /// Configured via appsettings.json: Peruri:InventoryStg
    /// </summary>
    public string InventoryStg { get; set; } = string.Empty;

    /// <summary>
    /// Peruri service account username for authentication
    /// Configured via appsettings.json: Peruri:User
    /// </summary>
    public string User { get; set; } = string.Empty;

    /// <summary>
    /// Peruri service account password for authentication
    /// Configured via appsettings.json: Peruri:Password
    /// </summary>
    public string Password { get; set; } = string.Empty;

    /// <summary>
    /// KeyStamp (Docker adapter) URL base address
    /// Used for on-premise PDF signing operations
    /// Container-to-Container: http://signadapter:7777 (production)
    /// Local Development: http://localhost:9999 (development)
    /// Configured via appsettings.json: Peruri:KeyStamp
    /// </summary>
    public string KeyStamp { get; set; } = string.Empty;

    /// <summary>
    /// Shared folder path for Docker named volume (relative to container filesystem)
    /// Used for PDF file exchange between API and signing adapter via shared named volume (stamping-share)
    ///
    /// IMPORTANT: The API and signadapter containers both mount the same Docker named volume
    /// to this path. Example docker-compose configuration:
    ///   volumes:
    ///     stamping-share:/app/sharefolder
    ///
    /// The API creates transient session workspaces in the shared volume:
    ///   - /app/sharefolder/session{guid}/UNSIGNED/ - Unsigned PDFs
    ///   - /app/sharefolder/session{guid}/STAMP/ - QR code images
    ///   - /app/sharefolder/session{guid}/SIGNED/ - Signed PDFs
    ///
    /// These paths are accessible to both containers, allowing the KeyStamp adapter
    /// to read from and write to the shared volume using absolute paths.
    /// Configured via appsettings.json: Peruri:SharedFolder
    /// Default: "/app/sharefolder" (Docker container path)
    /// </summary>
    public string SharedFolder { get; set; } = "/app/sharefolder";

    /// <summary>
    /// Token expiry buffer in minutes
    /// Tokens will be refreshed this many minutes before actual expiry
    /// Configured via appsettings.json: Peruri:TokenExpiryBufferMinutes
    /// Default: 5 minutes
    /// </summary>
    public int TokenExpiryBufferMinutes { get; set; } = 5;
}
