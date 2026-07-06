using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using amtemeterai.Api.Models;

namespace amtemeterai.Api.Data;

public static class DbInitializer
{
    public static async Task SeedRbacAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();

        // Ensure database migrations are up to date
        await context.Database.MigrateAsync();

        // Seed configuration settings first
        await SeedConfigurationSettingsAsync(context);

        // 1. SEED SYSTEM ROLES
        string[] roles = { "sysadmin", "finance", "warehouse", "sales" };
        foreach (var roleName in roles)
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                await roleManager.CreateAsync(new IdentityRole(roleName));
            }
        }

        var adminRole = await roleManager.FindByNameAsync("sysadmin");
        var financeRole = await roleManager.FindByNameAsync("finance");
        var warehouseRole = await roleManager.FindByNameAsync("warehouse");
        var salesRole = await roleManager.FindByNameAsync("sales");

        // 2. SEED PERMISSIONS
        var defaultPermissions = new List<Permission>
        {
            // Dashboard (Id: 1)
            new() { Id = 1, PermissionKey = "dashboard:read", Description = "View dashboard with KPIs and analytics", Category = "Dashboard", DisplayOrder = 1 },

            // Customers (Ids: 2, 3)
            new() { Id = 2, PermissionKey = "customer:read", Description = "View customer list and profiles", Category = "Customers", DisplayOrder = 2 },
            new() { Id = 3, PermissionKey = "customer:sync", Description = "Sync customer data from ERP system", Category = "Customers", DisplayOrder = 3 },

            // Invoices (Ids: 4, 5)
            new() { Id = 4, PermissionKey = "invoice:read", Description = "View invoice records", Category = "Invoices", DisplayOrder = 4 },
            new() { Id = 5, PermissionKey = "invoice:sync", Description = "Sync invoices from ERP system", Category = "Invoices", DisplayOrder = 5 },

            // Deliveries (Ids: 6, 7)
            new() { Id = 6, PermissionKey = "delivery:read", Description = "View delivery headers and details", Category = "Deliveries", DisplayOrder = 6 },
            new() { Id = 7, PermissionKey = "delivery:sync", Description = "Sync deliveries from ERP system", Category = "Deliveries", DisplayOrder = 7 },

            // User Management / UAM (Ids: 8, 9)
            new() { Id = 8, PermissionKey = "uam:read", Description = "View system roles and permission matrices", Category = "Access Control", DisplayOrder = 8 },
            new() { Id = 9, PermissionKey = "uam:sync", Description = "Modify and write role permissions to database", Category = "Access Control", DisplayOrder = 9 }
        };

        foreach (var perm in defaultPermissions)
        {
            if (!await context.Permissions.AnyAsync(p => p.PermissionKey == perm.PermissionKey))
            {
                await context.Permissions.AddAsync(perm);
            }
        }
        await context.SaveChangesAsync();

        // 3. SEED APPLICATION MENUS
        var defaultMenus = new List<ApplicationMenu>
        {
            new() { Id = 1, MenuKey = "dashboard", Label = "Dashboard", Path = "/", IconName = "LayoutDashboard", DisplayOrder = 1 },
            new() { Id = 2, MenuKey = "customers", Label = "Customers", Path = "/customers", IconName = "Users", DisplayOrder = 2 },
            new() { Id = 3, MenuKey = "invoices", Label = "Invoices", Path = "/invoices", IconName = "FileText", DisplayOrder = 3 },
            new() { Id = 4, MenuKey = "deliveries", Label = "Deliveries", Path = "/deliveries", IconName = "Package", DisplayOrder = 4 },
            new() { Id = 5, MenuKey = "uam", Label = "Access Management", Path = "/admin/uam", IconName = "ShieldAlert", DisplayOrder = 5 }
        };

        foreach (var menu in defaultMenus)
        {
            if (!await context.ApplicationMenus.AnyAsync(m => m.MenuKey == menu.MenuKey))
            {
                await context.ApplicationMenus.AddAsync(menu);
            }
        }
        await context.SaveChangesAsync();

        // 4. SEED MENU PERMISSIONS (Establish baseline rules to show/hide menus)
        var menuPermissions = new List<MenuPermission>
        {
            new() { MenuId = 1, PermissionId = 1 }, // Dashboard requires dashboard:read
            new() { MenuId = 2, PermissionId = 2 }, // Customers requires customer:read
            new() { MenuId = 3, PermissionId = 4 }, // Invoices requires invoice:read
            new() { MenuId = 4, PermissionId = 6 }, // Deliveries requires delivery:read
            new() { MenuId = 5, PermissionId = 8 }  // Access Management requires uam:read 
        };

        foreach (var mp in menuPermissions)
        {
            if (!await context.MenuPermissions.AnyAsync(x => x.MenuId == mp.MenuId && x.PermissionId == mp.PermissionId))
            {
                await context.MenuPermissions.AddAsync(mp);
            }
        }
        await context.SaveChangesAsync();

        // 5. SEED INITIAL ROLE PERMISSIONS MATRIX
        if (adminRole != null)
        {
            // Sysadmin gets all permissions (Ids 1 through 9), showing all menus
            for (int i = 1; i <= 9; i++)
            {
                await AssignPermissionToRoleAsync(context, adminRole.Id, i);
            }
        }

        if (financeRole != null)
        {
            // Finance only gets access to dashboard and customer
            await AssignPermissionToRoleAsync(context, financeRole.Id, 1); // dashboard:read
            await AssignPermissionToRoleAsync(context, financeRole.Id, 2); // customer:read
        }

        if (warehouseRole != null)
        {
            // Warehouse only gets access to delivery
            await AssignPermissionToRoleAsync(context, warehouseRole.Id, 6); // delivery:read
        }

        if (salesRole != null)
        {
            // Sales only gets access to dashboard and customer
            await AssignPermissionToRoleAsync(context, salesRole.Id, 1); // dashboard:read
            await AssignPermissionToRoleAsync(context, salesRole.Id, 2); // customer:read
        }

        await context.SaveChangesAsync();
    }

    private static async Task AssignPermissionToRoleAsync(AppDbContext context, string roleId, int permissionId)
    {
        if (!await context.RolePermissions.AnyAsync(rp => rp.RoleId == roleId && rp.PermissionId == permissionId))
        {
            await context.RolePermissions.AddAsync(new RolePermission { RoleId = roleId, PermissionId = permissionId });
        }
    }

    private static async Task SeedConfigurationSettingsAsync(AppDbContext context)
    {
        var defaultSettings = new List<ConfigurationSetting>
        {
            new()
            {
                Key = "BillingSync_Interval_Hours",
                Value = "1",
                Description = "For auto sync invoice for DO - Interval in hours to check for received deliveries ready for invoicing",
                UpdatedAt = DateTime.UtcNow
            },
            new()
            {
                Key = "DeliveryClose_Interval_Weeks",
                Value = "1",
                Description = "For auto close sync for DO - Interval in weeks to automatically close old deliveries",
                UpdatedAt = DateTime.UtcNow
            },
            new()
            {
                Key = "CustomerSync_Interval_Daily",
                Value = "1",
                Description = "For auto sync customer data - Interval in days between customer sync operations",
                UpdatedAt = DateTime.UtcNow
            }
        };

        foreach (var setting in defaultSettings)
        {
            var existing = await context.ConfigurationSettings.FindAsync(setting.Key);
            if (existing == null)
            {
                await context.ConfigurationSettings.AddAsync(setting);
            }
            else
            {
                // Update description if it exists but description is null or outdated
                if (string.IsNullOrEmpty(existing.Description) && !string.IsNullOrEmpty(setting.Description))
                {
                    existing.Description = setting.Description;
                    existing.UpdatedAt = DateTime.UtcNow;
                }
            }
        }

        await context.SaveChangesAsync();
    }
}