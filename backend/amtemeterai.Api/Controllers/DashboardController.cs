using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;
using amtemeterai.Api.Data;
using amtemeterai.Api.Models;

namespace amtemeterai.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize(Policy = PermissionKeys.DashboardRead)]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;

    public DashboardController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var totalDeliveries = await _db.DeliveryHeaders.CountAsync();

        var pendingDeliveries = await _db.DeliveryHeaders
            .Where(d => !d.Received)
            .CountAsync();

        var receivedDeliveries = await _db.DeliveryHeaders
            .Where(d => d.Received)
            .CountAsync();

        // Rejection rate on received deliveries
        var allDeliveredLines = await _db.DeliveryLines
            .Where(dl => dl.DeliveryHeader.Received)
            .Select(dl => new { dl.PackQuantityDelivered, dl.PackQuantityRejected })
            .ToListAsync();

        decimal totalDelivered = allDeliveredLines.Sum(dl => dl.PackQuantityDelivered);
        decimal totalRejected = allDeliveredLines.Sum(dl => dl.PackQuantityRejected);

        double rejectionRate = totalDelivered > 0
            ? Math.Round((double)(totalRejected / totalDelivered * 100), 1)
            : 0;

        var pendingInvoice = await _db.DeliveryHeaders
            .Where(d => d.Received && !d.Invoiced)
            .CountAsync();

        // Invoice / stamping KPIs
        var totalInvoices = await _db.Invoices.CountAsync();

        var pendingStamps = await _db.Invoices
            .Where(i => i.StampingStatus == Invoice.InvoiceStampingStatus.NotStamped
                     || i.StampingStatus == Invoice.InvoiceStampingStatus.Pending)
            .CountAsync();

        var stamped = await _db.Invoices
            .Where(i => i.StampingStatus == Invoice.InvoiceStampingStatus.Stamped)
            .CountAsync();

        var failedStamps = await _db.Invoices
            .Where(i => i.StampingStatus == Invoice.InvoiceStampingStatus.Failed)
            .CountAsync();

        var invoiceValueTotal = await _db.Invoices.SumAsync(i => (decimal?)i.AmountLocal) ?? 0m;
        var invoiceValueStamped = await _db.Invoices
            .Where(i => i.StampingStatus == Invoice.InvoiceStampingStatus.Stamped)
            .SumAsync(i => (decimal?)i.AmountLocal) ?? 0m;

        var activeCustomers = await _db.Invoices
            .Select(i => i.CustomerNumber)
            .Distinct()
            .CountAsync();

        return Ok(new DashboardStatsDto
        {
            TotalDeliveries = totalDeliveries,
            PendingDeliveries = pendingDeliveries,
            ReceivedDeliveries = receivedDeliveries,
            PendingInvoice = pendingInvoice,
            SapDiscrepancies = pendingInvoice,
            RejectionRate = rejectionRate,
            TotalInvoices = totalInvoices,
            PendingStamps = pendingStamps,
            Stamped = stamped,
            FailedStamps = failedStamps,
            InvoiceValueTotal = invoiceValueTotal,
            InvoiceValueStamped = invoiceValueStamped,
            ActiveCustomers = activeCustomers
        });
    }

    [HttpGet("charts")]
    public async Task<IActionResult> GetCharts()
    {
        var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);

        // Deliveries per day
        var deliveryRaw = await _db.DeliveryHeaders
            .Where(d => d.DeliveryDate >= thirtyDaysAgo)
            .GroupBy(d => d.DeliveryDate.Date)
            .Select(g => new { Key = g.Key, Count = g.Count() })
            .OrderBy(g => g.Key)
            .ToListAsync();

        var deliveryData = deliveryRaw.Select(d => new ChartDataPoint
        {
            Date = d.Key.ToString("yyyy-MM-dd"),
            Count = d.Count
        }).ToList();

        // Invoices per day
        var invoiceRaw = await _db.Invoices
            .Where(i => i.InvoicedDate >= thirtyDaysAgo)
            .GroupBy(i => i.InvoicedDate.Date)
            .Select(g => new { Key = g.Key, Count = g.Count() })
            .OrderBy(g => g.Key)
            .ToListAsync();

        var invoiceData = invoiceRaw.Select(d => new ChartDataPoint
        {
            Date = d.Key.ToString("yyyy-MM-dd"),
            Count = d.Count
        }).ToList();

        return Ok(new DashboardChartsDto
        {
            Deliveries = deliveryData,
            Invoices = invoiceData
        });
    }

    [HttpGet("stamp-breakdown")]
    public async Task<IActionResult> GetStampBreakdown()
    {
        var breakdown = await _db.Invoices
            .GroupBy(i => i.StampingStatus)
            .Select(g => new StampBreakdownDto
            {
                Status = g.Key,
                Count = g.Count(),
                Value = g.Sum(i => i.AmountLocal)
            })
            .OrderBy(g => g.Status)
            .ToListAsync();

        return Ok(breakdown);
    }

    [HttpGet("logs")]
    public async Task<IActionResult> GetLogs([FromQuery] int count = 20)
    {
        var logs = await _db.ActivityLogs
            .OrderByDescending(l => l.Timestamp)
            .Take(count)
            .Select(l => new ActivityLogDto
            {
                LogID = l.LogID,
                Timestamp = l.Timestamp,
                EventType = l.EventType,
                ReferenceID = l.ReferenceID ?? string.Empty,
                Message = l.Message,
                Severity = l.Severity ?? "Info"
            })
            .ToListAsync();

        return Ok(logs);
    }

    /// <summary>
    /// Delivery heatmap data grouped by destination city/regency.
    /// Uses structured CityRegency where available, else falls back to parsing
    /// the free-text ShipToAddress for "Kota/Kabupaten &lt;name&gt;" patterns.
    /// </summary>
    [HttpGet("delivery-map")]
    public async Task<IActionResult> GetDeliveryMap()
    {
        var deliveries = await _db.DeliveryHeaders
            .Select(d => new
            {
                d.CityRegency,
                d.ShipToAddress,
                d.Received
            })
            .ToListAsync();

        var buckets = new Dictionary<string, DeliveryMapBucket>();

        static string ExtractCity(string? cityRegency, string? address)
        {
            if (!string.IsNullOrWhiteSpace(cityRegency))
                return cityRegency.Trim();

            if (!string.IsNullOrWhiteSpace(address))
            {
                // Match "Kota X" / "Kabupaten X" (case-insensitive) anywhere in the address
                var m = Regex.Match(address, @"(?i)\b(?:kota|kabupaten)\s+([a-z\s\-\.']+?)(?=,|\s+\d{4,5}|\s+rt|\s+indonesia|$)",
                    RegexOptions.IgnoreCase);
                if (m.Success)
                {
                    var city = Regex.Replace(m.Groups[1].Value.Trim(), @"\s{2,}", " ");
                    return char.ToUpperInvariant(city[0]) + city[1..];
                }
            }

            return "Unknown";
        }

        foreach (var d in deliveries)
        {
            var city = ExtractCity(d.CityRegency, d.ShipToAddress);
            if (!buckets.TryGetValue(city, out var bucket))
            {
                bucket = new DeliveryMapBucket { City = city };
                buckets[city] = bucket;
            }

            bucket.Total++;
            if (d.Received) bucket.Received++;
        }

        var result = buckets.Values
            .OrderByDescending(b => b.Total)
            .ToList();

        return Ok(result);
    }
}

