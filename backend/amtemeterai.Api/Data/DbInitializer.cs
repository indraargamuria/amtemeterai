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

        // 1. SEED SYSTEM ROLES
        string[] roles = { "sysadmin", "finance", "warehouse", "sales" };
        foreach (var roleName in roles)
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                await roleManager.CreateAsync(new IdentityRole(roleName));
            }
        }

        // Get Role Objects for later mapping
        var adminRole = await roleManager.FindByNameAsync("sysadmin");
        var financeRole = await roleManager.FindByNameAsync("finance");
        var warehouseRole = await roleManager.FindByNameAsync("warehouse");
        var salesRole = await roleManager.FindByNameAsync("sales");

        // 2. SEED PERMISSIONS
        var defaultPermissions = new List<Permission>
        {
            // Customer Permissions
            new() { Id = 1, PermissionKey = "customer:read", Description = "View customer list and profiles", Category = "Customers", DisplayOrder = 1 },
            new() { Id = 2, PermissionKey = "customer:sync", Description = "Sync customer data from ERP system", Category = "Customers", DisplayOrder = 2 },
            
            // Invoice Permissions
            new() { Id = 3, PermissionKey = "invoice:read", Description = "View invoice records", Category = "Invoices", DisplayOrder = 3 },
            new() { Id = 4, PermissionKey = "invoice:sync", Description = "Sync invoices from ERP system", Category = "Invoices", DisplayOrder = 4 },
            
            // Delivery Permissions
            new() { Id = 5, PermissionKey = "delivery:read", Description = "View delivery headers and details", Category = "Deliveries", DisplayOrder = 5 },
            new() { Id = 6, PermissionKey = "delivery:sync", Description = "Sync deliveries from ERP system", Category = "Deliveries", DisplayOrder = 6 }
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
            new() { Id = 1, MenuKey = "customers", Label = "Customers", Path = "/customers", IconName = "Users", DisplayOrder = 1 },
            new() { Id = 2, MenuKey = "invoices", Label = "Invoices", Path = "/invoices", IconName = "FileText", DisplayOrder = 2 },
            new() { Id = 3, MenuKey = "deliveries", Label = "Deliveries", Path = "/deliveries", IconName = "Package", DisplayOrder = 3 },
            new() { Id = 4, MenuKey = "settings", Label = "Access Management", Path = "/settings/rbac", IconName = "ShieldAlert", DisplayOrder = 4 }
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
            new() { MenuId = 1, PermissionId = 1 }, // Customers Menu requires customer:read
            new() { MenuId = 2, PermissionId = 3 }, // Invoices Menu requires invoice:read
            new() { MenuId = 3, PermissionId = 5 }, // Deliveries Menu requires delivery:read
            new() { MenuId = 4, PermissionId = 2 }  // Only sync-capable admins get access management menu node
        };

        foreach (var mp in menuPermissions)
        {
            if (!await context.MenuPermissions.AnyAsync(x => x.MenuId == mp.MenuId && x.PermissionId == mp.PermissionId))
            {
                await context.MenuPermissions.AddAsync(mp);
            }
        }
        await context.SaveChangesAsync();

        // 5. SEED INITIAL ROLE PERMISSIONS MATRIX (Initial system mapping)
        if (adminRole != null)
        {
            // Sysadmin gets all permissions automatically
            for (int i = 1; i <= 6; i++)
            {
                await AssignPermissionToRoleAsync(context, adminRole.Id, i);
            }
        }

        // if (financeRole != null)
        // {
        //     // Finance can read/sync customers & invoices, but cannot see deliveries
        //     await AssignPermissionToRoleAsync(context, financeRole.Id, 1); // customer:read
        //     await AssignPermissionToRoleAsync(context, financeRole.Id, 2); // customer:sync
        //     await AssignPermissionToRoleAsync(context, financeRole.Id, 3); // invoice:read
        //     await AssignPermissionToRoleAsync(context, financeRole.Id, 4); // invoice:sync
        // }

        // if (warehouseRole != null)
        // {
        //     // Warehouse can ONLY see delivery routes (Can't read customer profiles or sync)
        //     await AssignPermissionToRoleAsync(context, warehouseRole.Id, 5); // delivery:read
        // }

        // if (salesRole != null)
        // {
        //     // Sales can look up customer lists and look up invoices, but cannot execute sync tools
        //     await AssignPermissionToRoleAsync(context, salesRole.Id, 1); // customer:read
        //     await AssignPermissionToRoleAsync(context, salesRole.Id, 3); // invoice:read
        // }

        await context.SaveChangesAsync();
    }

    private static async Task AssignPermissionToRoleAsync(AppDbContext context, string roleId, int permissionId)
    {
        if (!await context.RolePermissions.AnyAsync(rp => rp.RoleId == roleId && rp.PermissionId == permissionId))
        {
            await context.RolePermissions.AddAsync(new RolePermission { RoleId = roleId, PermissionId = permissionId });
        }
    }
}