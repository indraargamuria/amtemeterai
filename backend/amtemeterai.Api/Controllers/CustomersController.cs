using Microsoft.AspNetCore.Mvc;
using amtemeterai.Api.Data;
using amtemeterai.Api.Dtos;
using amtemeterai.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace amtemeterai.Api.Controllers;

[ApiController]
[Route("api/customers")]
public class CustomersController : ControllerBase
{
    private readonly AppDbContext _db;

    public CustomersController(AppDbContext context)
    {
        _db = context;
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