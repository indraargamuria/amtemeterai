using System.ComponentModel.DataAnnotations;

namespace amtemeterai.Api.Models;

public class UserPlant
{
    [Required]
    public string UserId { get; set; } = null!;
    public ApplicationUser User { get; set; } = null!;

    [Required]
    [StringLength(10)]
    public string PlantCode { get; set; } = null!;
    public Plant Plant { get; set; } = null!;

    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
}