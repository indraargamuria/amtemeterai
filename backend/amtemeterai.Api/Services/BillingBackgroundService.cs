using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using amtemeterai.Api.Config;
using amtemeterai.Api.Data;
using amtemeterai.Api.Models;

namespace amtemeterai.Api.Services;

/// <summary>
/// Managed background service that automatically syncs BC invoices from SAP.
/// Checks for deliveries with BillingStatus = Unbilled (1) and DeliveryType = BC (1)
/// and calls the invoice creation service to sync billing data.
///
/// Schedule and enable/disable state come from the BackgroundJobs table
/// (manageable from the Background Jobs admin page); the legacy
/// BillingSyncOptions values are only a fallback.
/// </summary>
public class BillingBackgroundService : ManagedBackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<BillingBackgroundService> _logger;
    private readonly BillingSyncOptions _options;

    public BillingBackgroundService(
        IServiceScopeFactory scopeFactory,
        IBackgroundJobRegistry registry,
        ILogger<BillingBackgroundService> logger,
        IOptions<BillingSyncOptions> options)
        : base(scopeFactory, registry, logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _options = options.Value;
    }

    protected override string JobKey => "BillingSync";
    protected override int FallbackIntervalMinutes => _options.CheckIntervalMinutes > 0 ? _options.CheckIntervalMinutes : 3;

    protected override async Task<JobRunResult> RunOnceAsync(AppDbContext db, CancellationToken stoppingToken)
    {
        // Find deliveries that:
        // 1. Have BillingStatus = Unbilled (1)
        // 2. Have DeliveryType = BC (1)
        // 3. Have been received (Status is FullyReceived or PartialReceived)
        var pendingDeliveries = await db.DeliveryHeaders
            .Where(d =>
                d.BillingStatus == DeliveryHeader.DeliveryBillingStatus.Unbilled &&
                d.Type == DeliveryHeader.DeliveryType.BC &&
                d.Status.HasValue &&
                (d.Status.Value == DeliveryHeader.ReceiverStatus.FullyReceived ||
                 d.Status.Value == DeliveryHeader.ReceiverStatus.PartialReceived))
            .Select(d => new { d.DeliveryNumber, d.DeliveryID })
            .ToListAsync(stoppingToken);

        if (!pendingDeliveries.Any())
        {
            _logger.LogDebug("No pending BC deliveries found for billing sync.");
            return JobRunResult.Skipped("No pending BC deliveries");
        }

        _logger.LogInformation("Found {Count} pending BC deliveries for billing sync.", pendingDeliveries.Count);

        int syncedCount = 0;
        int skippedCount = 0;
        var details = new System.Text.StringBuilder();

        foreach (var delivery in pendingDeliveries)
        {
            stoppingToken.ThrowIfCancellationRequested();

            try
            {
                _logger.LogInformation("Processing invoice sync for BC delivery {DeliveryNumber}", delivery.DeliveryNumber);

                // Create a new scope for each delivery to get fresh service instance
                using var scope = _scopeFactory.CreateScope();
                var bcInvoiceSyncService = scope.ServiceProvider.GetRequiredService<BcInvoiceSyncService>();

                // Call the invoice creation service
                var result = await bcInvoiceSyncService.CreateSapInvoiceAsync(delivery.DeliveryNumber);

                if (result != null && result.Success)
                {
                    syncedCount++;
                    _logger.LogInformation("Successfully synced invoice for delivery {DeliveryNumber}", delivery.DeliveryNumber);

                    // Log success activity
                    var activityLog = new ActivityLog
                    {
                        EventType = "BcInvoiceSyncSuccess",
                        ReferenceID = delivery.DeliveryNumber,
                        Message = $"BC invoice {result.InvoiceNumber} successfully synced from SAP for delivery {delivery.DeliveryNumber}",
                        Severity = "Success"
                    };
                    db.ActivityLogs.Add(activityLog);
                    details.AppendLine($"Synced {delivery.DeliveryNumber} -> {result.InvoiceNumber}");
                }
                else if (result != null && !result.Success)
                {
                    skippedCount++;
                    _logger.LogWarning("Invoice sync skipped for delivery {DeliveryNumber}: {Message}", delivery.DeliveryNumber, result.Message);

                    // Log warning activity
                    var activityLog = new ActivityLog
                    {
                        EventType = "BcInvoiceSyncSkipped",
                        ReferenceID = delivery.DeliveryNumber,
                        Message = $"Invoice sync skipped: {result.Message}",
                        Severity = "Warning"
                    };
                    db.ActivityLogs.Add(activityLog);
                }
                else
                {
                    skippedCount++;
                    _logger.LogWarning("Null or failed response when syncing invoice for delivery {DeliveryNumber}", delivery.DeliveryNumber);
                }
            }
            catch (Exception ex)
            {
                skippedCount++;
                _logger.LogError(ex, "Failed to sync invoice for BC delivery {DeliveryNumber}", delivery.DeliveryNumber);

                // Log error activity
                var activityLog = new ActivityLog
                {
                    EventType = "BcInvoiceSyncFailed",
                    ReferenceID = delivery.DeliveryNumber,
                    Message = $"Failed to sync BC invoice: {ex.Message}",
                    Severity = "Error"
                };
                db.ActivityLogs.Add(activityLog);
            }
        }

        await db.SaveChangesAsync(stoppingToken);

        _logger.LogInformation("Billing sync cycle completed. Synced: {Synced}, Skipped: {Skipped}", syncedCount, skippedCount);

        return syncedCount > 0
            ? JobRunResult.Success($"Synced {syncedCount} invoice(s), skipped {skippedCount}")
            : JobRunResult.Skipped($"No invoices synced ({skippedCount} skipped)");
    }
}
