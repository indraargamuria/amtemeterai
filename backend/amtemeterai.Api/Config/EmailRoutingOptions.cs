namespace amtemeterai.Api.Config;

/// <summary>
/// Configuration options for email routing and staging modes
/// Controls recipient routing for delivery confirmations and PIN emails
/// </summary>
public class EmailRoutingOptions
{
    public const string SectionName = "EmailRouting";

    /// <summary>
    /// Enable staging mode (routes to test addresses instead of actual recipients)
    /// When true, emails are sent to StagingTo/StagingCc addresses
    /// When false, emails are sent to actual delivery salesperson and customer
    /// Default: true (staging mode for development/testing)
    /// </summary>
    public bool EnableStagingMode { get; set; } = true;

    /// <summary>
    /// Staging mode primary recipient email address
    /// Used when EnableStagingMode = true for delivery confirmations
    /// </summary>
    public string StagingTo { get; set; } = string.Empty;

    /// <summary>
    /// Staging mode CC recipient email addresses (comma-separated)
    /// Used when EnableStagingMode = true for delivery confirmations and PIN emails
    /// </summary>
    public string StagingCc { get; set; } = string.Empty;

    /// <summary>
    /// Staging mode PIN email recipient
    /// Used when EnableStagingMode = true for PIN emails
    /// </summary>
    public string StagingPinTo { get; set; } = string.Empty;
}
