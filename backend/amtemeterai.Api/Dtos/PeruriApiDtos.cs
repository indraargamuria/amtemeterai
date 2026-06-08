namespace amtemeterai.Api.Dtos;

/// <summary>
/// Request DTO for Peruri User Login API
/// </summary>
public class PeruriLoginRequestDto
{
    public string user { get; set; } = string.Empty;
    public string password { get; set; } = string.Empty;
}

/// <summary>
/// Response DTO for Peruri User Login API
/// Matches the actual API response structure from:
/// https://backendservicestg.e-meterai.co.id/api/users/login
/// </summary>
public class PeruriLoginResponseDto
{
    /// <summary>
    /// Status code from Peruri API
    /// "00" indicates success
    /// </summary>
    public string statusCode { get; set; } = string.Empty;

    /// <summary>
    /// Message from the API
    /// </summary>
    public string message { get; set; } = string.Empty;

    /// <summary>
    /// Direct access to the JWT token at root level
    /// This is the primary token to use
    /// </summary>
    public string token { get; set; } = string.Empty;

    /// <summary>
    /// Nested result structure containing additional data
    /// </summary>
    public PeruriLoginResultDto? result { get; set; }
}

/// <summary>
/// Result wrapper for Peruri login response
/// </summary>
public class PeruriLoginResultDto
{
    public PeruriLoginNestedDataDto? data { get; set; }
}

/// <summary>
/// Nested data structure in Peruri login response
/// </summary>
public class PeruriLoginNestedDataDto
{
    public PeruriLoginDetailsDto? login { get; set; }
}

/// <summary>
/// Login details containing the token and user information
/// </summary>
public class PeruriLoginDetailsDto
{
    /// <summary>
    /// JWT token (also available at root level)
    /// </summary>
    public string token { get; set; } = string.Empty;

    /// <summary>
    /// User information
    /// </summary>
    public PeruriLoginUserDto? user { get; set; }
}

/// <summary>
/// User information returned in login response
/// </summary>
public class PeruriLoginUserDto
{
    public string id { get; set; } = string.Empty;
    public string email { get; set; } = string.Empty;
}

/// <summary>
/// Request DTO for Peruri Stamp v2 Single Serial Number API
/// Matches the actual API contract from:
/// https://stampv2stg.e-meterai.co.id/chanel/stampv2
/// </summary>
public class PeruriStampRequestDto
{
    /// <summary>
    /// Whether this is an upload operation
    /// Default: false
    /// </summary>
    public bool isUpload { get; set; } = false;

    /// <summary>
    /// Document type code for compliance
    /// "4b" = Invoice/Faktur
    /// </summary>
    public string namadoc { get; set; } = "4b";

    /// <summary>
    /// Filename of the document being stamped
    /// Example: "INV001.pdf"
    /// </summary>
    public string namafile { get; set; } = string.Empty;

    /// <summary>
    /// Nominal value/document amount in string format
    /// Represents the e-Meterai price tier
    /// </summary>
    public string nilaidoc { get; set; } = "10000";

    /// <summary>
    /// Type of ID document used for verification
    /// "KTP" = Indonesian ID Card
    /// "NPWP" = Tax ID
    /// "PASSPORT" = Passport
    /// </summary>
    public string namejidentitas { get; set; } = "KTP";

    /// <summary>
    /// ID number of the person/document owner
    /// For KTP: 16 digits
    /// For NPWP: 15 digits
    /// </summary>
    public string noidentitas { get; set; } = string.Empty;

    /// <summary>
    /// Name of the person/entity requesting the stamp
    /// </summary>
    public string namedipungut { get; set; } = string.Empty;

    /// <summary>
    /// Whether to return only the serial number without image
    /// Default: false (returns both SN and image)
    /// </summary>
    public bool snOnly { get; set; } = false;

    /// <summary>
    /// Document/Invoice number being stamped
    /// </summary>
    public string nodoc { get; set; } = string.Empty;

    /// <summary>
    /// Document date in YYYY-MM-DD format
    /// </summary>
    public string tgldoc { get; set; } = string.Empty;
}

/// <summary>
/// Response DTO for Peruri Stamp v2 API
/// Matches the actual API response from:
/// https://stampv2stg.e-meterai.co.id/chanel/stampv2
/// </summary>
public class PeruriStampResponseDto
{
    /// <summary>
    /// Status code from Peruri API
    /// "00" indicates success
    /// </summary>
    public string statusCode { get; set; } = string.Empty;

    /// <summary>
    /// Message from the API
    /// </summary>
    public string message { get; set; } = string.Empty;

    /// <summary>
    /// Result containing serial number and base64 image
    /// </summary>
    public PeruriStampResultDto? result { get; set; }
}

/// <summary>
/// Result data from Peruri Stamp v2 API
/// </summary>
public class PeruriStampResultDto
{
    /// <summary>
    /// Serial Number for the e-Meterai
    /// Format: 2C5NV74I6D0HJ1EZ000DU9
    /// </summary>
    public string sn { get; set; } = string.Empty;

    /// <summary>
    /// Base64 encoded e-Meterai stamp image data
    /// This is the physical stamp image that will be embedded in the PDF
    /// </summary>
    public string image { get; set; } = string.Empty;
}

/// <summary>
/// Request DTO for KeyStamp Docker Adapter Signing API
/// </summary>
public class KeyStampSigningRequestDto
{
    public string certificatelevel { get; set; } = "NOT_CERTIFIED";
    public string src { get; set; } = string.Empty;
    public string dest { get; set; } = string.Empty;
    public string spesimenPath { get; set; } = string.Empty;
    public string refToken { get; set; } = string.Empty;
    public string jwToken { get; set; } = string.Empty;
    public int visSignaturePage { get; set; } = 1;
    public int visLLX { get; set; } = 237;
    public int visLLY { get; set; } = 559;
    public int visURX { get; set; } = 337;
    public int visURY { get; set; } = 459;
    // Add these missing required fields:
    public string profileName { get; set; } = "default"; // Usually "default" or your cert profile name
    public string docpass { get; set; } = "";           // Leave blank "" if PDF isn't password protected
    public string location { get; set; } = "Jakarta";    // Signing location
    public string reason { get; set; } = "eMeterai Stamping"; // Signing reason
}

/// <summary>
/// Response DTO for KeyStamp Docker Adapter Signing API
/// </summary>
public class KeyStampSigningResponseDto
{
    public bool status { get; set; }
    public string message { get; set; } = string.Empty;
    public string? signedFilePath { get; set; }
}
