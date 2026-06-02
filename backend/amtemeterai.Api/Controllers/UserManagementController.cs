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
    private readonly AppDbContext _context;

    public UserManagementController(
        UserManager<ApplicationUser> userManager,
        AppDbContext context)
    {
        _userManager = userManager;
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
    /// Get user's plant assignment matrix
    /// </summary>
    [HttpGet("users/{id}/matrix")]
    public async Task<ActionResult> GetUserMatrix(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        var assignedPlants = await _context.UserPlant
            .Where(up => up.UserId == id)
            .Select(up => up.PlantCode)
            .ToListAsync();

        // Get all available plants for the UI
        var allPlants = await _context.Plant
            .OrderBy(p => p.PlantCode)
            .Select(p => new
            {
                p.PlantCode,
                p.PlantName
            })
            .ToListAsync();

        return Ok(new
        {
            userId = user.Id,
            fullName = user.FullName,
            email = user.Email,
            assignedPlants,
            allPlants
        });
    }

    /// <summary>
    /// Update user's plant assignment matrix
    /// </summary>
    [HttpPost("users/{id}/matrix")]
    public async Task<ActionResult> UpdateUserMatrix(string id, [FromBody] UpdateUserMatrixDto dto)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

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

        // Update security stamp to invalidate existing tokens
        await _userManager.UpdateSecurityStampAsync(user);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "User permissions updated successfully",
            userId = user.Id,
            plantCount = dto.SelectedPlants.Count
        });
    }
}

/// <summary>
/// DTO for updating user plant matrix
/// </summary>
public class UpdateUserMatrixDto
{
    public List<string> SelectedPlants { get; set; } = new();
}
