using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using amtemeterai.Api.Config;
using amtemeterai.Api.Data;
using amtemeterai.Api.Dtos;
using amtemeterai.Api.Models;
using amtemeterai.Api.Services;
using Microsoft.Extensions.Options;
using System.Text.Json;
using System.Text;
using System.IO;

namespace amtemeterai.Api.Controllers;

[ApiController]
[Route("api/invoices")]
[Authorize(Policy = PermissionKeys.InvoiceRead)]
public class InvoicesController : ControllerBase
{
    // Valid compliance categories accepted by the invoice creation API.
    // SAP sync produces "BC" / "NonBC"; standalone invoices may also use "OTHER".
    private static readonly string[] ValidComplianceCategories = ["BC", "NonBC", "OTHER"];

    private readonly AppDbContext _db;
    private readonly AppOptions _appOptions;
    private readonly IStorageService _storageService;
    private readonly ILogger<InvoicesController> _logger;
    private readonly IPeriuriPdsService _periuriPdsService;
    private readonly IPeruriOnPremiseStampService? _peruriOnPremiseStampService;
    private readonly IPdfAnchorService _pdfAnchorService;

    public InvoicesController(
        AppDbContext db,
        IOptions<AppOptions> appOptions,
        IStorageService storageService,
        ILogger<InvoicesController> logger,
        IPeriuriPdsService periuriPdsService,
        IPdfAnchorService pdfAnchorService,
        IPeruriOnPremiseStampService? peruriOnPremiseStampService = null)
    {
        _db = db;
        _appOptions = appOptions.Value;
        _storageService = storageService;
        _logger = logger;
        _periuriPdsService = periuriPdsService;
        _pdfAnchorService = pdfAnchorService;
        _peruriOnPremiseStampService = peruriOnPremiseStampService;
    }

