using System.ComponentModel.DataAnnotations;

namespace amtemeterai.Api.Models;

/// <summary>
/// Master data of lead times per Country + Region + Ship Mode combination.
/// Synced from SAP (source of truth). Each country+region pair carries one
/// row per ship mode plus a DEFAULT row used when a delivery order has no
/// ship mode selected.
/// </summary>
public class ShippingParameter
{
    public int Id { get; set; }

    /// <summary>Country code (e.g., "ID", "SG"). Required.</summary>
    [Required, MaxLength(10)]
    public string Country { get; set; } = null!;

    /// <summary>Region code, must align with Customer.Region values from SAP.</summary>
    [MaxLength(50)]
    public string? Region { get; set; }

    /// <summary>Ship mode code (e.g., "AIR", "SEA", "LAND"). "DEFAULT" for the fallback row.</summary>
    [Required, MaxLength(50)]
    public string ShipMode { get; set; } = null!;

    /// <summary>True when ShipMode == "DEFAULT" (reserved row for DOs without ship mode).</summary>
    public bool IsDefault { get; set; }

    /// <summary>Lead time in days.</summary>
    public int LeadTimeDays { get; set; }
}
