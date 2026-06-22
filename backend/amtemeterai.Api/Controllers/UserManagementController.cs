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

    #region Role-Menu Management

    /// <summary>
    /// Get all system roles and menus for role-menu mapping management
    /// </summary>
    [HttpGet("roles")]
    public async Task<ActionResult> GetRolesAndMenus()
    {
        // Get all system roles
        var roles = await _roleManager.Roles
            .OrderBy(r => r.Name)
            .Select(r => r.Name!)
            .ToListAsync();

        // Get all master menus for mapping
        var menus = await _context.ApplicationMenus
            .OrderBy(m => m.DisplayOrder)
            .Select(m => new
            {
                menuCode = m.MenuKey,
                menuName = m.Label
            })
            .ToListAsync();

        return Ok(new
        {
            roles,
            menus
        });
    }

    /// <summary>
    /// Get menu codes currently assigned to a specific role
    /// </summary>
    [HttpGet("roles/{roleName}/menus")]
    public async Task<ActionResult> GetRoleMenus(string roleName)
    {
        // Verify role exists
        var role = await _roleManager.FindByNameAsync(roleName);
        if (role == null)
        {
            return NotFound(new { message = $"Role '{roleName}' not found" });
        }

        // Get all permission IDs for this role
        var rolePermissionIds = await _context.RolePermissions
            .Where(rp => rp.RoleId == role.Id)
            .Select(rp => rp.PermissionId)
            .ToListAsync();

        if (!rolePermissionIds.Any())
        {
            return Ok(new { roleName, menuCodes = Array.Empty<string>() });
        }

        // Get all menu IDs for those permissions
        var menuIds = await _context.MenuPermissions
            .Where(mp => rolePermissionIds.Contains(mp.PermissionId))
            .Select(mp => mp.MenuId)
            .Distinct()
            .ToListAsync();

        if (!menuIds.Any())
        {
            return Ok(new { roleName, menuCodes = Array.Empty<string>() });
        }

        // Get the menu codes
        var menuCodes = await _context.ApplicationMenus
            .Where(m => menuIds.Contains(m.Id))
            .Select(m => m.MenuKey)
            .ToListAsync();

        return Ok(new
        {
            roleName,
            menuCodes
        });
    }

    /// <summary>
    /// Update menu assignments for a specific role
    /// </summary>
    [HttpPost("roles/{roleName}/menus")]
    public async Task<ActionResult> UpdateRoleMenus(string roleName, [FromBody] UpdateRoleMenusDto dto)
    {
        // Verify role exists
        var role = await _roleManager.FindByNameAsync(roleName);
        if (role == null)
        {
            return NotFound(new { message = $"Role '{roleName}' not found" });
        }

        // Verify all menu codes exist
        var validMenuIds = await _context.ApplicationMenus
            .Where(m => dto.SelectedMenus.Contains(m.MenuKey))
            .Select(m => m.Id)
            .ToListAsync();

        if (validMenuIds.Count != dto.SelectedMenus.Count)
        {
            return BadRequest(new { message = "One or more invalid menu codes provided" });
        }

        // === Get or create a "menu access" permission for this role ===
        // We'll use a permission key format like "{roleName}_menu_access"
        var menuPermissionKey = $"{roleName.ToLower()}_menu_access";
        var menuPermission = await _context.Permissions
            .FirstOrDefaultAsync(p => p.PermissionKey == menuPermissionKey);

        int permissionId;

        if (menuPermission == null)
        {
            // Get the next available ID
            var maxId = await _context.Permissions.MaxAsync(p => (int?)p.Id) ?? 0;
            var newId = maxId + 1;

            // Create a new permission for this role's menu access
            menuPermission = new Permission
            {
                Id = newId,
                PermissionKey = menuPermissionKey,
                Description = $"Grants {roleName} role access to assigned menus",
                Category = "MenuAccess",
                DisplayOrder = 999
            };
            await _context.Permissions.AddAsync(menuPermission);
            await _context.SaveChangesAsync();

            permissionId = menuPermission.Id;

            // Link this permission to the role
            var rolePermissionExists = await _context.RolePermissions
                .AnyAsync(rp => rp.RoleId == role.Id && rp.PermissionId == permissionId);

            if (!rolePermissionExists)
            {
                await _context.RolePermissions.AddAsync(new RolePermission
                {
                    RoleId = role.Id,
                    PermissionId = permissionId
                });
                await _context.SaveChangesAsync();
            }
        }
        else
        {
            permissionId = menuPermission.Id;
        }

        // === Update MenuPermissions ===
        // Remove all existing MenuPermission entries for this permission
        var existingMenuPermissions = await _context.MenuPermissions
            .Where(mp => mp.PermissionId == permissionId)
            .ToListAsync();

        _context.MenuPermissions.RemoveRange(existingMenuPermissions);

        // Add new MenuPermission entries
        foreach (var menuId in validMenuIds)
        {
            await _context.MenuPermissions.AddAsync(new MenuPermission
            {
                MenuId = menuId,
                PermissionId = permissionId
            });
        }

        // === Mass Session Update ===
        // Update security stamp for ALL users in this role
        var usersInRole = await _userManager.GetUsersInRoleAsync(roleName);
        foreach (var user in usersInRole)
        {
            await _userManager.UpdateSecurityStampAsync(user);
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = $"Role '{roleName}' menu permissions updated successfully",
            roleName,
            menuCount = dto.SelectedMenus.Count,
            affectedUsers = usersInRole.Count
        });
    }

    #endregion

    #region User Registration

    /// <summary>
    /// Register a new user with a specific role (Admin Only)
    /// </summary>
    [HttpPost("users/register")]
    public async Task<ActionResult> RegisterUser([FromBody] RegisterUserDto dto)
    {
        // Validate required fields
        if (string.IsNullOrWhiteSpace(dto.Username))
        {
            return BadRequest(new { message = "Username is required" });
        }

        if (string.IsNullOrWhiteSpace(dto.Email))
        {
            return BadRequest(new { message = "Email is required" });
        }

        if (string.IsNullOrWhiteSpace(dto.Password))
        {
            return BadRequest(new { message = "Password is required" });
        }

        if (string.IsNullOrWhiteSpace(dto.TargetRole))
        {
            return BadRequest(new { message = "Target role is required" });
        }

        // Check if user already exists by email
        var existingUser = await _userManager.FindByEmailAsync(dto.Email);
        if (existingUser != null)
        {
            return BadRequest(new { message = "A user with this email already exists" });
        }

        // Check if username already exists
        var existingByUsername = await _userManager.FindByNameAsync(dto.Username);
        if (existingByUsername != null)
        {
            return BadRequest(new { message = "A user with this username already exists" });
        }

        // Verify the role exists in the identity database
        if (!await _roleManager.RoleExistsAsync(dto.TargetRole))
        {
            return BadRequest(new { message = $"Role '{dto.TargetRole}' does not exist in the system" });
        }

        // Create the new user
        var newUser = new ApplicationUser
        {
            UserName = dto.Username,
            Email = dto.Email,
            FullName = dto.FullName ?? dto.Username,
            CreatedAt = DateTime.UtcNow
        };

        var createResult = await _userManager.CreateAsync(newUser, dto.Password);
        if (!createResult.Succeeded)
        {
            // Return detailed error messages from Identity
            var errors = createResult.Errors.Select(e => e.Description).ToList();
            return BadRequest(new
            {
                message = "Failed to create user",
                errors
            });
        }

        // Assign the specified role to the user
        var roleResult = await _userManager.AddToRoleAsync(newUser, dto.TargetRole);
        if (!roleResult.Succeeded)
        {
            // If role assignment fails, clean up the user
            await _userManager.DeleteAsync(newUser);
            return BadRequest(new { message = "User created but failed to assign role. Please try again." });
        }

        // Return the created user information
        return Ok(new
        {
            message = "User registered successfully",
            userId = newUser.Id,
            username = newUser.UserName,
            email = newUser.Email,
            fullName = newUser.FullName,
            role = dto.TargetRole,
            createdAt = newUser.CreatedAt
        });
    }

    #endregion
}

/// <summary>
/// DTO for updating user unified matrix (Plants + Roles)
/// </summary>
public class UpdateUserMatrixDto
{
    public List<string> SelectedPlants { get; set; } = new();
    public List<string> SelectedRoles { get; set; } = new();
}

/// <summary>
/// DTO for updating role menu assignments
/// </summary>
public class UpdateRoleMenusDto
{
    public List<string> SelectedMenus { get; set; } = new();
}

/// <summary>
/// DTO for registering a new user with role assignment
/// </summary>
public class RegisterUserDto
{
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string TargetRole { get; set; } = string.Empty;
}
