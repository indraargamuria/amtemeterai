using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using amtemeterai.Api.Data;
using amtemeterai.Api.Dtos;
using amtemeterai.Api.Models;
using amtemeterai.Api.Services;
using System.Text.Json;
using System.Text;
using System.IO;

namespace amtemeterai.Api.Controllers;

[ApiController]
[Route("api/invoices")]
[Authorize]
public class InvoicesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly IStorageService _storageService;
    private readonly ILogger<InvoicesController> _logger;
    private readonly IPeriuriPdsService _periuriPdsService;
    private readonly IPeruriOnPremiseStampService? _peruriOnPremiseStampService;

    public InvoicesController(
        AppDbContext db,
        IConfiguration configuration,
        IStorageService storageService,
        ILogger<InvoicesController> logger,
        IPeriuriPdsService periuriPdsService,
        IPeruriOnPremiseStampService? peruriOnPremiseStampService = null)
    {
        _db = db;
        _configuration = configuration;
        _storageService = storageService;
        _logger = logger;
        _periuriPdsService = periuriPdsService;
        _peruriOnPremiseStampService = peruriOnPremiseStampService;
    }

    [HttpPost("{id:int}/stamp")]
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

            var baseApiUrl = _configuration["App:ApiBaseUrl"] ?? "http://localhost:8080";

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
                    Amount = invoice.InvoiceAmount
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

            var baseApiUrl = _configuration["App:ApiBaseUrl"] ?? "http://localhost:8080";

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
        var baseApiUrl = _configuration["App:ApiBaseUrl"] ?? "http://localhost:8080";

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
                InvoiceAmount = i.InvoiceAmount * 100,
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
                    .FirstOrDefault()
            })
            .ToListAsync();

        // Step 2: Build the download URLs cleanly in-memory using Uri.EscapeDataString
        var invoices = rawInvoices.Select(i => new InvoiceResponseDto
        {
            InvoiceID = i.InvoiceID,
            InvoiceNumber = i.InvoiceNumber,
            CustomerNumber = i.CustomerNumber,
            CustomerName = i.CustomerName,
            InvoiceAmount = i.InvoiceAmount,
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
                
            CreatedAt = i.InvoicedDate
        }).ToList();

        return Ok(invoices);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<InvoiceResponseDto>> GetInvoiceById(int id)
    {
        var baseApiUrl = _configuration["App:ApiBaseUrl"] ?? "http://localhost:8080";

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
            InvoiceAmount = invoice.InvoiceAmount,
            InvoicedDate = invoice.InvoicedDate,
            Status = (int)invoice.Status,
            StatusText = GetStatusText(invoice.Status),
            DeliveryHeaderId = invoice.DeliveryHeaderId,
            // 🚀 FIX FOR WARNING LINE 211: Use Null-forgiving operator since context was fetched using Eager Loading .Include()
            DeliveryNumber = invoice.DeliveryHeader!.DeliveryNumber,
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
            CreatedAt = invoice.InvoicedDate
        };

        return Ok(response);
    }

    [HttpPost]
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
            InvoiceAmount = dto.InvoiceAmount,
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

        var baseApiUrl = _configuration["App:ApiBaseUrl"] ?? "http://localhost:8080";

        var response = new InvoiceResponseDto
        {
            InvoiceID = invoice.InvoiceID,
            InvoiceNumber = invoice.InvoiceNumber,
            CustomerNumber = invoice.CustomerNumber,
            InvoiceAmount = invoice.InvoiceAmount,
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
    /// Upload invoice printout using internal invoice ID (Legacy endpoint)
    /// </summary>
    [HttpPost("{id:int}/upload-printout")]
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

            _logger.LogInformation(
                "Printout document '{FileName}' uploaded for invoice {InvoiceNumber}",
                file.FileName,
                invoice.InvoiceNumber);

            var baseApiUrl = _configuration["App:ApiBaseUrl"] ?? "http://localhost:8080";
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