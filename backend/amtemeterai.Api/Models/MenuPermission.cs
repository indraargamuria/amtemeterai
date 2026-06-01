namespace amtemeterai.Api.Models;

/// <summary>
/// Join table mapping front-end menus to their minimum required permission bounds
/// </summary>
public class MenuPermission
{
    public int MenuId { get; set; }
    public int PermissionId { get; set; }

    // Navigation properties
    public virtual ApplicationMenu? Menu { get; set; }
    public virtual Permission? Permission { get; set; }
}