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