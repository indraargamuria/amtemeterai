using System.ComponentModel.DataAnnotations;

namespace amtemeterai.Api.Dtos;

public class CreateInvoiceWithoutDeliveryDto
{
    [Required]
    public string InvoiceNumber { get; set; } = null!;

    [Required]
    public string CustomerNumber { get; set; } = null!;

    public decimal AmountForeign { get; set; }

    [Required]
    public decimal AmountLocal { get; set; }

    [Required]
    [MaxLength(10)]
    public string Currency { get; set; } = "IDR";

    public string? ComplianceCategory { get; set; }

    public DateTime InvoicedDate { get; set; } = DateTime.UtcNow;

}
