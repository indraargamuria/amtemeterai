using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using amtemeterai.Api.Data;
using amtemeterai.Api.Dtos;
using amtemeterai.Api.Models;
using amtemeterai.Api.Services;
using System.Text.Json;

namespace amtemeterai.Api.Controllers;

/// <summary>
/// Test Controller for development and testing purposes
/// Contains endpoints for testing complex workflows
/// </summary>
[ApiController]
[Route("api/test")]
[Authorize(Roles = "sysadmin")]
public class TestController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly IStorageService _storageService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<TestController> _logger;
    private readonly string _baseApiUrl;

    public TestController(
        AppDbContext db,
        IConfiguration configuration,
        IStorageService storageService,
        IHttpClientFactory httpClientFactory,
        ILogger<TestController> _logger)
    {
        _db = db;
        _configuration = configuration;
        _storageService = storageService;
        _httpClientFactory = httpClientFactory;
        this._logger = _logger;
        _baseApiUrl = configuration["App:ApiBaseUrl"] ?? "http://localhost:8080";
    }

    /// <summary>
    /// Orchestrate the complete delivery settlement processing loop
    /// Step A: Call SAP simulation to get invoice details
    /// Step B: Parse and upload dummy PDF as delivery printout
    /// Step C: Create invoice record and mark delivery as invoiced
    /// </summary>
    [HttpPost("deliveries/{deliveryNumber}/process-settlement")]
    public async Task<ActionResult<DeliverySettlementResponseDto>> ProcessDeliverySettlement(string deliveryNumber)
    {
        if (string.IsNullOrWhiteSpace(deliveryNumber))
        {
            return BadRequest("Delivery number is required.");
        }

        _logger.LogInformation(
            "Starting settlement processing for delivery {DeliveryNumber}",
            deliveryNumber);

        try
        {
            // Fetch the delivery with all related data
            var delivery = await _db.DeliveryHeaders
                .Include(d => d.Customer)
                .Include(d => d.Lines)
                .FirstOrDefaultAsync(d => d.DeliveryNumber == deliveryNumber);

            if (delivery == null)
            {
                return NotFound($"Delivery {deliveryNumber} not found.");
            }

            if (delivery.Invoiced)
            {
                return BadRequest($"Delivery {deliveryNumber} is already invoiced.");
            }

            // === STEP A: Call SAP Simulation to get invoice details ===
            _logger.LogInformation(
                "Step A: Calling SAP simulation for delivery {DeliveryNumber}",
                deliveryNumber);

            // Create the SAP billing request
            var sapRequest = new SapBillingRequestDto
            {
                DeliveryNumber = deliveryNumber
            };

            // Call the SAP simulation endpoint via HTTP
            var sapClient = _httpClientFactory.CreateClient();
            var sapUrl = $"{_baseApiUrl}/api/sap-sim/billing";

            // Get the authorization header from current request
            var authHeader = HttpContext.Request.Headers["Authorization"].ToString();
            if (!string.IsNullOrEmpty(authHeader))
            {
                sapClient.DefaultRequestHeaders.Add("Authorization", authHeader);
            }

            var sapResponse = await sapClient.PostAsJsonAsync(sapUrl, sapRequest);
            if (!sapResponse.IsSuccessStatusCode)
            {
                var errorContent = await sapResponse.Content.ReadAsStringAsync();
                return StatusCode(
                    (int)sapResponse.StatusCode,
                    $"SAP simulation failed: {errorContent}");
            }

            var sapBillingData = await sapResponse.Content.ReadFromJsonAsync<SapBillingResponseDto>();
            if (sapBillingData == null)
            {
                return StatusCode(500, "Failed to deserialize SAP billing response.");
            }

            _logger.LogInformation(
                "Step A Complete: Received SAP invoice {SapInvoiceNumber} - Foreign: {AmountForeign} {Currency}, Local: {AmountLocal}",
                sapBillingData.SapInvoiceNumber,
                sapBillingData.AmountForeign,
                sapBillingData.Currency,
                sapBillingData.AmountLocal);

            // === STEP B: Upload dummy PDF as delivery printout ===
            _logger.LogInformation(
                "Step B: Uploading dummy PDF as delivery printout for {DeliveryNumber}",
                deliveryNumber);

            Document? printoutDocument = null;

            // Try to read from local fixtures directory
            string fixturePath = Path.Combine(
                Directory.GetCurrentDirectory(),
                "tests",
                "fixtures",
                "dummy_do.pdf");

            // If fixture doesn't exist, create a minimal dummy PDF content
            byte[] pdfContent;
            if (System.IO.File.Exists(fixturePath))
            {
                _logger.LogInformation("Using fixture file: {FixturePath}", fixturePath);
                pdfContent = await System.IO.File.ReadAllBytesAsync(fixturePath);
            }
            else
            {
                _logger.LogWarning(
                    "Fixture file not found at {FixturePath}, generating minimal PDF content",
                    fixturePath);

                // Generate minimal PDF content (valid PDF structure)
                pdfContent = GenerateMinimalPdf(deliveryNumber);
            }

            // Upload via the new printout endpoint logic
            string fileExtension = ".pdf";
            string storageKey = $"deliveries/{delivery.DeliveryID}/printouts/{Guid.NewGuid()}{fileExtension}";

            using (var pdfStream = new MemoryStream(pdfContent))
            {
                await _storageService.UploadFileAsync(storageKey, pdfStream, "application/pdf");
            }

            printoutDocument = new Document
            {
                DeliveryID = delivery.DeliveryID,
                InvoiceID = null,
                StorageKey = storageKey,
                FileName = $"DO_{deliveryNumber}.pdf",
                ContentType = "application/pdf",
                Type = DocumentType.DeliveryPrintOut,
                UploadedAt = DateTime.UtcNow
            };

            _db.Documents.Add(printoutDocument);
            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Step B Complete: Uploaded printout document {DocumentId}",
                printoutDocument.DocumentID);

            // === STEP C: Transactional database updates ===
            _logger.LogInformation(
                "Step C: Creating invoice record and marking delivery as invoiced");

            // Begin transaction for atomic updates
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                // Mark delivery as invoiced
                delivery.Invoiced = true;

                // Create invoice record from SAP billing data
                var invoice = new Invoice
                {
                    InvoiceNumber = sapBillingData.SapInvoiceNumber,
                    CustomerNumber = sapBillingData.CustomerNumber,
                    // Use local amount for legacy field
                    InvoiceAmount = sapBillingData.AmountLocal,
                    // New dual-currency fields
                    AmountForeign = sapBillingData.AmountForeign,
                    AmountLocal = sapBillingData.AmountLocal,
                    Currency = sapBillingData.Currency,
                    ComplianceCategory = sapBillingData.ComplianceCategory,
                    InvoicedDate = sapBillingData.BillingDate,
                    Status = Invoice.InvoiceStatus.Draft,
                    DeliveryHeaderId = delivery.DeliveryID,
                    StampingStatus = Invoice.InvoiceStampingStatus.NotStamped
                };

                _db.Invoices.Add(invoice);
                await _db.SaveChangesAsync();

                // Link the printout document to the invoice
                printoutDocument.InvoiceID = invoice.InvoiceID;
                await _db.SaveChangesAsync();

                // Log the activity
                var activityLog = new ActivityLog
                {
                    EventType = "DeliverySettlementCompleted",
                    ReferenceID = deliveryNumber,
                    Message = $"Delivery settlement completed. Invoice {sapBillingData.SapInvoiceNumber} created. " +
                              $"Foreign: {sapBillingData.AmountForeign} {sapBillingData.Currency}, Local: {sapBillingData.AmountLocal}",
                    Severity = "Success"
                };
                _db.ActivityLogs.Add(activityLog);

                await _db.SaveChangesAsync();

                // Commit transaction
                await transaction.CommitAsync();

                _logger.LogInformation(
                    "Step C Complete: Settlement transaction committed. Invoice ID: {InvoiceId}",
                    invoice.InvoiceID);

                var downloadUrl = $"{_baseApiUrl.TrimEnd('/')}/api/deliveries/files/download?key={Uri.EscapeDataString(storageKey)}";

                return Ok(new DeliverySettlementResponseDto
                {
                    Success = true,
                    Message = $"Settlement completed successfully. Invoice {sapBillingData.SapInvoiceNumber} created.",
                    InvoiceNumber = sapBillingData.SapInvoiceNumber,
                    InvoiceAmount = sapBillingData.AmountLocal,
                    BillingDate = sapBillingData.BillingDate,
                    DocumentId = printoutDocument.DocumentID,
                    StorageKey = storageKey,
                    DownloadUrl = downloadUrl,
                    DeliveryNumber = deliveryNumber
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Transaction rolled back during settlement processing");
                throw;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Settlement processing failed for delivery {DeliveryNumber}", deliveryNumber);

            // Log the failure
            var failureLog = new ActivityLog
            {
                EventType = "DeliverySettlementFailed",
                ReferenceID = deliveryNumber,
                Message = $"Settlement failed: {ex.Message}",
                Severity = "Error"
            };
            _db.ActivityLogs.Add(failureLog);
            await _db.SaveChangesAsync();

            return StatusCode(500, $"Settlement processing failed: {ex.Message}");
        }
    }

    /// <summary>
    /// Generates a minimal valid PDF document for testing purposes
    /// </summary>
    private byte[] GenerateMinimalPdf(string deliveryNumber)
    {
        // Minimal valid PDF structure
        string pdfContent = $"%PDF-1.4\n" +
            $"1 0 obj\n" +
            $"<<\n" +
            $"/Type /Catalog\n" +
            $"/Pages 2 0 R\n" +
            $">>\n" +
            $"endobj\n" +
            $"2 0 obj\n" +
            $"<<\n" +
            $"/Type /Pages\n" +
            $"/Kids [3 0 R]\n" +
            $"/Count 1\n" +
            $">>\n" +
            $"endobj\n" +
            $"3 0 obj\n" +
            $"<<\n" +
            $"/Type /Page\n" +
            $"/Parent 2 0 R\n" +
            $"/MediaBox [0 0 612 792]\n" +
            $"/Contents 4 0 R\n" +
            $"/Resources << /Font << /F1 5 0 R >> >>\n" +
            $">>\n" +
            $"endobj\n" +
            $"4 0 obj\n" +
            $"<<\n" +
            $"/Length 44\n" +
            $">>\n" +
            $"stream\n" +
            $"BT\n/F1 12 Tf 100 700 Td (Delivery Order: {deliveryNumber}) Tj\nET\n" +
            $"endstream\n" +
            $"endobj\n" +
            $"5 0 obj\n" +
            $"<<\n" +
            $"/Type /Font\n" +
            $"/Subtype /Type1\n" +
            $"/BaseFont /Helvetica\n" +
            $">>\n" +
            $"endobj\n" +
            $"xref\n" +
            $"0 6\n" +
            $"0000000000 65535 f\n" +
            $"0000000009 00000 n\n" +
            $"0000000058 00000 n\n" +
            $"0000000115 00000 n\n" +
            $"0000000274 00000 n\n" +
            $"0000000397 00000 n\n" +
            $"trailer\n" +
            $"<<\n" +
            $"/Size 6\n" +
            $"/Root 1 0 R\n" +
            $">>\n" +
            $"startxref\n" +
            $"486\n" +
            $"%%EOF\n";

        return System.Text.Encoding.UTF8.GetBytes(pdfContent);
    }

    /// <summary>
    /// Get list of available test deliveries (not yet invoiced)
    /// </summary>
    [HttpGet("deliveries/available-for-settlement")]
    public async Task<ActionResult<IEnumerable<object>>> GetAvailableDeliveriesForSettlement()
    {
        var deliveries = await _db.DeliveryHeaders
            .Include(d => d.Customer)
            .Where(d => !d.Invoiced && d.Status == DeliveryHeader.ReceiverStatus.FullyReceived)
            .OrderByDescending(d => d.DeliveryDate)
            .Select(d => new
            {
                d.DeliveryID,
                d.DeliveryNumber,
                d.DeliveryDate,
                CustomerCode = d.Customer != null ? d.Customer.CustomerCode : "UNKNOWN",
                CustomerName = d.Customer != null ? d.Customer.CustomerName : "Unknown",
                d.Plant,
                LineCount = d.Lines != null ? d.Lines.Count : 0
            })
            .ToListAsync();

        return Ok(deliveries);
    }
}
