namespace amtemeterai.Api.Data;

using System.Security.Claims;

/// <summary>
/// Resolves the acting user/IP for audit attribution.
/// HTTP requests → authenticated identity; background jobs/SAP callbacks → "system".
/// </summary>
public interface ICurrentUserProvider
{
    string UserName { get; }
    string? IpAddress { get; }
}

public class CurrentUserProvider : ICurrentUserProvider
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserProvider(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public string UserName =>
        _httpContextAccessor.HttpContext?.User?.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? _httpContextAccessor.HttpContext?.User?.FindFirstValue(ClaimTypes.Name)
        ?? _httpContextAccessor.HttpContext?.User?.FindFirstValue("preferred_username")
        ?? "system";

    public string? IpAddress =>
        _httpContextAccessor.HttpContext?.Connection?.RemoteIpAddress?.ToString();
}
