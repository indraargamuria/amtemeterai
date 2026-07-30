namespace amtemeterai.Api.Config;

/// <summary>
/// Configuration options for Billing Background Service
/// Controls automatic BC invoice creation timing from SAP
/// </summary>
public class BillingSyncOptions
{
    public const string SectionName = "BillingSync";

    /// <summary>
    /// Check interval in minutes between billing sync cycles
    /// Default: 3 minutes
    /// </summary>
    public int CheckIntervalMinutes { get; set; } = 1;
}
