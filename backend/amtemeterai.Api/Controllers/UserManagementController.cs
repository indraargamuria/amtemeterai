using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using amtemeterai.Api.Models;
using amtemeterai.Api.Data;

namespace amtemeterai.Api.Controllers;

[ApiController]
[Route("api/admin/uam")]
[Authorize(Roles = "sysadmin")]
public class UserManagementController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly AppDbContext _context;

    public UserManagementController(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        AppDbContext context)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _context = context;
    }

    /// <summary>
    /// Get all registered users for UAM management
    /// </summary>
    [HttpGet("users")]
    public async Task<ActionResult> GetAllUsers()
    {
        var users = await _userManager.Users
            .Select(u => new
            {
                u.Id,
                u.FullName,
                u.Email,
                u.LastLoginAt,
                u.CreatedAt
            })
            .OrderBy(u => u.FullName)
            .ToListAsync();

        return Ok(users);
    }

    /// <summary>
    /// Get user's unified assignment matrix (Plants + Roles)
    /// </summary>
    [HttpGet("users/{id}/matrix")]
    public async Task<ActionResult> GetUserMatrix(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        // Get assigned plants
        var assignedPlants = await _context.UserPlant
            .Where(up => up.UserId == id)
            .Select(up => up.PlantCode)
            .ToListAsync();

        // Get assigned roles
        var assignedRoles = await _userManager.GetRolesAsync(user);

        // Get all available plants for the UI
        var allPlants = await _context.Plant
            .OrderBy(p => p.PlantCode)
            .Select(p => new
            {
                p.PlantCode,
                p.PlantName
            })
            .ToListAsync();

        // Get all available roles for the UI
        var allRoles = await _roleManager.Roles
            .OrderBy(r => r.Name)
            .Select(r => new
            {
                r.Id,
                r.Name
            })
            .ToListAsync();

        return Ok(new
        {
            userId = user.Id,
            fullName = user.FullName,
            email = user.Email,
            assignedPlants,
            assignedRoles,
            allPlants,
            allRoles
        });
    }

    /// <summary>
    /// Update user's unified assignment matrix (Plants + Roles)
    /// </summary>
    [HttpPost("users/{id}/matrix")]
    public async Task<ActionResult> UpdateUserMatrix(string id, [FromBody] UpdateUserMatrixDto dto)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        // Prevent sysadmin from removing their own sysadmin role
        var currentUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (currentUserId == id && !dto.SelectedRoles.Contains("sysadmin"))
        {
            return BadRequest(new { message = "Cannot remove your own sysadmin role" });
        }

        // === Plants Sync ===
        // Remove existing plant assignments
        var existingAssignments = await _context.UserPlant
            .Where(up => up.UserId == id)
            .ToListAsync();

        _context.UserPlant.RemoveRange(existingAssignments);

        // Add new plant assignments
        foreach (var plantCode in dto.SelectedPlants)
        {
            // Verify plant exists
            var plantExists = await _context.Plant.AnyAsync(p => p.PlantCode == plantCode);
            if (!plantExists)
            {
                return BadRequest(new { message = $"Plant '{plantCode}' does not exist" });
            }

            _context.UserPlant.Add(new UserPlant
            {
                UserId = id,
                PlantCode = plantCode,
                AssignedAt = DateTime.UtcNow
            });
        }

        // === Roles Sync ===
        // Get current roles
        var currentRoles = await _userManager.GetRolesAsync(user);

        // Remove all current roles
        if (currentRoles.Any())
        {
            var removeResult = await _userManager.RemoveFromRolesAsync(user, currentRoles);
            if (!removeResult.Succeeded)
            {
                return BadRequest(new { message = "Failed to remove existing roles" });
            }
        }

        // Add new roles
        if (dto.SelectedRoles.Any())
        {
            // Verify all roles exist
            foreach (var roleName in dto.SelectedRoles)
            {
                if (!await _roleManager.RoleExistsAsync(roleName))
                {
                    return BadRequest(new { message = $"Role '{roleName}' does not exist" });
                }
            }

            var addResult = await _userManager.AddToRolesAsync(user, dto.SelectedRoles);
            if (!addResult.Succeeded)
            {
                return BadRequest(new { message = "Failed to assign new roles" });
            }
        }

        // Update security stamp to invalidate existing tokens
        await _userManager.UpdateSecurityStampAsync(user);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "User permissions updated successfully",
            userId = user.Id,
            plantCount = dto.SelectedPlants.Count,
            roleCount = dto.SelectedRoles.Count
        });
    }
}

/// <summary>
/// DTO for updating user unified matrix (Plants + Roles)
/// </summary>
public class UpdateUserMatrixDto
{
    public List<string> SelectedPlants { get; set; } = new();
    public List<string> SelectedRoles { get; set; } = new();
}
