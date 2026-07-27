using amtemeterai.Api.Config;
using amtemeterai.Api.Dtos;
using Microsoft.Extensions.Options;

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
/// Implementation of Peruri session management service with thread-safe token caching
/// Uses Double-Checked Locking pattern with SemaphoreSlim for thread safety
/// </summary>
public class PeruriSessionService : IPeruriSessionService
{
    private readonly PeruriOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<PeruriSessionService> _logger;

    // Thread-safe in-memory token cache (singleton scope)
    private CachedToken? _cachedToken;
    private readonly SemaphoreSlim _tokenLock = new SemaphoreSlim(1, 1);

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
    }

    /// <summary>
    /// Gets a valid JWT bearer token for Peruri API calls
    /// Uses Double-Checked Locking pattern to ensure thread safety while minimizing lock contention
    /// </summary>
    public async Task<string> GetAuthTokenAsync()
    {
        // First check: Fast path - if we have a valid cached token, return immediately without lock
        // This avoids lock contention for the common case where the token is still valid
        if (_cachedToken != null && _cachedToken.ExpiresAt > DateTime.UtcNow.AddMinutes(_options.TokenExpiryBufferMinutes))
        {
            _logger.LogDebug("Using cached Peruri token (expires at {ExpiresAt})", _cachedToken.ExpiresAt);
            return _cachedToken.Token;
        }

        // Token is expired or missing - acquire lock for thread-safe refresh
        await _tokenLock.WaitAsync();
        try
        {
            // Second check: Double-Checked Locking pattern
            // Another thread might have already refreshed the token while we were waiting for the lock
            if (_cachedToken != null && _cachedToken.ExpiresAt > DateTime.UtcNow.AddMinutes(_options.TokenExpiryBufferMinutes))
            {
                _logger.LogDebug("Using cached Peruri token after lock wait (expires at {ExpiresAt})", _cachedToken.ExpiresAt);
                return _cachedToken.Token;
            }

            // Still expired or missing - this thread will refresh the token
            _logger.LogInformation("Cached Peruri token expired or missing, refreshing...");
            return await RefreshTokenAsync();
        }
        finally
        {
            _tokenLock.Release();
        }
    }

    public async Task<string> RefreshTokenAsync()
    {
        // Note: This method should be called while holding the lock (_tokenLock)
        // The caller is responsible for acquiring and releasing the semaphore

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

            _logger.LogDebug("Sending Peruri login request to {LoginUrl} for user {User}", loginUrl, _options.User);

            var response = await client.PostAsJsonAsync(loginUrl, loginRequest);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("Peruri login failed with HTTP status {StatusCode}: {ErrorContent}",
                    response.StatusCode, errorContent);

                throw new InvalidOperationException(
                    $"Peruri authentication failed: {response.StatusCode}. Details: {errorContent}");
            }

            var loginResponse = await response.Content.ReadFromJsonAsync<PeruriLoginResponseDto>();

            // Validate response structure
            if (loginResponse == null)
            {
                _logger.LogError("Peruri login response is null");
                throw new InvalidOperationException("Peruri authentication response is null.");
            }

            // Check statusCode - "00" indicates success
            if (loginResponse.statusCode != "00")
            {
                _logger.LogError("Peruri login returned unsuccessful status code: {StatusCode}, Message: {Message}",
                    loginResponse.statusCode, loginResponse.message);
                throw new InvalidOperationException(
                    $"Peruri authentication failed with status code: {loginResponse.statusCode}. Message: {loginResponse.message}");
            }

            // Extract token - prioritize root-level token, fall back to nested token
            string token = string.Empty;

            // Try root-level token first
            if (!string.IsNullOrEmpty(loginResponse.token))
            {
                token = loginResponse.token;
                _logger.LogDebug("Using token from root-level response property");
            }
            // Fall back to nested token path: result.data.login.token
            else if (!string.IsNullOrEmpty(loginResponse.result?.data?.login?.token))
            {
                token = loginResponse.result.data.login.token;
                _logger.LogDebug("Using token from nested path: result.data.login.token");
            }

            if (string.IsNullOrEmpty(token))
            {
                _logger.LogError("Peruri login response missing token at both root and nested paths");
                throw new InvalidOperationException("Peruri authentication response is missing token.");
            }

            // Default token expiry to 1 hour if not provided
            // Note: The current Peruri API response doesn't include expiry time
            DateTime expiresAt = DateTime.UtcNow.AddHours(1);

            // Update the singleton cache (thread-safe since we hold the lock)
            _cachedToken = new CachedToken
            {
                Token = token,
                ExpiresAt = expiresAt,
                RetrievedAt = DateTime.UtcNow
            };

            _logger.LogInformation("Peruri token refreshed successfully. Expires at {ExpiresAt} (in {Minutes} minutes). User: {User}",
                expiresAt, (expiresAt - DateTime.UtcNow).TotalMinutes, loginResponse.result?.data?.login?.user?.email ?? "unknown");

            return token;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refresh Peruri authentication token");
            throw;
        }
    }
}