    [HttpPost("{id:int}/stamp")]
    [Authorize(Policy = PermissionKeys.InvoiceSync)]
    public async Task<IActionResult> StampInvoice(int id)
    {
        var invoice = await _db.Invoices
            .Include(i => i.DeliveryHeader)
            .FirstOrDefaultAsync(i => i.InvoiceID == id);

        if (invoice == null)
            return NotFound($"Invoice with ID {id} not found.");

        if (invoice.StampingStatus == Invoice.InvoiceStampingStatus.Stamped)
            return BadRequest($"Invoice {invoice.InvoiceNumber} is already stamped.");

        // Get the latest invoice printout document
        var printoutDocument = await _db.Documents
            .Where(d => d.InvoiceID == invoice.InvoiceID && d.Type == DocumentType.InvoicePrintOut)
            .OrderByDescending(d => d.UploadedAt)
            .FirstOrDefaultAsync();

        if (printoutDocument == null)
            return BadRequest($"No printout document found for invoice {invoice.InvoiceNumber}. Please upload a printout first.");

        try
        {
            // Update stamping status to pending using corrected enum type reference
            invoice.StampingStatus = Invoice.InvoiceStampingStatus.Pending;
            await _db.SaveChangesAsync();

            // Download the PDF from MinIO
            using var pdfStream = await _storageService.GetFileStreamAsync(printoutDocument.StorageKey);
            using var memoryStream = new MemoryStream();
            await pdfStream.CopyToAsync(memoryStream);
            byte[] pdfBytes = memoryStream.ToArray();

            // Call Peruri PDS API for stamping
            var customerName = invoice.DeliveryHeader?.Customer?.CustomerName ?? "Unknown";
            var stampingResult = await _periuriPdsService.StampPdfAsync(
                pdfBytes,
                invoice.InvoiceNumber,
                customerName);

            if (!stampingResult.Success)
            {
                invoice.StampingStatus = Invoice.InvoiceStampingStatus.Failed;
                invoice.Status = Invoice.InvoiceStatus.SyncFailed;
                await _db.SaveChangesAsync();

                _logger.LogError(
                    "Stamping failed for invoice {InvoiceNumber}: {Error}",
                    invoice.InvoiceNumber,
                    stampingResult.ErrorMessage);

                return StatusCode(500, $"Stamping failed: {stampingResult.ErrorMessage}");
            }

            // Upload the stamped PDF back to MinIO
            string stampedStorageKey = $"invoices/{invoice.InvoiceID}/stamped/{Guid.NewGuid()}_stamped.pdf";
            using var stampedStream = new MemoryStream(pdfBytes); // In real implementation, this would be the stamped PDF from Peruri
            await _storageService.UploadFileAsync(stampedStorageKey, stampedStream, "application/pdf");

            // Create document record for stamped PDF
            var stampedDocument = new Document
            {
                InvoiceID = invoice.InvoiceID,
                StorageKey = stampedStorageKey,
                FileName = $"{invoice.InvoiceNumber}_stamped.pdf",
                ContentType = "application/pdf",
                Type = DocumentType.InvoicePrintOut,
                UploadedAt = DateTime.UtcNow
            };

            _db.Documents.Add(stampedDocument);

            // Update invoice with stamping results
            invoice.SerialNumber = stampingResult.SerialNumber;
            invoice.StampingStatus = Invoice.InvoiceStampingStatus.Stamped;
            invoice.StampedDocumentId = stampedDocument.DocumentID;
            invoice.Status = Invoice.InvoiceStatus.SyncedToSap;

            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Successfully stamped invoice {InvoiceNumber} with serial number {SerialNumber}",
                invoice.InvoiceNumber,
                stampingResult.SerialNumber);

            var baseApiUrl = _appOptions.ApiBaseUrl ?? "http://localhost:8080";

            return Ok(new
            {
                invoiceId = invoice.InvoiceID,
                invoiceNumber = invoice.InvoiceNumber,
                serialNumber = stampingResult.SerialNumber,
                status = "Stamped",
                stampedDocumentUrl = $"{baseApiUrl.TrimEnd('/')}/api/deliveries/files/download?key={Uri.EscapeDataString(stampedStorageKey)}"
            });
        }
        catch (Exception ex)
        {
            invoice.StampingStatus = Invoice.InvoiceStampingStatus.Failed;
            invoice.Status = Invoice.InvoiceStatus.SyncFailed;
            await _db.SaveChangesAsync();

            _logger.LogError(ex, "Error stamping invoice {InvoiceId}", id);
            return StatusCode(500, $"Internal error during stamping: {ex.Message}");
        }
    }

    /// <summary>
    /// Stamp invoice by SAP invoice number (preferred method for SAP integration)
    /// Uses on-premise Peruri stamping flow if configured
    [HttpPost("by-sap-number/{invoiceNumber}/stamp")]
    [Authorize(Policy = PermissionKeys.InvoiceSync)]
    public async Task<IActionResult> StampInvoiceByNumber(string invoiceNumber)
    {
        if (string.IsNullOrWhiteSpace(invoiceNumber))
        {
            return BadRequest("Invoice number is required.");
        }

        var invoice = await _db.Invoices
            .Include(i => i.DeliveryHeader)
            .ThenInclude(d => d!.Customer)
            .FirstOrDefaultAsync(i => i.InvoiceNumber == invoiceNumber);

        if (invoice == null)
            return NotFound($"Invoice with number {invoiceNumber} not found.");

        if (invoice.StampingStatus == Invoice.InvoiceStampingStatus.Stamped)
            return BadRequest($"Invoice {invoiceNumber} is already stamped.");

        // Get the latest invoice printout document
        var printoutDocument = await _db.Documents
            .Where(d => d.InvoiceID == invoice.InvoiceID && d.Type == DocumentType.InvoicePrintOut)
            .OrderByDescending(d => d.UploadedAt)
            .FirstOrDefaultAsync();

        if (printoutDocument == null)
            return BadRequest($"No printout document found for invoice {invoiceNumber}. Please upload a printout first.");

        try
        {
            // Update stamping status to pending
            invoice.StampingStatus = Invoice.InvoiceStampingStatus.Pending;
            await _db.SaveChangesAsync();

            // Download the PDF from MinIO
            using var pdfStream = await _storageService.GetFileStreamAsync(printoutDocument.StorageKey);
            using var memoryStream = new MemoryStream();
            await pdfStream.CopyToAsync(memoryStream);
            byte[] pdfBytes = memoryStream.ToArray();

            byte[] stampedPdf;
            string serialNumber;
            string? stampedStorageKey = null; // Will be set by on-premise service or cloud fallback

            // Use on-premise service if available, otherwise fall back to cloud service
            if (_peruriOnPremiseStampService != null)
            {
                _logger.LogInformation("Using on-premise Peruri stamping for invoice {InvoiceNumber}", invoiceNumber);

                var stampRequest = new IPeruriOnPremiseStampService.PeruriStampRequest
                {
                    InvoiceId = invoice.InvoiceID,
                    InvoiceNumber = invoiceNumber,
                    PdfContent = pdfBytes,
                    CustomerName = invoice.DeliveryHeader?.Customer?.CustomerName ?? "Unknown",
                    CustomerNumber = invoice.CustomerNumber,
                    Amount = invoice.AmountLocal,
                    // Pass saved coordinates for dynamic stamp positioning
                    VisLLX = invoice.VisLLX,
                    VisLLY = invoice.VisLLY,
                    VisURX = invoice.VisURX,
                    VisURY = invoice.VisURY,
                    StampPageNumber = invoice.StampPageNumber
                };

                var stampResult = await _peruriOnPremiseStampService.StampInvoiceAsync(stampRequest);

                if (!stampResult.Success)
                {
                    invoice.StampingStatus = Invoice.InvoiceStampingStatus.Failed;
                    invoice.Status = Invoice.InvoiceStatus.SyncFailed;
                    await _db.SaveChangesAsync();

                    _logger.LogError(
                        "On-premise stamping failed for invoice {InvoiceNumber}: {Error}",
                        invoiceNumber,
                        stampResult.ErrorMessage);

                    return StatusCode(500, $"Stamping failed: {stampResult.ErrorMessage}");
                }

                stampedPdf = stampResult.StampedPdf ?? pdfBytes;
                serialNumber = stampResult.SerialNumber ?? string.Empty;
                stampedStorageKey = stampResult.StampedStorageKey; // Use storage key from service

                _logger.LogInformation("Stamping completed. UsedCache: {UsedCache}", stampResult.UsedCache);
            }
            else
            {
                _logger.LogInformation("Using cloud Peruri PDS service for invoice {InvoiceNumber}", invoiceNumber);

                // Fall back to cloud Peruri service
                var customerName = invoice.DeliveryHeader?.Customer?.CustomerName ?? "Unknown";
                var stampingResult = await _periuriPdsService.StampPdfAsync(
                    pdfBytes,
                    invoiceNumber,
                    customerName);

                if (!stampingResult.Success)
                {
                    invoice.StampingStatus = Invoice.InvoiceStampingStatus.Failed;
                    invoice.Status = Invoice.InvoiceStatus.SyncFailed;
                    await _db.SaveChangesAsync();

                    _logger.LogError(
                        "Stamping failed for invoice {InvoiceNumber}: {Error}",
                        invoiceNumber,
                        stampingResult.ErrorMessage);

                    return StatusCode(500, $"Stamping failed: {stampingResult.ErrorMessage}");
                }

                stampedPdf = pdfBytes; // In real cloud implementation, this would be stamped
                serialNumber = stampingResult.SerialNumber ?? string.Empty;
            }

            // Upload the stamped PDF to MinIO only if not already uploaded by on-premise service
            if (string.IsNullOrEmpty(stampedStorageKey))
            {
                // Use descriptive prefix with invoice number: invoices/{invoiceNumber}/stamped/STPINV_{invoiceNumber}_{guid}.pdf
                string stampedGuid = Guid.NewGuid().ToString();
                stampedStorageKey = $"invoices/{invoiceNumber}/stamped/STPINV_{invoiceNumber}_{stampedGuid}.pdf";
                using var stampedStream = new MemoryStream(stampedPdf);
                await _storageService.UploadFileAsync(stampedStorageKey, stampedStream, "application/pdf");
            }

            // Create document record for stamped PDF
            var stampedDocument = new Document
            {
                InvoiceID = invoice.InvoiceID,
                StorageKey = stampedStorageKey,
                FileName = $"{invoiceNumber}_stamped.pdf",
                ContentType = "application/pdf",
                Type = DocumentType.InvoicePrintOut,
                UploadedAt = DateTime.UtcNow
            };

            // FIX PART 1: Insert Document record first to generate the DocumentID key value
            _db.Documents.Add(stampedDocument);
            await _db.SaveChangesAsync();

            // FIX PART 2: Assign the fully verified DocumentID, then save invoice updates
            invoice.SerialNumber = serialNumber;
            invoice.StampingStatus = Invoice.InvoiceStampingStatus.Stamped;
            invoice.StampedDocumentId = stampedDocument.DocumentID; 
            invoice.Status = Invoice.InvoiceStatus.SyncedToSap;

            _db.Invoices.Update(invoice);
            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Successfully stamped invoice {InvoiceNumber} with serial number {SerialNumber}",
                invoiceNumber,
                serialNumber);

            var baseApiUrl = _appOptions.ApiBaseUrl ?? "http://localhost:8080";

            return Ok(new
            {
                invoiceId = invoice.InvoiceID,
                invoiceNumber = invoiceNumber,
                serialNumber = serialNumber,
                status = "Stamped",
                stampedDocumentUrl = $"{baseApiUrl.TrimEnd('/')}/api/deliveries/files/download?key={Uri.EscapeDataString(stampedStorageKey)}"
            });
        }
        catch (Exception ex)
        {
            invoice.StampingStatus = Invoice.InvoiceStampingStatus.Failed;
            invoice.Status = Invoice.InvoiceStatus.SyncFailed;
            await _db.SaveChangesAsync();

            _logger.LogError(ex, "Error stamping invoice {InvoiceNumber}", invoiceNumber);
            return StatusCode(500, $"Internal error during stamping: {ex.Message}");
        }
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<InvoiceResponseDto>>> GetAllInvoices()
    {
        var baseApiUrl = _appOptions.ApiBaseUrl ?? "http://localhost:8080";

        // Step 1: Query the database and filter by StorageKey path contents
        var rawInvoices = await _db.Invoices
            .Include(i => i.DeliveryHeader)
            .OrderByDescending(i => i.InvoicedDate)
            .Select(i => new
            {
                InvoiceID = i.InvoiceID,
                InvoiceNumber = i.InvoiceNumber,
                CustomerNumber = i.CustomerNumber,
                CustomerName = _db.Customers
                    .Where(c => c.CustomerCode == i.CustomerNumber)
                    .Select(c => c.CustomerName)
                    .FirstOrDefault() ?? string.Empty,
                CustomerEmail = _db.Customers
                    .Where(c => c.CustomerCode == i.CustomerNumber)
                    .Select(c => c.CustomerEmail)
                    .FirstOrDefault() ?? string.Empty,
#pragma warning disable CS0618 // Type or member is obsolete
                // Legacy amount field for backward compatibility
                InvoiceAmount = i.InvoiceAmount,
#pragma warning restore CS0618
                // New dual-currency fields
                AmountForeign = i.AmountForeign,
                AmountLocal = i.AmountLocal,
                BaseAmountForeign = i.BaseAmountForeign,
                BaseAmountLocal = i.BaseAmountLocal,
                DownPayAmountForeign = i.DownPayAmountForeign,
                DownPayAmountLocal = i.DownPayAmountLocal,
                Currency = i.Currency,
                ComplianceCategory = i.ComplianceCategory,
                InvoicedDate = i.InvoicedDate,
                Status = (int)i.Status,
                StatusText = GetStatusText(i.Status),
                DeliveryHeaderId = i.DeliveryHeaderId,
                DeliveryNumber = i.DeliveryHeader != null ? i.DeliveryHeader.DeliveryNumber : null,
                SerialNumber = i.SerialNumber,
                StampingStatus = (int)i.StampingStatus,
                StampingStatusText = GetStampingStatusText(i.StampingStatus),

                // Check if any invoice printout document exists for this invoice
                HasPrintoutDocument = _db.Documents.Any(d =>
                    d.InvoiceID == i.InvoiceID && d.Type == DocumentType.InvoicePrintOut),

                // Pull the storage key that belongs to the 'printouts' directory structure
                UnstampedStorageKey = _db.Documents
                    .Where(d => d.InvoiceID == i.InvoiceID &&
                                d.Type == DocumentType.InvoicePrintOut &&
                                d.StorageKey.Contains("/printouts/"))
                    .OrderByDescending(d => d.UploadedAt)
                    .Select(d => d.StorageKey)
                    .FirstOrDefault(),

                // Pull the storage key that belongs to the 'stamped' directory structure
                StampedStorageKey = _db.Documents
                    .Where(d => d.InvoiceID == i.InvoiceID &&
                                d.Type == DocumentType.InvoicePrintOut &&
                                d.StorageKey.Contains("/stamped/"))
                    .OrderByDescending(d => d.UploadedAt)
                    .Select(d => d.StorageKey)
                    .FirstOrDefault(),

                // Pull the delivery printout storage key if invoice is linked to a delivery
                DeliveryPrintoutStorageKey = i.DeliveryHeaderId.HasValue
                    ? _db.Documents
                        .Where(d => d.DeliveryID == i.DeliveryHeaderId.Value &&
                                    d.Type == DocumentType.DeliveryPrintOut)
                        .OrderByDescending(d => d.UploadedAt)
                        .Select(d => d.StorageKey)
                        .FirstOrDefault()
                    : null
            })
            .ToListAsync();

        // Step 2: Build the download URLs cleanly in-memory using Uri.EscapeDataString
        var invoices = rawInvoices.Select(i => new InvoiceResponseDto
        {
            InvoiceID = i.InvoiceID,
            InvoiceNumber = i.InvoiceNumber,
            CustomerNumber = i.CustomerNumber,
            CustomerName = i.CustomerName,
            CustomerEmail = i.CustomerEmail,
            InvoiceAmount = i.InvoiceAmount,
            AmountForeign = i.AmountForeign,
            AmountLocal = i.AmountLocal,
            BaseAmountForeign = i.BaseAmountForeign,
            BaseAmountLocal = i.BaseAmountLocal,
            DownPayAmountForeign = i.DownPayAmountForeign,
            DownPayAmountLocal = i.DownPayAmountLocal,
            Currency = i.Currency,
            ComplianceCategory = i.ComplianceCategory,
            InvoicedDate = i.InvoicedDate,
            Status = i.Status,
            StatusText = i.StatusText,
            DeliveryHeaderId = i.DeliveryHeaderId,
            DeliveryNumber = i.DeliveryNumber,
            SerialNumber = i.SerialNumber,
            StampingStatus = i.StampingStatus,
            StampingStatusText = i.StampingStatusText,
            HasPrintoutDocument = i.HasPrintoutDocument,

            UnstampedDocumentUrl = !string.IsNullOrEmpty(i.UnstampedStorageKey)
                ? $"{baseApiUrl.TrimEnd('/')}/api/deliveries/files/download?key={Uri.EscapeDataString(i.UnstampedStorageKey)}"
                : null,

            StampedDocumentUrl = !string.IsNullOrEmpty(i.StampedStorageKey)
                ? $"{baseApiUrl.TrimEnd('/')}/api/deliveries/files/download?key={Uri.EscapeDataString(i.StampedStorageKey)}"
                : null,

            CreatedAt = i.InvoicedDate,
            DeliveryPrintoutUrl = !string.IsNullOrEmpty(i.DeliveryPrintoutStorageKey)
                ? $"{baseApiUrl.TrimEnd('/')}/api/deliveries/files/download?key={Uri.EscapeDataString(i.DeliveryPrintoutStorageKey)}"
                : null
        }).ToList();

        return Ok(invoices);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<InvoiceResponseDto>> GetInvoiceById(int id)
    {
        var baseApiUrl = _appOptions.ApiBaseUrl ?? "http://localhost:8080";

        var invoice = await _db.Invoices
            .Include(i => i.DeliveryHeader)
            .Include(i => i.StampedDocument)
            .FirstOrDefaultAsync(i => i.InvoiceID == id);

        if (invoice == null)
            return NotFound();

        var response = new InvoiceResponseDto
        {
            InvoiceID = invoice.InvoiceID,
            InvoiceNumber = invoice.InvoiceNumber,
            CustomerNumber = invoice.CustomerNumber,
#pragma warning disable CS0618 // Type or member is obsolete
            // Legacy amount field for backward compatibility
            InvoiceAmount = invoice.InvoiceAmount,
#pragma warning restore CS0618
            // New dual-currency fields
            AmountForeign = invoice.AmountForeign,
            AmountLocal = invoice.AmountLocal,
            BaseAmountForeign = invoice.BaseAmountForeign,
            BaseAmountLocal = invoice.BaseAmountLocal,
            DownPayAmountForeign = invoice.DownPayAmountForeign,
            DownPayAmountLocal = invoice.DownPayAmountLocal,
            Currency = invoice.Currency,
            ComplianceCategory = invoice.ComplianceCategory,
            InvoicedDate = invoice.InvoicedDate,
            Status = (int)invoice.Status,
            StatusText = GetStatusText(invoice.Status),
            DeliveryHeaderId = invoice.DeliveryHeaderId,
            // Handle standalone invoices where DeliveryHeader is null
            DeliveryNumber = invoice.DeliveryHeader?.DeliveryNumber,
            SerialNumber = invoice.SerialNumber,
            StampingStatus = (int)invoice.StampingStatus,
            StampingStatusText = GetStampingStatusText(invoice.StampingStatus),
            HasPrintoutDocument = _db.Documents.Any(d =>
                d.InvoiceID == invoice.InvoiceID && d.Type == DocumentType.InvoicePrintOut),
            UnstampedDocumentUrl = _db.Documents
                .Where(d => d.InvoiceID == invoice.InvoiceID && d.Type == DocumentType.InvoicePrintOut)
                .OrderByDescending(d => d.UploadedAt)
                .Select(d => (string?)$"{baseApiUrl.TrimEnd('/')}/api/deliveries/files/download?key={Uri.EscapeDataString(d.StorageKey)}")
                .FirstOrDefault(),
            StampedDocumentUrl = invoice.StampedDocumentId.HasValue
                ? $"{baseApiUrl.TrimEnd('/')}/api/deliveries/files/download?key={Uri.EscapeDataString(invoice.StampedDocument?.StorageKey ?? string.Empty)}"
                : null,
            CreatedAt = invoice.InvoicedDate,
            DeliveryPrintoutUrl = invoice.DeliveryHeaderId.HasValue
                ? _db.Documents
                    .Where(d => d.DeliveryID == invoice.DeliveryHeaderId.Value && d.Type == DocumentType.DeliveryPrintOut)
                    .OrderByDescending(d => d.UploadedAt)
                    .Select(d => (string?)$"{baseApiUrl.TrimEnd('/')}/api/deliveries/files/download?key={Uri.EscapeDataString(d.StorageKey)}")
                    .FirstOrDefault()
                : null
        };

        return Ok(response);
    }

    [HttpPost]
    [Authorize(Policy = PermissionKeys.InvoiceSync)]
    public async Task<ActionResult<InvoiceResponseDto>> CreateInvoice(InvoiceCreateDto dto)
    {
        // Validate invoice number is unique
        var existingInvoice = await _db.Invoices
            .FirstOrDefaultAsync(i => i.InvoiceNumber == dto.InvoiceNumber);

        if (existingInvoice != null)
            return Conflict($"Invoice with number {dto.InvoiceNumber} already exists.");

        // If linking to a delivery, validate it exists
        if (dto.DeliveryHeaderId.HasValue)
        {
            var delivery = await _db.DeliveryHeaders
                .FirstOrDefaultAsync(d => d.DeliveryID == dto.DeliveryHeaderId.Value);

            if (delivery == null)
                return BadRequest($"Delivery with ID {dto.DeliveryHeaderId.Value} not found.");

            if (delivery.Invoiced)
                return BadRequest($"Delivery {delivery.DeliveryNumber} is already invoiced.");
        }

        var invoice = new Invoice
        {
            InvoiceNumber = dto.InvoiceNumber,
            CustomerNumber = dto.CustomerNumber,
#pragma warning disable CS0618 // Type or member is obsolete
            InvoiceAmount = dto.InvoiceAmount,
#pragma warning restore CS0618
            InvoicedDate = dto.InvoicedDate,
            Status = Invoice.InvoiceStatus.Draft,
            DeliveryHeaderId = dto.DeliveryHeaderId,
            StampingStatus = Invoice.InvoiceStampingStatus.NotStamped
        };

        _db.Invoices.Add(invoice);

        // Mark delivery as invoiced if linked
        if (dto.DeliveryHeaderId.HasValue)
        {
            var delivery = await _db.DeliveryHeaders
                .FirstOrDefaultAsync(d => d.DeliveryID == dto.DeliveryHeaderId.Value);
            if (delivery != null)
            {
                delivery.Invoiced = true;
            }
        }

        await _db.SaveChangesAsync();

        var baseApiUrl = _appOptions.ApiBaseUrl ?? "http://localhost:8080";

        var response = new InvoiceResponseDto
        {
            InvoiceID = invoice.InvoiceID,
            InvoiceNumber = invoice.InvoiceNumber,
            CustomerNumber = invoice.CustomerNumber,
#pragma warning disable CS0618 // Type or member is obsolete
            InvoiceAmount = invoice.InvoiceAmount,
#pragma warning restore CS0618
            InvoicedDate = invoice.InvoicedDate,
            Status = (int)invoice.Status,
            StatusText = GetStatusText(invoice.Status),
            DeliveryHeaderId = invoice.DeliveryHeaderId,
            DeliveryNumber = invoice.DeliveryHeader?.DeliveryNumber,
            SerialNumber = invoice.SerialNumber,
            StampingStatus = (int)invoice.StampingStatus,
            StampingStatusText = GetStampingStatusText(invoice.StampingStatus),
            HasPrintoutDocument = false,
            StampedDocumentUrl = null,
            CreatedAt = invoice.InvoicedDate
        };

        _logger.LogInformation(
            "Invoice {InvoiceNumber} created for customer {CustomerNumber}",
            invoice.InvoiceNumber,
            invoice.CustomerNumber);

        return CreatedAtAction(nameof(GetInvoiceById), new { id = invoice.InvoiceID }, response);
    }

    /// <summary>
    /// Create a standalone invoice without associating it with a Delivery Order.
    /// Expects a raw JSON body payload. File uploading must be done via a separate endpoint.
    /// </summary>
    [HttpPost("without-delivery")]
    [Authorize(Policy = PermissionKeys.InvoiceSync)]
    public async Task<ActionResult<InvoiceResponseDto>> CreateInvoiceWithoutDelivery([FromBody] CreateInvoiceWithoutDeliveryDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.InvoiceNumber))
            return BadRequest("Invoice number is required.");

        if (string.IsNullOrWhiteSpace(dto.CustomerNumber))
            return BadRequest("Customer number is required.");

        // Validate compliance category against allowed values (BC, NonBC, OTHER)
        if (!string.IsNullOrWhiteSpace(dto.ComplianceCategory) &&
            !ValidComplianceCategories.Contains(dto.ComplianceCategory, StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest(
                $"Compliance category '{dto.ComplianceCategory}' is not valid. " +
                $"Allowed values: {string.Join(", ", ValidComplianceCategories)}.");
        }

        // For standalone invoices (without delivery), compliance category is always OTHER
        var complianceCategory = "OTHER";

        // Resolve base / down pay / nett amounts
        // Rule: Nett Amount = BaseAmount - DownPayAmount
        // When BaseAmount is 0, derive it from the nett amount and down payment:
        // BaseAmount = AmountLocal + DownPayAmount  (gross = nett + downpay)
        var baseAmountLocal = dto.BaseAmountLocal > 0
            ? dto.BaseAmountLocal
            : dto.AmountLocal + dto.DownPayAmountLocal;
        var baseAmountForeign = dto.BaseAmountForeign > 0
            ? dto.BaseAmountForeign
            : dto.AmountForeign + dto.DownPayAmountForeign;
        var downPayAmountLocal = dto.DownPayAmountLocal;
        var downPayAmountForeign = dto.DownPayAmountForeign;
        var nettAmountLocal = baseAmountLocal - downPayAmountLocal;
        var nettAmountForeign = baseAmountForeign - downPayAmountForeign;

        // 1. Ensure invoice number is unique (only block if active, not voided/canceled)
        var existingInvoice = await _db.Invoices
            .FirstOrDefaultAsync(i => i.InvoiceNumber == dto.InvoiceNumber);

        if (existingInvoice != null)
        {
            // If active, return Conflict
            if (existingInvoice.Status != Invoice.InvoiceStatus.Voided &&
                existingInvoice.Status != Invoice.InvoiceStatus.Canceled)
            {
                return Conflict($"Invoice with number '{dto.InvoiceNumber}' already exists.");
            }
        }

        // 2. Initialize Invoice entity with Null DeliveryHeaderId
        var invoice = new Invoice
        {
            InvoiceNumber = dto.InvoiceNumber,
            CustomerNumber = dto.CustomerNumber,
            AmountForeign = nettAmountForeign,
            AmountLocal = nettAmountLocal,
            BaseAmountForeign = baseAmountForeign,
            BaseAmountLocal = baseAmountLocal,
            DownPayAmountForeign = downPayAmountForeign,
            DownPayAmountLocal = downPayAmountLocal,
#pragma warning disable CS0618 // Type or member is obsolete
            // Legacy field sync
            InvoiceAmount = nettAmountLocal,
#pragma warning restore CS0618
            Currency = dto.Currency,
            ComplianceCategory = complianceCategory,
            InvoicedDate = dto.InvoicedDate,
            Status = Invoice.InvoiceStatus.Draft,
            DeliveryHeaderId = null, // Strictly null for standalone invoices
            StampingStatus = Invoice.InvoiceStampingStatus.NotStamped
        };

        _db.Invoices.Add(invoice);
        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Standalone Invoice {InvoiceNumber} created without delivery for Customer {CustomerNumber}.",
            invoice.InvoiceNumber,
            invoice.CustomerNumber);

        // 3. Return formatted response using GetInvoiceById endpoint
        return await GetInvoiceById(invoice.InvoiceID);
    }

    /// <summary>
        /// Update the DownPay (Local and Foreign) for an invoice.
        /// The nett AmountLocal / AmountForeign are automatically recalculated
        /// as BaseAmount - DownPayAmount for each currency.
        /// Validation for foreign currency is skipped if BaseAmountForeign is zero.
        /// </summary>
        [HttpPut("{id:int}/downpay")]
        [Authorize(Policy = PermissionKeys.InvoiceSync)]
    public async Task<ActionResult<InvoiceResponseDto>> UpdateInvoiceDownPay(
        int id,
        [FromBody] UpdateInvoiceDownPayDto dto)
    {
        var invoice = await _db.Invoices
            .Include(i => i.DeliveryHeader)
            .FirstOrDefaultAsync(i => i.InvoiceID == id);

        if (invoice == null)
            return NotFound($"Invoice with ID {id} not found.");

        // Adopt the current nett amount as the base when it was never captured (legacy rows)
        if (invoice.BaseAmountLocal <= 0) invoice.BaseAmountLocal = invoice.AmountLocal;
        if (invoice.BaseAmountForeign <= 0) invoice.BaseAmountForeign = invoice.AmountForeign;

        // Validation: skip foreign currency validation if BaseAmountForeign is zero
        if (dto.DownPayAmountLocal < 0)
            return BadRequest("Down payment (local) cannot be negative.");

        if (invoice.BaseAmountForeign > 0 && dto.DownPayAmountForeign < 0)
            return BadRequest("Down payment (foreign) cannot be negative when foreign currency is enabled.");

        invoice.ApplyDownPay(dto.DownPayAmountLocal, dto.DownPayAmountForeign);
        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Invoice {InvoiceNumber} down payment updated. Local: {DownPayLocal}, Foreign: {DownPayForeign}. " +
            "Nett recalculated to Local: {NettLocal}, Foreign: {NettForeign}.",
            invoice.InvoiceNumber,
            invoice.DownPayAmountLocal,
            invoice.DownPayAmountForeign,
            invoice.AmountLocal,
            invoice.AmountForeign);

        return await GetInvoiceById(invoice.InvoiceID);
    }

    /// <summary>
    /// Update the DownPay (Local and Foreign) for an invoice by SAP invoice number.
    /// The nett AmountLocal / AmountForeign are automatically recalculated
    /// as BaseAmount + DownPayAmount for each currency.
    /// Validation for foreign currency is skipped if BaseAmountForeign is zero.
    /// </summary>
    [HttpPut("by-sap-number/{invoiceNumber}/downpay")]
    [Authorize(Policy = PermissionKeys.InvoiceSync)]
    public async Task<ActionResult<InvoiceResponseDto>> UpdateInvoiceDownPayByNumber(
        string invoiceNumber,
        [FromBody] UpdateInvoiceDownPayDto dto)
    {
        if (string.IsNullOrWhiteSpace(invoiceNumber))
        {
            return BadRequest("Invoice number is required.");
        }

        var invoice = await _db.Invoices
            .Include(i => i.DeliveryHeader)
            .FirstOrDefaultAsync(i => i.InvoiceNumber == invoiceNumber);

        if (invoice == null)
            return NotFound($"Invoice with number {invoiceNumber} not found.");

        // Adopt the current nett amount as the base when it was never captured (legacy rows)
        if (invoice.BaseAmountLocal <= 0) invoice.BaseAmountLocal = invoice.AmountLocal;
        if (invoice.BaseAmountForeign <= 0) invoice.BaseAmountForeign = invoice.AmountForeign;

        // Validation: skip foreign currency validation if BaseAmountForeign is zero
        if (dto.DownPayAmountLocal < 0)
            return BadRequest("Down payment (local) cannot be negative.");

        if (invoice.BaseAmountForeign > 0 && dto.DownPayAmountForeign < 0)
            return BadRequest("Down payment (foreign) cannot be negative when foreign currency is enabled.");

        invoice.ApplyDownPay(dto.DownPayAmountLocal, dto.DownPayAmountForeign);
        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Invoice {InvoiceNumber} down payment updated. Local: {DownPayLocal}, Foreign: {DownPayForeign}. " +
            "Nett recalculated to Local: {NettLocal}, Foreign: {NettForeign}.",
            invoice.InvoiceNumber,
            invoice.DownPayAmountLocal,
            invoice.DownPayAmountForeign,
            invoice.AmountLocal,
            invoice.AmountForeign);

        return await GetInvoiceById(invoice.InvoiceID);
    }

    /// <summary>
    /// Upload invoice printout using internal invoice ID (Legacy endpoint)
    /// </summary>
    [HttpPost("{id:int}/upload-printout")]
    [Authorize(Policy = PermissionKeys.InvoiceSync)]
    public async Task<IActionResult> UploadInvoicePrintout(int id, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("File is required.");

        var invoice = await _db.Invoices
            .FirstOrDefaultAsync(i => i.InvoiceID == id);

        if (invoice == null)
            return NotFound($"Invoice with ID {id} not found.");

        return await UploadInvoicePrintoutInternal(invoice, file);
    }

    /// <summary>
    /// Upload invoice printout using SAP-native invoice number (New endpoint)
    /// This is the preferred method for SAP integration
    /// </summary>
    [HttpPost("by-number/{invoiceNumber}/upload-printout")]
    [Authorize(Policy = PermissionKeys.InvoiceSync)]
    public async Task<IActionResult> UploadInvoicePrintoutByNumber(string invoiceNumber, IFormFile file)
    {
        if (string.IsNullOrWhiteSpace(invoiceNumber))
            return BadRequest("Invoice number is required.");

        if (file == null || file.Length == 0)
            return BadRequest("File is required.");

        var invoice = await _db.Invoices
            .FirstOrDefaultAsync(i => i.InvoiceNumber == invoiceNumber);

        if (invoice == null)
            return NotFound($"Invoice with number {invoiceNumber} not found.");

        return await UploadInvoicePrintoutInternal(invoice, file);
    }

    /// <summary>
    /// Internal method for handling invoice printout upload
    /// </summary>
    private async Task<IActionResult> UploadInvoicePrintoutInternal(Invoice invoice, IFormFile file)
    {
        // Validate file type (PDF or Image)
        string contentType = file.ContentType.ToLowerInvariant();
        if (!contentType.StartsWith("application/pdf") &&
            !contentType.StartsWith("image/") &&
            !file.FileName.ToLowerInvariant().EndsWith(".pdf"))
        {
            return BadRequest("Only PDF and image files are allowed.");
        }

        try
        {
            string fileExtension = Path.GetExtension(file.FileName);
            // Use descriptive invoice number and prefix for clarity
            // Format: INV_{invoiceNumber}_{guid}.{ext}
            string uniqueFileName = $"INV_{invoice.InvoiceNumber}_{Guid.NewGuid()}{fileExtension}";
            string storageKey = $"invoices/{invoice.InvoiceNumber}/printouts/{uniqueFileName}";

            // Upload to MinIO
            using (var stream = file.OpenReadStream())
            {
                await _storageService.UploadFileAsync(storageKey, stream, file.ContentType);
            }

            // Create document record
            var documentRecord = new Document
            {
                InvoiceID = invoice.InvoiceID,
                DeliveryID = null,
                StorageKey = storageKey,
                FileName = file.FileName,
                ContentType = file.ContentType,
                Type = DocumentType.InvoicePrintOut,
                UploadedAt = DateTime.UtcNow
            };

            _db.Documents.Add(documentRecord);
            await _db.SaveChangesAsync();

            // Extract PDF anchor coordinates if this is a PDF file
            if (contentType.StartsWith("application/pdf") || file.FileName.ToLowerInvariant().EndsWith(".pdf"))
            {
                try
                {
                    // Create a new stream for coordinate extraction (original stream was already consumed)
                    using var pdfStream = file.OpenReadStream();
                    var coordinates = await _pdfAnchorService.ExtractStampCoordinatesAsync(pdfStream);

                    if (coordinates.HasValue)
                    {
                        // Update invoice with extracted coordinates
                        invoice.VisLLX = coordinates.Value.visLLX;
                        invoice.VisLLY = coordinates.Value.visLLY;
                        invoice.VisURX = coordinates.Value.visURX;
                        invoice.VisURY = coordinates.Value.visURY;
                        invoice.StampPageNumber = coordinates.Value.stampPageNumber;

                        await _db.SaveChangesAsync();

                        _logger.LogInformation(
                            "PDF anchor coordinates extracted for invoice {InvoiceNumber}: " +
                            "LLX={VisLLX}, LLY={VisLLY}, URX={VisURX}, URY={VisURY}, Page={PageNumber}",
                            invoice.InvoiceNumber,
                            coordinates.Value.visLLX,
                            coordinates.Value.visLLY,
                            coordinates.Value.visURX,
                            coordinates.Value.visURY,
                            coordinates.Value.stampPageNumber);
                    }
                    else
                    {
                        _logger.LogWarning(
                            "Could not find 'Notes' or 'Remarks' anchor text in PDF for invoice {InvoiceNumber}. " +
                            "Will use default coordinates during stamping.",
                            invoice.InvoiceNumber);
                    }
                }
                catch (Exception coordEx)
                {
                    // Log coordinate extraction error but don't fail the upload
                    _logger.LogError(
                        coordEx,
                        "Failed to extract PDF coordinates for invoice {InvoiceNumber}. " +
                        "Will use default coordinates during stamping.",
                        invoice.InvoiceNumber);
                }
            }

            _logger.LogInformation(
                "Printout document '{FileName}' uploaded for invoice {InvoiceNumber}",
                file.FileName,
                invoice.InvoiceNumber);

            var baseApiUrl = _appOptions.ApiBaseUrl ?? "http://localhost:8080";
            var downloadUrl = $"{baseApiUrl.TrimEnd('/')}/api/deliveries/files/download?key={Uri.EscapeDataString(storageKey)}";

            return Ok(new
            {
                documentId = documentRecord.DocumentID,
                fileName = file.FileName,
                storageKey = storageKey,
                downloadUrl = downloadUrl,
                uploadedAt = documentRecord.UploadedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload printout for invoice {InvoiceNumber}", invoice.InvoiceNumber);
            return StatusCode(500, $"Failed to upload file: {ex.Message}");
        }
    }

    /// <summary>
    /// Void invoice by SAP invoice number.
    /// Transactional operation that voids the invoice and blocks the delivery from re-billing.
    /// </summary>
    [HttpPost("by-sap-number/{invoiceNumber}/void")]
    [Authorize(Policy = PermissionKeys.InvoiceSync)]
    public async Task<IActionResult> VoidInvoiceBySapNumber(string invoiceNumber)
    {
        if (string.IsNullOrWhiteSpace(invoiceNumber))
        {
            return BadRequest("Invoice number is required.");
        }

        // Start explicit transaction for atomicity
        using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            // Look up the invoice by its SAP target number
            var invoice = await _db.Invoices
                .Include(i => i.DeliveryHeader)
                .FirstOrDefaultAsync(i => i.InvoiceNumber == invoiceNumber);

            if (invoice == null)
            {
                return NotFound($"Invoice with SAP number {invoiceNumber} not found.");
            }

            // Set invoice status to Voided
            invoice.Status = Invoice.InvoiceStatus.Voided;

            // Traverse to the associated DeliveryHeader and set billing status to blocked
            if (invoice.DeliveryHeader != null)
            {
                invoice.DeliveryHeader.BillingStatus = DeliveryHeader.DeliveryBillingStatus.BillingBlocked;
            }

            await _db.SaveChangesAsync();

            // Commit transaction
            await transaction.CommitAsync();

            _logger.LogInformation(
                "Invoice {InvoiceNumber} voided and delivery {DeliveryNumber} billing blocked.",
                invoiceNumber,
                invoice.DeliveryHeader?.DeliveryNumber ?? "N/A");

            return Ok(new
            {
                success = true,
                message = $"Invoice {invoiceNumber} has been voided and associated delivery billing blocked.",
                invoiceNumber = invoiceNumber,
                deliveryNumber = invoice.DeliveryHeader?.DeliveryNumber,
                invoiceStatus = "Voided",
                deliveryBillingStatus = invoice.DeliveryHeader?.BillingStatus.ToString()
            });
        }
        catch (Exception ex)
        {
            // Rollback transaction on error
            await transaction.RollbackAsync();

            _logger.LogError(ex, "Error voiding invoice {InvoiceNumber}", invoiceNumber);
            return StatusCode(500, $"Internal error during invoice void: {ex.Message}");
        }
    }

    /// <summary>
    /// Delete invoice by SAP invoice number.
    /// - If invoice is standalone (without DO), removes it completely.
    /// - If invoice is linked to a DO, deletes the invoice and resets delivery status to allow re-invoicing.
    /// </summary>
    [HttpDelete("by-sap-number/{invoiceNumber}")]
    [Authorize(Policy = PermissionKeys.InvoiceSync)]
    public async Task<IActionResult> DeleteInvoiceByNumber(string invoiceNumber)
    {
        if (string.IsNullOrWhiteSpace(invoiceNumber))
        {
            return BadRequest("Invoice number is required.");
        }

        // Start explicit transaction for atomicity
        using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            // Look up the invoice by its SAP number
            var invoice = await _db.Invoices
                .Include(i => i.DeliveryHeader)
                .Include(i => i.Documents)
                .FirstOrDefaultAsync(i => i.InvoiceNumber == invoiceNumber);

            if (invoice == null)
            {
                return NotFound($"Invoice with number {invoiceNumber} not found.");
            }

            var deliveryNumber = invoice.DeliveryHeader?.DeliveryNumber;
            var isStandalone = invoice.DeliveryHeader == null;

            // If invoice is linked to a delivery, reset the delivery status
            if (!isStandalone)
            {
                invoice.DeliveryHeader!.Invoiced = false;
                invoice.DeliveryHeader.BillingStatus = DeliveryHeader.DeliveryBillingStatus.Unbilled;
            }

            // Store invoice ID for document cleanup
            var invoiceId = invoice.InvoiceID;

            // Break circular dependency: clear the StampedDocumentId reference
            invoice.StampedDocumentId = null;

            // Save the invoice changes (nullifying StampedDocumentId) first
            await _db.SaveChangesAsync();

            // Remove associated documents (invoice printouts, etc.)
            var documentsToDelete = await _db.Documents
                .Where(d => d.InvoiceID == invoiceId)
                .ToListAsync();

            int documentsDeletedCount = 0;
            if (documentsToDelete.Any())
            {
                _db.Documents.RemoveRange(documentsToDelete);
                await _db.SaveChangesAsync();
                documentsDeletedCount = documentsToDelete.Count;
            }

            // Now remove the invoice after all documents are deleted and reference is broken
            _db.Invoices.Remove(invoice);
            await _db.SaveChangesAsync();

            // Commit transaction
            await transaction.CommitAsync();

            _logger.LogInformation(
                "Invoice {InvoiceNumber} deleted completely. Standalone: {IsStandalone}, Delivery: {DeliveryNumber}",
                invoiceNumber,
                isStandalone,
                deliveryNumber ?? "N/A");

            return Ok(new
            {
                success = true,
                message = isStandalone
                    ? $"Standalone invoice {invoiceNumber} has been deleted."
                    : $"Invoice {invoiceNumber} has been deleted and delivery {deliveryNumber} is ready for re-invoicing.",
                invoiceNumber = invoiceNumber,
                deliveryNumber = deliveryNumber,
                isStandalone = isStandalone,
                documentsDeleted = documentsDeletedCount
            });
        }
        catch (Exception ex)
        {
            // Rollback transaction on error
            await transaction.RollbackAsync();

            _logger.LogError(ex, "Error deleting invoice {InvoiceNumber}", invoiceNumber);
            return StatusCode(500, $"Internal error during invoice deletion: {ex.Message}");
        }
    }

    private static string GetStatusText(Invoice.InvoiceStatus status)
    {
        return status switch
        {
            Invoice.InvoiceStatus.Draft => "Draft",
            Invoice.InvoiceStatus.Stamped => "Stamped",
            Invoice.InvoiceStatus.SyncFailed => "Sync Failed",
            Invoice.InvoiceStatus.SyncedToSap => "Synced to SAP",
            Invoice.InvoiceStatus.Canceled => "Canceled",
            Invoice.InvoiceStatus.Voided => "Voided",
            _ => "Unknown"
        };
    }

    // Corrected to take InvoiceStampingStatus enum parameters perfectly
    private static string GetStampingStatusText(Invoice.InvoiceStampingStatus status)
    {
        return status switch
        {
            Invoice.InvoiceStampingStatus.NotStamped => "Not Stamped",
            Invoice.InvoiceStampingStatus.Pending => "Pending",
            Invoice.InvoiceStampingStatus.Stamped => "Stamped",
            Invoice.InvoiceStampingStatus.Failed => "Failed",
            _ => "Unknown"
        };
    }
}