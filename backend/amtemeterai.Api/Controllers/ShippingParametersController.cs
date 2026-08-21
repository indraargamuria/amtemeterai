using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using amtemeterai.Api.Data;
using amtemeterai.Api.Dtos;
using amtemeterai.Api.Models;
using amtemeterai.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace amtemeterai.Api.Controllers;

[ApiController]
[Route("api/shipping-parameters")]
[Authorize(Policy = PermissionKeys.CustomerRead)]
public class ShippingParametersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IShippingParameterSource _source;
    private readonly ShippingParameterService _syncService;

    public ShippingParametersController(
        AppDbContext context,
        IShippingParameterSource source,
        ShippingParameterService syncService)
    {
        _db = context;
        _source = source;
        _syncService = syncService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ShippingParameterDto>>> GetAll()
    {
        var rows = await _db.ShippingParameters.AsNoTracking()
            .OrderBy(x => x.Country)
            .ThenBy(x => x.Region)
            .ThenBy(x => x.ShipMode)
            .Select(x => new ShippingParameterDto
            {
                Id = x.Id,
                Country = x.Country,
                Region = x.Region,
                ShipMode = x.ShipMode,
                IsDefault = x.IsDefault,
                LeadTimeDays = x.LeadTimeDays
            })
            .ToListAsync();

        return Ok(rows);
    }

    [HttpPost("sync")]
    public async Task<IActionResult> Sync()
    {
        var external = await _source.GetShippingParametersAsync();
        var (inserted, updated) = await _syncService.UpsertShippingParametersAsync(external);

        _db.ActivityLogs.Add(new ActivityLog
        {
            EventType = "ShippingParameterSynced",
            ReferenceID = "-",
            Message = $"Shipping parameter sync completed: {inserted} inserted, {updated} updated",
            Severity = "Success"
        });
        await _db.SaveChangesAsync();

        return Ok(new
        {
            inserted,
            updated,
            total = inserted + updated,
            message = $"Sync completed: {inserted} inserted, {updated} updated"
        });
    }
}
