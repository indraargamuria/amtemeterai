using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using amtemeterai.Api.Data;
using amtemeterai.Api.Dtos;
using amtemeterai.Api.Models;
using System.Globalization;

namespace amtemeterai.Api.Controllers;

/// <summary>
/// Simulated SAP Billing API Controller
/// This controller mimics the future SAP billing endpoint contract
/// Used for development and testing until the actual SAP endpoint is available
/// </summary>
[ApiController]
[Route("api/sap-sim")]
[Authorize]
public class SapSimulationController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<SapSimulationController> _logger;

    public SapSimulationController(
        AppDbContext db,
        ILogger<SapSimulationController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Simulates SAP Billing API endpoint
    /// Accepts a delivery identifier and generates a simulated SAP invoice
    /// </summary>
    /// <param name="request">Delivery number to generate billing for</param>
    /// <returns>Simulated SAP invoice data</returns>
    [HttpPost("billing")]
    public async Task<ActionResult<SapBillingResponseDto>> GenerateSimulatedBilling([FromBody] SapBillingRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.DeliveryNumber))
        {
            return BadRequest("Delivery number is required.");
        }

        _logger.LogInformation(
            "SAP Simulation: Generating billing for delivery {DeliveryNumber}",
            request.DeliveryNumber);

        // Fetch the delivery with customer and lines to calculate amount
        var delivery = await _db.DeliveryHeaders
            .Include(d => d.Customer)
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.DeliveryNumber == request.DeliveryNumber);

        if (delivery == null)
        {
            return NotFound($"Delivery {request.DeliveryNumber} not found.");
        }

        // Calculate total amount from delivery lines
        // Using sales quantity * a simulated unit price for demo purposes
        decimal totalAmount = 0;
        if (delivery.Lines != null && delivery.Lines.Any())
        {
            // Simulate unit price calculation: 10000 IDR per sales quantity unit
            foreach (var line in delivery.Lines)
            {
                totalAmount += line.SalesQuantity * 10000;
            }
        }

        // Generate simulated SAP invoice number
        // Format: SAP-INV-yyyyMMddHHmmss
        string sapInvoiceNumber = $"SAP-INV-{DateTime.UtcNow:yyyyMMddHHmmss}";

        var response = new SapBillingResponseDto
        {
            SapInvoiceNumber = sapInvoiceNumber,
            BillingDate = DateTime.UtcNow,
            Amount = totalAmount,
            Currency = "IDR",
            CustomerNumber = delivery.Customer?.CustomerCode ?? "UNKNOWN",
            CustomerName = delivery.Customer?.CustomerName ?? "Unknown Customer",
            PoNumber = delivery.BuyerPONumber,
            DeliveryNumber = delivery.DeliveryNumber
        };

        _logger.LogInformation(
            "SAP Simulation: Generated invoice {SapInvoiceNumber} for {CustomerNumber} with amount {Amount:C}",
            response.SapInvoiceNumber,
            response.CustomerNumber,
            response.Amount);

        return Ok(response);
    }
}
