using Microsoft.AspNetCore.Identity;

namespace amtemeterai.Api.Models;

/// <summary>
/// Join table mapping User Identity Roles to access Permissions
/// </summary>
public class RolePermission
{
    public string RoleId { get; set; } = null!; // Maps to AspNetRoles.Id (string UUID format)
    public int PermissionId { get; set; }       // Maps to Permissions.Id

    // Navigation properties
    public virtual IdentityRole? Role { get; set; }
    public virtual Permission? Permission { get; set; }
}