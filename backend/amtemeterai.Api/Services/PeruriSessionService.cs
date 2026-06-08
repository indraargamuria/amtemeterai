using amtemeterai.Api.Config;
using amtemeterai.Api.Dtos;
using Microsoft.Extensions.Options;
using System.Collections.Concurrent;

namespace amtemeterai.Api.Services;

/// <summary>
/// Service for managing Peruri PDS authentication sessions
/// Handles JWT token retrieval and caching
/// </summary>
public interface IPeruriSessionService
{
    /// <summary>
    /// Gets a valid JWT bearer token for Peruri API calls
    /// Returns cached token if still valid, otherwise refreshes
    /// </summary>
    Task<string> GetAuthTokenAsync();

    /// <summary>
    /// Forces a token refresh regardless of current token validity
    /// </summary>
    Task<string> RefreshTokenAsync();
}

/// <summary>
/// Implementation of Peruri session management service
/// </summary>
public class PeruriSessionService : IPeruriSessionService
{
    private readonly PeruriOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<PeruriSessionService> _logger;
    private readonly ConcurrentDictionary<string, CachedToken> _tokenCache;

    private class CachedToken
    {
        public string Token { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public DateTime RetrievedAt { get; set; }
    }

    public PeruriSessionService(
        IOptions<PeruriOptions> options,
        IHttpClientFactory httpClientFactory,
        ILogger<PeruriSessionService> logger)
    {
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _tokenCache = new ConcurrentDictionary<string, CachedToken>();
    }

    public async Task<string> GetAuthTokenAsync()
    {
        var cacheKey = "peruri_jwt_token";

        // Check if we have a cached token
        if (_tokenCache.TryGetValue(cacheKey, out var cachedToken))
        {
            // Check if token is still valid (with buffer)
            if (cachedToken.ExpiresAt > DateTime.UtcNow.AddMinutes(_options.TokenExpiryBufferMinutes))
            {
                _logger.LogDebug("Using cached Peruri token (expires at {ExpiresAt})", cachedToken.ExpiresAt);
                return cachedToken.Token;
            }

            _logger.LogInformation("Cached Peruri token expired or expiring soon, refreshing...");
        }

        return await RefreshTokenAsync();
    }

    public async Task<string> RefreshTokenAsync()
    {
        var cacheKey = "peruri_jwt_token";

        _logger.LogInformation("Refreshing Peruri authentication token from {BackendStg}", _options.BackendStg);

        try
        {
            var client = _httpClientFactory.CreateClient();

            // Build the login endpoint URL
            var loginUrl = $"{_options.BackendStg.TrimEnd('/')}/api/users/login";

            // Create login request
            var loginRequest = new PeruriLoginRequestDto
            {
                user = _options.User,
                password = _options.Password
            };

            _logger.LogDebug("Sending Peruri login request to {LoginUrl}", loginUrl);

            var response = await client.PostAsJsonAsync(loginUrl, loginRequest);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("Peruri login failed with status {StatusCode}: {ErrorContent}",
                    response.StatusCode, errorContent);

                throw new InvalidOperationException(
                    $"Peruri authentication failed: {response.StatusCode}. Details: {errorContent}");
            }

            var loginResponse = await response.Content.ReadFromJsonAsync<PeruriLoginResponseDto>();

            if (loginResponse == null || !loginResponse.status || string.IsNullOrEmpty(loginResponse.data?.token))
            {
                _logger.LogError("Peruri login response invalid or missing token");
                throw new InvalidOperationException("Peruri authentication response is invalid or missing token.");
            }

            var token = loginResponse.data.token;

            // Parse expiry if available, otherwise use default (1 hour)
            DateTime expiresAt = DateTime.UtcNow.AddHours(1);
            if (!string.IsNullOrEmpty(loginResponse.data.expireIn) &&
                int.TryParse(loginResponse.data.expireIn, out var expireSeconds))
            {
                expiresAt = DateTime.UtcNow.AddSeconds(expireSeconds);
            }

            // Cache the token
            var newCachedToken = new CachedToken
            {
                Token = token,
                ExpiresAt = expiresAt,
                RetrievedAt = DateTime.UtcNow
            };

            _tokenCache.AddOrUpdate(cacheKey, newCachedToken, (key, old) => newCachedToken);

            _logger.LogInformation("Peruri token refreshed successfully. Expires at {ExpiresAt} (in {Minutes} minutes)",
                expiresAt, (expiresAt - DateTime.UtcNow).TotalMinutes);

            return token;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refresh Peruri authentication token");
            throw;
        }
    }
}
