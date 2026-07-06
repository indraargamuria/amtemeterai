namespace amtemeterai.Api.Models;

/// <summary>
/// Application-wide configuration settings stored in the database.
/// Allows dynamic configuration management without appsettings.json or environment changes.
/// </summary>
public class ConfigurationSetting
{
    /// <summary>
    /// Unique configuration key (Primary Key).
    /// Examples: "BillingSync_Interval_Hours", "DeliveryClose_Interval_Weeks"
    /// </summary>
    public string Key { get; set; } = null!;

    /// <summary>
    /// Configuration value (stored as string for flexibility).
    /// Values should be parsed to appropriate types by the consuming service.
    /// </summary>
    public string Value { get; set; } = null!;

    /// <summary>
    /// Optional description of the configuration setting's purpose and valid values.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Timestamp of the last update to this configuration setting.
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
