namespace amtemeterai.Api.Services;

public interface ICustomerSource
{
    Task<List<CustomerDto>> GetCustomersAsync();
}

public record CustomerDto
{
    public string CustomerCode { get; init; } = null!;
    public string CustomerName { get; init; } = null!;
    public string? CustomerEmail { get; init; }
    public string? CustomerPin { get; init; }
    public string? Region { get; init; }
    public string? Country { get; init; }
}
