namespace amtemeterai.Api.Models;

/// <summary>
/// Tracks every outbound document email sent from the Document Hub
/// (one row per email dispatch, i.e. per reference).
/// Used to show "email state" (sent count / last sent) per document row.
/// </summary>
public class EmailSend
{
    public int Id { get; set; }

    /// <summary>"delivery" or "invoice" — the reference kind the email was about.</summary>
    public string ReferenceType { get; set; } = string.Empty;

    /// <summary>Delivery number or invoice number the email was sent for.</summary>
    public string ReferenceNumber { get; set; } = string.Empty;

    /// <summary>Recipient email address (as sent).</summary>
    public string ToEmail { get; set; } = string.Empty;

    /// <summary>Subject line of the sent email.</summary>
    public string Subject { get; set; } = string.Empty;

    /// <summary>True when the send went through staging mode (EMAIL_STAGING_MODE=true).</summary>
    public bool StagingMode { get; set; }

    /// <summary>UTC timestamp of dispatch.</summary>
    public DateTime SentAt { get; set; } = DateTime.UtcNow;

    /// <summary>Id of the ApplicationUser who triggered the send, when known.</summary>
    public string? SentByUserId { get; set; }
}
