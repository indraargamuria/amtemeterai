namespace amtemeterai.Api.Dtos;

/// <summary>
/// Request DTO for sending emails with attachments
/// </summary>
public class SendEmailRequestDto
{
    /// <summary>
    /// Recipient email address (customer email)
    /// </summary>
    public string ToEmail { get; set; } = string.Empty;

    /// <summary>
    /// Recipient name (customer name)
    /// </summary>
    public string ToName { get; set; } = string.Empty;

    /// <summary>
    /// Email subject
    /// </summary>
    public string Subject { get; set; } = string.Empty;

    /// <summary>
    /// Email body (HTML content)
    /// </summary>
    public string Body { get; set; } = string.Empty;

    /// <summary>
    /// Reference type - either "delivery" or "invoice"
    /// </summary>
    public string ReferenceType { get; set; } = string.Empty;

    /// <summary>
    /// Reference number (delivery number or invoice number)
    /// </summary>
    public string ReferenceNumber { get; set; } = string.Empty;

    /// <summary>
    /// Optional CC email addresses (comma-separated)
    /// </summary>
    public string? CcEmails { get; set; }
}
