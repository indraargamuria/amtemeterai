using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace amtemeterai.Api.Models;

/// <summary>
/// Definition of a managed background job. Each row represents one
/// recurring background service whose schedule can be toggled and
/// re-intervaled at runtime from the Background Jobs admin page.
/// </summary>
public class BackgroundJob
{
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// Stable machine key used by the hosted service to look itself up
    /// (e.g. "DeliveryAutoConfirm", "BillingSync").
    /// </summary>
    [Required, MaxLength(100)]
    public string JobKey { get; set; } = null!;

    /// <summary>
    /// Human-friendly name shown in the UI (e.g. "Delivery Auto Confirm").
    /// </summary>
    [Required, MaxLength(200)]
    public string DisplayName { get; set; } = null!;

    /// <summary>
    /// Short description of what the job does.
    /// </summary>
    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// Run interval in minutes. Services re-read this from the database
    /// every cycle, so changes apply without a restart.
    /// </summary>
    public int IntervalMinutes { get; set; } = 60;

    /// <summary>
    /// Whether the job currently runs. When false the service loop
    /// idles and does not execute work.
    /// </summary>
    public bool IsEnabled { get; set; } = true;

    /// <summary>
    /// UTC timestamp of the last completed (or attempted) execution.
    /// </summary>
    public DateTime? LastExecutedAt { get; set; }

    /// <summary>
    /// Outcome of the last execution: "Success", "Failed", or "Skipped".
    /// </summary>
    [MaxLength(20)]
    public string? LastExecutionStatus { get; set; }

    /// <summary>
    /// Error message of the last execution, when it failed.
    /// </summary>
    [MaxLength(2000)]
    public string? LastExecutionError { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// One execution record of a background job. Kept indefinitely so the
/// Background Jobs page can show full execution history.
/// </summary>
public class BackgroundJobExecutionLog
{
    [Key]
    public int Id { get; set; }

    public int JobId { get; set; }
    public BackgroundJob Job { get; set; } = null!;

    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? FinishedAt { get; set; }

    /// <summary>
    /// "Success", "Failed", or "Skipped".
    /// </summary>
    [Required, MaxLength(20)]
    public string Status { get; set; } = null!;

    public long? DurationMs { get; set; }

    /// <summary>
    /// Optional detail message (e.g. "Confirmed 3 deliveries").
    /// </summary>
    [MaxLength(2000)]
    public string? Details { get; set; }

    /// <summary>
    /// Error message when the run failed.
    /// </summary>
    [MaxLength(2000)]
    public string? ErrorMessage { get; set; }
}
