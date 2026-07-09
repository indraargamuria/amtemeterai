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
    /// Default (Staging): https://backendservicestg.e-meterai.co.id
    /// </summary>
    public string BackendStg { get; set; } = "https://backendservicestg.e-meterai.co.id";

    /// <summary>
    /// Stamp v2 staging URL base address
    /// Used for stamp/chanel operations
    /// Default (Staging): https://stampv2stg.e-meterai.co.id
    /// Allotment path: /chanel/stampv2
    /// </summary>
    public string Stampv2Stg { get; set; } = "https://stampv2stg.e-meterai.co.id";

    /// <summary>
    /// Inventory staging URL base address
    /// Used for inventory management operations
    /// </summary>
    public string InventoryStg { get; set; } = string.Empty;

    /// <summary>
    /// Peruri service account username for authentication
    /// </summary>
    public string User { get; set; } = "opex_emet@yopmail.com";

    /// <summary>
    /// Peruri service account password for authentication
    /// </summary>
    public string Password { get; set; } = "Emeterai123!";

    /// <summary>
    /// KeyStamp (Docker adapter) URL base address
    /// Used for on-premise PDF signing operations
    /// Corrected (Container-to-Container): http://signadapter:7777
    /// Signing path: /adapter/pdfsigning/rest/docSigningZ
    /// Uses internal Docker DNS for container-to-container communication
    /// </summary>
    public string KeyStamp { get; set; } = "http://localhost:9999";

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
    /// </summary>
    public string SharedFolder { get; set; } = "/app/sharefolder";

    /// <summary>
    /// Token expiry buffer in minutes
    /// Tokens will be refreshed this many minutes before actual expiry
    /// </summary>
    public int TokenExpiryBufferMinutes { get; set; } = 5;
}
