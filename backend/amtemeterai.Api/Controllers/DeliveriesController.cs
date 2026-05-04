using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using amtemeterai.Api.Data;
using amtemeterai.Api.Dtos;
using amtemeterai.Api.Models;

namespace amtemeterai.Api.Controllers;

[ApiController]
[Route("api/deliveries")]
public class DeliveriesController : ControllerBase
{
    private readonly AppDbContext _db;

    public DeliveriesController(
        AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<DeliveryHeaderDto>>> GetAllDeliveries()
    {
        var deliveries = await _db.DeliveryHeaders
            .Include(d => d.Customer)
            .Select(d => new DeliveryHeaderDto
            {
                DeliveryId = d.DeliveryID,
                DeliveryNumber = d.DeliveryNumber,
                DeliveryDate = d.DeliveryDate,
                DeliveryRemarks = d.DeliveryRemarks,

                CustomerCode = d.Customer.CustomerCode,
                CustomerName = d.Customer.CustomerName,

                Received = d.Received,
                Invoiced = d.Invoiced
            })
            .OrderByDescending(d => d.DeliveryDate)
            .ToListAsync();

        return Ok(deliveries);
    }


    [HttpGet("{deliveryId:int}")]
    public async Task<ActionResult<DeliveryResponseDto>> GetDeliveryById(int deliveryId)
    {
        var delivery = await _db.DeliveryHeaders
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.DeliveryID == deliveryId);

        if (delivery == null)
            return NotFound();

        var response = new DeliveryResponseDto
        {
            DeliveryNumber = delivery.DeliveryNumber,
            DeliveryDate = delivery.DeliveryDate,
            DeliveryRemarks = delivery.DeliveryRemarks,
            ReceiverToken = delivery.ReceiverToken,
            ReceiverName = delivery.ReceiverName,
            ReceiverNotes = delivery.ReceiverNotes,
            Received = delivery.Received,
            Invoiced = delivery.Invoiced,

            Lines = delivery.Lines.Select(l => new DeliveryLineResponseDto
            {
                DeliveryLineNumber = l.DeliveryLineNumber,
                DeliveryItemCode = l.DeliveryItemCode,
                DeliveryItemDescription = l.DeliveryItemDescription,
                SalesQuantity = l.SalesQuantity,
                SalesUOM = l.SalesUOM,
                PackQuantity = l.PackQuantity,
                PackUOM = l.PackUOM,
                PackQuantityDelivered = l.PackQuantityDelivered,
                PackQuantityReturned = l.PackQuantityReturned,
                PackQuantityRejected = l.PackQuantityRejected
            }).ToList()
        };

        return Ok(response);
    }
    [HttpPost]
    [HttpPatch]
    public async Task<IActionResult> Upsert(DeliveryUpsertDto dto)
    {
        var customer = await _db.Customers
            .FirstOrDefaultAsync(x => x.CustomerCode == dto.CustomerCode);

        if (customer == null)
            return BadRequest("Customer not found");

        var existing = await _db.DeliveryHeaders
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.DeliveryNumber == dto.DeliveryNumber);

        if (existing == null)
        {
            var header = new DeliveryHeader
            {
                CustomerID = customer.CustomerID,
                DeliveryNumber = dto.DeliveryNumber,
                DeliveryDate = dto.DeliveryDate,
                DeliveryRemarks = dto.DeliveryRemarks,
                ReceiverToken = Guid.NewGuid()
            };

            header.Lines = dto.Lines.Select(l => new DeliveryLine
            {
                DeliveryLineNumber = l.DeliveryLineNumber,
                DeliveryItemCode = l.DeliveryItemCode,
                DeliveryItemDescription = l.DeliveryItemDescription,
                SalesQuantity = l.SalesQuantity,
                SalesUOM = l.SalesUOM,
                PackQuantity = l.PackQuantity,
                PackUOM = l.PackUOM
            }).ToList();

            _db.DeliveryHeaders.Add(header);
        }
        else
        {
            existing.DeliveryDate = dto.DeliveryDate;
            existing.DeliveryRemarks = dto.DeliveryRemarks;
            existing.ReceiverToken = Guid.NewGuid();

            _db.DeliveryLines.RemoveRange(existing.Lines);

            existing.Lines = dto.Lines.Select(l => new DeliveryLine
            {
                DeliveryLineNumber = l.DeliveryLineNumber,
                DeliveryItemCode = l.DeliveryItemCode,
                DeliveryItemDescription = l.DeliveryItemDescription,
                SalesQuantity = l.SalesQuantity,
                SalesUOM = l.SalesUOM,
                PackQuantity = l.PackQuantity,
                PackUOM = l.PackUOM
            }).ToList();
        }

        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpGet("{token}")]
    public async Task<IActionResult> Get(Guid token)
    {
        var data = await _db.DeliveryHeaders
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.ReceiverToken == token);

        if (data == null) return NotFound();

        var result = new DeliveryResponseDto
        {
            DeliveryNumber = data.DeliveryNumber,
            DeliveryDate = data.DeliveryDate,
            DeliveryRemarks = data.DeliveryRemarks,
            ReceiverToken = data.ReceiverToken,
            ReceiverName = data.ReceiverName,
            ReceiverNotes = data.ReceiverNotes,
            Received = data.Received,
            Invoiced = data.Invoiced,
            Lines = data.Lines.Select(l => new DeliveryLineResponseDto
            {
                DeliveryLineNumber = l.DeliveryLineNumber,
                DeliveryItemCode = l.DeliveryItemCode,
                DeliveryItemDescription = l.DeliveryItemDescription,
                SalesQuantity = l.SalesQuantity,
                SalesUOM = l.SalesUOM,
                PackQuantity = l.PackQuantity,
                PackUOM = l.PackUOM,
                PackQuantityDelivered = l.PackQuantityDelivered,
                PackQuantityReturned = l.PackQuantityReturned,
                PackQuantityRejected = l.PackQuantityRejected
            }).ToList()
        };

        return Ok(result);
    }

    [HttpPatch("{token}")]
    public async Task<IActionResult> UpdateByToken(Guid token, DeliveryReceiveDto dto)
    {
        var data = await _db.DeliveryHeaders
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.ReceiverToken == token);

        if (data == null) return NotFound();

        data.ReceiverName = dto.ReceiverName;
        data.ReceiverNotes = dto.ReceiverNotes;
        data.Received = true;

        foreach (var lineDto in dto.Lines)
        {
            var line = data.Lines.FirstOrDefault(x => x.DeliveryLineNumber == lineDto.DeliveryLineNumber);
            if (line != null)
            {
                line.PackQuantityDelivered = lineDto.PackQuantityDelivered;
                line.PackQuantityReturned = lineDto.PackQuantityReturned;
                line.PackQuantityRejected = lineDto.PackQuantityRejected;
            }
        }

        await _db.SaveChangesAsync();
        return Ok();
    }
}