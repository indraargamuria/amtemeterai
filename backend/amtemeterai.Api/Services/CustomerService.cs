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
                    CustomerPin = c.CustomerPin ?? "123456"
                });
                inserted++;
            }
            else
            {
                // Evaluate explicit dirty changes flags across non-key columns
                bool isDirty = false;

                if (existing.CustomerName != c.CustomerName)
                {
                    existing.CustomerName = c.CustomerName;
                    isDirty = true;
                }

                if (existing.CustomerEmail != c.CustomerEmail)
                {
                    existing.CustomerEmail = c.CustomerEmail;
                    isDirty = true;
                }

                // Only evaluate if incoming value is targeted for modification updates
                if (!string.IsNullOrEmpty(c.CustomerPin) && existing.CustomerPin != c.CustomerPin)
                {
                    existing.CustomerPin = c.CustomerPin;
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