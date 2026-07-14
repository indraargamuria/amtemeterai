using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using amtemeterai.Api.Config;
using amtemeterai.Api.Data;
using amtemeterai.Api.Models;
using Microsoft.Extensions.Options;
using System.Text.Json;

namespace amtemeterai.Api.Services;

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
        _logger.LogInformation("Billing Background Service is starting. Delay: {Delay} minutes, Check Interval: {Interval} minutes", _options.DelayMinutes, _options.CheckIntervalMinutes);

        var delayMinutes = _options.DelayMinutes;
        var checkIntervalMinutes = _options.CheckIntervalMinutes;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                await ProcessPendingBillingAsync(db, delayMinutes);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Billing Background Service");
            }

            // Wait for the configured interval before next check
            await Task.Delay(TimeSpan.FromMinutes(checkIntervalMinutes), stoppingToken);
        }

        _logger.LogInformation("Billing Background Service is stopping.");
    }

    private async Task ProcessPendingBillingAsync(AppDbContext db, int delayMinutes)
    {
        var cutoffTime = DateTime.UtcNow.AddMinutes(-delayMinutes);

        // Find deliveries that:
        // 1. Have been received (Status is FullyReceived or PartialReceived)
        // 2. Were received before the cutoff time
        // 3. Are not yet invoiced
        var pendingDeliveries = await db.DeliveryHeaders
            .Include(d => d.Lines)
            .Include(d => d.Customer)
            .Where(d =>
                (d.Status == DeliveryHeader.ReceiverStatus.FullyReceived ||
                 d.Status == DeliveryHeader.ReceiverStatus.PartialReceived) &&
                d.Received &&
                !d.Invoiced &&
                d.DeliveryDate < cutoffTime)
            .ToListAsync();

        if (!pendingDeliveries.Any())
        {
            _logger.LogDebug("No pending deliveries found for billing sync.");
            return;
        }

        _logger.LogInformation("Found {Count} pending deliveries for billing sync.", pendingDeliveries.Count);

        foreach (var delivery in pendingDeliveries)
        {
            try
            {
                await ProcessDeliveryBillingAsync(db, delivery);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process billing for delivery {DeliveryNumber}", delivery.DeliveryNumber);

                // Log activity
                var activityLog = new ActivityLog
                {
                    EventType = "BillingSyncFailed",
                    ReferenceID = delivery.DeliveryNumber,
                    Message = $"Failed to sync billing to SAP: {ex.Message}",
                    Severity = "Error"
                };
                db.ActivityLogs.Add(activityLog);
            }
        }

        await db.SaveChangesAsync();
    }

    private async Task ProcessDeliveryBillingAsync(AppDbContext db, DeliveryHeader delivery)
    {
        _logger.LogInformation("Processing billing for delivery {DeliveryNumber}", delivery.DeliveryNumber);

        // Build SAP billing payload
        var sapBillingPayload = new
        {
            CustomerCode = delivery.Customer?.CustomerCode ?? string.Empty,
            DeliveryNumber = delivery.DeliveryNumber,
            DeliveryDate = delivery.DeliveryDate.ToString("yyyy-MM-dd"),
            ReceiverStatus = delivery.Status == DeliveryHeader.ReceiverStatus.FullyReceived ? "1" : "2",
            Lines = delivery.Lines.Select(l => new
            {
                DeliveryLineNumber = l.DeliveryLineNumber,
                DeliveryItemCode = l.DeliveryItemCode,
                DeliveryItemDescription = l.DeliveryItemDescription,
                PackQuantityDelivered = l.PackQuantityDelivered,
                PackQuantityReturned = l.PackQuantityReturned,
                PackQuantityRejected = l.PackQuantityRejected
            }).ToList()
        };

        // In a real implementation, you would call SAP API here
        // For now, we'll simulate the response
        var sapSuccess = await CallSapBillingApiAsync(sapBillingPayload);

        if (sapSuccess)
        {
            // Calculate total invoice amount from lines
            decimal totalAmount = delivery.Lines.Sum(l => l.PackQuantityDelivered * 1000); // Simplified calculation

            // Create invoice record
            var invoiceNumber = $"INV-{DateTime.UtcNow:yyyyMMdd}-{delivery.DeliveryID:D6}";

            var invoice = new Invoice
            {
                InvoiceNumber = invoiceNumber,
                CustomerNumber = delivery.Customer?.CustomerCode ?? string.Empty,
                InvoiceAmount = totalAmount,
                InvoicedDate = DateTime.UtcNow,
                Status = Invoice.InvoiceStatus.Draft,
                DeliveryHeaderId = delivery.DeliveryID,
                
                //  FIXED: Reference the correct type signature name here
                StampingStatus = Invoice.InvoiceStampingStatus.NotStamped
            };

            db.Invoices.Add(invoice);

            // Mark delivery as invoiced
            delivery.Invoiced = true;

            _logger.LogInformation(
                "Successfully created invoice {InvoiceNumber} for delivery {DeliveryNumber}",
                invoiceNumber,
                delivery.DeliveryNumber);

            // Log activity
            var activityLog = new ActivityLog
            {
                EventType = "BillingSyncSuccess",
                ReferenceID = delivery.DeliveryNumber,
                Message = $"Invoice {invoiceNumber} created and synced to SAP.",
                Severity = "Info"
            };
            db.ActivityLogs.Add(activityLog);
        }
        else
        {
            _logger.LogWarning("SAP billing sync failed for delivery {DeliveryNumber}", delivery.DeliveryNumber);
        }
    }

    private async Task<bool> CallSapBillingApiAsync(object payload)
    {
        // In production, this would call the actual SAP billing API
        // For now, we simulate a successful response

        _logger.LogDebug("SAP Billing Payload: {Payload}", JsonSerializer.Serialize(payload));

        // Simulate network delay
        await Task.Delay(100);

        return true; // Simulate success
    }
}