using System.ComponentModel.DataAnnotations;

namespace amtemeterai.Api.Models;

public class Plant
{
    [Key]
    [StringLength(10)] // To match SAP standard plant codes (e.g., "1000", "PL01")
    public string PlantCode { get; set; } = null!;

    [Required]
    [StringLength(100)]
    public string PlantName { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}