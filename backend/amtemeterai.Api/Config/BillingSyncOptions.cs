namespace amtemeterai.Api.Config;

/// <summary>
/// Configuration options for Billing Background Service
/// Controls automatic invoice creation timing
/// </summary>
public class BillingSyncOptions
{
    public const string SectionName = "BillingSync";

    /// <summary>
    /// Delay in minutes after delivery receipt before creating invoice
    /// Default: 30 minutes
    /// </summary>
    public int DelayMinutes { get; set; } = 30;

    /// <summary>
    /// Check interval in minutes between billing sync cycles
    /// Default: 5 minutes
    /// </summary>
    public int CheckIntervalMinutes { get; set; } = 5;
}
