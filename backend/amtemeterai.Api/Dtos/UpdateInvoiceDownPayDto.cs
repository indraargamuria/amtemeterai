using System.ComponentModel.DataAnnotations;

namespace amtemeterai.Api.Dtos;

/// <summary>
/// Request payload for updating an invoice's down payment amounts.
/// The nett AmountLocal / AmountForeign are automatically recalculated
/// as BaseAmount - DownPayAmount for each currency.
/// </summary>
public class UpdateInvoiceDownPayDto
{
    [Range(0, (double)decimal.MaxValue, ErrorMessage = "Down payment amount cannot be negative.")]
    public decimal DownPayAmountLocal { get; set; }

    [Range(0, (double)decimal.MaxValue, ErrorMessage = "Down payment amount cannot be negative.")]
    public decimal DownPayAmountForeign { get; set; }
}
