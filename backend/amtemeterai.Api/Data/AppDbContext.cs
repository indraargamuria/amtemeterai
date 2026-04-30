using Microsoft.EntityFrameworkCore;
using amtemeterai.Api.Models;

namespace amtemeterai.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }


    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<DeliveryHeader> DeliveryHeaders => Set<DeliveryHeader>();
    public DbSet<DeliveryLine> DeliveryLines => Set<DeliveryLine>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
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
    }
}