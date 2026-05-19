using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using amtemeterai.Api.Data;
using amtemeterai.Api.Dtos;
using amtemeterai.Api.Models;
using amtemeterai.Api.Helpers;
using amtemeterai.Api.Services;

namespace amtemeterai.Api.Controllers;

[ApiController]
[Route("api/deliveries")]
[Authorize]
public class DeliveriesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _env;
    private readonly IStorageService _storageService; // <-- ADD THIS LINE

    // Helper method to log activity
    private async Task LogActivity(string eventType, string referenceId, string message, string severity = "Info")
    {
        var log = new ActivityLog
        {
            EventType = eventType,
            ReferenceID = referenceId,
            Message = message,
            Severity = severity
        };
        _db.ActivityLogs.Add(log);
        await _db.SaveChangesAsync();
    }

    public DeliveriesController(
        AppDbContext db,
        IConfiguration configuration,
        IWebHostEnvironment env,
        IStorageService storageService)
    {
        _db = db;
        _configuration = configuration;
        _env = env;
        _storageService = storageService;
    }

    private static string GetPublicUrl(Guid token, string? baseUrl = null)
    {
        var effectiveBaseUrl = baseUrl ?? "http://localhost:5173";
        return $"{effectiveBaseUrl}/receive/{token}";
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<DeliveryHeaderDto>>> GetAllDeliveries()
    {
        var baseUrl = _configuration["App:PublicBaseUrl"] ?? "http://localhost:5173";

        var deliveries = await _db.DeliveryHeaders
            .Include(d => d.Customer)
            .Select(d => new
            {
                DeliveryId = d.DeliveryID,
                DeliveryNumber = d.DeliveryNumber,
                DeliveryDate = d.DeliveryDate,
                DeliveryRemarks = d.DeliveryRemarks,

                CustomerCode = d.Customer.CustomerCode,
                CustomerName = d.Customer.CustomerName,

                Received = d.Received,
                Invoiced = d.Invoiced,
                ReceiverToken = d.ReceiverToken
            })
            .OrderByDescending(d => d.DeliveryDate)
            .ToListAsync();

        var result = deliveries.Select(d => new DeliveryHeaderDto
        {
            DeliveryId = d.DeliveryId,
            DeliveryNumber = d.DeliveryNumber,
            DeliveryDate = d.DeliveryDate,
            DeliveryRemarks = d.DeliveryRemarks,
            CustomerCode = d.CustomerCode,
            CustomerName = d.CustomerName,
            Received = d.Received,
            Invoiced = d.Invoiced,
            PublicUrl = $"{baseUrl}/receive/{d.ReceiverToken}"
        }).ToList();

        return Ok(result);
    }

    [HttpGet("{deliveryId:int}")]
    public async Task<ActionResult<DeliveryResponseDto>> GetDeliveryById(int deliveryId)
    {
        var delivery = await _db.DeliveryHeaders
            .Include(d => d.Lines)
            .Include(d => d.Customer)
            .FirstOrDefaultAsync(d => d.DeliveryID == deliveryId);

        if (delivery == null)
            return NotFound();

        var response = new DeliveryResponseDto
        {
            DeliveryNumber = delivery.DeliveryNumber,
            DeliveryDate = delivery.DeliveryDate,
            DeliveryRemarks = delivery.DeliveryRemarks,
            CustomerCode = delivery.Customer.CustomerCode,
            CustomerName = delivery.Customer.CustomerName,
            ReceiverToken = delivery.ReceiverToken,
            ReceiverName = delivery.ReceiverName,
            ReceiverNotes = delivery.ReceiverNotes,
            Received = delivery.Received,
            Invoiced = delivery.Invoiced,
            PublicUrl = GetPublicUrl(delivery.ReceiverToken, _configuration["App:PublicBaseUrl"]),

            Lines = delivery.Lines.Select(l => new DeliveryLineResponseDto
            {
                DeliveryLineNumber = l.DeliveryLineNumber,
                DeliveryItemCode = l.DeliveryItemCode,
                DeliveryItemDescription = l.DeliveryItemDescription,
                SalesQuantity = l.SalesQuantity,
                SalesUOM = l.SalesUOM,
                PackQuantity = l.PackQuantity,
                PackUOM = l.PackUOM,
                PackQuantityDelivered = l.PackQuantityDelivered,
                PackQuantityReturned = l.PackQuantityReturned,
                PackQuantityRejected = l.PackQuantityRejected
            }).ToList()
        };

        return Ok(response);
    }

    // Public endpoint for delivery receive page - allows anonymous access after PIN verification
    [AllowAnonymous]
    [HttpGet("{token}")]
    public async Task<IActionResult> Get(Guid token)
    {
        var data = await _db.DeliveryHeaders
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.ReceiverToken == token);

        if (data == null) return NotFound();

        var result = new DeliveryResponseDto
        {
            DeliveryNumber = data.DeliveryNumber,
            DeliveryDate = data.DeliveryDate,
            DeliveryRemarks = data.DeliveryRemarks,
            ReceiverToken = data.ReceiverToken,
            ReceiverName = data.ReceiverName,
            ReceiverNotes = data.ReceiverNotes,
            Received = data.Received,
            Invoiced = data.Invoiced,
            PublicUrl = GetPublicUrl(data.ReceiverToken, _configuration["App:PublicBaseUrl"]),
            Lines = data.Lines.Select(l => new DeliveryLineResponseDto
            {
                DeliveryLineNumber = l.DeliveryLineNumber,
                DeliveryItemCode = l.DeliveryItemCode,
                DeliveryItemDescription = l.DeliveryItemDescription,
                SalesQuantity = l.SalesQuantity,
                SalesUOM = l.SalesUOM,
                PackQuantity = l.PackQuantity,
                PackUOM = l.PackUOM,
                PackQuantityDelivered = l.PackQuantityDelivered,
                PackQuantityReturned = l.PackQuantityReturned,
                PackQuantityRejected = l.PackQuantityRejected
            }).ToList()
        };

        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<DeliveryCreateResponseDto>> Create(DeliveryUpsertDto dto)
    {
        var customer = await _db.Customers
            .FirstOrDefaultAsync(x => x.CustomerCode == dto.CustomerCode);

        if (customer == null)
            return BadRequest("Customer not found");

        var existing = await _db.DeliveryHeaders
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.DeliveryNumber == dto.DeliveryNumber);

        if (existing != null)
            return Conflict("Delivery already exists. Use PATCH to update.");

        var header = new DeliveryHeader
        {
            CustomerID = customer.CustomerID,
            DeliveryNumber = dto.DeliveryNumber,
            DeliveryDate = dto.DeliveryDate,
            DeliveryRemarks = dto.DeliveryRemarks,
            ReceiverToken = Guid.NewGuid()
        };

        header.Lines = dto.Lines.Select(l => new DeliveryLine
        {
            DeliveryLineNumber = l.DeliveryLineNumber,
            DeliveryItemCode = l.DeliveryItemCode,
            DeliveryItemDescription = l.DeliveryItemDescription,
            SalesQuantity = l.SalesQuantity,
            SalesUOM = l.SalesUOM,
            PackQuantity = l.PackQuantity,
            PackUOM = l.PackUOM
        }).ToList();

        _db.DeliveryHeaders.Add(header);
        await _db.SaveChangesAsync();

        // Log delivery creation activity
        await LogActivity(
            "DeliveryCreated",
            header.DeliveryNumber,
            $"Delivery {header.DeliveryNumber} created for customer {customer.CustomerName}",
            "Success"
        );

        var publicUrl = GetPublicUrl(header.ReceiverToken, _configuration["App:PublicBaseUrl"]);
        var qrCodeBase64 = QrCodeHelper.GenerateQrBase64(publicUrl);

        var response = new DeliveryCreateResponseDto
        {
            DeliveryNumber = header.DeliveryNumber,
            PublicUrl = publicUrl,
            QrCodeBase64 = qrCodeBase64
        };

        return Ok(response);
    }

    [HttpPatch]
    public async Task<IActionResult> Upsert(DeliveryUpsertDto dto)
    {
        var customer = await _db.Customers
            .FirstOrDefaultAsync(x => x.CustomerCode == dto.CustomerCode);

        if (customer == null)
            return BadRequest("Customer not found");

        var existing = await _db.DeliveryHeaders
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.DeliveryNumber == dto.DeliveryNumber);

        if (existing == null)
            return NotFound("Delivery not found. Use POST to create.");

        existing.DeliveryDate = dto.DeliveryDate;
        existing.DeliveryRemarks = dto.DeliveryRemarks;
        // Do NOT regenerate ReceiverToken on update - token must be stable

        _db.DeliveryLines.RemoveRange(existing.Lines);

        existing.Lines = dto.Lines.Select(l => new DeliveryLine
        {
            DeliveryLineNumber = l.DeliveryLineNumber,
            DeliveryItemCode = l.DeliveryItemCode,
            DeliveryItemDescription = l.DeliveryItemDescription,
            SalesQuantity = l.SalesQuantity,
            SalesUOM = l.SalesUOM,
            PackQuantity = l.PackQuantity,
            PackUOM = l.PackUOM
        }).ToList();

        await _db.SaveChangesAsync();
        return Ok();
    }

    // Public endpoint for delivery receive (after PIN verification) - allows anonymous access
    [AllowAnonymous]
    [HttpPatch("{token}")]
    public async Task<IActionResult> UpdateByToken(Guid token, [FromForm] DeliveryReceiveDto dto)
    {
        // 1. Locate the delivery target header via its secure token
        var data = await _db.DeliveryHeaders
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.ReceiverToken == token);

        if (data == null) return NotFound();

        // 2. Process text payload field configurations
        data.ReceiverName = dto.ReceiverName;
        data.ReceiverNotes = dto.ReceiverNotes;
        data.Received = true;

        // 3. Process nested lines securely
        if (data.Lines != null && dto.Lines != null && dto.Lines.Any())
        {
            foreach (var lineDto in dto.Lines)
            {
                if (lineDto == null) continue;

                var line = data.Lines.FirstOrDefault(x => x.DeliveryLineNumber == lineDto.DeliveryLineNumber);
                
                // CRITICAL GUARD: Skip if this specific line number wasn't found in the database
                if (line == null) continue; 

                line.PackQuantityDelivered = lineDto.PackQuantityDelivered;
                line.PackQuantityReturned = lineDto.PackQuantityReturned;
                line.PackQuantityRejected = lineDto.PackQuantityRejected;
            }
        }

        // 4. Handle multiple Proof of Delivery files uploading to MinIO
        if (dto.PhotoFiles != null && dto.PhotoFiles.Any())
        {
            foreach (var file in dto.PhotoFiles)
            {
                if (file == null || file.Length == 0) continue;

                string fileExtension = Path.GetExtension(file.FileName);
                // Using Guid.NewGuid() ensures multiple files within the same Delivery ID don't overwrite each other
                string storageKey = $"deliveries/{data.DeliveryID}/photos/{Guid.NewGuid()}{fileExtension}";

                using (var stream = file.OpenReadStream())
                {
                    await _storageService.UploadFileAsync(storageKey, stream, file.ContentType);
                }

                var documentRecord = new Document
                {
                    DeliveryID = data.DeliveryID,
                    InvoiceID = null,
                    StorageKey = storageKey,
                    FileName = file.FileName,
                    ContentType = file.ContentType,
                    Type = DocumentType.DeliveryPhoto,
                    UploadedAt = DateTime.UtcNow
                };

                _db.Documents.Add(documentRecord);
            }
        }

        // 5. Commit text updates and file entity traces in one atomic database transaction
        await _db.SaveChangesAsync();

        // 6. Execute system logging metrics
        var totalRejected = data.Lines?.Sum(l => l.PackQuantityRejected) ?? 0m;
        var hasRejections = totalRejected > 0m;
        
        await LogActivity(
            "DeliveryReceived",
            data.DeliveryNumber,
            hasRejections
                ? $"Delivery {data.DeliveryNumber} confirmed by {data.ReceiverName} with {totalRejected} rejections"
                : $"Delivery {data.DeliveryNumber} confirmed by {data.ReceiverName}",
            hasRejections ? "Warning" : "Success"
        );

        return Ok();
    }
    // Public endpoint for PIN verification - allows anonymous access
    [AllowAnonymous]
    [HttpPost("{token}/verify-pin")]
    public async Task<IActionResult> VerifyPin(Guid token, [FromBody] PinRequestDto request)
    {
        var delivery = await _db.DeliveryHeaders
            .Include(d => d.Customer)
            .FirstOrDefaultAsync(d => d.ReceiverToken == token);

        if (delivery == null)
            return NotFound();

        if (delivery.Customer.CustomerPin == request.Pin)
            return Ok(new { valid = true });

        return Unauthorized("Invalid PIN");
    }

    [HttpPost("dev/seed-deliveries")]
    public async Task<IActionResult> SeedDeliveries()
    {
        if (!_env.IsDevelopment())
        {
            return BadRequest("Not allowed outside development environment.");
        }

        var customers = await _db.Customers.ToListAsync();

        if (!customers.Any())
        {
            return BadRequest("No customers found. Please sync customers first.");
        }

        var rnd = new Random();
        var deliveries = new List<DeliveryHeader>();

        for (int i = 1; i <= 20; i++)
        {
            var customer = customers[rnd.Next(customers.Count)];
            var lineCount = rnd.Next(3, 6);

            var header = new DeliveryHeader
            {
                CustomerID = customer.CustomerID,
                DeliveryNumber = $"DLV-{DateTime.UtcNow:yyyyMMddHHmmss}-{i:D3}",
                DeliveryDate = DateTime.UtcNow.AddDays(rnd.Next(-30, 0)),
                DeliveryRemarks = "-",
                ReceiverToken = Guid.NewGuid(),
                Received = false,
                Invoiced = false
            };

            var lines = new List<DeliveryLine>();

            for (int j = 1; j <= lineCount; j++)
            {
                var packQuantity = (decimal)rnd.Next(5, 25);
                var salesQuantity = packQuantity * (decimal)rnd.Next(50, 100);

                lines.Add(new DeliveryLine
                {
                    DeliveryLineNumber = j.ToString(),
                    DeliveryItemCode = $"ITEM-{rnd.Next(100, 999):D3}",
                    DeliveryItemDescription = $"Sample Item {j}",
                    SalesQuantity = salesQuantity,
                    SalesUOM = "PCS",
                    PackQuantity = packQuantity,
                    PackUOM = "ROLL",
                    PackQuantityDelivered = 0,
                    PackQuantityReturned = 0,
                    PackQuantityRejected = 0
                });
            }

            header.Lines = lines;
            deliveries.Add(header);
        }

        _db.DeliveryHeaders.AddRange(deliveries);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            created = deliveries.Count,
            status = "All deliveries are on-going (not delivered)",
            message = $"Successfully seeded {deliveries.Count} deliveries with {deliveries.Sum(d => d.Lines.Count)} total lines"
        });
    }
}
