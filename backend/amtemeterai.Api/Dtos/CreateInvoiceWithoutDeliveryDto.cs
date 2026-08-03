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

    /// <summary>
    /// Optional base (gross) amounts. When 0, they default to the nett Amount.
    /// Nett Amount = BaseAmount + DownPayAmount
    /// </summary>
    public decimal BaseAmountForeign { get; set; }

    public decimal BaseAmountLocal { get; set; }

    /// <summary>
    /// Optional down payment amounts. When set, the nett Amount is recalculated
    /// as BaseAmount + DownPayAmount.
    /// </summary>
    public decimal DownPayAmountForeign { get; set; }

    public decimal DownPayAmountLocal { get; set; }

    [Required]
    [MaxLength(10)]
    public string Currency { get; set; } = "IDR";

    public string? ComplianceCategory { get; set; }

    public DateTime InvoicedDate { get; set; } = DateTime.UtcNow;

}
