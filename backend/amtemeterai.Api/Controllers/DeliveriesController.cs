using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using amtemeterai.Api.Data;
using amtemeterai.Api.Dtos;
using amtemeterai.Api.Models;
using amtemeterai.Api.Helpers;
using amtemeterai.Api.Services;
using amtemeterai.Api.Config;
using System; 
using System.Text.Json; 
using Microsoft.AspNetCore.Http.Features;

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
    private readonly IHttpClientFactory _httpClientFactory; 
    private readonly SapOptions _sapOptions;               
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
        IHttpClientFactory httpClientFactory,              
        Microsoft.Extensions.Options.IOptions<SapOptions> sapOptions, 
        IServiceProvider serviceProvider, 
        ILogger<DeliveriesController> logger)
    {
        _db = db;
        _configuration = configuration;
        _env = env;
        _storageService = storageService;
        _httpClientFactory = httpClientFactory;
        _sapOptions = sapOptions.Value;
        _googleApiKey = config["GoogleMaps:ApiKey"] ?? string.Empty;
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

        // 🚀 1. CEK CONFIG MATRIX RBAC & CLAIMS DATA PLANT
        var isSysAdmin = User.IsInRole("sysadmin");
        
        // Buat basic IQueryable query stream
        var query = _db.DeliveryHeaders.AsQueryable();

        // 🚀 2. SUNTIKKAN DATA-LEVEL PRIVACY ENFORCEMENT FILTER
        if (!isSysAdmin)
        {
            // Ambil semua daftar kode plant dari Token JWT milik user yang sedang aktif
            var allowedPlants = User.FindAll("plant").Select(c => c.Value).ToList();

            if (!allowedPlants.Any())
            {
                // Jika user biasa tidak punya mapping plant sama sekali, block data & kembalikan list kosong
                return Ok(new List<DeliveryHeaderDto>());
            }

            // Filter data PostgreSQL secara dinamis: Hanya ambil delivery yang kodenya ada di dalam klaim tokenquery = query.Where(d => allowedPlants.Contains(d.Plant ?? ""));
        }

        // 3. CEK ROLE UNTUK DATA VISIBILITY
        var isWarehouseRole = User.IsInRole("warehouse");

        // 4. Eksekusi penarikan data yang sudah ter-filter aman
        var deliveries = await query
            .Include(d => d.Customer)
            .Select(d => new
            {
                DeliveryId = d.DeliveryID,
                DeliveryNumber = d.DeliveryNumber,
                DeliveryDate = d.DeliveryDate,
                DeliveryRemarks = d.DeliveryRemarks,

                // Conditional: Hide customer info for warehouse role
                CustomerCode = isWarehouseRole ? (string?)null : (d.Customer != null ? d.Customer.CustomerCode : "UNKNOWN"),
                CustomerName = isWarehouseRole ? (string?)null : (d.Customer != null ? d.Customer.CustomerName : "UNKNOWN"),

                Received = d.Received,
                ReceiveDate = d.ReceiveDate,
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
            CustomerCode = d.CustomerCode ?? string.Empty,
            CustomerName = d.CustomerName ?? string.Empty,
            Received = d.Received,
            ReceiveDate = d.ReceiveDate,
            Invoiced = d.Invoiced,
            PublicUrl = $"{baseUrl}/receive/{d.ReceiverToken}",

            Plant = d.Plant,
            SalesPersonName = d.SalesPersonName,
            SalesPersonEmail = d.SalesPersonEmail,
            CityRegency = d.CityRegency,
            District = d.District,
            Province = d.Province,
            PhotosCount = d.PhotosCount,

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
        // 🚀 1. CEK ROLE UNTUK DATA VISIBILITY
        var isSysAdmin = User.IsInRole("sysadmin");
        var isWarehouseRole = User.IsInRole("warehouse");

        // 🚀 2. TARIK DATA UNTUK DICHECK TERLEBIH DAHULU
        var delivery = await _db.DeliveryHeaders
            .Include(d => d.Lines)
            .Include(d => d.Customer)
            .FirstOrDefaultAsync(d => d.DeliveryID == deliveryId);

        if (delivery == null)
            return NotFound();

        // 🚀 3. SECURITY GUARD CLAIMS VALIDATION FOR DIRECT URL INJECTION (ID GUESSING)
        if (!isSysAdmin)
        {
            var allowedPlants = User.FindAll("plant").Select(c => c.Value).ToList();

            // Jika user mencoba menebak ID delivery milik plant lain, paksa return 403 Forbidden!
            if (!allowedPlants.Contains(delivery.Plant ?? ""))
            {
                return Forbid();
            }
        }

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

        var response = new DeliveryResponseDto
        {
            DeliveryID = delivery.DeliveryID,
            DeliveryNumber = delivery.DeliveryNumber,
            DeliveryDate = delivery.DeliveryDate,
            DeliveryRemarks = delivery.DeliveryRemarks,
            ShipToAddress = delivery.ShipToAddress,
            // Conditional: Hide OrderNumber and BuyerPONumber for warehouse role
            OrderNumber = isWarehouseRole ? null : delivery.OrderNumber,
            BuyerPONumber = isWarehouseRole ? null : delivery.BuyerPONumber,
            // Conditional: Hide CustomerCode and CustomerName for warehouse role
            CustomerCode = isWarehouseRole ? string.Empty : (delivery.Customer?.CustomerCode ?? "UNKNOWN"),
            CustomerName = isWarehouseRole ? string.Empty : (delivery.Customer?.CustomerName ?? "UNKNOWN"),
            ReceiverToken = delivery.ReceiverToken,
            ReceiverName = delivery.ReceiverName,
            ReceiverNotes = delivery.ReceiverNotes,
            Received = delivery.Received,
            ReceiveDate = delivery.ReceiveDate,
            Invoiced = delivery.Invoiced,
            PublicUrl = GetPublicUrl(delivery.ReceiverToken, _configuration["App:PublicBaseUrl"]),

            Plant = delivery.Plant,
            SalesPersonName = delivery.SalesPersonName,
            SalesPersonEmail = delivery.SalesPersonEmail,

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

            Lines = (delivery.Lines ?? new List<DeliveryLine>()).Select(l => new DeliveryLineResponseDto
            {
                DeliveryLineNumber = l.DeliveryLineNumber,
                DeliveryItemCode = l.DeliveryItemCode,
                DeliveryItemDescription = l.DeliveryItemDescription,
                BatchNumber = l.BatchNumber,
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

    [AllowAnonymous]
    [HttpGet("{token}")]
    public async Task<IActionResult> Get(Guid token)
    {
        var data = await _db.DeliveryHeaders
            .Include(x => x.Lines)
            .Include(x => x.Customer)
            .FirstOrDefaultAsync(x => x.ReceiverToken == token);

        if (data == null) return NotFound();

        // 🚀 FIX FOR CS9035: Map required customer strings for anonymous access link
        var result = new DeliveryResponseDto
        {
            DeliveryID = data.DeliveryID,
            DeliveryNumber = data.DeliveryNumber,
            DeliveryDate = data.DeliveryDate,
            DeliveryRemarks = data.DeliveryRemarks,
            ShipToAddress = data.ShipToAddress,
            CustomerCode = data.Customer?.CustomerCode ?? "UNKNOWN",
            CustomerName = data.Customer?.CustomerName ?? "UNKNOWN",
            OrderNumber = data.OrderNumber,
            BuyerPONumber = data.BuyerPONumber,
            ReceiverToken = data.ReceiverToken,
            ReceiverName = data.ReceiverName,
            ReceiverNotes = data.ReceiverNotes,
            Received = data.Received,
            ReceiveDate = data.ReceiveDate,
            Invoiced = data.Invoiced,
            PublicUrl = GetPublicUrl(data.ReceiverToken, _configuration["App:PublicBaseUrl"]),
            Lines = (data.Lines ?? new List<DeliveryLine>()).Select(l => new DeliveryLineResponseDto
            {
                DeliveryLineNumber = l.DeliveryLineNumber,
                DeliveryItemCode = l.DeliveryItemCode,
                DeliveryItemDescription = l.DeliveryItemDescription,
                BatchNumber = l.BatchNumber,
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

        var associatedDocs = await _db.Documents
            .Where(d => d.DeliveryID == data.DeliveryID && d.Type == DocumentType.DeliveryPhoto)
            .ToListAsync();

        if (associatedDocs != null && associatedDocs.Any())
        {
            string baseUrl = _configuration["App:ApiBaseUrl"] ?? "http://localhost:8080";

            foreach (var doc in associatedDocs)
            {
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
            ShipToAddress = dto.ShipToAddress,
            Plant = dto.Plant,
            SalesPersonName = dto.SalesPersonName,
            SalesPersonEmail = dto.SalesPersonEmail,
            OrderNumber = dto.OrderNumber,
            BuyerPONumber = dto.BuyerPONumber,
            Type = (DeliveryHeader.DeliveryType)dto.Type,
            ReceiverToken = Guid.NewGuid()
        };

        header.Lines = dto.Lines.Select(l => new DeliveryLine
        {
            DeliveryLineNumber = l.DeliveryLineNumber,
            DeliveryItemCode = l.DeliveryItemCode,
            DeliveryItemDescription = l.DeliveryItemDescription,
            BatchNumber = l.BatchNumber,
            SalesQuantity = l.SalesQuantity,
            SalesUOM = l.SalesUOM,
            PackQuantity = l.PackQuantity,
            PackUOM = l.PackUOM
        }).ToList();

        _db.DeliveryHeaders.Add(header);
        await _db.SaveChangesAsync();

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
        existing.ShipToAddress = dto.ShipToAddress;
        existing.Plant = dto.Plant;
        existing.SalesPersonName = dto.SalesPersonName;
        existing.SalesPersonEmail = dto.SalesPersonEmail;
        existing.OrderNumber = dto.OrderNumber;
        existing.BuyerPONumber = dto.BuyerPONumber;
        existing.Type = (DeliveryHeader.DeliveryType)dto.Type;
        
        _db.DeliveryLines.RemoveRange(existing.Lines);

        existing.Lines = dto.Lines.Select(l => new DeliveryLine
        {
            DeliveryLineNumber = l.DeliveryLineNumber,
            DeliveryItemCode = l.DeliveryItemCode,
            DeliveryItemDescription = l.DeliveryItemDescription,
            BatchNumber = l.BatchNumber,
            SalesQuantity = l.SalesQuantity,
            SalesUOM = l.SalesUOM,
            PackQuantity = l.PackQuantity,
            PackUOM = l.PackUOM
        }).ToList();

        await _db.SaveChangesAsync();
        return Ok();
    }

    [AllowAnonymous]
    [HttpPatch("{token}")]
    public async Task<IActionResult> UpdateByToken(Guid token, [FromForm] DeliveryEditConfirmationDto dto)
    {
        var data = await _db.DeliveryHeaders
            .Include(x => x.Lines)
            .Include(x => x.Customer)
            .FirstOrDefaultAsync(x => x.ReceiverToken == token);

        if (data == null) return NotFound();

        if (data.Invoiced)
        {
            return BadRequest("This delivery record is locked because it has already been invoiced.");
        }

        data.ReceiverName = dto.ReceiverName;
        data.ReceiverNotes = dto.ReceiverNotes;
        data.Received = true;
        data.ReceiveDate = dto.ReceiveDate ?? DateTime.UtcNow; 

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

        if (dto.KeysToDelete != null && dto.KeysToDelete.Any())
        {
            foreach (var storageKey in dto.KeysToDelete)
            {
                if (string.IsNullOrEmpty(storageKey)) continue;

                var existingDoc = await _db.Documents
                    .FirstOrDefaultAsync(doc => doc.DeliveryID == data.DeliveryID && doc.StorageKey == storageKey);

                if (existingDoc != null)
                {
                    try
                    {
                        await _storageService.DeleteFileAsync(storageKey); 
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"MinIO file deletion skipped/failed for {storageKey}: {ex.Message}");
                    }

                    _db.Documents.Remove(existingDoc);
                }
            }
        }

        bool hasDiscrepancy = false;

        if (data.Lines != null && dto.Lines != null && dto.Lines.Any())
        {
            foreach (var lineDto in dto.Lines)
            {
                if (lineDto == null) continue;

                var line = data.Lines.FirstOrDefault(x => x.DeliveryLineNumber == lineDto.DeliveryLineNumber);
                if (line == null) continue; 

                line.PackQuantityDelivered = lineDto.PackQuantityDelivered;
                line.PackQuantityReturned = lineDto.PackQuantityReturned;
                line.PackQuantityRejected = lineDto.PackQuantityRejected;
                line.LineComment = lineDto.LineComment;

                decimal totalAccounted = line.PackQuantityDelivered + line.PackQuantityReturned + line.PackQuantityRejected;

                if (line.PackQuantityReturned > 0m || 
                    line.PackQuantityRejected > 0m || 
                    totalAccounted != line.PackQuantity) 
                {
                    hasDiscrepancy = true;
                }
            }
        }

        data.Status = hasDiscrepancy 
            ? DeliveryHeader.ReceiverStatus.PartialReceived 
            : DeliveryHeader.ReceiverStatus.FullyReceived;

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
        }

        try
        {
            var sapPayload = new SapDeliveryConfirmationPayload
            {
                CustomerCode = data.Customer?.CustomerCode ?? string.Empty,
                DeliveryNumber = data.DeliveryNumber,
                ReceiverName = data.ReceiverName ?? string.Empty,
                ReceiverStatus = hasDiscrepancy ? "2" : "1",
                ReceiverNotes = data.ReceiverNotes ?? string.Empty,
                // 🚀 FIX FOR CS8604: Wrap the collection inside a null-coalescing guard fallback
                Lines = (data.Lines ?? Enumerable.Empty<DeliveryLine>()).Select(l =>
                {
                    // Calculate variance percent based on DeliveryReceivePage formula
                    // variancePercent = ((delivered + returned + rejected - packQuantity) / packQuantity) * 100
                    // Returns numeric value only (e.g., 200 for 200%, 12.5 for 12.5%)
                    decimal totalActual = l.PackQuantityDelivered + l.PackQuantityReturned + l.PackQuantityRejected;
                    decimal rawVariance = totalActual - l.PackQuantity;
                    decimal percentCalc = l.PackQuantity > 0 ? (rawVariance / l.PackQuantity) * 100 : 0;

                    return new SapDeliveryLinePayload
                    {
                        DeliveryLineNumber = l.DeliveryLineNumber,
                        DeliveredQuantity = l.PackQuantityDelivered,
                        RejectedQuantity = l.PackQuantityRejected,
                        ReturnedQuantity = l.PackQuantityReturned,
                        LineComment = l.LineComment ?? "",
                        VariancePercent = percentCalc
                    };
                }).ToList()
            };
            var jsonOptions = new JsonSerializerOptions { WriteIndented = true };
            string jsonString = JsonSerializer.Serialize(sapPayload, jsonOptions);

            Console.WriteLine("=================== SAP PAYLOAD DEBUG ===================");
            Console.WriteLine(jsonString);
            Console.WriteLine("=========================================================");
            
            var client = _httpClientFactory.CreateClient("SapClient");
            string endpointPath = $"/sap/bc/zrest_doconfirm?sap-client={_sapOptions.Client}";

            var response = await client.PostAsJsonAsync(endpointPath, sapPayload);

            if (!response.IsSuccessStatusCode)
            {
                string errorResponse = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"SAP error response content: {response.StatusCode} - {errorResponse}");
                return StatusCode(502, $"ERP Synchronization Error: Remote server returned status {response.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Critical network exception thrown during SAP post sequence: {ex.Message}");
            return StatusCode(500, $"Internal server error routing data to ERP infrastructure: {ex.Message}");
        }

        await _db.SaveChangesAsync();

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

        var totalRejected = data.Lines?.Sum(l => l.PackQuantityRejected) ?? 0m;
        var totalReturned = data.Lines?.Sum(l => l.PackQuantityReturned) ?? 0m;
        
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

        string logMessage = $"Delivery {data.DeliveryNumber} confirmed by {data.ReceiverName} and synced to SAP.";
        var details = new List<string>();
        
        if (totalRejected > 0m) details.Add($"{totalRejected:0} item(s) rejected");
        if (totalReturned > 0m) details.Add($"{totalReturned:0} item(s) returned");
        if (totalShortage > 0m) details.Add($"{totalShortage:0} item(s) short-delivered/unaccounted for");

        if (details.Any())
        {
            logMessage += $" Summary: {string.Join(", ", details)}.";
        }
        else
        {
            logMessage += " Status: Fully cleared with zero variances.";
        }

        await LogActivity(
            "DeliveryConfirmationUpdated",
            data.DeliveryNumber,
            logMessage,
            hasDiscrepancy ? "Warning" : "Info"
        );

        return Ok();
    }

    [AllowAnonymous]
    [HttpPost("{token}/verify-pin")]
    public async Task<IActionResult> VerifyPin(Guid token, [FromBody] PinRequestDto request)
    {
        var delivery = await _db.DeliveryHeaders
            .Include(d => d.Customer)
            .FirstOrDefaultAsync(d => d.ReceiverToken == token);

        if (delivery == null)
            return NotFound();

        if (delivery.Customer != null && delivery.Customer.CustomerPin == request.Pin)
            return Ok(new { valid = true });

        return Unauthorized("Invalid PIN");
    }

    [AllowAnonymous]
    [HttpPost("public/request-pin")]
    public async Task<ActionResult<RequestPinResponseDto>> RequestPin([FromBody] RequestPinDto dto)
    {
        if (dto.ReceiverToken == Guid.Empty)
        {
            return BadRequest(new RequestPinResponseDto
            {
                Success = false,
                Message = "Invalid receiver token.",
                SentTo = string.Empty
            });
        }

        var delivery = await _db.DeliveryHeaders
            .Include(d => d.Customer)
            .FirstOrDefaultAsync(d => d.ReceiverToken == dto.ReceiverToken);

        if (delivery == null)
        {
            return NotFound(new RequestPinResponseDto
            {
                Success = false,
                Message = "Delivery not found or link has expired.",
                SentTo = string.Empty
            });
        }

        var customerEmail = delivery.Customer?.CustomerEmail;
        var customerPin = delivery.Customer?.CustomerPin;

        if (string.IsNullOrWhiteSpace(customerEmail))
        {
            return BadRequest(new RequestPinResponseDto
            {
                Success = false,
                Message = "No email registered for this customer.",
                SentTo = string.Empty
            });
        }

        if (string.IsNullOrWhiteSpace(customerPin))
        {
            return BadRequest(new RequestPinResponseDto
            {
                Success = false,
                Message = "No security PIN configured for this customer.",
                SentTo = string.Empty
            });
        }

        try
        {
            using var scope = _serviceProvider.CreateScope();
            var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();

            bool emailSent = await emailService.SendPinEmailAsync(customerEmail, customerPin, delivery.DeliveryNumber);

            if (!emailSent)
            {
                return StatusCode(500, new RequestPinResponseDto
                {
                    Success = false,
                    Message = "Failed to send PIN email. Please try again.",
                    SentTo = string.Empty
                });
            }

            await LogActivity(
                "PinRequested",
                delivery.DeliveryNumber,
                $"PIN requested and sent to masked email address",
                "Info"
            );

            _logger.LogInformation(
                "PIN requested for delivery {DeliveryNumber} and sent to {Email}",
                delivery.DeliveryNumber,
                customerEmail);

            return Ok(new RequestPinResponseDto
            {
                Success = true,
                Message = "Verification PIN dispatched successfully.",
                SentTo = MaskEmail(customerEmail)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending PIN for delivery {DeliveryNumber}", delivery.DeliveryNumber);
            return StatusCode(500, new RequestPinResponseDto
            {
                Success = false,
                Message = "An error occurred while sending the PIN. Please try again.",
                SentTo = string.Empty
            });
        }
    }
    
    private static string MaskEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return string.Empty;

        var trimmed = email.Trim();
        var atIndex = trimmed.IndexOf('@');
        
        if (atIndex <= 0)
            return "***";

        var localPart = trimmed.Substring(0, atIndex);
        var domainPart = trimmed.Substring(atIndex); 

        char firstChar = char.ToLower(localPart[0]);

        return $"{firstChar}***{domainPart}";
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
        
        var jsonString = await client.GetStringAsync(url);
        Console.WriteLine("=== RAW GOOGLE RESPONSE FOR LAPTOP ===");
        Console.WriteLine(jsonString);
        Console.WriteLine("======================================");
        var response = await client.GetFromJsonAsync<GoogleGeocodeResponse>(url);
        if (response?.Results == null || !response.Results.Any()) return null;

        var result = new GeoLocationResult
        {
            FormattedAddress = response.Results.First().FormattedAddress
        };

        foreach (var resultObject in response.Results.Take(3)) 
        {
            foreach (var component in resultObject.AddressComponents)
            {
                if (string.IsNullOrEmpty(result.Province) && component.Types.Contains("administrative_area_level_1"))
                    result.Province = component.LongName;
                
                if (string.IsNullOrEmpty(result.CityRegency) && component.Types.Contains("administrative_area_level_2"))
                    result.CityRegency = component.LongName;
                    
                if (string.IsNullOrEmpty(result.District) && component.Types.Contains("administrative_area_level_3"))
                    result.District = component.LongName;
            }

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
    [HttpGet("files/download")] 
    public async Task<IActionResult> DownloadFile([FromQuery] string key)
    {
        if (string.IsNullOrEmpty(key)) 
            return BadRequest("Storage key is required.");

        try
        {
            Stream fileStream = await _storageService.GetFileStreamAsync(key);
            
            if (fileStream == null) 
                return NotFound("File not found in object storage.");

            string contentType = "application/octet-stream";
            if (key.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase) || key.EndsWith(".jpeg", StringComparison.OrdinalIgnoreCase))
                contentType = "image/jpeg";
            else if (key.EndsWith(".png", StringComparison.OrdinalIgnoreCase))
                contentType = "image/png";

            return File(fileStream, contentType);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal storage error: {ex.Message}");
        }
    }
    
    [HttpPost("cancel/{deliveryNumber}")]
    public async Task<IActionResult> CancelDelivery(string deliveryNumber, [FromBody] CancelDeliveryDto dto)
    {
        if (string.IsNullOrWhiteSpace(deliveryNumber))
            return BadRequest("Delivery number parameter cannot be blank.");

        var delivery = await _db.DeliveryHeaders
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.DeliveryNumber == deliveryNumber);

        if (delivery == null)
            return NotFound($"Delivery record {deliveryNumber} does not exist in the infrastructure.");

        if (delivery.Invoiced)
            return BadRequest("Operation Refused: This delivery record is locked because it has already been invoiced.");

        if (delivery.Received || delivery.Status == DeliveryHeader.ReceiverStatus.FullyReceived || delivery.Status == DeliveryHeader.ReceiverStatus.PartialReceived)
            return BadRequest("Operation Refused: This delivery cannot be canceled as confirmation data has already been recorded by the recipient.");

        if (delivery.Status == DeliveryHeader.ReceiverStatus.Canceled)
            return BadRequest("This delivery record has already been transitioned to a canceled status.");

        delivery.Status = DeliveryHeader.ReceiverStatus.Canceled;
        delivery.ReceiverToken = Guid.Empty; 

        string traceReason = string.IsNullOrWhiteSpace(dto?.Reason) ? "No contextual reason provided." : dto.Reason;
        delivery.CancelReason = traceReason;

        await _db.SaveChangesAsync();

        await LogActivity(
            "DeliveryCanceled",
            delivery.DeliveryNumber,
            $"Delivery canceled by operator. Reason context: {traceReason}",
            "Warning"
        );

        return Ok(new { success = true, message = $"Delivery {deliveryNumber} has been successfully canceled and reason recorded." });
    }

    /// <summary>
    /// Upload delivery printout using internal delivery ID (Legacy endpoint)
    /// </summary>
    [HttpPost("{deliveryId:int}/upload-printout")]
    [Authorize]
    public async Task<IActionResult> UploadDeliveryPrintout(int deliveryId, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("File is required.");

        var delivery = await _db.DeliveryHeaders
            .FirstOrDefaultAsync(d => d.DeliveryID == deliveryId);

        if (delivery == null)
            return NotFound($"Delivery with ID {deliveryId} not found.");

        return await UploadDeliveryPrintoutInternal(delivery, file);
    }

    /// <summary>
    /// Upload delivery printout using SAP-native delivery number (New endpoint)
    /// This is the preferred method for integration with SAP systems
    /// </summary>
    [HttpPost("by-number/{deliveryNumber}/upload-printout")]
    [Authorize]
    public async Task<IActionResult> UploadDeliveryPrintoutByNumber(string deliveryNumber, IFormFile file)
    {
        if (string.IsNullOrWhiteSpace(deliveryNumber))
            return BadRequest("Delivery number is required.");

        if (file == null || file.Length == 0)
            return BadRequest("File is required.");

        var delivery = await _db.DeliveryHeaders
            .FirstOrDefaultAsync(d => d.DeliveryNumber == deliveryNumber);

        if (delivery == null)
            return NotFound($"Delivery with number {deliveryNumber} not found.");

        return await UploadDeliveryPrintoutInternal(delivery, file);
    }

    /// <summary>
    /// Internal method for handling delivery printout upload
    /// </summary>
    private async Task<IActionResult> UploadDeliveryPrintoutInternal(DeliveryHeader delivery, IFormFile file)
    {
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
            string storageKey = $"deliveries/{delivery.DeliveryID}/printouts/{Guid.NewGuid()}{fileExtension}";

            using (var stream = file.OpenReadStream())
            {
                await _storageService.UploadFileAsync(storageKey, stream, file.ContentType);
            }

            var documentRecord = new Document
            {
                DeliveryID = delivery.DeliveryID,
                InvoiceID = null,
                StorageKey = storageKey,
                FileName = file.FileName,
                ContentType = file.ContentType,
                Type = DocumentType.DeliveryPrintOut,
                UploadedAt = DateTime.UtcNow
            };

            _db.Documents.Add(documentRecord);
            await _db.SaveChangesAsync();

            await LogActivity(
                "DeliveryPrintoutUploaded",
                delivery.DeliveryNumber,
                $"Printout document '{file.FileName}' uploaded for delivery {delivery.DeliveryNumber}",
                "Info"
            );

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
            await LogActivity(
                "DeliveryPrintoutUploadFailed",
                delivery.DeliveryNumber,
                $"Failed to upload printout: {ex.Message}",
                "Error"
            );

            return StatusCode(500, $"Failed to upload file: {ex.Message}");
        }
    }
}