using amtemeterai.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Text.Json;

namespace amtemeterai.Api.Data;

/// <summary>
/// Auto-records per-property data diffs for business tables on every SaveChanges.
/// Audit rows are inserted in the SAME SaveChanges batch/transaction —
/// an audit entry can never be lost or orphaned from its change.
/// </summary>
public class AuditSaveChangesInterceptor : SaveChangesInterceptor
{
    private readonly ICurrentUserProvider _userProvider;

    public AuditSaveChangesInterceptor(ICurrentUserProvider userProvider)
    {
        _userProvider = userProvider;
    }

    /// <summary>Business tables worth auditing. Everything else (Identity/RBAC/logs) skipped.</summary>
    private static readonly HashSet<string> AuditedEntities = new()
    {
        nameof(DeliveryHeader), nameof(DeliveryLine), nameof(Invoice),
        nameof(Customer), nameof(ShippingParameter), nameof(Document),
        nameof(ConfigurationSetting), nameof(ApplicationUser),
    };

    // Columns that are pure bookkeeping — never interesting in a diff.
    private static readonly HashSet<string> IgnoredColumns = new()
    {
        "RowVersion", "ConcurrencyToken",
    };

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        if (eventData.Context is not null)
            CollectAuditEntries(eventData.Context);

        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        if (eventData.Context is not null)
            CollectAuditEntries(eventData.Context);

        return base.SavingChanges(eventData, result);
    }

    /// <summary>
    /// Adds AuditLog rows to the SAME ChangeTracker before the save executes,
    /// so they commit atomically with the changes they describe.
    /// </summary>
    private void CollectAuditEntries(DbContext context)
    {
        var userName = _userProvider.UserName;
        var ip = _userProvider.IpAddress;
        var now = DateTime.UtcNow;

        foreach (var entry in context.ChangeTracker.Entries().ToList())
        {
            if (entry.Entity is AuditLog || entry.State is EntityState.Detached)
                continue;

            var entityName = entry.Entity.GetType().Name;
            if (!AuditedEntities.Contains(entityName))
                continue;

            string? action = entry.State switch
            {
                EntityState.Added => "Created",
                EntityState.Deleted => "Deleted",
                EntityState.Modified => "Updated",
                _ => null
            };
            if (action is null)
                continue;

            Dictionary<string, Dictionary<string, object?>>? diff = action switch
            {
                // For inserts: log every non-null initial value so the row's birth state is known.
                "Created" => Snapshot(entry),
                // For deletes: EF keeps originals; log the final state being removed.
                "Deleted" => Snapshot(entry),
                _ => Diff(entry)
            };

            context.Add(new AuditLog
            {
                Timestamp = now,
                UserName = userName,
                IpAddress = ip,
                EntityName = entityName,
                EntityId = PrimaryKeyValue(entry) ?? "?",
                Action = action,
                ChangedFields = diff
            });
        }
    }

    /// <summary>Only properties that actually changed, as {prop: {from, to}}.</summary>
    private static Dictionary<string, Dictionary<string, object?>>? Diff(EntityEntry entry)
    {
        Dictionary<string, Dictionary<string, object?>>? result = null;

        foreach (var prop in entry.Properties)
        {
            if (!prop.IsModified)
                continue;
            if (IgnoredColumns.Contains(prop.Metadata.Name))
                continue;

            var original = prop.OriginalValue;
            var current = prop.CurrentValue;

            bool changed =
                original is null ? current is not null
                : current is null ? true
                : !original.Equals(current);

            if (!changed)
                continue;

            (result ??= new())[prop.Metadata.Name] = new Dictionary<string, object?>
            {
                ["from"] = original,
                ["to"] = current
            };
        }

        return result;
    }

    /// <summary>All non-null column values (initial insert / final delete state).</summary>
    private static Dictionary<string, Dictionary<string, object?>>? Snapshot(EntityEntry entry)
    {
        Dictionary<string, Dictionary<string, object?>>? result = null;

        foreach (var prop in entry.Properties)
        {
            if (IgnoredColumns.Contains(prop.Metadata.Name))
                continue;

            var value = entry.State == EntityState.Deleted ? prop.OriginalValue : prop.CurrentValue;
            if (value is null or "")
                continue;

            (result ??= new())[prop.Metadata.Name] = new Dictionary<string, object?>
            {
                ["from"] = null,
                ["to"] = value
            };
        }

        return result;
    }

    private static string? PrimaryKeyValue(EntityEntry entry)
    {
        var pk = entry.Properties.FirstOrDefault(p => p.Metadata.IsPrimaryKey());
        return pk?.CurrentValue?.ToString();
    }
}
