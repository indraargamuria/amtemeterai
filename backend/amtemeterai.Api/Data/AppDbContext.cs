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
    }
}
