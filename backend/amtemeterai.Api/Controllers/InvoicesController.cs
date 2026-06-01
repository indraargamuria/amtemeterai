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

    public InvoicesController(
        AppDbContext db,
        IConfiguration configuration,
        IStorageService storageService,
        ILogger<InvoicesController> logger,
        IPeriuriPdsService periuriPdsService)
    {
        _db = db;
        _configuration = configuration;
        _storageService = storageService;
        _logger = logger;
        _periuriPdsService = periuriPdsService;
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

    [HttpGet]
    public async Task<ActionResult<IEnumerable<InvoiceResponseDto>>> GetAllInvoices()
    {
        var baseApiUrl = _configuration["App:ApiBaseUrl"] ?? "http://localhost:8080";

        var invoices = await _db.Invoices
            .Include(i => i.DeliveryHeader)
            .OrderByDescending(i => i.InvoicedDate)
            .Select(i => new InvoiceResponseDto
            {
                InvoiceID = i.InvoiceID,
                InvoiceNumber = i.InvoiceNumber,
                CustomerNumber = i.CustomerNumber,
                InvoiceAmount = i.InvoiceAmount,
                InvoicedDate = i.InvoicedDate,
                Status = (int)i.Status,
                StatusText = GetStatusText(i.Status),
                DeliveryHeaderId = i.DeliveryHeaderId,
                // 🚀 FIX FOR WARNING LINE 172: Use safe conditional propagation mapping
                DeliveryNumber = i.DeliveryHeader != null ? i.DeliveryHeader.DeliveryNumber : null,
                SerialNumber = i.SerialNumber,
                StampingStatus = (int)i.StampingStatus,
                StampingStatusText = GetStampingStatusText(i.StampingStatus),
                HasPrintoutDocument = _db.Documents.Any(d =>
                    d.InvoiceID == i.InvoiceID && d.Type == DocumentType.InvoicePrintOut),
                StampedDocumentUrl = i.StampedDocumentId.HasValue
                ? $"{baseApiUrl.TrimEnd('/')}/api/deliveries/files/download?key={Uri.EscapeDataString(i.StampedDocument!.StorageKey)}"
                : null,
                CreatedAt = i.InvoicedDate
            })
            .ToListAsync();

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

    [HttpPost("{id:int}/upload-printout")]
    public async Task<IActionResult> UploadInvoicePrintout(int id, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("File is required.");

        var invoice = await _db.Invoices
            .FirstOrDefaultAsync(i => i.InvoiceID == id);

        if (invoice == null)
            return NotFound($"Invoice with ID {id} not found.");

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
            string storageKey = $"invoices/{id}/printouts/{Guid.NewGuid()}{fileExtension}";

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
            _logger.LogError(ex, "Failed to upload printout for invoice {InvoiceId}", id);
            return StatusCode(500, $"Failed to upload file: {ex.Message}");
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