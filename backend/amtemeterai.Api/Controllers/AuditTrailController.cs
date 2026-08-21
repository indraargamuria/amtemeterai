using amtemeterai.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace amtemeterai.Api.Controllers;

public class AuditLogDto
{
    public long AuditID { get; set; }
    public DateTime Timestamp { get; set; }
    public string UserName { get; set; } = "";
    public string? IpAddress { get; set; }
    public string EntityName { get; set; } = "";
    public string EntityId { get; set; } = "";
    public string Action { get; set; } = "";
    public Dictionary<string, Dictionary<string, object?>>? ChangedFields { get; set; }  // parsed from ChangedFieldsJson
}

public class AuditLogPagedDto
{
    public List<AuditLogDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AuditTrailController : ControllerBase
{
    private readonly AppDbContext _db;

    public AuditTrailController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Paged audit log with filters. All filters optional.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<AuditLogPagedDto>> GetAuditLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? entity = null,
        [FromQuery] string? entityId = null,
        [FromQuery] string? user = null,
        [FromQuery] string? action = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 50;
        if (pageSize > 200) pageSize = 200;

        var query = _db.AuditLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(entity))
            query = query.Where(a => a.EntityName == entity);
        if (!string.IsNullOrWhiteSpace(entityId))
            query = query.Where(a => a.EntityId == entityId);
        if (!string.IsNullOrWhiteSpace(user))
            query = query.Where(a => a.UserName.Contains(user));
        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(a => a.Action == action);
        if (from.HasValue)
            query = query.Where(a => a.Timestamp >= from.Value);
        if (to.HasValue)
            query = query.Where(a => a.Timestamp <= to.Value);

        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(a => a.Timestamp)
            .ThenByDescending(a => a.AuditID)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AuditLogDto
            {
                AuditID = a.AuditID,
                Timestamp = a.Timestamp,
                UserName = a.UserName,
                IpAddress = a.IpAddress,
                EntityName = a.EntityName,
                EntityId = a.EntityId,
                Action = a.Action,
                ChangedFields = ParseJson(a.ChangedFieldsJson)
            })
            .ToListAsync();

        return Ok(new AuditLogPagedDto
        {
            Items = items,
            TotalCount = total,
            Page = page,
            PageSize = pageSize
        });
    }

    /// <summary>Distinct entity names + users for filter dropdowns.</summary>
    [HttpGet("facets")]
    public async Task<IActionResult> GetFacets()
    {
        var entities = await _db.AuditLogs.AsNoTracking()
            .Select(a => a.EntityName).Distinct().OrderBy(e => e).ToListAsync();
        var users = await _db.AuditLogs.AsNoTracking()
            .Where(a => a.UserName != "system")
            .Select(a => a.UserName).Distinct().OrderBy(u => u).ToListAsync();

        return Ok(new { entities, users });
    }
    /// <summary>Parse the jsonb diff payload for the API response.</summary>
    private static Dictionary<string, Dictionary<string, object?>>? ParseJson(string? json) =>
        json is null
            ? null
            : System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, object?>>>(json);
}
