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
        decimal totalLocalAmount = 0;
        decimal totalForeignAmount = 0;
        string? buyerPONumber = null;
        if (delivery.Lines != null && delivery.Lines.Any())
        {
            // Simulate unit price calculation: 10000 IDR per sales quantity unit
            foreach (var line in delivery.Lines)
            {
                totalLocalAmount += line.SalesQuantity * 10000;
                // Simulate foreign amount (e.g., USD): divide by 15000
                totalForeignAmount += line.SalesQuantity * 10000 / 15000;
                // Get BuyerPONumber from first line (now at line level)
                if (buyerPONumber == null && !string.IsNullOrEmpty(line.BuyerPONumber))
                {
                    buyerPONumber = line.BuyerPONumber;
                }
            }
        }

        // Determine compliance category based on delivery type
        string complianceCategory = delivery.Type == DeliveryHeader.DeliveryType.BC ? "BC" : "NonBC";

        // Generate simulated SAP invoice number
        // Format: SAP-INV-yyyyMMddHHmmss
        string sapInvoiceNumber = $"SAP-INV-{DateTime.UtcNow:yyyyMMddHHmmss}";

        var response = new SapBillingResponseDto
        {
            SapInvoiceNumber = sapInvoiceNumber,
            BillingDate = DateTime.UtcNow,
            // New dual-currency fields
            AmountLocal = totalLocalAmount,
            AmountForeign = totalForeignAmount,
            Currency = "USD",
            ComplianceCategory = complianceCategory,
            CustomerNumber = delivery.Customer?.CustomerCode ?? "UNKNOWN",
            CustomerName = delivery.Customer?.CustomerName ?? "Unknown Customer",
            PoNumber = buyerPONumber ?? string.Empty,
            DeliveryNumber = delivery.DeliveryNumber,
            Message = "Billing simulation completed successfully"
        };

        _logger.LogInformation(
            "SAP Simulation: Generated invoice {SapInvoiceNumber} for {CustomerNumber} - Foreign: {AmountForeign} {Currency}, Local: {AmountLocal}",
            response.SapInvoiceNumber,
            response.CustomerNumber,
            response.AmountForeign,
            response.Currency,
            response.AmountLocal);

        return Ok(response);
    }
}
