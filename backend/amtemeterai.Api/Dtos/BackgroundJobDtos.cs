using System.ComponentModel.DataAnnotations;

namespace amtemeterai.Api.Dtos;

/// <summary>
/// Request payload for updating a background job's schedule and state.
/// All fields optional; only provided fields are updated.
/// </summary>
public class UpdateBackgroundJobDto
{
    /// <summary>Enable or disable the job.</summary>
    public bool? IsEnabled { get; set; }

    /// <summary>New run interval in minutes (minimum 1).</summary>
    [Range(1, 10080)]
    public int? IntervalMinutes { get; set; }
}

/// <summary>
/// Response payload describing one managed background job and its runtime state.
/// </summary>
public class BackgroundJobResponseDto
{
    public int Id { get; set; }
    public string JobKey { get; set; } = null!;
    public string DisplayName { get; set; } = null!;
    public string? Description { get; set; }
    public int IntervalMinutes { get; set; }
    public bool IsEnabled { get; set; }
    public DateTime? LastExecutedAt { get; set; }
    public string? LastExecutionStatus { get; set; }
    public string? LastExecutionError { get; set; }

    /// <summary>Whether the hosted service loop is currently registered/alive.</summary>
    public bool IsRunning { get; set; }

    /// <summary>UTC start time of the in-flight execution, if one is running.</summary>
    public DateTime? CurrentRunStartedAt { get; set; }
}

/// <summary>
/// One execution-history row.
/// </summary>
public class BackgroundJobExecutionLogDto
{
    public int Id { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public string Status { get; set; } = null!;
    public long? DurationMs { get; set; }
    public string? Details { get; set; }
    public string? ErrorMessage { get; set; }
}
