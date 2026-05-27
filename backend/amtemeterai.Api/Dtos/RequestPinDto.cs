namespace amtemeterai.Api.Dtos;

public class RequestPinDto
{
    public Guid ReceiverToken { get; set; }
}

public class RequestPinResponseDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string SentTo { get; set; } = string.Empty;
}