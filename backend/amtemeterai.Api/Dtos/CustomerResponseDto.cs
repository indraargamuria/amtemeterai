namespace amtemeterai.Api.Dtos
{
    public class CustomerResponseDto
    {
        public int CustomerId { get; set; }
        public required string CustomerCode { get; set; }
        public required string CustomerName { get; set; }
        public string? CustomerEmail { get; set; }
        public string? CustomerPin { get; set; }
        public string? Region { get; set; }
        public string? Country { get; set; }
    }
}