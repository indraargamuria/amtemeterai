using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using amtemeterai.Api.Config;
using amtemeterai.Api.Data;
using amtemeterai.Api.Models;
using amtemeterai.Api.Dtos;
using System.Text.Json;

namespace amtemeterai.Api.Services;

/// <summary>
/// Service for syncing BC invoices from SAP.
/// Extracted from DeliveriesController to allow background job processing.
/// </summary>
public class BcInvoiceSyncService
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly SapOptions _sapOptions;
    private readonly ILogger<BcInvoiceSyncService> _logger;

    public BcInvoiceSyncService(
        AppDbContext db,
        IHttpClientFactory httpClientFactory,
        IOptions<SapOptions> sapOptions,
        ILogger<BcInvoiceSyncService> logger)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
        _sapOptions = sapOptions.Value;
        _logger = logger;
    }

    /// <summary>
    /// Create SAP invoice for a delivery by delivery number.
    /// This is extracted from DeliveriesController.CreateSapInvoice for background processing.
    /// </summary>
    public async Task<DeliverySettlementResponseDto?> CreateSapInvoiceAsync(string deliveryNumber)
    {
        _logger.LogInformation("Starting SAP invoice creation for delivery {DeliveryNumber}", deliveryNumber);

        try
        {
            // === Step 1: Validation - Check if delivery exists ===
            var delivery = await _db.DeliveryHeaders
                .Include(d => d.Customer)
                .Include(d => d.Lines)
                .FirstOrDefaultAsync(d => d.DeliveryNumber == deliveryNumber);

            if (delivery == null)
            {
                _logger.LogWarning("Delivery {DeliveryNumber} not found.", deliveryNumber);
                return null;
            }

            // === Step 1.5: Business Interlocking Rules ===
            // Guard: Reject if delivery is in BillingBlocked state
            if (delivery.BillingStatus == DeliveryHeader.DeliveryBillingStatus.BillingBlocked)
            {
                _logger.LogWarning(
                    "Invoice creation rejected for delivery {DeliveryNumber}: Billing is barred while delivery remains blocked.",
                    deliveryNumber);
                return null;
            }

            // Guard: Reject if delivery is already Billed (duplicate invoicing prevention)
            if (delivery.BillingStatus == DeliveryHeader.DeliveryBillingStatus.Billed)
            {
                _logger.LogWarning(
                    "Invoice creation rejected for delivery {DeliveryNumber}: Duplicate invoicing attempt - delivery already billed.",
                    deliveryNumber);
                return null;
            }

            // === Step 2: Active Invoice Idempotency Check - Local Database Invoice Lookup ===
            var activeInvoice = await _db.Invoices
                .FirstOrDefaultAsync(i => i.DeliveryHeaderId == delivery.DeliveryID &&
                                       i.Status != Invoice.InvoiceStatus.Canceled &&
                                       i.Status != Invoice.InvoiceStatus.Voided);

            if (activeInvoice != null)
            {
                // Case B: Re-sync / Active Record Already Exists
                _logger.LogInformation(
                    "Active invoice {InvoiceNumber} already exists for delivery {DeliveryNumber}. Returning existing record.",
                    activeInvoice.InvoiceNumber,
                    deliveryNumber);

                return new DeliverySettlementResponseDto
                {
                    Success = true,
                    Message = "Invoice already created previously",
                    InvoiceNumber = activeInvoice.InvoiceNumber,
                    InvoiceAmount = activeInvoice.AmountLocal,
                    BillingDate = activeInvoice.InvoicedDate,
                    DeliveryNumber = deliveryNumber
                };
            }

            // === Step 3: Outbound Request - Call SAP billing endpoint with Retry Policy ===
            _logger.LogInformation("Calling SAP billing endpoint for delivery {DeliveryNumber}", deliveryNumber);

            var sapRequest = new SapBillingRequestDto
            {
                DeliveryNumber = deliveryNumber
            };

            // Retry loop to handle SAP DB commit latency
            int maxRetries = 3;
            int delayMs = 1500;
            SapBillingResponseDto sapBillingData = null;

            for (int attempt = 1; attempt <= maxRetries; attempt++)
            {
                _logger.LogInformation(
                    "SAP billing attempt {Attempt}/{MaxRetries} for delivery {DeliveryNumber}",
                    attempt,
                    maxRetries,
                    deliveryNumber);

                try
                {
                    // Use a clean client instance to avoid base address issues
                    var sapClient = _httpClientFactory.CreateClient("SapClient");
                    var sapUrl = $"{_sapOptions.BaseUrl.TrimEnd('/')}/sap/bc/zr_createinv?sap-client={_sapOptions.Client}";

                    var sapResponse = await sapClient.PostAsJsonAsync(sapUrl, sapRequest);

                    // Check if SAP response indicates success
                    if (sapResponse.IsSuccessStatusCode)
                    {
                        var candidateData = await sapResponse.Content.ReadFromJsonAsync<SapBillingResponseDto>();

                        // Validate that we got complete data back
                        if (candidateData != null &&
                            !string.IsNullOrEmpty(candidateData.SapInvoiceNumber) &&
                            candidateData.AmountLocal > 0)
                        {
                            sapBillingData = candidateData;
                            _logger.LogInformation(
                                "SAP billing successful on attempt {Attempt}. Invoice {SapInvoiceNumber} - Foreign: {AmountForeign} {Currency}, Local: {AmountLocal}",
                                attempt,
                                sapBillingData.SapInvoiceNumber,
                                sapBillingData.AmountForeign,
                                sapBillingData.Currency,
                                sapBillingData.AmountLocal);
                            break; // Success, exit retry loop
                        }
                        else
                        {
                            _logger.LogWarning(
                                "SAP billing attempt {Attempt} returned incomplete data. SAP invoice may not be committed yet.",
                                attempt);
                        }
                    }
                    else
                    {
                        var errorContent = await sapResponse.Content.ReadAsStringAsync();
                        _logger.LogWarning(
                            "SAP billing request failed on attempt {Attempt} with status {StatusCode}: {ErrorContent}",
                            attempt,
                            sapResponse.StatusCode,
                            errorContent);
                    }

                    // If this is not the last attempt, wait before retrying
                    if (attempt < maxRetries)
                    {
                        _logger.LogInformation("Waiting {DelayMs}ms before next SAP billing attempt...", delayMs);
                        await Task.Delay(delayMs);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex,
                        "Exception during SAP billing attempt {Attempt}/{MaxRetries}: {Message}",
                        attempt,
                        maxRetries,
                        ex.Message);

                    if (attempt < maxRetries)
                    {
                        await Task.Delay(delayMs);
                    }
                }
            }

            // === Step 4: Validate SAP Response After All Retries ===
            if (sapBillingData == null)
            {
                _logger.LogError(
                    "SAP billing failed after {MaxRetries} attempts for delivery {DeliveryNumber}",
                    maxRetries,
                    deliveryNumber);

                return null;
            }

            // === Step 4.5: Handle Duplicate Invoice Number Scenario ===
            var existingInvoice = await _db.Invoices
                .FirstOrDefaultAsync(i => i.InvoiceNumber == sapBillingData.SapInvoiceNumber);

            if (existingInvoice != null)
            {
                bool isVoidedOrCanceled = existingInvoice.Status == Invoice.InvoiceStatus.Voided ||
                                           existingInvoice.Status == Invoice.InvoiceStatus.Canceled;

                if (isVoidedOrCanceled)
                {
                    _logger.LogWarning(
                        "Sync blocked for Delivery {DeliveryNumber}: SAP returned voided invoice {InvoiceNumber}. New billing must be generated in SAP first.",
                        deliveryNumber,
                        sapBillingData.SapInvoiceNumber);

                    return null;
                }

                _logger.LogInformation(
                    "Invoice already synced for Delivery {DeliveryNumber}: Invoice {InvoiceNumber} exists with active status.",
                    deliveryNumber,
                    sapBillingData.SapInvoiceNumber);

                return new DeliverySettlementResponseDto
                {
                    Success = true,
                    Message = "Invoice already synced.",
                    InvoiceNumber = existingInvoice.InvoiceNumber,
                    InvoiceAmount = existingInvoice.AmountLocal,
                    BillingDate = existingInvoice.InvoicedDate,
                    DeliveryNumber = deliveryNumber
                };
            }

            // === Step 5: Database Updates (Transactional) ===
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                // Mark delivery as invoiced
                delivery.Invoiced = true;

                // Advance billing status to Billed when syncing from Unbilled or ReadyToRebill
                if (delivery.BillingStatus == DeliveryHeader.DeliveryBillingStatus.Unbilled ||
                    delivery.BillingStatus == DeliveryHeader.DeliveryBillingStatus.ReadyToRebill)
                {
                    delivery.BillingStatus = DeliveryHeader.DeliveryBillingStatus.Billed;

                    _logger.LogInformation(
                        "Delivery {DeliveryNumber} billing status advanced to Billed",
                        deliveryNumber);
                }

                // Create invoice record with dual-currency support
                // New logic: Nett Amount = BaseAmount + DownPayAmount
                // SAP sends: amountLocal as base, downPayment as additional amount
                var downPayLocal = sapBillingData.DownPayment;
                var downPayForeign = 0m; // Down payment is currently based on local currency only

                var invoice = new Invoice
                {
                    InvoiceNumber = sapBillingData.SapInvoiceNumber,
                    CustomerNumber = sapBillingData.CustomerNumber,
                    InvoiceAmount = sapBillingData.AmountLocal + downPayLocal, // Legacy field for compatibility
                    AmountForeign = sapBillingData.AmountForeign + downPayForeign,
                    AmountLocal = sapBillingData.AmountLocal + downPayLocal,
                    BaseAmountForeign = sapBillingData.AmountForeign,
                    BaseAmountLocal = sapBillingData.AmountLocal,
                    DownPayAmountForeign = downPayForeign,
                    DownPayAmountLocal = downPayLocal,
                    Currency = sapBillingData.Currency,
                    ComplianceCategory = sapBillingData.ComplianceCategory,
                    InvoicedDate = sapBillingData.BillingDate,
                    Status = Invoice.InvoiceStatus.Draft,
                    DeliveryHeaderId = delivery.DeliveryID,
                    StampingStatus = Invoice.InvoiceStampingStatus.NotStamped
                };

                _db.Invoices.Add(invoice);
                await _db.SaveChangesAsync();

                // Commit transaction
                await transaction.CommitAsync();

                _logger.LogInformation(
                    "SAP invoice creation completed successfully for delivery {DeliveryNumber}",
                    deliveryNumber);

                // === Step 6: Return Values ===
                return new DeliverySettlementResponseDto
                {
                    Success = true,
                    Message = sapBillingData.Message,
                    InvoiceNumber = sapBillingData.SapInvoiceNumber,
                    InvoiceAmount = sapBillingData.AmountLocal,
                    BillingDate = sapBillingData.BillingDate,
                    DeliveryNumber = deliveryNumber
                };
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Transaction rolled back during SAP invoice creation");
                throw;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SAP invoice creation failed for delivery {DeliveryNumber}", deliveryNumber);
            return null;
        }
    }
}
