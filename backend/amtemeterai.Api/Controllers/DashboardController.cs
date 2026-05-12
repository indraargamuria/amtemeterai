using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using amtemeterai.Api.Data;
using amtemeterai.Api.Models;

namespace amtemeterai.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
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

        // Calculate rejection rate
        var allDeliveredLines = await _db.DeliveryLines
            .Where(dl => dl.DeliveryHeader.Received)
            .Select(dl => new { dl.PackQuantityDelivered, dl.PackQuantityRejected })
            .ToListAsync();

        // FIX: Removed ?? 0m because these are likely already non-nullable decimals based on your build error
        // If they are nullable, the sum logic should handle them via casting or explicit null checks before sum
        decimal totalDelivered = allDeliveredLines.Sum(dl => dl.PackQuantityDelivered);
        decimal totalRejected = allDeliveredLines.Sum(dl => dl.PackQuantityRejected);
        
        double rejectionRate = totalDelivered > 0
            ? Math.Round((double)(totalRejected / totalDelivered * 100), 1)
            : 0;

        var pendingInvoice = await _db.DeliveryHeaders
            .Where(d => d.Received && !d.Invoiced)
            .CountAsync();

        return Ok(new DashboardStatsDto
        {
            TotalDeliveries = totalDeliveries,
            PendingDeliveries = pendingDeliveries,
            PendingInvoice = pendingInvoice,
            RejectionRate = rejectionRate
        });
    }

    [HttpGet("charts")]
    public async Task<IActionResult> GetCharts()
    {
        var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);

        // 1. Database level: Group and Count
        var rawData = await _db.DeliveryHeaders
            .Where(d => d.DeliveryDate >= thirtyDaysAgo)
            .GroupBy(d => d.DeliveryDate.Date)
            .Select(g => new 
            { 
                Key = g.Key, 
                Count = g.Count() 
            })
            .OrderBy(g => g.Key)
            .ToListAsync();

        // 2. Memory level: Format the Date to string
        var deliveryData = rawData.Select(d => new ChartDataPoint
        {
            Date = d.Key.ToString("yyyy-MM-dd"),
            Count = d.Count
        }).ToList();

        return Ok(deliveryData);
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
}

// =========================
// DTOs for Dashboard
// =========================
public record DashboardStatsDto
{
    public int TotalDeliveries { get; init; }
    public int PendingDeliveries { get; init; }
    public int PendingInvoice { get; init; }
    public double RejectionRate { get; init; }
}

public record ChartDataPoint
{
    // FIX: Added required to satisfy non-nullable property check
    public required string Date { get; init; }
    public int Count { get; init; }
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