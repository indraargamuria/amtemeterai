using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using amtemeterai.Api.Data;
using amtemeterai.Api.Dtos;
using amtemeterai.Api.Models;
using amtemeterai.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace amtemeterai.Api.Controllers;

[ApiController]
[Route("api/customers")]
[Authorize]
public class CustomersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICustomerSource _customerSource;
    private readonly CustomerService _customerService;

    public CustomersController(
        AppDbContext context,
        ICustomerSource customerSource,
        CustomerService customerService)
    {
        _db = context;
        _customerSource = customerSource;
        _customerService = customerService;
    }

    //2026-05-04 15:36:19 - Arga - Add Customer Get
    [HttpGet]
    public async Task<ActionResult<IEnumerable<CustomerResponseDto>>> GetAllCustomers()
    {
        var customers = await _db.Customers
            .Select(c => new CustomerResponseDto
            {
                CustomerId = c.CustomerID,
                CustomerCode = c.CustomerCode,
                CustomerName = c.CustomerName,
                CustomerEmail = c.CustomerEmail
            })
            .ToListAsync();

        return Ok(customers);
    }

    //2026-05-06 - Customer Sync Endpoint
    [HttpPost("sync")]
    public async Task<IActionResult> SyncCustomers()
    {
        var externalCustomers = await _customerSource.GetCustomersAsync();

        var (inserted, updated) = await _customerService.UpsertCustomersAsync(externalCustomers);

        return Ok(new
        {
            inserted,
            updated,
            total = inserted + updated,
            message = $"Sync completed: {inserted} inserted, {updated} updated"
        });
    }

    [HttpPost]
    [HttpPatch]
    public async Task<IActionResult> Upsert(CustomerUpsertDto dto)
    {
        var existing = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstOrDefaultAsync(_db.Customers, x => x.CustomerCode == dto.CustomerCode);

        if (existing == null)
        {
            var customer = new Customer
            {
                CustomerCode = dto.CustomerCode,
                CustomerName = dto.CustomerName,
                CustomerEmail = dto.CustomerEmail,
                CustomerPin = string.IsNullOrEmpty(dto.CustomerPin) ? "123456" : dto.CustomerPin
            };

            _db.Customers.Add(customer);
        }
        else
        {
            existing.CustomerName = dto.CustomerName;
            existing.CustomerEmail = dto.CustomerEmail;

            if (!string.IsNullOrEmpty(dto.CustomerPin))
                existing.CustomerPin = dto.CustomerPin;
        }

        await _db.SaveChangesAsync();
        return Ok();
    }
}
