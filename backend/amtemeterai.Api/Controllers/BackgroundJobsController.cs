using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using amtemeterai.Api.Data;
using amtemeterai.Api.Dtos;
using amtemeterai.Api.Services;

namespace amtemeterai.Api.Controllers;

/// <summary>
/// Admin API for managing background jobs: list, enable/disable, change
/// interval, trigger an immediate run, and browse execution history.
/// </summary>
[ApiController]
[Route("api/background-jobs")]
[Authorize]
public class BackgroundJobsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IBackgroundJobRegistry _registry;
    private readonly ILogger<BackgroundJobsController> _logger;

    public BackgroundJobsController(
        AppDbContext db,
        IBackgroundJobRegistry registry,
        ILogger<BackgroundJobsController> logger)
    {
        _db = db;
        _registry = registry;
        _logger = logger;
    }

    /// <summary>List all managed background jobs with runtime state.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<BackgroundJobResponseDto>>> GetAll()
    {
        var jobs = await _db.BackgroundJobs
            .AsNoTracking()
            .OrderBy(j => j.Id)
            .ToListAsync();

        return Ok(jobs.Select(j => ToDto(j)));
    }

    /// <summary>Update a job's enabled state and/or interval (minutes).</summary>
    [HttpPatch("{key}")]
    public async Task<IActionResult> Update(string key, [FromBody] UpdateBackgroundJobDto dto)
    {
        var job = await _db.BackgroundJobs.FirstOrDefaultAsync(j => j.JobKey == key);
        if (job == null) return NotFound($"Background job '{key}' not found");

        if (dto.IsEnabled.HasValue)
            job.IsEnabled = dto.IsEnabled.Value;

        if (dto.IntervalMinutes.HasValue)
        {
            var interval = dto.IntervalMinutes.Value;
            if (interval < 1) interval = 1;
            job.IntervalMinutes = interval;
        }

        job.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ToDto(job));
    }

    /// <summary>Trigger an immediate run of a job (next loop wake-up).</summary>
    [HttpPost("{key}/run-now")]
    public async Task<IActionResult> RunNow(string key)
    {
        var job = await _db.BackgroundJobs.AsNoTracking().FirstOrDefaultAsync(j => j.JobKey == key);
        if (job == null) return NotFound($"Background job '{key}' not found");

        var handle = _registry.Find(key);
        if (handle == null)
            return Conflict($"Background job '{key}' is not currently running (hosted service not registered)");

        handle.RequestRun();
        _logger.LogInformation("Manual run requested for background job {JobKey} by {User}", key, User.Identity?.Name ?? "unknown");

        return Accepted(new
        {
            message = $"Run requested for '{key}'. It will start on the next cycle wake-up.",
            jobKey = key
        });
    }

    /// <summary>Execution history for a job, newest first, paged.</summary>
    [HttpGet("{key}/logs")]
    public async Task<ActionResult<IEnumerable<BackgroundJobExecutionLogDto>>> GetLogs(
        string key,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 200) pageSize = 50;

        var job = await _db.BackgroundJobs.AsNoTracking().FirstOrDefaultAsync(j => j.JobKey == key);
        if (job == null) return NotFound($"Background job '{key}' not found");

        var logs = await _db.BackgroundJobExecutionLogs
            .AsNoTracking()
            .Where(l => l.JobId == job.Id)
            .OrderByDescending(l => l.StartedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(logs.Select(l => new BackgroundJobExecutionLogDto
        {
            Id = l.Id,
            StartedAt = l.StartedAt,
            FinishedAt = l.FinishedAt,
            Status = l.Status,
            DurationMs = l.DurationMs,
            Details = l.Details,
            ErrorMessage = l.ErrorMessage
        }));
    }

    private BackgroundJobResponseDto ToDto(Models.BackgroundJob j)
    {
        var handle = _registry.Find(j.JobKey);
        return new BackgroundJobResponseDto
        {
            Id = j.Id,
            JobKey = j.JobKey,
            DisplayName = j.DisplayName,
            Description = j.Description,
            IntervalMinutes = j.IntervalMinutes,
            IsEnabled = j.IsEnabled,
            LastExecutedAt = j.LastExecutedAt,
            LastExecutionStatus = j.LastExecutionStatus,
            LastExecutionError = j.LastExecutionError,
            IsRunning = handle != null,
            CurrentRunStartedAt = handle?.CurrentRunStartedAt
        };
    }
}
