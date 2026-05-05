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
                existing.CustomerName = c.CustomerName;
                existing.CustomerEmail = c.CustomerEmail;
                if (!string.IsNullOrEmpty(c.CustomerPin))
                {
                    existing.CustomerPin = c.CustomerPin;
                }
                updated++;
            }
        }

        await _context.SaveChangesAsync();

        return (inserted, updated);
    }
}
