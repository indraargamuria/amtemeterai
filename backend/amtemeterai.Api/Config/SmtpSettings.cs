namespace amtemeterai.Api.Config
{
    /// <summary>
    /// Configuration options for SMTP email service
    /// Uses MailKit for email transport with STARTTLS support
    /// </summary>
    public class SmtpSettings
    {
        public const string SectionName = "SmtpSettings";

        public string Host { get; set; } = string.Empty;
        public int Port { get; set; }
        public string SenderName { get; set; } = string.Empty;
        public string SenderEmail { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public bool EnableSsl { get; set; }
    }
}