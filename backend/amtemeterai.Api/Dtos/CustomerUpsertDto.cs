namespace amtemeterai.Api.Dtos;

public class CustomerUpsertDto
{
    public string CustomerCode { get; set; } = null!;
    public string CustomerName { get; set; } = null!;
    public string? CustomerEmail { get; set; }
    public string? CustomerPin { get; set; }
}