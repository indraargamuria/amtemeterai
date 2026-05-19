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
    }
}
