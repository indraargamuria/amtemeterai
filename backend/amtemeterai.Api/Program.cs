using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using amtemeterai.Api.Data;
using amtemeterai.Api.Services;
using amtemeterai.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using amtemeterai.Api.Config;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

// 2026-04-30 - Add Db Context
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// 2026-05-20 - Configure SAP Options
builder.Services.Configure<SapOptions>(builder.Configuration.GetSection(SapOptions.Position));

// 2026-04-30 - Add Controllers
builder.Services.AddControllers();

// 2026-04-30 - Add Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 2026-05-05 - Allow CORS Dynamically
var allowedOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>();

builder.Services.AddSingleton<IStorageService, MinioStorageService>();

builder.Services.AddCors(options =>
{
    // Setting this as the Default Policy ensures it applies globally 
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins!)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Customer Source Configuration Toggles
var customerSourceType = builder.Configuration["CustomerSource"] ?? "Dummy";

if (customerSourceType == "Dummy")
{
    builder.Services.AddScoped<ICustomerSource, DummyCustomerSource>();
}
else
{
    builder.Services.AddHttpClient<ICustomerSource, ErpCustomerSource>();
}

builder.Services.AddScoped<CustomerService>();

// Bind the Smtp Settings Payload Block
builder.Services.Configure<SmtpSettings>(builder.Configuration.GetSection("SmtpSettings"));

// Register Email Infrastructure Service
builder.Services.AddTransient<IEmailService, EmailService>();

// Register Periuri PDS Service for e-Meterai stamping
builder.Services.AddHttpClient();
builder.Services.AddScoped<IPeriuriPdsService, PeriuriPdsService>();

// Register the named HttpClient that your DeliveriesController uses to talk to SAP
builder.Services.AddHttpClient("SapClient", (serviceProvider, client) =>
{
    var sapOptions = serviceProvider.GetRequiredService<Microsoft.Extensions.Options.IOptions<SapOptions>>().Value;
    
    if (string.IsNullOrEmpty(sapOptions.BaseUrl))
    {
        throw new InvalidOperationException("SAP BaseUrl is missing from the configuration providers!");
    }

    client.BaseAddress = new Uri(sapOptions.BaseUrl.TrimEnd('/'));
    client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", sapOptions.BasicAuthToken);
    client.DefaultRequestHeaders.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));
});

// 2026-05-06 - Add ASP.NET Core Identity
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequiredLength = 6;

    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.AllowedForNewUsers = true;

    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

// 2026-05-06 - Add JWT Authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

var app = builder.Build();

// ==========================================
// 🚀 FIXED EXECUTION LIFECYCLE FOR SEEDING & TEST ACCOUNTS
// ==========================================
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    
    try
    {
        logger.LogInformation("Applying pending database migrations...");
        var db = services.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();

        logger.LogInformation("Seeding dynamic RBAC Matrix structural tables...");
        await DbInitializer.SeedRbacAsync(services);

        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();

        // --- A. FIX & ENSURE ADMINISTRATOR EXISTENCE ---
        var adminUser = await userManager.FindByEmailAsync("admin@amtemeterai.com");
        if (adminUser == null)
        {
            logger.LogInformation("Generating fallback default administrator access credentials...");
            adminUser = new ApplicationUser
            {
                UserName = "admin@amtemeterai.com",
                Email = "admin@amtemeterai.com",
                FullName = "System Administrator",
                CreatedAt = DateTime.UtcNow
            };
            await userManager.CreateAsync(adminUser, "Admin@123");
        }

        // Move admin cleanly to sysadmin role if it's trapped in the legacy 'Admin' role
        if (!await userManager.IsInRoleAsync(adminUser, "sysadmin"))
        {
            await userManager.AddToRoleAsync(adminUser, "sysadmin");
            logger.LogInformation("Admin account successfully linked to 'sysadmin' role matrix.");
            
            // Clean up old string role reference if it exists
            if (await userManager.IsInRoleAsync(adminUser, "Admin"))
            {
                await userManager.RemoveFromRoleAsync(adminUser, "Admin");
            }
        }

        // --- B. PROVISION 1 DUMMY ACCOUNT PER CUSTOM SYSTEM ROLE ---
        var dummyAccounts = new List<(string Email, string Name, string Role)>
        {
            ("finance@amtemeterai.com", "Finance Tester", "finance"),
            ("warehouse@amtemeterai.com", "Warehouse Tester", "warehouse"),
            ("sales@amtemeterai.com", "Sales Tester", "sales")
        };

        foreach (var account in dummyAccounts)
        {
            var existingDummy = await userManager.FindByEmailAsync(account.Email);
            if (existingDummy == null)
            {
                logger.LogInformation("Provisioning dynamic test profile: {Email}", account.Email);
                var testUser = new ApplicationUser
                {
                    UserName = account.Email,
                    Email = account.Email,
                    FullName = account.Name,
                    CreatedAt = DateTime.UtcNow
                };

                var createResult = await userManager.CreateAsync(testUser, "Testing@123");
                if (createResult.Succeeded)
                {
                    await userManager.AddToRoleAsync(testUser, account.Role);
                    logger.LogInformation("Assigned {Email} to role '{Role}' cleanly.", account.Email, account.Role);
                }
                else
                {
                    logger.LogWarning("Failed to provision dummy account {Email}: {Errors}", 
                        account.Email, string.Join(", ", createResult.Errors.Select(e => e.Description)));
                }
            }
        }

        // --- C. CLEAN UP LEGACY STRUCTURAL ROLES FROM INITIAL ENGINE (Optional) ---
        string[] oldRoles = { "Admin", "User" };
        foreach (var oldRole in oldRoles)
        {
            var roleNode = await roleManager.FindByNameAsync(oldRole);
            if (roleNode != null && !db.UserRoles.Any(ur => ur.RoleId == roleNode.Id))
            {
                await roleManager.DeleteAsync(roleNode);
                logger.LogInformation("Removed obsolete system role: {OldRole}", oldRole);
            }
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "A fatal exception was thrown during the critical database initialization pipeline sequence.");
    }
}

app.UseHttpsRedirection();

// Adjust Swagger Config based on NGINX
app.UseSwagger(options =>
{
    options.RouteTemplate = "api/swagger/{documentName}/swagger.json";
});

app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/api/swagger/v1/swagger.json", "v1");
    options.RoutePrefix = "api/swagger";
});

// ==========================================
// MIDDLEWARE PIPELINE ROUTING CONFIGURATION
// ==========================================
app.UseRouting();

app.UseCors(); // Picks up global dynamic policy configurations

app.UseAuthentication();
app.UseAuthorization(); // Single clean authorization check

app.MapControllers();

app.Run();