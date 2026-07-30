using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using amtemeterai.Api.Config;
using amtemeterai.Api.Data;
using amtemeterai.Api.Models;
using Microsoft.Extensions.Options;

namespace amtemeterai.Api.Services;

/// <summary>
/// Background service that automatically syncs BC invoices from SAP every 3 minutes.
/// Checks for deliveries with BillingStatus = Unbilled (1) and DeliveryType = BC (1)
/// and calls the invoice creation service to sync billing data.
/// </summary>
public class BillingBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<BillingBackgroundService> _logger;
    private readonly BillingSyncOptions _options;

    public BillingBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<BillingBackgroundService> logger,
        IOptions<BillingSyncOptions> options)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Billing Background Service is starting. Check Interval: {Interval} minutes", _options.CheckIntervalMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                await ProcessPendingBillingAsync(db);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Billing Background Service");
            }

            // Wait for the configured interval before next check (3 minutes)
            await Task.Delay(TimeSpan.FromMinutes(_options.CheckIntervalMinutes), stoppingToken);
        }

        _logger.LogInformation("Billing Background Service is stopping.");
    }

    private async Task ProcessPendingBillingAsync(AppDbContext db)
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
            .ToListAsync();

        if (!pendingDeliveries.Any())
        {
            _logger.LogDebug("No pending BC deliveries found for billing sync.");
            return;
        }

        _logger.LogInformation("Found {Count} pending BC deliveries for billing sync.", pendingDeliveries.Count);

        // Process each delivery
        foreach (var delivery in pendingDeliveries)
        {
            try
            {
                _logger.LogInformation("Processing invoice sync for BC delivery {DeliveryNumber}", delivery.DeliveryNumber);

                // Create a new scope for each delivery to get fresh service instance
                using var scope = _serviceProvider.CreateScope();
                var bcInvoiceSyncService = scope.ServiceProvider.GetRequiredService<BcInvoiceSyncService>();

                // Call the invoice creation service
                var result = await bcInvoiceSyncService.CreateSapInvoiceAsync(delivery.DeliveryNumber);

                if (result != null && result.Success)
                {
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
                }
                else if (result != null && !result.Success)
                {
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
                    _logger.LogWarning("Null or failed response when syncing invoice for delivery {DeliveryNumber}", delivery.DeliveryNumber);
                }
            }
            catch (Exception ex)
            {
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

        await db.SaveChangesAsync();
    }
}