// =========================
// DTOs for Dashboard
// =========================
public record DashboardStatsDto
{
    public int TotalDeliveries { get; init; }
    public int PendingDeliveries { get; init; }
    public int ReceivedDeliveries { get; init; }
    public int PendingInvoice { get; init; }
    public int SapDiscrepancies { get; init; }
    public double RejectionRate { get; init; }

    public int TotalInvoices { get; init; }
    public int PendingStamps { get; init; }
    public int Stamped { get; init; }
    public int FailedStamps { get; init; }
    public decimal InvoiceValueTotal { get; init; }
    public decimal InvoiceValueStamped { get; init; }
    public int ActiveCustomers { get; init; }
}

public record DashboardChartsDto
{
    public List<ChartDataPoint> Deliveries { get; init; } = new();
    public List<ChartDataPoint> Invoices { get; init; } = new();
}

public record ChartDataPoint
{
    public required string Date { get; init; }
    public int Count { get; init; }
}

public record StampBreakdownDto
{
    public Invoice.InvoiceStampingStatus Status { get; init; }
    public int Count { get; init; }
    public decimal Value { get; init; }
}

public record DeliveryMapBucket
{
    public required string City { get; init; }
    public int Total { get; set; }
    public int Received { get; set; }
}

public record ActivityLogDto
{
    public int LogID { get; init; }
    public DateTime Timestamp { get; init; }
    public required string EventType { get; init; }
    public string ReferenceID { get; init; } = string.Empty;
    public required string Message { get; init; }
    public string Severity { get; init; } = "Info";
}
