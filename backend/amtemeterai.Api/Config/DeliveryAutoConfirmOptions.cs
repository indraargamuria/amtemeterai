namespace amtemeterai.Api.Config;

/// <summary>
/// Configuration options for Delivery Auto Confirm Background Service
/// Controls automatic delivery order confirmation based on PGI date + customer region lead time
/// </summary>
public class DeliveryAutoConfirmOptions
{
    public const string SectionName = "DeliveryAutoConfirm";

    /// <summary>
    /// Check interval in minutes between auto-confirm cycles
    /// Default: 60 minutes (1 hour)
    /// </summary>
    public int CheckIntervalMinutes { get; set; } = 60;
}
