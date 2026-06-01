using System.ComponentModel.DataAnnotations;

namespace amtemeterai.Api.Models;

public class Permission
{
    [Key]
    public int Id { get; set; }

    [Required]
    [StringLength(100)]
    public string PermissionKey { get; set; } = null!;

    [Required]
    [StringLength(250)]
    public string Description { get; set; } = null!;

    [Required]
    [StringLength(100)]
    public string Category { get; set; } = null!;

    public int DisplayOrder { get; set; }

    // This collection relies on the exact namespace matching RolePermission
    public virtual ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
    public virtual ICollection<MenuPermission> MenuPermissions { get; set; } = new List<MenuPermission>();
}