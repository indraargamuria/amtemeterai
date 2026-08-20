using Microsoft.EntityFrameworkCore;
using amtemeterai.Api.Data;
using amtemeterai.Api.Models;

namespace amtemeterai.Api.Services;

/// <summary>
/// Result of a single managed background job run.
/// </summary>
public class JobRunResult
{
    public string Status { get; init; } = "Success";
    public string? Details { get; init; }
    public string? ErrorMessage { get; init; }

    public static JobRunResult Success(string? details = null) => new() { Status = "Success", Details = details };
    public static JobRunResult Skipped(string? details = null) => new() { Status = "Skipped", Details = details };
    public static JobRunResult Failed(string error) => new() { Status = "Failed", ErrorMessage = error };
}

/// <summary>
/// Runtime handle for a managed background job. The BackgroundJobsController
/// uses this registry to trigger immediate runs and to check whether a job's
/// hosted loop is actually alive.
/// </summary>
public interface IBackgroundJobRegistry
{
    /// <summary>Register a running job loop. Called by the service itself.</summary>
    void Register(BackgroundJobHandle handle);

    /// <summary>Look up a running job by its JobKey.</summary>
    BackgroundJobHandle? Find(string jobKey);

    /// <summary>All currently running job loops.</summary>
    IReadOnlyCollection<BackgroundJobHandle> All { get; }
}

/// <summary>
/// Handle to a live job loop. RequestRun() interrupts the wait so the
/// job executes immediately (used by the "Run now" button).
/// </summary>
public class BackgroundJobHandle
{
    private readonly SemaphoreSlim _wakeSignal = new(0);
    private readonly Func<CancellationToken, Task<JobRunResult>> _runOnce;

    public string JobKey { get; }
    public DateTime? CurrentRunStartedAt { get; private set; }
    public bool IsRunning => CurrentRunStartedAt != null;

    public BackgroundJobHandle(string jobKey, Func<CancellationToken, Task<JobRunResult>> runOnce)
    {
        JobKey = jobKey;
        _runOnce = runOnce;
    }

    /// <summary>
    /// Ask the loop to run immediately. Non-blocking; takes effect as soon
    /// as the current wait (or current run) finishes.
    /// </summary>
    public void RequestRun() => _wakeSignal.Release();

    /// <summary>
    /// Internal: consumed by ManagedBackgroundService loop. Atomically drains
    /// any pending run request so a stale signal never lingers.
    /// </summary>
    internal bool ConsumeRunRequest() => _wakeSignal.CurrentCount > 0 && _wakeSignal.Wait(0);

    /// <summary>Internal: consumed by ManagedBackgroundService loop.</summary>
    internal async Task<bool> WaitWakeAsync(TimeSpan timeout, CancellationToken token)
        => await _wakeSignal.WaitAsync(timeout, token);

    /// <summary>Internal: wraps one execution with running-state tracking.</summary>
    internal async Task<JobRunResult> ExecuteAsync(CancellationToken token)
    {
        CurrentRunStartedAt = DateTime.UtcNow;
        try { return await _runOnce(token); }
        finally { CurrentRunStartedAt = null; }
    }
}

public class BackgroundJobRegistry : IBackgroundJobRegistry
{
    private readonly object _lock = new();
    private readonly Dictionary<string, BackgroundJobHandle> _jobs = new();

    public void Register(BackgroundJobHandle handle)
    {
        lock (_lock) { _jobs[handle.JobKey] = handle; }
    }

    public BackgroundJobHandle? Find(string jobKey)
    {
        lock (_lock) { return _jobs.TryGetValue(jobKey, out var h) ? h : null; }
    }

    public IReadOnlyCollection<BackgroundJobHandle> All
    {
        get { lock (_lock) { return _jobs.Values.ToList().AsReadOnly(); } }
    }
}

