using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Text.Json;
using amtemeterai.Api.Config;
using amtemeterai.Api.Data;
using amtemeterai.Api.Models;
using amtemeterai.Api.Dtos;

namespace amtemeterai.Api.Services;

/// <summary>
/// Managed background service that automatically confirms delivery orders
/// based on PGI date + customer region lead time.
/// If PGI date is 12 Aug and lead time is 3 days, auto-receive on 15 Aug.
/// Skips processing if PGI date or lead time is blank/null.
///
/// Schedule and enable/disable state come from the BackgroundJobs table
/// (manageable from the Background Jobs admin page); the legacy
/// DeliveryAutoConfirmOptions values are only a fallback.
/// </summary>
public class DeliveryAutoConfirmService : ManagedBackgroundService
{
    private readonly ILogger<DeliveryAutoConfirmService> _logger;
    private readonly DeliveryAutoConfirmOptions _options;

    public DeliveryAutoConfirmService(
        IServiceScopeFactory scopeFactory,
        IBackgroundJobRegistry registry,
        ILogger<DeliveryAutoConfirmService> logger,
        IOptions<DeliveryAutoConfirmOptions> options)
        : base(scopeFactory, registry, logger)
    {
        _logger = logger;
        _options = options.Value;
    }

    protected override string JobKey => "DeliveryAutoConfirm";
    protected override int FallbackIntervalMinutes => _options.CheckIntervalMinutes > 0 ? _options.CheckIntervalMinutes : 60;

