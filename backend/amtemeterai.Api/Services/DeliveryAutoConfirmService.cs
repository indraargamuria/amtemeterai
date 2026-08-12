using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using amtemeterai.Api.Config;
using amtemeterai.Api.Data;
using amtemeterai.Api.Models;

namespace amtemeterai.Api.Services;

/// <summary>
/// Background service that automatically confirms delivery orders based on PGI date + customer region lead time.
/// If PGI date is 12 Aug and lead time is 3 days, auto-receive on 15 Aug.
/// Skips processing if PGI date or lead time is blank/null.
/// </summary>
public class DeliveryAutoConfirmService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DeliveryAutoConfirmService> _logger;
    private readonly DeliveryAutoConfirmOptions _options;

    public DeliveryAutoConfirmService(
        IServiceProvider serviceProvider,
        ILogger<DeliveryAutoConfirmService> logger,
        IOptions<DeliveryAutoConfirmOptions> options)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Delivery Auto Confirm Service is starting. Check Interval: {Interval} minutes", _options.CheckIntervalMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                await ProcessPendingAutoConfirmAsync(db);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Delivery Auto Confirm Service");
            }

            // Wait for the configured interval before next check (default 60 minutes)
            await Task.Delay(TimeSpan.FromMinutes(_options.CheckIntervalMinutes), stoppingToken);
        }

        _logger.LogInformation("Delivery Auto Confirm Service is stopping.");
    }

    private async Task ProcessPendingAutoConfirmAsync(AppDbContext db)
    {
        // Find deliveries that:
        // 1. Have NOT been received yet (Received = false)
        // 2. Have a PostGoodsIssueDate (PGI date)
        // 3. Have a Customer with LeadTimeDays
        // 4. Expected receive date (PGI date + lead time) is today or in the past
        var today = DateTime.UtcNow.Date;
        var pendingDeliveries = await db.DeliveryHeaders
            .Include(d => d.Customer)
            .Include(d => d.Lines)
            .Where(d =>
                !d.Received &&
                d.PostGoodsIssueDate.HasValue &&
                d.Customer != null &&
                d.Customer.LeadTimeDays.HasValue &&
                d.Status != DeliveryHeader.ReceiverStatus.Canceled)
            .Select(d => new
            {
                d.DeliveryID,
                d.DeliveryNumber,
                d.PostGoodsIssueDate,
                d.Customer.LeadTimeDays,
                d.Customer.CustomerCode,
                d.Customer.CustomerName,
                Lines = d.Lines
            })
            .ToListAsync();

        if (!pendingDeliveries.Any())
        {
            _logger.LogDebug("No pending deliveries found for auto-confirmation.");
            return;
        }

        _logger.LogInformation("Found {Count} pending deliveries for auto-confirmation evaluation.", pendingDeliveries.Count);

        int confirmedCount = 0;

        // Process each delivery
        foreach (var delivery in pendingDeliveries)
        {
            try
            {
                // Calculate expected receive date: PGI date + lead time
                var expectedReceiveDate = delivery.PostGoodsIssueDate.Value.AddDays(delivery.LeadTimeDays.Value).Date;

                // Only auto-confirm if today is on or after the expected receive date
                if (today < expectedReceiveDate)
                {
                    _logger.LogDebug(
                        "Delivery {DeliveryNumber} not yet due for auto-confirmation. Expected: {ExpectedDate}, Today: {Today}",
                        delivery.DeliveryNumber,
                        expectedReceiveDate.ToString("yyyy-MM-dd"),
                        today.ToString("yyyy-MM-dd"));
                    continue;
                }

                _logger.LogInformation(
                    "Auto-confirming delivery {DeliveryNumber}. PGI: {PGIDate}, Lead Time: {LeadTime} days, Expected Receive: {ExpectedDate}",
                    delivery.DeliveryNumber,
                    delivery.PostGoodsIssueDate.Value.ToString("yyyy-MM-dd"),
                    delivery.LeadTimeDays.Value,
                    expectedReceiveDate.ToString("yyyy-MM-dd"));

                // Get the full delivery entity with navigation properties
                var fullDelivery = await db.DeliveryHeaders
                    .Include(d => d.Lines)
                    .Include(d => d.Customer)
                    .FirstOrDefaultAsync(d => d.DeliveryID == delivery.DeliveryID);

                if (fullDelivery == null)
                {
                    _logger.LogWarning("Delivery {DeliveryID} not found during auto-confirm processing", delivery.DeliveryID);
                    continue;
                }

                // Mark as received with all items received (FullyReceived status)
                fullDelivery.Received = true;
                fullDelivery.ReceiveDate = DateTime.UtcNow;
                fullDelivery.ReceiverName = "System Auto-Confirm";
                fullDelivery.ReceiverNotes = $"Auto-confirmed based on PGI date + lead time. PGI: {delivery.PostGoodsIssueDate.Value:yyyy-MM-dd}, Lead Time: {delivery.LeadTimeDays} days";
                fullDelivery.Status = DeliveryHeader.ReceiverStatus.FullyReceived;

                // Update all delivery lines to mark as fully delivered
                if (fullDelivery.Lines != null)
                {
                    foreach (var line in fullDelivery.Lines)
                    {
                        line.PackQuantityDelivered = line.PackQuantity;
                        line.PackQuantityReturned = 0;
                        line.PackQuantityRejected = 0;
                        line.LineComment = "Auto-confirmed by system";
                    }
                }

                await db.SaveChangesAsync();

                confirmedCount++;

                // Log activity
                var activityLog = new ActivityLog
                {
                    EventType = "DeliveryAutoConfirmed",
                    ReferenceID = delivery.DeliveryNumber,
                    Message = $"Delivery {delivery.DeliveryNumber} auto-confirmed. PGI: {delivery.PostGoodsIssueDate.Value:yyyy-MM-dd}, Lead Time: {delivery.LeadTimeDays} days",
                    Severity = "Info"
                };
                db.ActivityLogs.Add(activityLog);

                _logger.LogInformation("Successfully auto-confirmed delivery {DeliveryNumber}", delivery.DeliveryNumber);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to auto-confirm delivery {DeliveryNumber}", delivery.DeliveryNumber);

                // Log error activity
                var activityLog = new ActivityLog
                {
                    EventType = "DeliveryAutoConfirmFailed",
                    ReferenceID = delivery.DeliveryNumber,
                    Message = $"Failed to auto-confirm delivery: {ex.Message}",
                    Severity = "Error"
                };
                db.ActivityLogs.Add(activityLog);
            }
        }

        if (confirmedCount > 0)
        {
            await db.SaveChangesAsync();
            _logger.LogInformation("Delivery Auto Confirm Service completed. Successfully confirmed {Count} deliveries.", confirmedCount);
        }
        else
        {
            _logger.LogInformation("Delivery Auto Confirm Service completed. No deliveries met the criteria for auto-confirmation.");
        }
    }
}
