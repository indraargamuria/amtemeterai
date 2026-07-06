using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using amtemeterai.Api.Models;

namespace amtemeterai.Api.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<DeliveryHeader> DeliveryHeaders => Set<DeliveryHeader>();
    public DbSet<DeliveryLine> DeliveryLines => Set<DeliveryLine>();
    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();

    // 1. Add the new Unified Documents DbSet - 2026-05-19 11:08:58 - Arga
    public DbSet<Document> Documents { get; set; }

    // Invoice Management
    public DbSet<Invoice> Invoices => Set<Invoice>();

    // 🚀 Dynamic Dynamic RBAC Matrix Tables - 2026-06-02 - Arga
    public DbSet<Permission> Permissions { get; set; } = null!;
    public DbSet<ApplicationMenu> ApplicationMenus { get; set; } = null!;
    public DbSet<RolePermission> RolePermissions { get; set; } = null!;
    public DbSet<MenuPermission> MenuPermissions { get; set; } = null!;

    public DbSet<Plant> Plant { get; set; } = null!;
    public DbSet<UserPlant> UserPlant { get; set; } = null!;

    // Configuration Settings
    public DbSet<ConfigurationSetting> ConfigurationSettings { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<DeliveryHeader>()
            .HasKey(x => x.DeliveryID);

        modelBuilder.Entity<Customer>()
            .HasKey(x => x.CustomerID);

        modelBuilder.Entity<DeliveryLine>()
            .HasKey(x => x.DeliveryLineID);

        modelBuilder.Entity<DeliveryLine>()
            .HasOne(x => x.DeliveryHeader)
            .WithMany(x => x.Lines)
            .HasForeignKey(x => x.DeliveryID);

        modelBuilder.Entity<Customer>()
            .HasIndex(x => x.CustomerCode)
            .IsUnique();

        // DeliveryHeader
        modelBuilder.Entity<DeliveryHeader>()
            .HasIndex(x => x.DeliveryNumber)
            .IsUnique();

        // DeliveryLine Precision
        modelBuilder.Entity<DeliveryLine>()
            .Property(x => x.SalesQuantity).HasPrecision(18, 2);

        modelBuilder.Entity<DeliveryLine>()
            .Property(x => x.PackQuantity).HasPrecision(18, 2);

        modelBuilder.Entity<DeliveryLine>()
            .Property(x => x.PackQuantityDelivered).HasPrecision(18, 2);

        modelBuilder.Entity<DeliveryLine>()
            .Property(x => x.PackQuantityReturned).HasPrecision(18, 2);

        modelBuilder.Entity<DeliveryLine>()
            .Property(x => x.PackQuantityRejected).HasPrecision(18, 2);

        // ActivityLog
        modelBuilder.Entity<ActivityLog>()
            .HasKey(x => x.LogID);
            
        // 2. Configure Delivery Relation with Cascade Delete
        modelBuilder.Entity<Document>()
            .HasOne(d => d.DeliveryHeader)
            .WithMany() // Can be configured with an explicit Collection property later if desired
            .HasForeignKey(d => d.DeliveryID)
            .OnDelete(DeleteBehavior.Cascade);

        // 3. Prevent empty/null keys in Object Storage paths
        modelBuilder.Entity<Document>()
            .Property(d => d.StorageKey)
            .IsRequired();

        // Invoice Entity Configuration
        modelBuilder.Entity<Invoice>()
            .HasKey(x => x.InvoiceID);

        modelBuilder.Entity<Invoice>()
            .Property(x => x.InvoiceNumber)
            .IsRequired()
            .HasMaxLength(50);

        modelBuilder.Entity<Invoice>()
            .HasIndex(x => x.InvoiceNumber)
            .IsUnique();

        modelBuilder.Entity<Invoice>()
            .Property(x => x.CustomerNumber)
            .IsRequired()
            .HasMaxLength(50);

        modelBuilder.Entity<Invoice>()
            .Property(x => x.InvoiceAmount)
            .HasPrecision(18, 2);

        // Invoice <-> DeliveryHeader (optional 1:many, but treated as 1:1)
        modelBuilder.Entity<Invoice>()
            .HasOne(x => x.DeliveryHeader)
            .WithMany(d => d.Invoices)
            .HasForeignKey(x => x.DeliveryHeaderId)
            .OnDelete(DeleteBehavior.Restrict);

        // Invoice <-> StampedDocument
        modelBuilder.Entity<Invoice>()
            .HasOne(x => x.StampedDocument)
            .WithMany()
            .HasForeignKey(x => x.StampedDocumentId)
            .OnDelete(DeleteBehavior.Restrict);

        // Document <-> Invoice (for invoice printouts)
        modelBuilder.Entity<Document>()
            .HasOne(d => d.InvoiceHeader)
            .WithMany(i => i.Documents)
            .HasForeignKey(d => d.InvoiceID)
            .OnDelete(DeleteBehavior.Cascade);

        // 🚀 4. Configure Composite Key and FKs for RolePermission
        modelBuilder.Entity<RolePermission>(entity =>
        {
            entity.HasKey(rp => new { rp.RoleId, rp.PermissionId });

            entity.HasOne(rp => rp.Permission)
                  .WithMany(p => p.RolePermissions)
                  .HasForeignKey(rp => rp.PermissionId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(rp => rp.Role)
                  .WithMany()
                  .HasForeignKey(rp => rp.RoleId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // 🚀 5. Configure Composite Key and FKs for MenuPermission
        modelBuilder.Entity<MenuPermission>(entity =>
        {
            entity.HasKey(mp => new { mp.MenuId, mp.PermissionId });

            entity.HasOne(mp => mp.Menu)
                  .WithMany(m => m.MenuPermissions)
                  .HasForeignKey(mp => mp.MenuId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(mp => mp.Permission)
                  .WithMany(p => p.MenuPermissions)
                  .HasForeignKey(mp => mp.PermissionId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Configure Composite Key for the Configuration Matrix
        modelBuilder.Entity<UserPlant>()
            .HasKey(up => new { up.UserId, up.PlantCode });

        // Link UserPlant -> User
        modelBuilder.Entity<UserPlant>()
            .HasOne(up => up.User)
            .WithMany() 
            .HasForeignKey(up => up.UserId);

        // Link UserPlant -> Plant
        modelBuilder.Entity<UserPlant>()
            .HasOne(up => up.Plant)
            .WithMany()
            .HasForeignKey(up => up.PlantCode);

        // Explicitly map DeliveryHeader's existing 'Plant' string property to our new Plant table
        modelBuilder.Entity<DeliveryHeader>()
            .HasOne<Plant>()
            .WithMany()
            .HasForeignKey(d => d.Plant) // Assuming DeliveryHeader already has a string property named 'Plant'
            .IsRequired(false); // Make it optional or required based on your ERP data constraints

        // Configuration Settings
        modelBuilder.Entity<ConfigurationSetting>(entity =>
        {
            entity.HasKey(e => e.Key);
            entity.Property(e => e.Key).HasMaxLength(200);
            entity.Property(e => e.Value).IsRequired().HasMaxLength(1000);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP AT TIME ZONE 'UTC'");
        });

        // ============================================================================
        // 🚀 GLOBAL UTC DATETIME CONVERTER FOR POSTGRESQL
        // ============================================================================
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            var properties = entityType.GetProperties()
                .Where(p => p.ClrType == typeof(DateTime) || p.ClrType == typeof(DateTime?));

            foreach (var property in properties)
            {
                property.SetValueConverter(new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime, DateTime>(
                    v => v.Kind == DateTimeKind.Utc ? v : DateTime.SpecifyKind(v, DateTimeKind.Utc),
                    v => v.Kind == DateTimeKind.Utc ? v : DateTime.SpecifyKind(v, DateTimeKind.Utc)
                ));
            }
        }
    }

}