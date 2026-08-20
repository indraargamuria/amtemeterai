using System.Net.Http.Json;
using amtemeterai.Api.Config;
using amtemeterai.Api.Dtos;
using Microsoft.Extensions.Options;

namespace amtemeterai.Api.Services;

/// <summary>
/// Stamp quota (saldo) from Peruri backend: GET {BackendStg}/function/saldopos
/// Cached 30s in memory — the invoice page polls frequently, no need to hit Peruri each time.
/// </summary>
public interface IPeruriSaldoService
{
    Task<PeruriSaldoPosResultDto> GetSaldoAsync(CancellationToken ct = default);
}

public class PeruriSaldoService : IPeruriSaldoService
{
    private readonly PeruriOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<PeruriSaldoService> _logger;
    private readonly IPeruriSessionService _sessionService;

    private readonly SemaphoreSlim _lock = new(1, 1);
    private (PeruriSaldoPosResultDto Value, DateTime FetchedAt)? _cache;

    public PeruriSaldoService(
        IOptions<PeruriOptions> options,
        IHttpClientFactory httpClientFactory,
        IPeruriSessionService sessionService,
        ILogger<PeruriSaldoService> logger)
    {
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
        _sessionService = sessionService;
        _logger = logger;
    }

    public async Task<PeruriSaldoPosResultDto> GetSaldoAsync(CancellationToken ct = default)
    {
        var cached = _cache;
        if (cached != null && cached.Value.FetchedAt > DateTime.UtcNow.AddSeconds(-30))
            return cached.Value.Value;

        await _lock.WaitAsync(ct);
        try
        {
            cached = _cache;
            if (cached != null && cached.Value.FetchedAt > DateTime.UtcNow.AddSeconds(-30))
                return cached.Value.Value;

            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {await _sessionService.GetAuthTokenAsync()}");

            var url = $"{_options.BackendStg.TrimEnd('/')}/function/saldopos";
            using var response = await client.GetAsync(url, ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Peruri saldopos failed: {Status} {Body}", response.StatusCode, body);
                throw new InvalidOperationException($"Peruri saldopos failed: {response.StatusCode}");
            }

            var dto = await response.Content.ReadFromJsonAsync<PeruriSaldoPosResponseDto>(cancellationToken: ct);
            var result = dto?.result ?? throw new InvalidOperationException("Peruri saldopos response missing result.");
            if (result.status != "00")
                throw new InvalidOperationException($"Peruri saldopos error: {result.status} {result.message}");

            _cache = (result, DateTime.UtcNow);
            return result;
        }
        finally
        {
            _lock.Release();
        }
    }
}
