namespace amtemeterai.Api.Models;

public class DeliveryHeader
{
    // --- NESTED ENUMS DEFINITIONS ---
    public enum DeliveryType
    {
        BC = 1,
        NonBC = 2
    }
    public enum ReceiverStatus
    {
        FullyReceived = 1,
        PartialReceived = 2,
        Canceled = 3 // 🚀 ADDED: Explicit state tracking for cancellation
    }

    /// <summary>
    /// Billing lifecycle states for delivery orders.
    /// Tracks the complete transactional flow from initial fulfillment through SAP invoicing,
    /// invoice void handling, financial lock enforcement, and re-billing authorization.
    /// </summary>
    public enum DeliveryBillingStatus
    {
        /// <summary>
        /// Initial state: Delivery confirmed by buyer, ready for initial invoice generation and SAP sync.
        /// </summary>
        Unbilled = 1,

        /// <summary>
        /// Invoice successfully generated and synced to SAP ERP.
        /// Delivery has completed its billing cycle.
        /// </summary>
        Billed = 2,

        /// <summary>
        /// Invoice voided by SAP; re-billing is strictly prohibited in this lock state.
        /// Delivery must be explicitly released by SAP before any new invoice can be generated.
        /// </summary>
        BillingBlocked = 3,

        /// <summary>
        /// SAP has explicitly unlocked the delivery order, allowing a new invoice simulation run.
        /// The system can now proceed to generate a fresh invoice for this delivery.
        /// </summary>
        ReadyToRebill = 4
    }

    public int DeliveryID { get; set; }

    public int CustomerID { get; set; }
    public Customer Customer { get; set; } = null!;


    public string DeliveryNumber { get; set; } = null!;
    public DateTime DeliveryDate { get; set; }

    public string? DeliveryRemarks { get; set; }

    public string? ShipToAddress { get; set; }

    // Note: OrderNumber and BuyerPONumber moved to DeliveryLine for heterogeneous routing support

    public Guid ReceiverToken { get; set; }

    public string? ReceiverName { get; set; }
    public string? ReceiverNotes { get; set; }

    public bool Received { get; set; }
    public DateTime? ReceiveDate { get; set; }
    public bool Invoiced { get; set; }

    /// <summary>
    /// Tracks the billing lifecycle state for this delivery order.
    /// Defaults to Unbilled, allowing initial invoice generation.
    /// Transitions through Billed → BillingBlocked → ReadyToRebill based on SAP interactions.
    /// </summary>
    public DeliveryBillingStatus BillingStatus { get; set; } = DeliveryBillingStatus.Unbilled;

    /// <summary>
    /// Indicates whether the delivery order is open for structural modifications.
    /// Default state for incoming dispatches. When closed, the delivery record
    /// is locked from further structural changes while still allowing receipt submission.
    /// </summary>
    public bool IsOpen { get; set; } = true;

    public string? Plant { get; set; }           
    public string? SalesPersonName { get; set; }
    public string? SalesPersonEmail { get; set; }

    // Use the nested enum types directly
    public DeliveryType Type { get; set; }            
    public ReceiverStatus? Status { get; set; } // Changed name to 'Status' for clean reading: DeliveryHeader.Status

    // GPS Spatial Coordinates
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    // Structured Administrative Fields (Perfect for Dashboard Grouping)
    public string? Province { get; set; }      // e.g., "Jawa Barat"
    public string? CityRegency { get; set; }   // e.g., "Kabupaten Bogor"
    public string? District { get; set; }      // e.g., "Tajur Halang"
    public string? FormattedAddress { get; set; } // Full textual string representation
    
    public string? CancelReason { get; set; }

    public ICollection<DeliveryLine> Lines { get; set; } = new List<DeliveryLine>();
    public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
}