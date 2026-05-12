namespace amtemeterai.Api.Models;

public class ActivityLog
{
    public int LogID { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string EventType { get; set; } = string.Empty;
    public string ReferenceID { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Severity { get; set; } = "Info"; // Info, Success, Warning

    // Navigation property for EF Core
    public ActivityLog() { }
}
