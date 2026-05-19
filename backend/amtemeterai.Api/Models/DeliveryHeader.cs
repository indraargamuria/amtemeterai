namespace amtemeterai.Api.Models;

public class DeliveryHeader
{
    public int DeliveryID { get; set; }

    public int CustomerID { get; set; }
    public Customer Customer { get; set; } = null!;

    public string DeliveryNumber { get; set; } = null!;
    public DateTime DeliveryDate { get; set; }

    public string? DeliveryRemarks { get; set; }

    public Guid ReceiverToken { get; set; }

    public string? ReceiverName { get; set; }
    public string? ReceiverNotes { get; set; }

    public bool Received { get; set; }
    public bool Invoiced { get; set; }
    
    // GPS Spatial Coordinates
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    // Structured Administrative Fields (Perfect for Dashboard Grouping)
    public string? Province { get; set; }      // e.g., "Jawa Barat"
    public string? CityRegency { get; set; }   // e.g., "Kabupaten Bogor"
    public string? District { get; set; }      // e.g., "Tajur Halang"
    public string? FormattedAddress { get; set; } // Full textual string representation

    public ICollection<DeliveryLine> Lines { get; set; } = new List<DeliveryLine>();
}