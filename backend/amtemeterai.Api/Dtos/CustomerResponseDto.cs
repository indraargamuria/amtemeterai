namespace amtemeterai.Api.Dtos
{
    public class CustomerResponseDto
    {
        public int CustomerId { get; set; }
        public string CustomerCode { get; set; }
        public string CustomerName { get; set; }
        public string? CustomerEmail { get; set; }
    }
}