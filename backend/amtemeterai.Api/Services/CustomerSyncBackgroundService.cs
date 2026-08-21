using amtemeterai.Api.Data;

namespace amtemeterai.Api.Services;

/// <summary>
/// Managed background job that periodically syncs customer master data
/// (customer_no + customer_name + email + pin_code + region + country) from SAP.
/// Schedule/enable state comes from the BackgroundJobs table
/// (JobKey: customer:sync). Corresponds to ErpCustomerSource.GetCustomersAsync().
/// </summary>
public class CustomerSyncBackgroundService : ManagedBackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<CustomerSyncBackgroundService> _logger;
    private readonly ICustomerSource _source;

    public CustomerSyncBackgroundService(
        IServiceScopeFactory scopeFactory,
        IBackgroundJobRegistry registry,
        ILogger<CustomerSyncBackgroundService> logger,
        ICustomerSource source)
        : base(scopeFactory, registry, logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _source = source;
    }

    protected override string JobKey => "customer:sync";
    protected override int FallbackIntervalMinutes => 1440; // daily default

    protected override async Task<JobRunResult> RunOnceAsync(AppDbContext db, CancellationToken stoppingToken)
    {
        var customers = await _source.GetCustomersAsync();

        if (customers.Count == 0)
            return JobRunResult.Skipped("No customers returned by source");

        using var scope = _scopeFactory.CreateScope();
        var customerService = scope.ServiceProvider.GetRequiredService<CustomerService>();
        var (inserted, updated) = await customerService.UpsertCustomersAsync(customers);

        return JobRunResult.Success($"{inserted} inserted, {updated} updated");
    }
}