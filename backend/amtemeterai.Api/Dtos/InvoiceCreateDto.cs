using System.ComponentModel.DataAnnotations;

namespace amtemeterai.Api.Dtos;

public class InvoiceCreateDto
{
    [Required]
    [MaxLength(50)]
    public string InvoiceNumber { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string CustomerNumber { get; set; } = string.Empty;

    [Required]
    public decimal InvoiceAmount { get; set; }

    [Required]
    public DateTime InvoicedDate { get; set; }

    // Optional: Link to an existing delivery order
    public int? DeliveryHeaderId { get; set; }
}