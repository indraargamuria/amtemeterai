using amtemeterai.Api.Data;

namespace amtemeterai.Api.Services;

/// <summary>
/// Managed background job that periodically syncs shipping parameter master data
/// (country + region + ship mode + lead time) from SAP. Schedule/enable state
/// comes from the BackgroundJobs table (JobKey: ShippingParameterSync).
/// </summary>
public class ShippingParameterBackgroundService : ManagedBackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ShippingParameterBackgroundService> _logger;
    private readonly IShippingParameterSource _source;

    public ShippingParameterBackgroundService(
        IServiceScopeFactory scopeFactory,
        IBackgroundJobRegistry registry,
        ILogger<ShippingParameterBackgroundService> logger,
        IShippingParameterSource source)
        : base(scopeFactory, registry, logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _source = source;
    }

    protected override string JobKey => "ShippingParameterSync";
    protected override int FallbackIntervalMinutes => 60;

    protected override async Task<JobRunResult> RunOnceAsync(AppDbContext db, CancellationToken stoppingToken)
    {
        var parameters = await _source.GetShippingParametersAsync();

        if (parameters.Count == 0)
            return JobRunResult.Skipped("No shipping parameters returned by source");

        using var scope = _scopeFactory.CreateScope();
        var syncService = scope.ServiceProvider.GetRequiredService<ShippingParameterService>();
        var (inserted, updated) = await syncService.UpsertShippingParametersAsync(parameters);

        return JobRunResult.Success($"{inserted} inserted, {updated} updated");
    }
}