/// <summary>
/// Base class for background services managed through the BackgroundJobs
/// admin page. The loop re-reads IsEnabled / IntervalMinutes from the
/// database every cycle, so toggles and interval changes apply without a
/// restart, and every run is recorded in BackgroundJobExecutionLogs.
///
/// Subclasses implement RunOnceAsync and only do work when the job row
/// is enabled; the base loop handles scheduling, wake-ups ("Run now"),
/// logging, and last-execution bookkeeping.
/// </summary>
public abstract class ManagedBackgroundService : BackgroundService
{
    protected readonly IServiceScopeFactory _scopeFactory;
    private readonly IBackgroundJobRegistry _registry;
    private readonly ILogger _logger;

    protected abstract string JobKey { get; }
    /// <summary>Fallback interval (minutes) when the job row is missing from the database.</summary>
    protected abstract int FallbackIntervalMinutes { get; }

    protected ManagedBackgroundService(
        IServiceScopeFactory scopeFactory,
        IBackgroundJobRegistry registry,
        ILogger logger)
    {
        _scopeFactory = scopeFactory;
        _registry = registry;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Managed background job {JobKey} starting", JobKey);

        var handle = new BackgroundJobHandle(JobKey, RunOnceInternalAsync);
        _registry.Register(handle);

        // True when a manual run request arrived while we were inside a wait.
        bool manualRunPending = false;

        // Small startup delay so DB migrations/seeding finish first.
        try { await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            int intervalMinutes = FallbackIntervalMinutes;
            bool enabled = true;

            try
            {
                using (var scope = _scopeFactory.CreateScope())
                {
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var job = await db.BackgroundJobs.AsNoTracking().FirstOrDefaultAsync(j => j.JobKey == JobKey, stoppingToken);
                    if (job != null)
                    {
                        enabled = job.IsEnabled;
                        intervalMinutes = job.IntervalMinutes > 0 ? job.IntervalMinutes : FallbackIntervalMinutes;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not read job state for {JobKey}; using fallback (enabled, {Interval} min)", JobKey, FallbackIntervalMinutes);
            }

            var runNowRequested = manualRunPending || handle.ConsumeRunRequest();
            manualRunPending = false;

            if (enabled || runNowRequested)
            {
                var sw = System.Diagnostics.Stopwatch.StartNew();
                JobRunResult result;
                try
                {
                    result = await handle.ExecuteAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    result = JobRunResult.Failed(ex.Message);
                }
                sw.Stop();

                try
                {
                    await RecordExecutionAsync(result, sw.ElapsedMilliseconds, stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to record execution log for {JobKey}", JobKey);
                }
            }

            // Wait for the interval, but wake up immediately if a manual run is requested.
            try
            {
                var woke = await handle.WaitWakeAsync(TimeSpan.FromMinutes(intervalMinutes), stoppingToken);
                if (woke) { manualRunPending = true; _logger.LogInformation("Manual run requested for {JobKey}", JobKey); }
            }
            catch (OperationCanceledException) { break; }
        }

        _logger.LogInformation("Managed background job {JobKey} stopping", JobKey);
    }

    /// <summary>Subclasses implement the actual work here.</summary>
    protected abstract Task<JobRunResult> RunOnceAsync(AppDbContext db, CancellationToken stoppingToken);

    private async Task<JobRunResult> RunOnceInternalAsync(CancellationToken stoppingToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        try
        {
            return await RunOnceAsync(db, stoppingToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled error in managed job {JobKey}", JobKey);
            return JobRunResult.Failed(ex.Message);
        }
    }

    private async Task RecordExecutionAsync(JobRunResult result, long durationMs, CancellationToken token)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var job = await db.BackgroundJobs.FirstOrDefaultAsync(j => j.JobKey == JobKey, token);
        if (job == null) return;

        job.LastExecutedAt = DateTime.UtcNow;
        job.LastExecutionStatus = result.Status;
        job.LastExecutionError = result.ErrorMessage;
        job.UpdatedAt = DateTime.UtcNow;

        db.BackgroundJobExecutionLogs.Add(new BackgroundJobExecutionLog
        {
            JobId = job.Id,
            StartedAt = DateTime.UtcNow.AddMilliseconds(-durationMs),
            FinishedAt = DateTime.UtcNow,
            Status = result.Status,
            DurationMs = durationMs,
            Details = result.Details,
            ErrorMessage = result.ErrorMessage
        });

        await db.SaveChangesAsync(token);
    }
}
