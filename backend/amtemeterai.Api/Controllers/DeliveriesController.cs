using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using amtemeterai.Api.Data;
using amtemeterai.Api.Dtos;
using amtemeterai.Api.Models;
using amtemeterai.Api.Helpers;
using amtemeterai.Api.Services;
using amtemeterai.Api.Config;
using System; // For Console
using System.Text.Json; // For JsonSerializer

namespace amtemeterai.Api.Controllers;

[ApiController]
[Route("api/deliveries")]
[Authorize]
public class DeliveriesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _env;
    private readonly IStorageService _storageService;
    private readonly string _googleApiKey;
    private readonly IHttpClientFactory _httpClientFactory; // 🚀 Added
    private readonly SapOptions _sapOptions;               // 🚀 Added
    // 🚀 ADD THESE TWO FIELDS HERE:
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DeliveriesController> _logger;

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
        IStorageService storageService,
        IConfiguration config,
        IHttpClientFactory httpClientFactory,              // 🚀 Added
        Microsoft.Extensions.Options.IOptions<SapOptions> sapOptions, // Use your existing options type name here
        IServiceProvider serviceProvider, // 🚀 Inject here
        ILogger<DeliveriesController> logger)
    {
        _db = db;
        _configuration = configuration;
        _env = env;
        _storageService = storageService;
        _httpClientFactory = httpClientFactory;
        _sapOptions = sapOptions.Value;
        _googleApiKey = config["GoogleMaps:ApiKey"] ?? string.Empty;
        // 🚀 ASSIGN THEM HERE:
        _serviceProvider = serviceProvider;
        _logger = logger;
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
                ReceiverToken = d.ReceiverToken,

                Plant = d.Plant,
                Type = d.Type,
                Status = d.Status,
                SalesPersonName = d.SalesPersonName,
                SalesPersonEmail = d.SalesPersonEmail,
                CityRegency = d.CityRegency,
                District = d.District,
                Province = d.Province,
                
                // 🚀 ADDED: Fetch raw database fields for cancellation projection
                CancelReason = d.CancelReason,
                IsCanceled = d.Status == DeliveryHeader.ReceiverStatus.Canceled,
                
                PhotosCount = _db.Documents.Count(p => 
                    p.DeliveryID == d.DeliveryID && 
                    p.Type == DocumentType.DeliveryPhoto)
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
            PublicUrl = $"{baseUrl}/receive/{d.ReceiverToken}",

            Plant = d.Plant,
            SalesPersonName = d.SalesPersonName,
            SalesPersonEmail = d.SalesPersonEmail,
            CityRegency = d.CityRegency,
            District = d.District,
            Province = d.Province,
            PhotosCount = d.PhotosCount,

            // 🚀 ADDED: Map fields into the final returned API contract list
            IsCanceled = d.IsCanceled,
            CancelReason = d.CancelReason,

            Type = (int?)d.Type,
            Status = (int?)d.Status
        }).ToList();

        return Ok(result);
    }

    [HttpGet("{deliveryId:int}")]
    public async Task<ActionResult<DeliveryResponseDto>> GetDeliveryById(int deliveryId)
    {
        // 1. Fetch core delivery header records along with customer information links
        var delivery = await _db.DeliveryHeaders
            .Include(d => d.Lines)
            .Include(d => d.Customer)
            .FirstOrDefaultAsync(d => d.DeliveryID == deliveryId);

        if (delivery == null)
            return NotFound();

        // 2. Fetch all associated proof files from your Documents table
        var baseApiUrl = _configuration["App:ApiBaseUrl"] ?? "http://localhost:8080";
        
        var photos = await _db.Documents
            .Where(doc => doc.DeliveryID == deliveryId && doc.Type == DocumentType.DeliveryPhoto)
            .Select(doc => new DeliveryPhotoResponseDto
            {
                FileName = doc.FileName,
                StorageKey = doc.StorageKey,
                DownloadUrl = $"{baseApiUrl.TrimEnd('/')}/api/deliveries/files/download?key={Uri.EscapeDataString(doc.StorageKey)}",
                UploadedAt = doc.UploadedAt
            })
            .ToListAsync();

        // 3. Assemble the unified data response payload
        var response = new DeliveryResponseDto
        {
            DeliveryID = delivery.DeliveryID,
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

            Plant = delivery.Plant,
            SalesPersonName = delivery.SalesPersonName,
            SalesPersonEmail = delivery.SalesPersonEmail,
            
            // 🚀 ADDED: Map cancellation tracking properties directly into the object schema
            CancelReason = delivery.CancelReason,
            IsCanceled = delivery.Status == DeliveryHeader.ReceiverStatus.Canceled,
            
            Type = (int)delivery.Type,
            Status = delivery.Status.HasValue ? (int)delivery.Status.Value : null,

            Latitude = delivery.Latitude,
            Longitude = delivery.Longitude,
            Province = delivery.Province,
            CityRegency = delivery.CityRegency,
            District = delivery.District,
            FormattedAddress = delivery.FormattedAddress,

            Photos = photos,

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
                PackQuantityRejected = l.PackQuantityRejected,
                
                LineComment = l.LineComment
            }).ToList()
        };

        return Ok(response);
    }

    // Public endpoint for delivery receive page - allows anonymous access after PIN verification

    //2026-05-20 02:19:23
    [AllowAnonymous]
    [HttpGet("{token}")]
    public async Task<IActionResult> Get(Guid token)
    {
        // 1. Fetch the delivery header and include lines safely
        var data = await _db.DeliveryHeaders
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.ReceiverToken == token);

        if (data == null) return NotFound();

        // 2. Map standard response parameters
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
                PackQuantityRejected = l.PackQuantityRejected,
                LineComment = l.LineComment
            }).ToList()
        };

        // 3. Look up related files straight from the Documents context table
        var associatedDocs = await _db.Documents
            .Where(d => d.DeliveryID == data.DeliveryID && d.Type == DocumentType.DeliveryPhoto)
            .ToListAsync();

        if (associatedDocs != null && associatedDocs.Any())
        {
            // Fetch your base URL configuration string dynamically
            string baseUrl = _configuration["App:ApiBaseUrl"] ?? "http://localhost:8080";
            // var baseUrl = "http://192.168.0.191";

            foreach (var doc in associatedDocs)
            {
                // Point the downloadUrl directly to your operational local DownloadFile route
                string localDownloadUrl = baseUrl + "/api/deliveries/files/download?key=" + Uri.EscapeDataString(doc.StorageKey);

                result.Photos.Add(new DeliveryPhotoResponseDto
                {
                    FileName = doc.FileName,
                    StorageKey = doc.StorageKey,
                    DownloadUrl = localDownloadUrl,
                    UploadedAt = doc.UploadedAt
                });
            }
        }

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
            
            // 1. ADDED: New Initialization Fields for Creation Context
            Plant = dto.Plant,
            SalesPersonName = dto.SalesPersonName,
            SalesPersonEmail = dto.SalesPersonEmail,
            
            // 2. ADDED: Explicit Cast from primitive int DTO input to nested model enum
            Type = (DeliveryHeader.DeliveryType)dto.Type,
            
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
        
        // 3. ADDED: Update mapping context fields on sync changes
        existing.Plant = dto.Plant;
        existing.SalesPersonName = dto.SalesPersonName;
        existing.SalesPersonEmail = dto.SalesPersonEmail;
        existing.Type = (DeliveryHeader.DeliveryType)dto.Type;
        
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
            // Note: LineComment is left out here on purpose because it's only populated 
            // later by the customer during driver handoff (UpdateByToken).
        }).ToList();

        await _db.SaveChangesAsync();
        return Ok();
    }
    // Public endpoint for delivery receive - allows anonymous access & repetitive edits until invoiced
    [AllowAnonymous]
    [HttpPatch("{token}")]
    public async Task<IActionResult> UpdateByToken(Guid token, [FromForm] DeliveryEditConfirmationDto dto)
    {
        // 1. Locate the delivery target header via its secure token
        var data = await _db.DeliveryHeaders
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.ReceiverToken == token);

        if (data == null) return NotFound();

        // 🛑 2. THE CRITICAL GUARD GATES: Block modification if already invoiced
        if (data.Invoiced)
        {
            return BadRequest("This delivery record is locked because it has already been invoiced.");
        }

        // 3. Process text payload field configurations (overwrite/update safely)
        data.ReceiverName = dto.ReceiverName;
        data.ReceiverNotes = dto.ReceiverNotes;
        data.Received = true; // Remains true once initially set

        // Only update location telemetry if new coordinates are sent
        if (dto.Latitude.HasValue && dto.Longitude.HasValue)
        {
            data.Latitude = dto.Latitude;
            data.Longitude = dto.Longitude;

            try
            {
                var geoData = await ReverseGeocodeAsync(dto.Latitude.Value, dto.Longitude.Value);
                if (geoData != null)
                {
                    data.Province = geoData.Province;
                    data.CityRegency = geoData.CityRegency;
                    data.District = geoData.District;
                    data.FormattedAddress = geoData.FormattedAddress;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Geocoding failed: {ex.Message}");
            }
        }

        // 🗑️ 4. NEW: Handle Document File Purges (MinIO + DB Sync Cleanup)
        if (dto.KeysToDelete != null && dto.KeysToDelete.Any())
        {
            foreach (var storageKey in dto.KeysToDelete)
            {
                if (string.IsNullOrEmpty(storageKey)) continue;

                // Find db record matching this specific key for this delivery
                var existingDoc = await _db.Documents
                    .FirstOrDefaultAsync(doc => doc.DeliveryID == data.DeliveryID && doc.StorageKey == storageKey);

                if (existingDoc != null)
                {
                    try
                    {
                        // 1. Physically wipe the asset from MinIO bucket
                        // (Adjust the method call below to match your exact IStorageService contract name, e.g., DeleteFileAsync)
                        await _storageService.DeleteFileAsync(storageKey); 
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"MinIO file deletion skipped/failed for {storageKey}: {ex.Message}");
                    }

                    // 2. Clear trace record tracking row out of database
                    _db.Documents.Remove(existingDoc);
                }
            }
        }

        // 5. Process lines securely and dynamically calculate variance thresholds
        bool hasDiscrepancy = false;

        if (data.Lines != null && dto.Lines != null && dto.Lines.Any())
        {
            foreach (var lineDto in dto.Lines)
            {
                if (lineDto == null) continue;

                var line = data.Lines.FirstOrDefault(x => x.DeliveryLineNumber == lineDto.DeliveryLineNumber);
                if (line == null) continue; 

                // Overwrite old data with fresh corrections from the customer form
                line.PackQuantityDelivered = lineDto.PackQuantityDelivered;
                line.PackQuantityReturned = lineDto.PackQuantityReturned;
                line.PackQuantityRejected = lineDto.PackQuantityRejected;
                line.LineComment = lineDto.LineComment;

                // 🚀 FIX: A discrepancy exists if there are explicit returns/rejections,
                // OR if the total sum of delivered + returned + rejected quantities does not equal the original order PackQuantity.
                decimal totalAccounted = line.PackQuantityDelivered + line.PackQuantityReturned + line.PackQuantityRejected;

                if (line.PackQuantityReturned > 0m || 
                    line.PackQuantityRejected > 0m || 
                    totalAccounted != line.PackQuantity) // Handles items lost or short-delivered
                {
                    hasDiscrepancy = true;
                }
            }
        }

        // 6. Auto-assign/reset status based on the latest edit quantities
        data.Status = hasDiscrepancy 
            ? DeliveryHeader.ReceiverStatus.PartialReceived 
            : DeliveryHeader.ReceiverStatus.FullyReceived;

        // ➕ 7. Handle freshly appended Photo Upload sets to MinIO
        if (dto.NewPhotoFiles != null && dto.NewPhotoFiles.Any())
        {
            foreach (var file in dto.NewPhotoFiles)
            {
                if (file == null || file.Length == 0) continue;

                string fileExtension = Path.GetExtension(file.FileName);
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
        }// =========================================================
        // 🚀 NEW: TRANSACTION INTEGRATION LAYER FOR SAP ERP
        // =========================================================
        try
        {
            var sapPayload = new SapDeliveryConfirmationPayload
            {
                CustomerCode = data.Customer?.CustomerCode ?? string.Empty,
                DeliveryNumber = data.DeliveryNumber,
                ReceiverName = data.ReceiverName ?? string.Empty,
                ReceiverStatus = hasDiscrepancy ? "2" : "1", 
                ReceiverNotes = data.ReceiverNotes ?? string.Empty,
                Lines = data.Lines.Select(l => new SapDeliveryLinePayload
                {
                    DeliveryLineNumber = l.DeliveryLineNumber,
                    DeliveredQuantity = l.PackQuantityDelivered,
                    RejectedQuantity = l.PackQuantityRejected,
                    ReturnedQuantity = l.PackQuantityReturned,
                    LineComment = l.LineComment ?? ""
                }).ToList()
            };
            var jsonOptions = new JsonSerializerOptions { WriteIndented = true };
            string jsonString = JsonSerializer.Serialize(sapPayload, jsonOptions);

            Console.WriteLine("=================== SAP PAYLOAD DEBUG ===================");
            Console.WriteLine(jsonString);
            Console.WriteLine("=========================================================");
            // Pull standard client template configured via dynamic named factory inside Program.cs
            var client = _httpClientFactory.CreateClient("SapClient");

            // Point to your exact endpoint format path string: /sap/bc/zrest_doconfirm
            string endpointPath = $"/sap/bc/zrest_doconfirm?sap-client={_sapOptions.Client}";

            var response = await client.PostAsJsonAsync(endpointPath, sapPayload);

            if (!response.IsSuccessStatusCode)
            {
                string errorResponse = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"SAP error response content: {response.StatusCode} - {errorResponse}");
                
                // Fail-safe: Reject database commit if the core enterprise sync pipeline fails

                // Activate this after fix discrepancy
                return StatusCode(502, $"ERP Synchronization Error: Remote server returned status {response.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Critical network exception thrown during SAP post sequence: {ex.Message}");
            return StatusCode(500, $"Internal server error routing data to ERP infrastructure: {ex.Message}");
        }

        // 8. Commit updates atomically (Only executes if SAP synchronization was completely successful)
        await _db.SaveChangesAsync();

        // ====================================================================
        // 🚀 AUTOMATED NOTIFICATION LAYER TRIGGER: Background Thread Allocation
        // ====================================================================
        var trackingId = data.DeliveryID;
        _ = Task.Run(async () =>
        {
            try
            {
                using (var scope = _serviceProvider.CreateScope())
                {
                    var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
                    await emailService.SendDeliveryConfirmationEmailAsync(trackingId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Background email alert process faulted unexpectedly for Delivery Record ID {Id}", trackingId);
            }
        });


        // 9. 🚀 DYNAMIC LOG METRICS WITH EXACT SHORTAGE QUANTITIES
        var totalRejected = data.Lines?.Sum(l => l.PackQuantityRejected) ?? 0m;
        var totalReturned = data.Lines?.Sum(l => l.PackQuantityReturned) ?? 0m;
        
        // Calculate exact total missing/shortage items across all lines
        decimal totalShortage = 0m;
        if (data.Lines != null)
        {
            foreach (var line in data.Lines)
            {
                decimal accountedForThisLine = line.PackQuantityDelivered + line.PackQuantityReturned + line.PackQuantityRejected;
                if (accountedForThisLine < line.PackQuantity)
                {
                    totalShortage += (line.PackQuantity - accountedForThisLine);
                }
            }
        }

        // Base message structure
        string logMessage = $"Delivery {data.DeliveryNumber} confirmed by {data.ReceiverName} and synced to SAP.";
        
        // Dynamically build the details segments
        var details = new List<string>();
        
        if (totalRejected > 0m) details.Add($"{totalRejected:0} item(s) rejected");
        if (totalReturned > 0m) details.Add($"{totalReturned:0} item(s) returned");
        if (totalShortage > 0m) details.Add($"{totalShortage:0} item(s) short-delivered/unaccounted for");

        // Combine segments into the final string
        if (details.Any())
        {
            logMessage += $" Summary: {string.Join(", ", details)}.";
        }
        else
        {
            logMessage += " Status: Fully cleared with zero variances.";
        }

        // Broadcast to ActivityLog table and Terminal console
        await LogActivity(
            "DeliveryConfirmationUpdated",
            data.DeliveryNumber,
            logMessage,
            hasDiscrepancy ? "Warning" : "Info"
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

    private async Task<GeoLocationResult?> ReverseGeocodeAsync(double lat, double lng)
    {
        using var client = new HttpClient();
        string url = $"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&key={_googleApiKey}";
        // Temporary debug check inside ReverseGeocodeAsync
        var jsonString = await client.GetStringAsync(url);
        Console.WriteLine("=== RAW GOOGLE RESPONSE FOR LAPTOP ===");
        Console.WriteLine(jsonString);
        Console.WriteLine("======================================");
        var response = await client.GetFromJsonAsync<GoogleGeocodeResponse>(url);
        if (response?.Results == null || !response.Results.Any()) return null;

        var result = new GeoLocationResult
        {
            // Keep the most precise formatted address string
            FormattedAddress = response.Results.First().FormattedAddress
        };

        // 💡 THE FIX: Loop through the top few result objects to aggregate missing boundaries
        foreach (var resultObject in response.Results.Take(3)) 
        {
            foreach (var component in resultObject.AddressComponents)
            {
                // Only fill if not already found by a previous, more precise layer
                if (string.IsNullOrEmpty(result.Province) && component.Types.Contains("administrative_area_level_1"))
                    result.Province = component.LongName;
                
                if (string.IsNullOrEmpty(result.CityRegency) && component.Types.Contains("administrative_area_level_2"))
                    result.CityRegency = component.LongName;
                    
                if (string.IsNullOrEmpty(result.District) && component.Types.Contains("administrative_area_level_3"))
                    result.District = component.LongName;
            }

            // If we've successfully filled all structural targets, break out early!
            if (!string.IsNullOrEmpty(result.Province) && 
                !string.IsNullOrEmpty(result.CityRegency) && 
                !string.IsNullOrEmpty(result.District))
            {
                break;
            }
        }

        return result;
    }

    [AllowAnonymous]
    [HttpGet("files/download")] // Using a distinct path to avoid route conflicts!
    public async Task<IActionResult> DownloadFile([FromQuery] string key)
    {
        if (string.IsNullOrEmpty(key)) 
            return BadRequest("Storage key is required.");

        try
        {
            // 1. Get the raw stream from MinIO using your storage service
            Stream fileStream = await _storageService.GetFileStreamAsync(key);
            
            if (fileStream == null) 
                return NotFound("File not found in object storage.");

            // 2. Set the proper image content type headers so the browser renders it
            string contentType = "application/octet-stream";
            if (key.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase) || key.EndsWith(".jpeg", StringComparison.OrdinalIgnoreCase))
                contentType = "image/jpeg";
            else if (key.EndsWith(".png", StringComparison.OrdinalIgnoreCase))
                contentType = "image/png";

            // 3. Stream it straight to the browser
            return File(fileStream, contentType);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal storage error: {ex.Message}");
        }
    }
    
    // =========================================================
    // 🚀 NEW: CANCELLATION ENGINE WITH TRANSITIONAL GATES
    // =========================================================
    [HttpPost("cancel/{deliveryNumber}")]
    // [Authorize(Roles = "Admin,Operator")]
    public async Task<IActionResult> CancelDelivery(string deliveryNumber, [FromBody] CancelDeliveryDto dto)
    {
        if (string.IsNullOrWhiteSpace(deliveryNumber))
            return BadRequest("Delivery number parameter cannot be blank.");

        var delivery = await _db.DeliveryHeaders
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.DeliveryNumber == deliveryNumber);

        if (delivery == null) 
            return NotFound($"Delivery record {deliveryNumber} does not exist in the infrastructure.");

        // 🛑 VALIDATION GUARD GATES
        if (delivery.Invoiced)
            return BadRequest("Operation Refused: This delivery record is locked because it has already been invoiced.");

        if (delivery.Received || delivery.Status == DeliveryHeader.ReceiverStatus.FullyReceived || delivery.Status == DeliveryHeader.ReceiverStatus.PartialReceived)
            return BadRequest("Operation Refused: This delivery cannot be canceled as confirmation data has already been recorded by the recipient.");

        if (delivery.Status == DeliveryHeader.ReceiverStatus.Canceled)
            return BadRequest("This delivery record has already been transitioned to a canceled status.");

        // 🔄 1. State Mutation Layer
        delivery.Status = DeliveryHeader.ReceiverStatus.Canceled;
        delivery.ReceiverToken = Guid.Empty; // Revoke tracking link access instantly
        
        // 🚀 ADDED: Persist the reason string directly to your database column record
        string traceReason = string.IsNullOrWhiteSpace(dto?.Reason) ? "No contextual reason provided." : dto.Reason;
        delivery.CancelReason = traceReason; 

        // 💾 2. Commit changes atomically to PostgreSQL
        await _db.SaveChangesAsync();

        // 📝 3. Systemic Activity Audit Trail Logging
        await LogActivity(
            "DeliveryCanceled",
            delivery.DeliveryNumber,
            $"Delivery canceled by operator. Reason context: {traceReason}",
            "Warning"
        );

        return Ok(new { success = true, message = $"Delivery {deliveryNumber} has been successfully canceled and reason recorded." });
    }
}