    protected override async Task<JobRunResult> RunOnceAsync(AppDbContext db, CancellationToken stoppingToken)
    {
        _logger.LogInformation("Delivery Auto Confirm cycle starting at: {Timestamp}", DateTime.UtcNow);

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
                d.Type,
                Lines = d.Lines
            })
            .ToListAsync(stoppingToken);

        if (!pendingDeliveries.Any())
        {
            _logger.LogDebug("No pending deliveries found for auto-confirmation.");
            return JobRunResult.Skipped("No pending deliveries found");
        }

        int confirmedCount = 0;
        var details = new System.Text.StringBuilder();

        foreach (var delivery in pendingDeliveries)
        {
            stoppingToken.ThrowIfCancellationRequested();

            try
            {
                // Calculate expected receive date: PGI date + lead time
                var expectedReceiveDate = delivery.PostGoodsIssueDate.Value.AddDays(delivery.LeadTimeDays.Value).Date;

                // Only auto-confirm if today is on or after the expected receive date
                if (today < expectedReceiveDate)
                {
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
                    .FirstOrDefaultAsync(d => d.DeliveryID == delivery.DeliveryID, stoppingToken);

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

                await db.SaveChangesAsync(stoppingToken);

                // 🎯 CALL SAP zrest_doconfirm AFTER DATABASE UPDATE
                // Similar to manual confirmation (UpdateByToken), notify SAP of the delivery confirmation
                _ = Task.Run(async () =>
                {
                    try
                    {
                        using (var scope = _scopeFactory.CreateScope())
                        {
                            var httpClientFactory = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();
                            var sapOptions = scope.ServiceProvider.GetRequiredService<IOptions<SapOptions>>().Value;
                            var loggerFactory = scope.ServiceProvider.GetRequiredService<ILoggerFactory>();
                            var logger = loggerFactory.CreateLogger<DeliveryAutoConfirmService>();

                            logger.LogInformation("SAP zrest_doconfirm call starting for auto-confirmed delivery {DeliveryNumber}", delivery.DeliveryNumber);

                            // Create a clean client instance from the factory
                            var sapClient = httpClientFactory.CreateClient("SapClient");

                            // Build the SAP confirmation payload
                            var dbLines = (fullDelivery.Lines ?? Enumerable.Empty<DeliveryLine>()).ToList();

                            var sapPayload = new SapDeliveryConfirmationPayload
                            {
                                CustomerCode = fullDelivery.Customer?.CustomerCode ?? string.Empty,
                                DeliveryNumber = fullDelivery.DeliveryNumber,
                                ReceiverName = fullDelivery.ReceiverName ?? string.Empty,
                                ReceiverStatus = "1", // Always "1" for auto-confirm (FullyReceived)
                                ReceiverNotes = fullDelivery.ReceiverNotes ?? string.Empty,

                                Lines = dbLines.Select(l =>
                                {
                                    // 🎯 Identify if this row acts as a parent line for any split-batch child lines
                                    var children = dbLines.Where(c => !string.IsNullOrEmpty(c.ParentLineNumber) && c.ParentLineNumber.Trim() == l.DeliveryLineNumber).ToList();
                                    bool isParentLine = children.Any();

                                    // Dynamically roll up all quantities from children if this is a structural parent line
                                    decimal packQty = isParentLine ? children.Sum(c => c.PackQuantity) : l.PackQuantity;
                                    decimal delivered = isParentLine ? children.Sum(c => c.PackQuantityDelivered) : l.PackQuantityDelivered;
                                    decimal returned = isParentLine ? children.Sum(c => c.PackQuantityReturned) : l.PackQuantityReturned;
                                    decimal rejected = isParentLine ? children.Sum(c => c.PackQuantityRejected) : l.PackQuantityRejected;

                                    // Compute unified variance using the non-zero target base
                                    decimal totalActual = delivered + returned + rejected;
                                    decimal rawVariance = totalActual - packQty;
                                    decimal percentCalc = packQty > 0 ? (rawVariance / packQty) * 100 : 0;

                                    return new SapDeliveryLinePayload
                                    {
                                        DeliveryLineNumber = l.DeliveryLineNumber,
                                        DeliveredQuantity = delivered, // 🎯 Sent as structural aggregate to SAP
                                        RejectedQuantity = rejected,
                                        ReturnedQuantity = returned,
                                        LineComment = l.LineComment ?? "",
                                        VariancePercent = Math.Round(percentCalc, 2, MidpointRounding.AwayFromZero)
                                    };
                                }).ToList()
                            };

                            // Use configured SAP base URL
                            if (string.IsNullOrWhiteSpace(sapOptions.BaseUrl))
                            {
                                throw new InvalidOperationException("SAP BaseUrl is not configured. Please check the SapOptions configuration.");
                            }
                            string baseSapUrl = sapOptions.BaseUrl.TrimEnd('/');

                            string sapClientParam = !string.IsNullOrEmpty(sapOptions.Client)
                                ? sapOptions.Client
                                : "250";

                            string absoluteSapUrl = $"{baseSapUrl}/sap/bc/zrest_doconfirm?sap-client={sapClientParam}";

                            // Execute post operation targeting the absolute URL pathway directly
                            var response = await sapClient.PostAsJsonAsync(absoluteSapUrl, sapPayload);

                            if (response.IsSuccessStatusCode)
                            {
                                logger.LogInformation("SAP zrest_doconfirm successful for auto-confirmed delivery {DeliveryNumber}", delivery.DeliveryNumber);

                                // Log success activity
                                using (var dbScope = _scopeFactory.CreateScope())
                                {
                                    var db = dbScope.ServiceProvider.GetRequiredService<AppDbContext>();
                                    var activityLog = new ActivityLog
                                    {
                                        EventType = "DeliveryAutoConfirmSapSync",
                                        ReferenceID = delivery.DeliveryNumber,
                                        Message = $"SAP zrest_doconfirm successful for auto-confirmed delivery {delivery.DeliveryNumber}",
                                        Severity = "Success"
                                    };
                                    db.ActivityLogs.Add(activityLog);
                                    await db.SaveChangesAsync();
                                }
                            }
                            else
                            {
                                string errorResponse = await response.Content.ReadAsStringAsync();
                                logger.LogError("SAP zrest_doconfirm failed for {DeliveryNumber}. Status: {StatusCode}, Error: {Error}",
                                    delivery.DeliveryNumber, response.StatusCode, errorResponse);

                                // Log failure activity
                                using (var dbScope = _scopeFactory.CreateScope())
                                {
                                    var db = dbScope.ServiceProvider.GetRequiredService<AppDbContext>();
                                    var activityLog = new ActivityLog
                                    {
                                        EventType = "DeliveryAutoConfirmSapSyncFailed",
                                        ReferenceID = delivery.DeliveryNumber,
                                        Message = $"SAP zrest_doconfirm failed for auto-confirmed delivery {delivery.DeliveryNumber}. Status: {response.StatusCode}",
                                        Severity = "Error"
                                    };
                                    db.ActivityLogs.Add(activityLog);
                                    await db.SaveChangesAsync();
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Background SAP zrest_doconfirm faulted for auto-confirmed delivery {DeliveryNumber}", delivery.DeliveryNumber);

                        // Log error activity
                        using (var scope = _scopeFactory.CreateScope())
                        {
                            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                            var activityLog = new ActivityLog
                            {
                                EventType = "DeliveryAutoConfirmSapSyncError",
                                ReferenceID = delivery.DeliveryNumber,
                                Message = $"Error during SAP zrest_doconfirm: {ex.Message}",
                                Severity = "Error"
                            };
                            db.ActivityLogs.Add(activityLog);
                            await db.SaveChangesAsync();
                        }
                    }
                });

                confirmedCount++;

                // Log activity
                var activityLogEntry = new ActivityLog
                {
                    EventType = "DeliveryAutoConfirmed",
                    ReferenceID = delivery.DeliveryNumber,
                    Message = $"Delivery {delivery.DeliveryNumber} auto-confirmed. PGI: {delivery.PostGoodsIssueDate.Value:yyyy-MM-dd}, Lead Time: {delivery.LeadTimeDays} days",
                    Severity = "Info"
                };
                db.ActivityLogs.Add(activityLogEntry);
                details.AppendLine($"Auto-confirmed {delivery.DeliveryNumber}");

                _logger.LogInformation("Successfully auto-confirmed delivery {DeliveryNumber}", delivery.DeliveryNumber);

                // 🎯 AUTO-GENERATE INVOICE FOR NON BC DELIVERIES
                // For Non BC delivery orders, immediately invoke the invoice creation API
                // after auto-confirmation is completed
                if (delivery.Type == DeliveryHeader.DeliveryType.NonBC)
                {
                    _logger.LogInformation(
                        "Non BC delivery {DeliveryNumber} auto-confirmed. Triggering automatic invoice creation.",
                        delivery.DeliveryNumber);

                    // Start background task for invoice creation
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            using (var scope = _scopeFactory.CreateScope())
                            {
                                var httpClientFactory = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();
                                var sapOptions = scope.ServiceProvider.GetRequiredService<IOptions<SapOptions>>().Value;
                                var loggerFactory = scope.ServiceProvider.GetRequiredService<ILoggerFactory>();
                                var logger = loggerFactory.CreateLogger<DeliveryAutoConfirmService>();

                                logger.LogInformation("Background invoice creation starting for Non BC delivery {DeliveryNumber}", delivery.DeliveryNumber);

                                // Use a clean client instance to avoid base address issues
                                var sapClient = httpClientFactory.CreateClient("SapClient");
                                var sapUrl = $"{sapOptions.BaseUrl.TrimEnd('/')}/sap/bc/zr_createinv?sap-client={sapOptions.Client}";

                                var sapRequest = new SapBillingRequestDto
                                {
                                    DeliveryNumber = delivery.DeliveryNumber
                                };

                                // Retry loop for SAP invoice creation
                                int maxRetries = 3;
                                int delayMs = 1500;
                                SapBillingResponseDto sapBillingData = null;

                                for (int attempt = 1; attempt <= maxRetries; attempt++)
                                {
                                    try
                                    {
                                        var sapResponse = await sapClient.PostAsJsonAsync(sapUrl, sapRequest);

                                        if (sapResponse.IsSuccessStatusCode)
                                        {
                                            var candidateData = await sapResponse.Content.ReadFromJsonAsync<SapBillingResponseDto>();

                                            if (candidateData != null &&
                                                !string.IsNullOrEmpty(candidateData.SapInvoiceNumber) &&
                                                candidateData.AmountLocal > 0)
                                            {
                                                sapBillingData = candidateData;
                                                logger.LogInformation(
                                                    "SAP billing successful on attempt {Attempt}. Invoice {InvoiceNumber}",
                                                    attempt,
                                                    sapBillingData.SapInvoiceNumber);
                                                break;
                                            }
                                        }

                                        if (attempt < maxRetries)
                                        {
                                            await Task.Delay(delayMs);
                                        }
                                    }
                                    catch (Exception ex)
                                    {
                                        logger.LogWarning(ex,
                                            "Exception during SAP billing attempt {Attempt}/{MaxRetries}",
                                            attempt,
                                            maxRetries);

                                        if (attempt < maxRetries)
                                        {
                                            await Task.Delay(delayMs);
                                        }
                                    }
                                }

                                if (sapBillingData != null)
                                {
                                    // Create a new scope for database operations
                                    using (var dbScope = _scopeFactory.CreateScope())
                                    {
                                        var db = dbScope.ServiceProvider.GetRequiredService<AppDbContext>();

                                        // Reload the delivery to get fresh data
                                        var deliveryEntity = await db.DeliveryHeaders
                                            .Include(d => d.Customer)
                                            .Include(d => d.Lines)
                                            .FirstOrDefaultAsync(d => d.DeliveryNumber == delivery.DeliveryNumber);

                                        if (deliveryEntity != null)
                                        {
                                            // Check if an active invoice already exists
                                            var existingInvoice = await db.Invoices
                                                .FirstOrDefaultAsync(i => i.DeliveryHeaderId == deliveryEntity.DeliveryID
                                                                       && i.Status != Invoice.InvoiceStatus.Canceled
                                                                       && i.Status != Invoice.InvoiceStatus.Voided);

                                            if (existingInvoice == null)
                                            {
                                                // Create invoice record
                                                var invoice = new Invoice
                                                {
                                                    InvoiceNumber = sapBillingData.SapInvoiceNumber,
                                                    CustomerNumber = sapBillingData.CustomerNumber,
#pragma warning disable CS0618 // Type or member is obsolete
                                                    InvoiceAmount = sapBillingData.AmountLocal,
#pragma warning restore CS0618
                                                    AmountForeign = sapBillingData.AmountForeign,
                                                    AmountLocal = sapBillingData.AmountLocal,
                                                    BaseAmountForeign = sapBillingData.AmountForeign,
                                                    BaseAmountLocal = sapBillingData.AmountLocal,
                                                    DownPayAmountForeign = 0,
                                                    DownPayAmountLocal = 0,
                                                    Currency = sapBillingData.Currency,
                                                    ComplianceCategory = sapBillingData.ComplianceCategory,
                                                    InvoicedDate = sapBillingData.BillingDate,
                                                    Status = Invoice.InvoiceStatus.Draft,
                                                    DeliveryHeaderId = deliveryEntity.DeliveryID,
                                                    StampingStatus = Invoice.InvoiceStampingStatus.NotStamped
                                                };

                                                // Update delivery billing status
                                                deliveryEntity.Invoiced = true;
                                                if (deliveryEntity.BillingStatus == DeliveryHeader.DeliveryBillingStatus.Unbilled ||
                                                    deliveryEntity.BillingStatus == DeliveryHeader.DeliveryBillingStatus.ReadyToRebill)
                                                {
                                                    deliveryEntity.BillingStatus = DeliveryHeader.DeliveryBillingStatus.Billed;
                                                }

                                                db.Invoices.Add(invoice);
                                                await db.SaveChangesAsync();

                                                logger.LogInformation(
                                                    "Successfully created invoice {InvoiceNumber} for Non BC delivery {DeliveryNumber}",
                                                    sapBillingData.SapInvoiceNumber,
                                                    delivery.DeliveryNumber);

                                                // Log activity
                                                var activityLog = new ActivityLog
                                                {
                                                    EventType = "NonBcInvoiceAutoCreated",
                                                    ReferenceID = delivery.DeliveryNumber,
                                                    Message = $"Invoice {sapBillingData.SapInvoiceNumber} automatically created for Non BC delivery {delivery.DeliveryNumber}. Foreign: {sapBillingData.AmountForeign} {sapBillingData.Currency}, Local: {sapBillingData.AmountLocal}",
                                                    Severity = "Success"
                                                };
                                                db.ActivityLogs.Add(activityLog);
                                                await db.SaveChangesAsync();
                                            }
                                            else
                                            {
                                                logger.LogInformation(
                                                    "Invoice {InvoiceNumber} already exists for Non BC delivery {DeliveryNumber}",
                                                    existingInvoice.InvoiceNumber,
                                                    delivery.DeliveryNumber);
                                            }
                                        }
                                    }
                                }
                                else
                                {
                                    logger.LogError(
                                        "Failed to create SAP invoice for Non BC delivery {DeliveryNumber} after {MaxRetries} attempts",
                                        delivery.DeliveryNumber,
                                        maxRetries);

                                    // Log failure activity
                                    using (var dbScope = _scopeFactory.CreateScope())
                                    {
                                        var db = dbScope.ServiceProvider.GetRequiredService<AppDbContext>();
                                        var activityLog = new ActivityLog
                                        {
                                            EventType = "NonBcInvoiceAutoCreationFailed",
                                            ReferenceID = delivery.DeliveryNumber,
                                            Message = $"Failed to automatically create invoice for Non BC delivery {delivery.DeliveryNumber} after {maxRetries} attempts",
                                            Severity = "Error"
                                        };
                                        db.ActivityLogs.Add(activityLog);
                                        await db.SaveChangesAsync();
                                    }
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Background invoice creation faulted for Non BC delivery {DeliveryNumber}", delivery.DeliveryNumber);
                        }
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing auto-confirm for delivery {DeliveryNumber}", delivery.DeliveryNumber);
            }
        }

        await db.SaveChangesAsync();

        _logger.LogInformation("Delivery Auto Confirm cycle completed at: {Timestamp}. Confirmed: {Count}", DateTime.UtcNow, confirmedCount);

        return confirmedCount > 0
            ? JobRunResult.Success($"Auto-confirmed {confirmedCount} delivery(ies)")
            : JobRunResult.Skipped("No deliveries due for auto-confirmation");
    }
}
