using amtemeterai.Api.Data;
using amtemeterai.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace amtemeterai.Api.Services;

public class CustomerService
{
    private readonly AppDbContext _context;

    public CustomerService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<(int inserted, int updated)> UpsertCustomersAsync(List<CustomerDto> customers)
    {
        int inserted = 0;
        int updated = 0;

        foreach (var c in customers)
        {
            var existing = await _context.Customers
                .FirstOrDefaultAsync(x => x.CustomerCode == c.CustomerCode);

            if (existing == null)
            {
                // Clean new insert execution lane
                _context.Customers.Add(new Customer
                {
                    CustomerCode = c.CustomerCode,
                    CustomerName = c.CustomerName,
                    CustomerEmail = c.CustomerEmail,
                    CustomerPin = c.CustomerPin ?? "123456",
                    Region = c.Region,
                    Country = c.Country
                });
                inserted++;
            }
            else
            {
                // Evaluate explicit dirty changes flags across non-key columns
                bool isDirty = false;

                // Update CustomerName if changed
                if (existing.CustomerName != c.CustomerName)
                {
                    existing.CustomerName = c.CustomerName;
                    isDirty = true;
                }

                // Update CustomerEmail if changed (allow null to clear)
                if (existing.CustomerEmail != c.CustomerEmail)
                {
                    existing.CustomerEmail = c.CustomerEmail;
                    isDirty = true;
                }

                // Update CustomerPin if changed (allow null to clear, default to "123456")
                string newPin = c.CustomerPin ?? "123456";
                if (existing.CustomerPin != newPin)
                {
                    existing.CustomerPin = newPin;
                    isDirty = true;
                }

                // Update Region if changed (allow null to clear)
                if (existing.Region != c.Region)
                {
                    existing.Region = c.Region;
                    isDirty = true;
                }

                // Update Country if changed (allow null to clear)
                if (existing.Country != c.Country)
                {
                    existing.Country = c.Country;
                    isDirty = true;
                }

                // Only save transaction increments if absolute data mutations were caught
                if (isDirty)
                {
                    updated++;
                }
                else
                {
                    // Explicitly detach or leave EntityState as Unchanged, saving DB execution performance
                    _context.Entry(existing).State = EntityState.Unchanged;
                }
            }
        }

        // Only trip database infrastructure commit if updates or inserts occurred
        if (inserted > 0 || updated > 0)
        {
            await _context.SaveChangesAsync();
        }

        return (inserted, updated);
    }
}