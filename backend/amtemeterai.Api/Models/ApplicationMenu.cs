using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace amtemeterai.Api.Models;

/// <summary>
/// Master layout node table for dynamic UI sidebars
/// </summary>
public class ApplicationMenu
{
    [Key]
    public int Id { get; set; }

    [Required]
    [StringLength(100)]
    public string MenuKey { get; set; } = null!; // e.g., "deliveries"

    [Required]
    [StringLength(100)]
    public string Label { get; set; } = null!; // e.g., "Deliveries"

    [Required]
    [StringLength(250)]
    public string Path { get; set; } = null!; // e.g., "/deliveries"

    [StringLength(100)]
    public string? IconName { get; set; } // Lucide React icon token e.g., "Package"

    public int? ParentMenuId { get; set; }

    public int DisplayOrder { get; set; }

    // Navigation properties for sub-menu structuring
    [ForeignKey(nameof(ParentMenuId))]
    public virtual ApplicationMenu? ParentMenu { get; set; }
    public virtual ICollection<ApplicationMenu> ChildMenus { get; set; } = new List<ApplicationMenu>();
    public virtual ICollection<MenuPermission> MenuPermissions { get; set; } = new List<MenuPermission>();
}