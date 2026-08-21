namespace amtemeterai.Api.Models;

/// <summary>
/// Automatic data-change audit record written by AuditSaveChangesInterceptor
/// in the same transaction as the change itself.
/// ChangedFields JSON shape: {"PropName": {"from": <old>, "to": <new>}, ...}
/// </summary>
public class AuditLog
{
    public long AuditID { get; set; }

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    /// <summary>Authenticated username, or "system" for background jobs/SAP callbacks.</summary>
    public string UserName { get; set; } = "system";

    /// <summary>Client IP when available (web requests).</summary>
    public string? IpAddress { get; set; }

    public string EntityName { get; set; } = string.Empty;

    /// <summary>Primary key value of the affected row (string for composite safety).</summary>
    public string EntityId { get; set; } = string.Empty;

    /// <summary>Created | Updated | Deleted</summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>jsonb: property-level diff. Null for Created rows with no defaults worth logging.</summary>
    public Dictionary<string, Dictionary<string, object?>>? ChangedFields { get; set; }
}
