using amtemeterai.Api.Data;
using amtemeterai.Api.Dtos;
using amtemeterai.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace amtemeterai.Api.Services;

/// <summary>
/// Upserts shipping parameter master data fetched from the ERP source.
/// Match key: (Country, Region, ShipMode). Region null matches null.
/// </summary>
public class ShippingParameterService
{
    private readonly AppDbContext _context;

    public ShippingParameterService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<(int inserted, int updated)> UpsertShippingParametersAsync(List<ShippingParameterDto> parameters)
    {
        int inserted = 0;
        int updated = 0;

        foreach (var p in parameters)
        {
            var existing = await _context.ShippingParameters.FirstOrDefaultAsync(x =>
                x.Country == p.Country &&
                x.Region == p.Region &&
                x.ShipMode == p.ShipMode);

            if (existing == null)
            {
                _context.ShippingParameters.Add(new ShippingParameter
                {
                    Country = p.Country,
                    Region = p.Region,
                    ShipMode = p.ShipMode,
                    IsDefault = p.IsDefault || string.Equals(p.ShipMode, "DEFAULT", StringComparison.OrdinalIgnoreCase),
                    LeadTimeDays = p.LeadTimeDays
                });
                inserted++;
            }
            else
            {
                bool isDirty = false;

                if (existing.LeadTimeDays != p.LeadTimeDays)
                {
                    existing.LeadTimeDays = p.LeadTimeDays;
                    isDirty = true;
                }

                bool newIsDefault = p.IsDefault || string.Equals(p.ShipMode, "DEFAULT", StringComparison.OrdinalIgnoreCase);
                if (existing.IsDefault != newIsDefault)
                {
                    existing.IsDefault = newIsDefault;
                    isDirty = true;
                }

                if (isDirty) updated++;
                else _context.Entry(existing).State = EntityState.Unchanged;
            }
        }

        if (inserted > 0 || updated > 0)
            await _context.SaveChangesAsync();

        return (inserted, updated);
    }

    /// <summary>
    /// Resolve lead time for a delivery: country + region + ship mode; falls back to
    /// the DEFAULT row of that country+region when ship mode is null/empty or no
    /// exact match exists. Returns null when nothing matches.
    /// </summary>
    public async Task<int?> ResolveLeadTimeAsync(string? country, string? region, string? shipMode)
    {
        if (string.IsNullOrWhiteSpace(country))
            return null;

        var query = _context.ShippingParameters.AsNoTracking()
            .Where(x => x.Country == country);

        // Region: exact match when provided, else treat null region rows as wildcard fallback too.
        if (!string.IsNullOrWhiteSpace(region))
            query = query.Where(x => x.Region == region || x.Region == null);
        else
            query = query.Where(x => x.Region == null);

        int? result = null;

        if (!string.IsNullOrWhiteSpace(shipMode))
        {
            var sm = shipMode.Trim().ToUpperInvariant();
            var exact = await query.FirstOrDefaultAsync(x => x.ShipMode == sm);
            if (exact != null) return exact.LeadTimeDays;
        }

        var fallback = await query.FirstOrDefaultAsync(x => x.IsDefault);
        if (fallback != null) result = fallback.LeadTimeDays;

        return result;
    }
}
