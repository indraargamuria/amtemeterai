namespace amtemeterai.Api.Dtos;

public class AuthResponseDto
{
    public string Token { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string? FullName { get; set; }
}
