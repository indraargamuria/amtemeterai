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
using Microsoft.Extensions.Options;

namespace amtemeterai.Api.Controllers;

[ApiController]
[Route("api/deliveries")]
[Authorize(Policy = PermissionKeys.DeliveryRead)]
public class DeliveriesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AppOptions _appOptions;
    private readonly GoogleMapsOptions _googleMapsOptions;
    private readonly IWebHostEnvironment _env;
    private readonly IStorageService _storageService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly SapOptions _sapOptions;
    private readonly IServiceProvider _serviceProvider;
    private readonly IServiceScopeFactory _scopeFactory;
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
        IOptions<AppOptions> appOptions,
        IOptions<GoogleMapsOptions> googleMapsOptions,
        IWebHostEnvironment env,
        IStorageService storageService,
        IHttpClientFactory httpClientFactory,
        IOptions<SapOptions> sapOptions,
        IServiceProvider serviceProvider,
        IServiceScopeFactory scopeFactory,
        ILogger<DeliveriesController> logger)
    {
        _db = db;
        _appOptions = appOptions.Value;
        _googleMapsOptions = googleMapsOptions.Value;
        _env = env;
        _storageService = storageService;
        _httpClientFactory = httpClientFactory;
        _sapOptions = sapOptions.Value;
        _serviceProvider = serviceProvider;
        _scopeFactory = scopeFactory;
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
        var baseUrl = _appOptions.PublicBaseUrl ?? "http://localhost:5173";

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
        // Also preload invoice data for state calculation
        var deliveryIds = query.Select(d => d.DeliveryID).ToList();
        var invoicesData = await _db.Invoices
            .Where(i => i.DeliveryHeaderId.HasValue && deliveryIds.Contains(i.DeliveryHeaderId.Value))
            .Select(i => new
            {
                i.DeliveryHeaderId,
                i.InvoiceNumber,
                IsVoided = i.Status == Invoice.InvoiceStatus.Canceled || i.Status == Invoice.InvoiceStatus.Voided,
                IsActive = i.Status != Invoice.InvoiceStatus.Canceled && i.Status != Invoice.InvoiceStatus.Voided
            })
            .ToListAsync();

        var deliveries = await query
            .Include(d => d.Customer)
            .Select(d => new
            {
                DeliveryId = d.DeliveryID,
                DeliveryNumber = d.DeliveryNumber,
                DeliveryDate = d.DeliveryDate,
                PostGoodsIssueDate = d.PostGoodsIssueDate,
                DeliveryRemarks = d.DeliveryRemarks,

                // Conditional: Hide customer info for warehouse role
                CustomerCode = isWarehouseRole ? (string?)null : (d.Customer != null ? d.Customer.CustomerCode : "UNKNOWN"),
                CustomerName = isWarehouseRole ? (string?)null : (d.Customer != null ? d.Customer.CustomerName : "UNKNOWN"),

                Received = d.Received,
                ReceiveDate = d.ReceiveDate,
                Invoiced = d.Invoiced,
                ReceiverToken = d.ReceiverToken,
                BillingStatus = d.BillingStatus,
                IsOpen = d.IsOpen,

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

        var result = deliveries.Select(d =>
        {
            // Calculate invoice state based on invoices data
            var deliveryInvoices = invoicesData.Where(i => i.DeliveryHeaderId == d.DeliveryId).ToList();
            var activeInvoice = deliveryInvoices.FirstOrDefault(i => i.IsActive);
            var hasCanceledInvoices = deliveryInvoices.Any(i => i.IsVoided);

            string invoiceState;
            string invoiceNumber;
            bool isInvoiced;

            if (activeInvoice != null)
            {
                // Billed: Valid invoice exists that is not voided
                invoiceState = "Billed";
                invoiceNumber = activeInvoice.InvoiceNumber;
                isInvoiced = true;
            }
            else if (hasCanceledInvoices)
            {
                // Determine between Blocked & Voided vs Ready to Re Billing
                if (d.BillingStatus == DeliveryHeader.DeliveryBillingStatus.BillingBlocked)
                {
                    invoiceState = "Blocked & Voided";
                }
                else
                {
                    invoiceState = "Ready to Re Billing";
                }
                invoiceNumber = "-";
                isInvoiced = false;
            }
            else
            {
                // Unbilled: No invoices exist
                invoiceState = "Unbilled";
                invoiceNumber = "-";
                isInvoiced = false;
            }

            return new DeliveryHeaderDto
            {
                DeliveryId = d.DeliveryId,
                DeliveryNumber = d.DeliveryNumber,
                DeliveryDate = d.DeliveryDate,
                PostGoodsIssueDate = d.PostGoodsIssueDate,
                DeliveryRemarks = d.DeliveryRemarks,
                CustomerCode = d.CustomerCode ?? string.Empty,
                CustomerName = d.CustomerName ?? string.Empty,
                Received = d.Received,
                ReceiveDate = d.ReceiveDate,
                Invoiced = isInvoiced,
                InvoiceState = invoiceState,
                InvoiceNumber = invoiceNumber,
                PublicUrl = $"{baseUrl}/receive/{d.ReceiverToken}",
                IsOpen = d.IsOpen,
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
            };
        }).ToList();

        return Ok(result);
    }

    /// <summary>
    /// Document Hub: customer-grouped view of all billable documents.
    /// Each row is one business object: delivery-with-invoice, delivery-only (unbilled), or standalone invoice.
    /// </summary>
    [HttpGet("documents-hub")]
    public async Task<ActionResult<IEnumerable<object>>> GetDocumentsHub()
    {
        var baseApiUrl = _appOptions.ApiBaseUrl ?? "http://localhost:8080";
        var dl = (string type, string num) => $"{baseApiUrl.TrimEnd('/')}/api/deliveries/files/download?key={Uri.EscapeDataString(num)}";

        // 1. Deliveries (with their active invoice + customer)
        var deliveries = await _db.DeliveryHeaders
            .Include(d => d.Customer)
            .Select(d => new
            {
                d.DeliveryID,
                d.DeliveryNumber,
                d.DeliveryDate,
                d.Received,
                d.ReceiveDate,
                d.Invoiced,
                d.BillingStatus,
                d.Status,
                d.CustomerID,
                CustomerCode = d.Customer != null ? d.Customer.CustomerCode : "UNKNOWN",
                CustomerName = d.Customer != null ? d.Customer.CustomerName : "UNKNOWN",
                CustomerEmail = d.Customer != null ? d.Customer.CustomerEmail : null,
                ActiveInvoiceID = d.Invoices
                    .Where(i => i.Status != Invoice.InvoiceStatus.Canceled && i.Status != Invoice.InvoiceStatus.Voided)
                    .OrderByDescending(i => i.InvoicedDate)
                    .Select(i => (int?)i.InvoiceID)
                    .FirstOrDefault(),
                ActiveInvoiceNumber = d.Invoices
                    .Where(i => i.Status != Invoice.InvoiceStatus.Canceled && i.Status != Invoice.InvoiceStatus.Voided)
                    .OrderByDescending(i => i.InvoicedDate)
                    .Select(i => i.InvoiceNumber)
                    .FirstOrDefault(),
                ActiveInvoiceStampingStatus = d.Invoices
                    .Where(i => i.Status != Invoice.InvoiceStatus.Canceled && i.Status != Invoice.InvoiceStatus.Voided)
                    .OrderByDescending(i => i.InvoicedDate)
                    .Select(i => i.StampingStatus)
                    .FirstOrDefault(),
                ActiveInvoiceSerial = d.Invoices
                    .Where(i => i.Status != Invoice.InvoiceStatus.Canceled && i.Status != Invoice.InvoiceStatus.Voided)
                    .OrderByDescending(i => i.InvoicedDate)
                    .Select(i => i.SerialNumber)
                    .FirstOrDefault(),
                ActiveInvoiceDate = d.Invoices
                    .Where(i => i.Status != Invoice.InvoiceStatus.Canceled && i.Status != Invoice.InvoiceStatus.Voided)
                    .OrderByDescending(i => i.InvoicedDate)
                    .Select(i => (DateTime?)i.InvoicedDate)
                    .FirstOrDefault()
            })
            .Where(d => d.Status != DeliveryHeader.ReceiverStatus.Canceled || d.Invoiced)
            .ToListAsync();

        // 2. Standalone invoices (no delivery)
        var standaloneInvoices = await _db.Invoices
            .Where(i => i.DeliveryHeaderId == null &&
                        i.Status != Invoice.InvoiceStatus.Canceled &&
                        i.Status != Invoice.InvoiceStatus.Voided)
            .Select(i => new
            {
                i.InvoiceID,
                i.InvoiceNumber,
                i.InvoicedDate,
                i.CustomerNumber,
                i.StampingStatus,
                i.SerialNumber,
                CustomerName = _db.Customers
                    .Where(c => c.CustomerCode == i.CustomerNumber)
                    .Select(c => c.CustomerName)
                    .FirstOrDefault() ?? "UNKNOWN",
                CustomerEmail = _db.Customers
                    .Where(c => c.CustomerCode == i.CustomerNumber)
                    .Select(c => c.CustomerEmail)
                    .FirstOrDefault()
            })
            .ToListAsync();

        // 3. Email send counts per reference
        var emailStats = await _db.EmailSends
            .GroupBy(e => new { e.ReferenceType, e.ReferenceNumber })
            .Select(g => new
            {
                g.Key.ReferenceType,
                g.Key.ReferenceNumber,
                Count = g.Count(),
                LastSentAt = g.Max(x => x.SentAt)
            })
            .ToListAsync();

        // 4. Document storage keys (download URLs) for each delivery / invoice
        var docKeys = await _db.Documents
            .Where(d => d.Type == DocumentType.DeliveryPrintOut || d.Type == DocumentType.InvoicePrintOut)
            .Select(d => new
            {
                d.DeliveryID,
                d.InvoiceID,
                d.Type,
                d.StorageKey
            })
            .ToListAsync();

        var result = new List<DocumentsHubItem>();
        // ... deliveries & invoices populated above
        var docLookup = docKeys;

        foreach (var d in deliveries)
        {
            var invNum = d.ActiveInvoiceNumber;
            var hasInvoice = !string.IsNullOrEmpty(invNum);
            var type = hasInvoice ? "delivery-with-invoice" : "delivery-only";

            var doPrintoutKey = docLookup
                .Where(x => x.DeliveryID == d.DeliveryID && x.Type == DocumentType.DeliveryPrintOut)
                .OrderByDescending(x => x.StorageKey)
                .Select(x => x.StorageKey)
                .FirstOrDefault();
            var stampedKey = d.ActiveInvoiceID != null ? docLookup
                .Where(x => x.InvoiceID == d.ActiveInvoiceID && x.Type == DocumentType.InvoicePrintOut && x.StorageKey.Contains("/stamped/"))
                .OrderByDescending(x => x.StorageKey)
                .Select(x => x.StorageKey)
                .FirstOrDefault() : null;

            var ready = d.Received && hasInvoice && d.ActiveInvoiceStampingStatus == Invoice.InvoiceStampingStatus.Stamped;

            result.Add(new DocumentsHubItem
            {
                Type = type,
                Id = d.DeliveryID,
                KeyNumber = hasInvoice ? $"{d.DeliveryNumber} / {invNum}" : d.DeliveryNumber!,
                DeliveryNumber = d.DeliveryNumber,
                InvoiceNumber = invNum,
                CustomerCode = d.CustomerCode,
                CustomerName = d.CustomerName,
                CustomerEmail = d.CustomerEmail,
                InvoicedDate = hasInvoice ? d.ActiveInvoiceDate : null,
                DeliveryDate = d.DeliveryDate,
                IsReceived = d.Received,
                IsInvoiceStamped = hasInvoice && d.ActiveInvoiceStampingStatus == Invoice.InvoiceStampingStatus.Stamped,
                InvoiceStampingStatusText = hasInvoice ? GetStampingStatusText(d.ActiveInvoiceStampingStatus) : null,
                IsReadyToSend = ready,
                EmailCount =
                    (emailStats.FirstOrDefault(e => e.ReferenceType == "delivery" && e.ReferenceNumber == d.DeliveryNumber)?.Count ?? 0) +
                    (hasInvoice ? (emailStats.FirstOrDefault(e => e.ReferenceType == "invoice" && e.ReferenceNumber == invNum)?.Count ?? 0) : 0),
                LastSentAt = new[] {
                    emailStats.FirstOrDefault(e => e.ReferenceType == "delivery" && e.ReferenceNumber == d.DeliveryNumber)?.LastSentAt,
                    hasInvoice ? emailStats.FirstOrDefault(e => e.ReferenceType == "invoice" && e.ReferenceNumber == invNum)?.LastSentAt : null
                }.Where(x => x != null).DefaultIfEmpty().Max(),
                DeliveryPrintoutUrl = !string.IsNullOrEmpty(doPrintoutKey) ? dl("delivery", doPrintoutKey) : null,
                InvoicePrintoutUrl = !string.IsNullOrEmpty(stampedKey) ? dl("invoice", stampedKey) : null
            });
        }

        foreach (var inv in standaloneInvoices)
        {
            var stampedKey = docLookup
                .Where(x => x.InvoiceID == inv.InvoiceID && x.Type == DocumentType.InvoicePrintOut && x.StorageKey.Contains("/stamped/"))
                .Select(x => x.StorageKey)
                .FirstOrDefault();

            result.Add(new DocumentsHubItem
            {
                Type = "standalone-invoice",
                Id = inv.InvoiceID,
                KeyNumber = inv.InvoiceNumber,
                DeliveryNumber = null,
                InvoiceNumber = inv.InvoiceNumber,
                CustomerCode = inv.CustomerNumber,
                CustomerName = inv.CustomerName,
                CustomerEmail = inv.CustomerEmail,
                InvoicedDate = inv.InvoicedDate,
                DeliveryDate = null,
                IsReceived = null,
                IsInvoiceStamped = inv.StampingStatus == Invoice.InvoiceStampingStatus.Stamped,
                InvoiceStampingStatusText = GetStampingStatusText(inv.StampingStatus),
                IsReadyToSend = inv.StampingStatus == Invoice.InvoiceStampingStatus.Stamped,
                EmailCount = emailStats.FirstOrDefault(e => e.ReferenceType == "invoice" && e.ReferenceNumber == inv.InvoiceNumber)?.Count ?? 0,
                LastSentAt = emailStats.FirstOrDefault(e => e.ReferenceType == "invoice" && e.ReferenceNumber == inv.InvoiceNumber)?.LastSentAt,
                DeliveryPrintoutUrl = null,
                InvoicePrintoutUrl = !string.IsNullOrEmpty(stampedKey) ? dl("invoice", stampedKey) : null
            });
        }

        // Group by customer (typed projection — no reflection / dynamic)
        var grouped = result
            .GroupBy(r => (r.CustomerCode, r.CustomerName))
            .Select(g => new DocumentsHubGroup
            {
                CustomerCode = g.Key.Item1,
                CustomerName = g.Key.Item2,
                CustomerEmail = g.FirstOrDefault()?.CustomerEmail,
                Items = g.ToList()
            })
            .OrderBy(c => c.CustomerName)
            .ToList();

        return Ok(grouped);
    }

    /// <summary>One row in the Document Hub (one delivery+invoice / delivery-only / standalone invoice).</summary>
    public class DocumentsHubItem
    {
        public string Type { get; set; } = string.Empty;
        public int Id { get; set; }
        public string KeyNumber { get; set; } = string.Empty;
        public string? DeliveryNumber { get; set; }
        public string? InvoiceNumber { get; set; }
        public string CustomerCode { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string? CustomerEmail { get; set; }
        public DateTime? InvoicedDate { get; set; }
        public DateTime? DeliveryDate { get; set; }
        public bool? IsReceived { get; set; }
        public bool IsInvoiceStamped { get; set; }
        public string? InvoiceStampingStatusText { get; set; }
        public bool IsReadyToSend { get; set; }
        public int EmailCount { get; set; }
        public DateTime? LastSentAt { get; set; }
        public string? DeliveryPrintoutUrl { get; set; }
        public string? InvoicePrintoutUrl { get; set; }
    }

    public class DocumentsHubGroup
    {
        public string CustomerCode { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string? CustomerEmail { get; set; }
        public List<DocumentsHubItem> Items { get; set; } = new();
    }

    /// <summary>Mirror of InvoicesController.GetStampingStatusText.</summary>
    private static string GetStampingStatusText(Invoice.InvoiceStampingStatus s) => s switch
    {
        Invoice.InvoiceStampingStatus.NotStamped => "Not Stamped",
        Invoice.InvoiceStampingStatus.Pending => "Pending",
        Invoice.InvoiceStampingStatus.Stamped => "Stamped",
        Invoice.InvoiceStampingStatus.Failed => "Failed",
        _ => "Unknown"
    };

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

        var baseApiUrl = _appOptions.ApiBaseUrl ?? "http://localhost:8080";

        // Calculate invoice state based on delivery's invoices
        var deliveryInvoices = await _db.Invoices
            .Where(i => i.DeliveryHeaderId == delivery.DeliveryID)
            .Select(i => new
            {
                i.InvoiceNumber,
                IsActive = i.Status != Invoice.InvoiceStatus.Canceled && i.Status != Invoice.InvoiceStatus.Voided,
                IsVoided = i.Status == Invoice.InvoiceStatus.Canceled || i.Status == Invoice.InvoiceStatus.Voided
            })
            .ToListAsync();

        // Determine invoice state and number
        string invoiceState;
        string invoiceNumber;
        bool isInvoiced;

        var activeInvoice = deliveryInvoices.FirstOrDefault(i => i.IsActive);
        var hasCanceledInvoices = deliveryInvoices.Any(i => i.IsVoided);

        if (activeInvoice != null)
        {
            // Billed: Valid invoice exists that is not voided
            invoiceState = "Billed";
            invoiceNumber = activeInvoice.InvoiceNumber;
            isInvoiced = true;
        }
        else if (hasCanceledInvoices)
        {
            // Determine between Blocked & Voided vs Ready to Re Billing
            if (delivery.BillingStatus == DeliveryHeader.DeliveryBillingStatus.BillingBlocked)
            {
                invoiceState = "Blocked & Voided";
            }
            else
            {
                invoiceState = "Ready to Re Billing";
            }
            invoiceNumber = "-";
            isInvoiced = false;
        }
        else
        {
            // Unbilled: No invoices exist
            invoiceState = "Unbilled";
            invoiceNumber = "-";
            isInvoiced = false;
        }

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

        // Materialize line collection to local memory context to handle cross-row child-parent calculations safely
        var dbLines = delivery.Lines ?? new List<DeliveryLine>();

        var response = new DeliveryResponseDto
        {
            DeliveryID = delivery.DeliveryID,
            DeliveryNumber = delivery.DeliveryNumber,
            DeliveryDate = delivery.DeliveryDate,
            PostGoodsIssueDate = delivery.PostGoodsIssueDate,
            DeliveryRemarks = delivery.DeliveryRemarks,
            ShipToAddress = delivery.ShipToAddress,

            // Conditional: Hide CustomerCode and CustomerName for warehouse role
            CustomerCode = isWarehouseRole ? string.Empty : (delivery.Customer?.CustomerCode ?? "UNKNOWN"),
            CustomerName = isWarehouseRole ? string.Empty : (delivery.Customer?.CustomerName ?? "UNKNOWN"),
            // 🆕 Sneak Peek PIN: hidden for warehouse role, consistent with customer data hiding
            CustomerPin = isWarehouseRole ? null : delivery.Customer?.CustomerPin,
            ReceiverToken = delivery.ReceiverToken,
            ReceiverName = delivery.ReceiverName,
            ReceiverNotes = delivery.ReceiverNotes,
            Received = delivery.Received,
            ReceiveDate = delivery.ReceiveDate,
            Invoiced = isInvoiced,
            InvoiceState = invoiceState,
            InvoiceNumber = invoiceNumber,
            IsOpen = delivery.IsOpen,
            PublicUrl = GetPublicUrl(delivery.ReceiverToken, _appOptions.PublicBaseUrl),

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

            Lines = dbLines.Select(l => 
            {
                // 🎯 Identify if this specific line is a structural parent to any split-batch child lines
                var childrenLines = dbLines.Where(c => !string.IsNullOrEmpty(c.ParentLineNumber) && c.ParentLineNumber.Trim() == l.DeliveryLineNumber).ToList();
                bool isParentLine = childrenLines.Any();

                // Roll up structural targets and receipt quantities from children elements
                decimal targetPackQty = isParentLine ? childrenLines.Sum(c => c.PackQuantity)          : l.PackQuantity;
                decimal delivered     = isParentLine ? childrenLines.Sum(c => c.PackQuantityDelivered) : l.PackQuantityDelivered;
                decimal returned      = isParentLine ? childrenLines.Sum(c => c.PackQuantityReturned)  : l.PackQuantityReturned;
                decimal rejected      = isParentLine ? childrenLines.Sum(c => c.PackQuantityRejected)  : l.PackQuantityRejected;

                return new DeliveryLineResponseDto
                {
                    DeliveryLineNumber = l.DeliveryLineNumber,
                    DeliveryItemCode = l.DeliveryItemCode,
                    DeliveryItemDescription = l.DeliveryItemDescription,
                    BatchNumber = l.BatchNumber,
                    OrderNumber = isWarehouseRole ? null : l.OrderNumber,
                    BuyerPONumber = isWarehouseRole ? null : l.BuyerPONumber,
                    ParentLineNumber = l.ParentLineNumber?.Trim() ?? "0",
                    SalesQuantity = l.SalesQuantity,
                    SalesUOM = l.SalesUOM,
                    PackQuantity = targetPackQty, // 🎯 Non-zero rolled up target base value for parent rows
                    PackUOM = l.PackUOM,
                    PackQuantityDelivered = delivered,
                    PackQuantityReturned = returned,
                    PackQuantityRejected = rejected,
                    LineComment = l.LineComment
                };
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

        // Calculate invoice state based on delivery's invoices
        var deliveryInvoices = await _db.Invoices
            .Where(i => i.DeliveryHeaderId == data.DeliveryID)
            .Select(i => new
            {
                i.InvoiceNumber,
                IsActive = i.Status != Invoice.InvoiceStatus.Canceled && i.Status != Invoice.InvoiceStatus.Voided,
                IsVoided = i.Status == Invoice.InvoiceStatus.Canceled || i.Status == Invoice.InvoiceStatus.Voided
            })
            .ToListAsync();

        // Determine invoice state and number
        string invoiceState;
        string invoiceNumber;
        bool isInvoiced;

        var activeInvoice = deliveryInvoices.FirstOrDefault(i => i.IsActive);
        var hasCanceledInvoices = deliveryInvoices.Any(i => i.IsVoided);

        if (activeInvoice != null)
        {
            // Billed: Valid invoice exists that is not voided
            invoiceState = "Billed";
            invoiceNumber = activeInvoice.InvoiceNumber;
            isInvoiced = true;
        }
        else if (hasCanceledInvoices)
        {
            // Determine between Blocked & Voided vs Ready to Re Billing
            if (data.BillingStatus == DeliveryHeader.DeliveryBillingStatus.BillingBlocked)
            {
                invoiceState = "Blocked & Voided";
            }
            else
            {
                invoiceState = "Ready to Re Billing";
            }
            invoiceNumber = "-";
            isInvoiced = false;
        }
        else
        {
            // Unbilled: No invoices exist
            invoiceState = "Unbilled";
            invoiceNumber = "-";
            isInvoiced = false;
        }

        // Materialize the list in memory to prevent self-referencing query evaluation issues inside EF LINQ projection
        var dbLines = data.Lines ?? new List<DeliveryLine>();

        // 🚀 Map required customer strings and roll up child tier metrics dynamically
        var result = new DeliveryResponseDto
        {
            DeliveryID = data.DeliveryID,
            DeliveryNumber = data.DeliveryNumber,
            DeliveryDate = data.DeliveryDate,
            DeliveryRemarks = data.DeliveryRemarks,
            ShipToAddress = data.ShipToAddress,
            CustomerCode = data.Customer?.CustomerCode ?? "UNKNOWN",
            CustomerName = data.Customer?.CustomerName ?? "UNKNOWN",
            ReceiverToken = data.ReceiverToken,
            ReceiverName = data.ReceiverName,
            ReceiverNotes = data.ReceiverNotes,
            Received = data.Received,
            ReceiveDate = data.ReceiveDate,
            Invoiced = isInvoiced,
            InvoiceState = invoiceState,
            InvoiceNumber = invoiceNumber,
            IsOpen = data.IsOpen,
            PublicUrl = GetPublicUrl(data.ReceiverToken, _appOptions.PublicBaseUrl),
            Lines = dbLines.Select(l => 
            {
                // 🎯 Identify if this line acts as a structural parent to any split-batch child lines
                var childrenLines = dbLines.Where(c => !string.IsNullOrEmpty(c.ParentLineNumber) && c.ParentLineNumber.Trim() == l.DeliveryLineNumber).ToList();
                bool isParentLine = childrenLines.Any();

                // Roll up target quantities and feedback counts from children if this is a split-batch parent line
                decimal targetPackQty = isParentLine ? childrenLines.Sum(c => c.PackQuantity)          : l.PackQuantity;
                decimal delivered     = isParentLine ? childrenLines.Sum(c => c.PackQuantityDelivered) : l.PackQuantityDelivered;
                decimal returned      = isParentLine ? childrenLines.Sum(c => c.PackQuantityReturned)  : l.PackQuantityReturned;
                decimal rejected      = isParentLine ? childrenLines.Sum(c => c.PackQuantityRejected)  : l.PackQuantityRejected;

                return new DeliveryLineResponseDto
                {
                    DeliveryLineNumber = l.DeliveryLineNumber,
                    DeliveryItemCode = l.DeliveryItemCode,
                    DeliveryItemDescription = l.DeliveryItemDescription,
                    BatchNumber = l.BatchNumber,
                    OrderNumber = l.OrderNumber,
                    BuyerPONumber = l.BuyerPONumber,
                    ParentLineNumber = l.ParentLineNumber?.Trim() ?? "0",
                    SalesQuantity = l.SalesQuantity,
                    SalesUOM = l.SalesUOM,
                    PackQuantity = targetPackQty, // 🎯 Non-zero rolled up target base value for parent rows
                    PackUOM = l.PackUOM,
                    PackQuantityDelivered = delivered,
                    PackQuantityReturned = returned,
                    PackQuantityRejected = rejected,
                    LineComment = l.LineComment
                };
            }).ToList()
        };

        var associatedDocs = await _db.Documents
            .Where(d => d.DeliveryID == data.DeliveryID && d.Type == DocumentType.DeliveryPhoto)
            .ToListAsync();

        if (associatedDocs != null && associatedDocs.Any())
        {
            string baseUrl = _appOptions.ApiBaseUrl ?? "http://localhost:8080";

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
    [Authorize(Policy = PermissionKeys.DeliverySync)]
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
            PostGoodsIssueDate = dto.PostGoodsIssueDate,
            DeliveryRemarks = dto.DeliveryRemarks,
            ShipToAddress = dto.ShipToAddress,
            Plant = dto.Plant,
            SalesPersonName = dto.SalesPersonName,
            SalesPersonEmail = dto.SalesPersonEmail,
            // Note: OrderNumber and BuyerPONumber moved to line level
            Type = (DeliveryHeader.DeliveryType)dto.Type,
            ReceiverToken = Guid.NewGuid()
        };

        header.Lines = dto.Lines.Select(l => new DeliveryLine
        {
            DeliveryLineNumber = l.DeliveryLineNumber,
            DeliveryItemCode = l.DeliveryItemCode,
            DeliveryItemDescription = l.DeliveryItemDescription,
            BatchNumber = l.BatchNumber,
            OrderNumber = l.OrderNumber,
            BuyerPONumber = l.BuyerPONumber,
            ParentLineNumber = l.ParentLineNumber ?? "0",
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

        var publicUrl = GetPublicUrl(header.ReceiverToken, _appOptions.PublicBaseUrl);
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
    [Authorize(Policy = PermissionKeys.DeliverySync)]
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
        existing.PostGoodsIssueDate = dto.PostGoodsIssueDate;
        existing.DeliveryRemarks = dto.DeliveryRemarks;
        existing.ShipToAddress = dto.ShipToAddress;
        existing.Plant = dto.Plant;
        existing.SalesPersonName = dto.SalesPersonName;
        existing.SalesPersonEmail = dto.SalesPersonEmail;
        // Note: OrderNumber and BuyerPONumber moved to line level
        existing.Type = (DeliveryHeader.DeliveryType)dto.Type;

        _db.DeliveryLines.RemoveRange(existing.Lines);

        existing.Lines = dto.Lines.Select(l => new DeliveryLine
        {
            DeliveryLineNumber = l.DeliveryLineNumber,
            DeliveryItemCode = l.DeliveryItemCode,
            DeliveryItemDescription = l.DeliveryItemDescription,
            BatchNumber = l.BatchNumber,
            OrderNumber = l.OrderNumber,
            BuyerPONumber = l.BuyerPONumber,
            ParentLineNumber = l.ParentLineNumber ?? "0",
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

        // if (data.Invoiced)
        // {
        //     return BadRequest("This delivery record is locked because it has already been invoiced.");
        // }

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

        // Console.WriteLine(data.Lines);

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
            var dbLines = (data.Lines ?? Enumerable.Empty<DeliveryLine>()).ToList();

            var sapPayload = new SapDeliveryConfirmationPayload
            {
                CustomerCode = data.Customer?.CustomerCode ?? string.Empty,
                DeliveryNumber = data.DeliveryNumber,
                ReceiverName = data.ReceiverName ?? string.Empty,
                ReceiverStatus = hasDiscrepancy ? "2" : "1",
                ReceiverNotes = data.ReceiverNotes ?? string.Empty,
                
                Lines = dbLines.Select(l =>
                {
                    // 🎯 Identify if this row acts as a parent line for any split-batch child lines
                    var children = dbLines.Where(c => !string.IsNullOrEmpty(c.ParentLineNumber) && c.ParentLineNumber.Trim() == l.DeliveryLineNumber).ToList();
                    bool isParentLine = children.Any();

                    // Dynamically roll up all quantities from children if this is a structural parent line
                    decimal packQty  = isParentLine ? children.Sum(c => c.PackQuantity)          : l.PackQuantity;
                    decimal delivered = isParentLine ? children.Sum(c => c.PackQuantityDelivered) : l.PackQuantityDelivered;
                    decimal returned  = isParentLine ? children.Sum(c => c.PackQuantityReturned)  : l.PackQuantityReturned;
                    decimal rejected  = isParentLine ? children.Sum(c => c.PackQuantityRejected)  : l.PackQuantityRejected;

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
            var jsonOptions = new JsonSerializerOptions { WriteIndented = true };
            string jsonString = JsonSerializer.Serialize(sapPayload, jsonOptions);

            Console.WriteLine("=================== SAP PAYLOAD DEBUG ===================");
            Console.WriteLine(jsonString);
            Console.WriteLine("=========================================================");
            
            // Create a clean client instance from the factory
            var client = _httpClientFactory.CreateClient("SapClient");
            
            // 🎯 Use dynamic absolute URL matching the CreateSapInvoice connection strategy
            // Use configured SAP base URL, throw if missing (no fallback to hardcoded value)
            if (string.IsNullOrWhiteSpace(_sapOptions.BaseUrl))
            {
                throw new InvalidOperationException("SAP BaseUrl is not configured. Please check the SapOptions configuration.");
            }
            string baseSapUrl = _sapOptions.BaseUrl.TrimEnd('/');

            string sapClientParam = !string.IsNullOrEmpty(_sapOptions.Client) 
                ? _sapOptions.Client 
                : "250";

            string absoluteSapUrl = $"{baseSapUrl}/sap/bc/zrest_doconfirm?sap-client={sapClientParam}";

            // Execute post operation targeting the absolute URL pathway directly
            var response = await client.PostAsJsonAsync(absoluteSapUrl, sapPayload);

            if (!response.IsSuccessStatusCode)
            {
                string errorResponse = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"SAP error response content: {response.StatusCode} - {errorResponse}");
                return StatusCode(502, $"ERP Synchronization Error: Remote server returned status {response.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            // Console.WriteLine("AU AMAT DAH");
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

        // 🎯 AUTO-GENERATE INVOICE FOR NON BC DELIVERIES
        // For Non BC delivery orders, immediately invoke the invoice creation API
        // after confirmation is completed
        if (data.Type == DeliveryHeader.DeliveryType.NonBC)
        {
            _logger.LogInformation(
                "Non BC delivery {DeliveryNumber} confirmed. Triggering automatic invoice creation.",
                data.DeliveryNumber);

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
                        var logger = loggerFactory.CreateLogger<DeliveriesController>();

                        logger.LogInformation("Background invoice creation starting for Non BC delivery {DeliveryNumber}", data.DeliveryNumber);

                        // Use a clean client instance to avoid base address issues
                        var sapClient = httpClientFactory.CreateClient("SapClient");
                        var sapUrl = $"{sapOptions.BaseUrl.TrimEnd('/')}/sap/bc/zr_createinv?sap-client={sapOptions.Client}";

                        var sapRequest = new SapBillingRequestDto
                        {
                            DeliveryNumber = data.DeliveryNumber
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
                                var delivery = await db.DeliveryHeaders
                                    .Include(d => d.Customer)
                                    .Include(d => d.Lines)
                                    .FirstOrDefaultAsync(d => d.DeliveryNumber == data.DeliveryNumber);

                                if (delivery != null)
                                {
                                    // Check if an active invoice already exists
                                    var existingInvoice = await db.Invoices
                                        .FirstOrDefaultAsync(i => i.DeliveryHeaderId == delivery.DeliveryID
                                                               && i.Status != Invoice.InvoiceStatus.Canceled
                                                               && i.Status != Invoice.InvoiceStatus.Voided);

                                    if (existingInvoice == null)
                                    {
                                        // Create invoice record
                                        // Down payment REDUCES the gross: nett = base - downpay
                                        // SAP sends amountLocal as gross; amountInvoice as final nett amount
                                        // Total down payment = downPayAmount + downPayTaxAmount
                                        var baseAmountLocal = sapBillingData.BaseAmount > 0
                                            ? sapBillingData.BaseAmount
                                            : sapBillingData.AmountLocal;
                                        var baseAmountForeign = sapBillingData.AmountForeign > 0
                                            ? sapBillingData.AmountForeign
                                            : sapBillingData.AmountLocal;
                                        var downPayLocal = sapBillingData.LocalDownPayAmount + sapBillingData.LocalDownPayTaxAmount;
                                        var downPayForeign = sapBillingData.DownPayAmount + sapBillingData.DownPayTaxAmount;
                                        var finalInvoiceAmount = sapBillingData.AmountInvoice > 0
                                            ? sapBillingData.AmountInvoice
                                            : sapBillingData.AmountLocal - downPayLocal;
                                        var finalInvoiceAmountForeign = sapBillingData.AmountForeign > 0
                                            ? sapBillingData.AmountForeign
                                            : finalInvoiceAmount;

                                        var invoice = new Invoice
                                        {
                                            InvoiceNumber = sapBillingData.SapInvoiceNumber,
                                            CustomerNumber = sapBillingData.CustomerNumber,
#pragma warning disable CS0618 // Type or member is obsolete
                                            InvoiceAmount = finalInvoiceAmount,
#pragma warning restore CS0618
                                            AmountForeign = finalInvoiceAmountForeign,
                                            AmountLocal = finalInvoiceAmount,
                                            BaseAmountForeign = baseAmountForeign,
                                            BaseAmountLocal = baseAmountLocal,
                                            DownPayAmountForeign = downPayForeign,
                                            DownPayAmountLocal = downPayLocal,
                                            DownPayTaxAmountForeign = sapBillingData.DownPayTaxAmount,
                                            DownPayTaxAmountLocal = sapBillingData.LocalDownPayTaxAmount,
                                            Currency = sapBillingData.Currency,
                                            ComplianceCategory = sapBillingData.ComplianceCategory,
                                            InvoicedDate = sapBillingData.BillingDate,
                                            Status = Invoice.InvoiceStatus.Draft,
                                            DeliveryHeaderId = delivery.DeliveryID,
                                            StampingStatus = Invoice.InvoiceStampingStatus.NotStamped
                                        };

                                        // Update delivery billing status
                                        delivery.Invoiced = true;
                                        if (delivery.BillingStatus == DeliveryHeader.DeliveryBillingStatus.Unbilled ||
                                            delivery.BillingStatus == DeliveryHeader.DeliveryBillingStatus.ReadyToRebill)
                                        {
                                            delivery.BillingStatus = DeliveryHeader.DeliveryBillingStatus.Billed;
                                        }

                                        db.Invoices.Add(invoice);
                                        await db.SaveChangesAsync();

                                        logger.LogInformation(
                                            "Successfully created invoice {InvoiceNumber} for Non BC delivery {DeliveryNumber}",
                                            sapBillingData.SapInvoiceNumber,
                                            data.DeliveryNumber);

                                        // Log activity
                                        var activityLog = new ActivityLog
                                        {
                                            EventType = "NonBcInvoiceAutoCreated",
                                            ReferenceID = data.DeliveryNumber,
                                            Message = $"Invoice {sapBillingData.SapInvoiceNumber} automatically created for Non BC delivery {data.DeliveryNumber}. Foreign: {sapBillingData.AmountForeign} {sapBillingData.Currency}, Local: {sapBillingData.AmountLocal}",
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
                                            data.DeliveryNumber);
                                    }
                                }
                            }
                        }
                        else
                        {
                            logger.LogError(
                                "Failed to create SAP invoice for Non BC delivery {DeliveryNumber} after {MaxRetries} attempts",
                                data.DeliveryNumber,
                                maxRetries);

                            // Log failure activity
                            using (var dbScope = _scopeFactory.CreateScope())
                            {
                                var db = dbScope.ServiceProvider.GetRequiredService<AppDbContext>();
                                var activityLog = new ActivityLog
                                {
                                    EventType = "NonBcInvoiceAutoCreationFailed",
                                    ReferenceID = data.DeliveryNumber,
                                    Message = $"Failed to automatically create invoice for Non BC delivery {data.DeliveryNumber} after {maxRetries} attempts",
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
                    _logger.LogError(ex, "Background invoice creation faulted for Non BC delivery {DeliveryNumber}", data.DeliveryNumber);

                    // Log error activity
                    using (var scope = _scopeFactory.CreateScope())
                    {
                        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                        var activityLog = new ActivityLog
                        {
                            EventType = "NonBcInvoiceAutoCreationError",
                            ReferenceID = data.DeliveryNumber,
                            Message = $"Error during automatic invoice creation: {ex.Message}",
                            Severity = "Error"
                        };
                        db.ActivityLogs.Add(activityLog);
                        await db.SaveChangesAsync();
                    }
                }
            });
        }

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
    [Authorize(Policy = PermissionKeys.DeliverySync)]
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
        string url = $"{_googleMapsOptions.BaseUrl}/maps/api/geocode/json?latlng={lat},{lng}&key={_googleMapsOptions.ApiKey}";
        
        var jsonString = await client.GetStringAsync(url);
        // Console.WriteLine("=== RAW GOOGLE RESPONSE FOR LAPTOP ===");
        // Console.WriteLine(jsonString);
        // Console.WriteLine("======================================");
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
            else if (key.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                contentType = "application/pdf";

            // Informative download filename (e.g. DO_2110019772_f9b2060c.pdf or STPINV_3410024628_xxx.pdf)
            string fileName = System.IO.Path.GetFileName(key);
            if (string.IsNullOrEmpty(fileName))
                fileName = "document";

            return File(fileStream, contentType, fileName);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal storage error: {ex.Message}");
        }
    }
    
    [HttpPost("cancel/{deliveryNumber}")]
    [Authorize(Policy = PermissionKeys.DeliverySync)]
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
    [Authorize(Policy = PermissionKeys.DeliverySync)]
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
    [Authorize(Policy = PermissionKeys.DeliverySync)]
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
            // Use descriptive delivery number and prefix for clarity
            // Format: DO_{deliveryNumber}_{guid}.{ext}
            string uniqueFileName = $"DO_{delivery.DeliveryNumber}_{Guid.NewGuid()}{fileExtension}";
            string storageKey = $"deliveries/{delivery.DeliveryNumber}/printouts/{uniqueFileName}";

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
            await LogActivity(
                "DeliveryPrintoutUploadFailed",
                delivery.DeliveryNumber,
                $"Failed to upload printout: {ex.Message}",
                "Error"
            );

            return StatusCode(500, $"Failed to upload file: {ex.Message}");
        }
    }

    /// <summary>
    /// Trigger actual SAP Invoice creation for a delivery number
    /// This endpoint calls the real SAP billing endpoint to create an invoice
    /// Now supports idempotent execution - returns existing invoice if already created
    /// Enforces business interlocking rules for billing lifecycle management
    /// </summary>
    [HttpPost("{deliveryNumber}/invoice")]
    [Authorize(Policy = PermissionKeys.InvoiceSync)]
    public async Task<ActionResult<DeliverySettlementResponseDto>> CreateSapInvoice(string deliveryNumber)
    {
        if (string.IsNullOrWhiteSpace(deliveryNumber))
        {
            return BadRequest("Delivery number is required.");
        }

        _logger.LogInformation(
            "Starting SAP invoice creation for delivery {DeliveryNumber}",
            deliveryNumber);

        try
        {
            // === Step 1: Validation - Check if delivery exists ===
            var delivery = await _db.DeliveryHeaders
                .Include(d => d.Customer)
                .Include(d => d.Lines)
                .FirstOrDefaultAsync(d => d.DeliveryNumber == deliveryNumber);

            if (delivery == null)
            {
                return NotFound($"Delivery {deliveryNumber} not found.");
            }

            // === Step 1.5: Business Interlocking Rules ===
            // Guard: Reject if delivery is in BillingBlocked state
            if (delivery.BillingStatus == DeliveryHeader.DeliveryBillingStatus.BillingBlocked)
            {
                _logger.LogWarning(
                    "Invoice creation rejected for delivery {DeliveryNumber}: Billing is barred while delivery remains blocked.",
                    deliveryNumber);

                return StatusCode(403, "Invoicing is barred while this delivery order remains blocked.");
            }

            // Guard: Reject if delivery is already Billed (duplicate invoicing prevention)
            if (delivery.BillingStatus == DeliveryHeader.DeliveryBillingStatus.Billed)
            {
                _logger.LogWarning(
                    "Invoice creation rejected for delivery {DeliveryNumber}: Duplicate invoicing attempt - delivery already billed.",
                    deliveryNumber);

                return BadRequest(new
                {
                    success = false,
                    message = "Delivery has already been billed. Duplicate invoicing is not permitted.",
                    deliveryNumber = deliveryNumber,
                    billingStatus = delivery.BillingStatus.ToString()
                });
            }

            // === Step 2: Active Invoice Idempotency Check - Local Database Invoice Lookup ===
            // Check if an ACTIVE (non-voided, non-canceled) invoice already exists for this delivery
            // Voided/canceled invoices should not block re-billing when delivery is in ReadyToRebill status
            var activeInvoice = await _db.Invoices
                .FirstOrDefaultAsync(i => i.DeliveryHeaderId == delivery.DeliveryID
                                       && i.Status != Invoice.InvoiceStatus.Canceled
                                       && i.Status != Invoice.InvoiceStatus.Voided);

            if (activeInvoice != null)
            {
                // Case B: Re-sync / Active Record Already Exists
                // Return existing active invoice data without calling SAP API
                _logger.LogInformation(
                    "Active invoice {InvoiceNumber} already exists for delivery {DeliveryNumber}. Returning existing record.",
                    activeInvoice.InvoiceNumber,
                    deliveryNumber);

                return Ok(new DeliverySettlementResponseDto
                {
                    Success = true,
                    Message = "Invoice already created previously",
                    InvoiceNumber = activeInvoice.InvoiceNumber,
#pragma warning disable CS0618 // Type or member is obsolete
                    InvoiceAmount = activeInvoice.InvoiceAmount,
#pragma warning restore CS0618
                    BillingDate = activeInvoice.InvoicedDate,
                    DeliveryNumber = deliveryNumber
                });
            }

            // === Step 3: Outbound Request - Call SAP billing endpoint with Retry Policy ===
            // Only reached if activeInvoice == null (new billing scenario)
            _logger.LogInformation(
                "Calling SAP billing endpoint for delivery {DeliveryNumber}",
                deliveryNumber);

            var sapRequest = new SapBillingRequestDto
            {
                DeliveryNumber = deliveryNumber
            };

            // Retry loop to handle SAP DB commit latency
            // SAP requires time to commit transaction data to DB tables (VBRK/VBRP)
            // Immediate fetch after invoice creation can return 404 or empty data on first attempt
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

                await LogActivity(
                    "SapInvoiceCreationTimedOut",
                    deliveryNumber,
                    $"SAP invoice creation timed out after {maxRetries} retries. Invoice may have been created in SAP but sync timed out.",
                    "Error");

                return StatusCode(500, new
                {
                    success = false,
                    message = "Invoice creation in SAP timed out after multiple attempts. The invoice may have been created in SAP, but fetching details failed. Please refresh or try syncing again.",
                    deliveryNumber = deliveryNumber,
                    attemptsMade = maxRetries
                });
            }

            // === Step 4.5: Handle Duplicate Invoice Number Scenario ===
            // Check if SAP returned an invoice number that already exists in our local database
            // IMPORTANT: Query local DB FIRST, ignore SAP's message string to prevent false-positives
            // Only block based on actual local database state, not SAP's response message text
            var existingInvoice = await _db.Invoices
                .FirstOrDefaultAsync(i => i.InvoiceNumber == sapBillingData.SapInvoiceNumber);

            if (existingInvoice != null)
            {
                bool isVoidedOrCanceled = existingInvoice.Status == Invoice.InvoiceStatus.Voided ||
                                           existingInvoice.Status == Invoice.InvoiceStatus.Canceled;

                // Condition 2: Invoice exists locally but was Voided/Canceled
                // This means the delivery was unlocked/released for re-billing in OpexNOW,
                // but SAP is still returning the old voided invoice number (no new BC billing generated yet)
                if (isVoidedOrCanceled)
                {
                    _logger.LogWarning(
                        "Sync blocked for Delivery {DeliveryNumber}: SAP returned voided invoice {InvoiceNumber}. New billing must be generated in SAP first.",
                        deliveryNumber,
                        sapBillingData.SapInvoiceNumber);

                    await LogActivity(
                        "SyncBlockedVoidedInvoice",
                        deliveryNumber,
                        $"Sync blocked for delivery {deliveryNumber}: SAP returned voided invoice {sapBillingData.SapInvoiceNumber}. Please generate new billing in SAP first.",
                        "Warning");

                    return BadRequest(new
                    {
                        success = false,
                        message = "No new BC Billing document found in SAP. Please create the BC Billing in SAP first before syncing.",
                        deliveryNumber = deliveryNumber,
                        sapInvoiceNumber = sapBillingData.SapInvoiceNumber,
                        localInvoiceStatus = existingInvoice.Status.ToString()
                    });
                }

                // Condition 1: Invoice exists locally and is Active
                // The invoice was already synced properly - inform the user
                _logger.LogInformation(
                    "Invoice already synced for Delivery {DeliveryNumber}: Invoice {InvoiceNumber} exists with active status.",
                    deliveryNumber,
                    sapBillingData.SapInvoiceNumber);

                await LogActivity(
                    "InvoiceAlreadySynced",
                    deliveryNumber,
                    $"Invoice {sapBillingData.SapInvoiceNumber} already synced for delivery {deliveryNumber}.",
                    "Info");

                return Ok(new DeliverySettlementResponseDto
                {
                    Success = true,
                    Message = "Invoice already synced.",
                    InvoiceNumber = existingInvoice.InvoiceNumber,
#pragma warning disable CS0618 // Type or member is obsolete
                    InvoiceAmount = existingInvoice.InvoiceAmount,
#pragma warning restore CS0618
                    BillingDate = existingInvoice.InvoicedDate,
                    DeliveryNumber = deliveryNumber
                });
            }

            // Branch 1: Invoice does NOT exist in local DB (existingInvoice == null)
            // Proceed directly to create and insert the new Invoice entity
            // Do NOT block based on sapResponse.Message - ignore SAP's message text completely

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
                // Down payment REDUCES the gross: nett = base - downpay
                // SAP sends amountLocal as gross; amountInvoice as final nett amount
                // Total down payment = downPayAmount + downPayTaxAmount
                var downPayLocal = sapBillingData.LocalDownPayAmount + sapBillingData.LocalDownPayTaxAmount;
                var downPayForeign = sapBillingData.DownPayAmount + sapBillingData.DownPayTaxAmount;

                var baseAmountLocal = sapBillingData.BaseAmount > 0
                    ? sapBillingData.BaseAmount
                    : sapBillingData.AmountLocal;
                var baseAmountForeign = sapBillingData.AmountForeign > 0
                    ? sapBillingData.AmountForeign
                    : sapBillingData.AmountLocal;

                var finalInvoiceAmount = sapBillingData.AmountInvoice > 0
                    ? sapBillingData.AmountInvoice
                    : sapBillingData.AmountLocal - downPayLocal;
                var finalInvoiceAmountForeign = sapBillingData.AmountForeign > 0
                    ? sapBillingData.AmountForeign
                    : finalInvoiceAmount;

                var invoice = new Invoice
                {
                    InvoiceNumber = sapBillingData.SapInvoiceNumber,
                    CustomerNumber = sapBillingData.CustomerNumber,
#pragma warning disable CS0618 // Type or member is obsolete
                    // Legacy field for backward compatibility
                    InvoiceAmount = finalInvoiceAmount,
#pragma warning restore CS0618
                    // New dual-currency fields
                    AmountForeign = finalInvoiceAmountForeign,
                    AmountLocal = finalInvoiceAmount,
                    BaseAmountForeign = baseAmountForeign,
                    BaseAmountLocal = baseAmountLocal,
                    DownPayAmountForeign = downPayForeign,
                    DownPayAmountLocal = downPayLocal,
                    DownPayTaxAmountForeign = sapBillingData.DownPayTaxAmount,
                    DownPayTaxAmountLocal = sapBillingData.LocalDownPayTaxAmount,
                    Currency = sapBillingData.Currency,
                    ComplianceCategory = sapBillingData.ComplianceCategory,
                    InvoicedDate = sapBillingData.BillingDate,
                    Status = Invoice.InvoiceStatus.Draft,
                    DeliveryHeaderId = delivery.DeliveryID,
                    StampingStatus = Invoice.InvoiceStampingStatus.NotStamped
                };

                _db.Invoices.Add(invoice);
                await _db.SaveChangesAsync();

                // Log the activity with dual-currency information
                await LogActivity(
                    "SapInvoiceCreated",
                    deliveryNumber,
                    $"SAP Invoice {sapBillingData.SapInvoiceNumber} created for delivery {deliveryNumber}. " +
                    $"Foreign: {sapBillingData.AmountForeign} {sapBillingData.Currency}, Local: {sapBillingData.AmountLocal}, Category: {sapBillingData.ComplianceCategory}",
                    "Success");

                // Commit transaction
                await transaction.CommitAsync();

                _logger.LogInformation(
                    "SAP invoice creation completed successfully for delivery {DeliveryNumber}",
                    deliveryNumber);

                // === Step 6: Return Values ===
                var baseApiUrl = _appOptions.ApiBaseUrl ?? "http://localhost:8080";

                return Ok(new DeliverySettlementResponseDto
                {
                    Success = true,
                    Message = sapBillingData.Message,
                    InvoiceNumber = sapBillingData.SapInvoiceNumber,
                    InvoiceAmount = sapBillingData.AmountLocal,
                    BillingDate = sapBillingData.BillingDate,
                    DeliveryNumber = deliveryNumber
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Transaction rolled back during SAP invoice creation");

                // Log the failure
                await LogActivity(
                    "SapInvoiceCreationFailed",
                    deliveryNumber,
                    $"SAP invoice creation failed: {ex.Message}",
                    "Error");

                throw;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SAP invoice creation failed for delivery {DeliveryNumber}", deliveryNumber);
            return StatusCode(500, $"SAP invoice creation failed: {ex.Message}");
        }
    }

    /// <summary>
    /// Authorization Release API - Clears financial lock on a delivery order.
    /// Invoked exclusively by SAP to unlock a delivery for re-billing.
    /// </summary>
    [HttpPost("by-number/{deliveryNumber}/release-rebill")]
    [Authorize(Policy = PermissionKeys.InvoiceSync)]
    public async Task<IActionResult> ReleaseRebillAuthorization(string deliveryNumber)
    {
        if (string.IsNullOrWhiteSpace(deliveryNumber))
        {
            return BadRequest("Delivery number is required.");
        }

        _logger.LogInformation(
            "Processing release-rebill authorization for delivery {DeliveryNumber}",
            deliveryNumber);

        try
        {
            // Look up the DeliveryHeader via its business identifier (DeliveryNumber)
            var delivery = await _db.DeliveryHeaders
                .FirstOrDefaultAsync(d => d.DeliveryNumber == deliveryNumber);

            if (delivery == null)
            {
                return NotFound($"Delivery {deliveryNumber} not found.");
            }

            // Guard check: Ensure its current BillingStatus is exactly BillingBlocked
            if (delivery.BillingStatus != DeliveryHeader.DeliveryBillingStatus.BillingBlocked)
            {
                return BadRequest(new
                {
                    success = false,
                    message = $"Delivery {deliveryNumber} is not in BillingBlocked status. Current status: {delivery.BillingStatus}",
                    currentStatus = delivery.BillingStatus.ToString()
                });
            }

            // Transition the state to ReadyToRebill
            delivery.BillingStatus = DeliveryHeader.DeliveryBillingStatus.ReadyToRebill;
            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Delivery {DeliveryNumber} billing status transitioned from BillingBlocked to ReadyToRebill",
                deliveryNumber);

            await LogActivity(
                "RebillAuthorizationReleased",
                deliveryNumber,
                $"SAP released re-billing authorization for delivery {deliveryNumber}",
                "Info");

            return Ok(new
            {
                success = true,
                message = $"Delivery {deliveryNumber} has been released for re-billing.",
                deliveryNumber = deliveryNumber,
                previousStatus = "BillingBlocked",
                newStatus = "ReadyToRebill"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error releasing re-billing authorization for delivery {DeliveryNumber}", deliveryNumber);
            return StatusCode(500, $"Internal error during release authorization: {ex.Message}");
        }
    }
}