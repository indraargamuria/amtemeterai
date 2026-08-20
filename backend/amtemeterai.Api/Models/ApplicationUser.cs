using Microsoft.AspNetCore.Identity;

namespace amtemeterai.Api.Models;

public class ApplicationUser : IdentityUser
{
    public string? FullName { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? LastLoginAt { get; set; }

    /// <summary>
    /// Deactivation flag. Inactive users cannot sign in and have their
    /// existing JWTs invalidated by bumping SecurityStamp on toggle.
    /// </summary>
    public bool IsActive { get; set; } = true;

    public DateTime? DeactivatedAt { get; set; }
}
