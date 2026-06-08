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
/// </summary>
public class PeruriLoginResponseDto
{
    public bool status { get; set; }
    public string message { get; set; } = string.Empty;
    public PeruriLoginDataDto? data { get; set; }
}

public class PeruriLoginDataDto
{
    public string token { get; set; } = string.Empty;
    public string expireIn { get; set; } = string.Empty;
}

/// <summary>
/// Request DTO for Peruri Stamp v2 Single Serial Number API
/// </summary>
public class PeruriStampRequestDto
{
    public string invoiceNumber { get; set; } = string.Empty;
    public string customerName { get; set; } = string.Empty;
    public string customerNumber { get; set; } = string.Empty;
    public decimal amount { get; set; }
    public string currency { get; set; } = "IDR";
}

/// <summary>
/// Response DTO for Peruri Stamp v2 API
/// </summary>
public class PeruriStampResponseDto
{
    public bool status { get; set; }
    public string message { get; set; } = string.Empty;
    public PeruriStampResultDto? result { get; set; }
}

public class PeruriStampResultDto
{
    /// <summary>
    /// Serial Number for the e-Meterai
    /// </summary>
    public string sn { get; set; } = string.Empty;

    /// <summary>
    /// Base64 encoded QR code image data
    /// </summary>
    public string filenameQR { get; set; } = string.Empty;

    /// <summary>
    /// Transaction ID for tracking
    /// </summary>
    public string transactionId { get; set; } = string.Empty;
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
