using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using amtemeterai.Api.Config;
using amtemeterai.Api.Dtos;
using Microsoft.Extensions.Options;

namespace amtemeterai.Api.Services;

/// <summary>
/// Contract for fetching shipping parameter master data (country + region + ship mode + lead time)
/// from the ERP system. Mirrors ICustomerSource.
/// </summary>
public interface IShippingParameterSource
{
    Task<List<ShippingParameterDto>> GetShippingParametersAsync();
}

/// <summary>
/// SAP implementation. Calls the zrest_shipparam endpoint and maps rows to DTOs.
/// Expected SAP payload: array of { country, region, ship_mode, leadtime }.
/// </summary>
public class ErpShippingParameterSource : IShippingParameterSource
{
    private readonly HttpClient _httpClient;
    private readonly SapOptions _sapOptions;

    public ErpShippingParameterSource(HttpClient httpClient, IOptions<SapOptions> sapOptions)
    {
        _httpClient = httpClient;
        _sapOptions = sapOptions.Value;
    }

    public async Task<List<ShippingParameterDto>> GetShippingParametersAsync()
    {
        var targetUrl = $"{_sapOptions.BaseUrl}/sap/bc/zrest_shipparam?sap-client={_sapOptions.Client}";

        using var request = new HttpRequestMessage(HttpMethod.Get, targetUrl);
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", _sapOptions.BasicAuthToken);

        try
        {
            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[SHIP-PARAM] SAP returned {response.StatusCode}");
                return new List<ShippingParameterDto>();
            }

            var jsonString = await response.Content.ReadAsStringAsync();
            if (string.IsNullOrWhiteSpace(jsonString))
                return new List<ShippingParameterDto>();

            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                NumberHandling = JsonNumberHandling.AllowReadingFromString
            };

            var items = JsonSerializer.Deserialize<List<SapShippingParameterItem>>(jsonString, options);
            if (items == null)
                return new List<ShippingParameterDto>();

            var result = new List<ShippingParameterDto>();
            foreach (var item in items)
            {
                if (string.IsNullOrWhiteSpace(item.Country) || string.IsNullOrWhiteSpace(item.ShipMode))
                    continue;

                var dto = item.ToDto();
                dto.Region = string.IsNullOrWhiteSpace(dto.Region) ? null : dto.Region.Trim();
                dto.ShipMode = dto.ShipMode.Trim().ToUpperInvariant();
                dto.Country = dto.Country.Trim().ToUpperInvariant();
                result.Add(dto);
            }

            Console.WriteLine($"[SHIP-PARAM] Processed {result.Count} shipping parameter records from SAP.");
            return result;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SHIP-PARAM ERROR] {ex.GetType().Name} - {ex.Message}");
            return new List<ShippingParameterDto>();
        }
    }
}

/// <summary>
/// Dummy source for local dev when CustomerSource=Dummy.
/// Provides a small representative matrix incl. a DEFAULT row per country+region.
/// </summary>
public class DummyShippingParameterSource : IShippingParameterSource
{
    public Task<List<ShippingParameterDto>> GetShippingParametersAsync()
    {
        var list = new List<ShippingParameterDto>
        {
            new() { Country = "ID", Region = "JK", ShipMode = "AIR", LeadTimeDays = 2 },
            new() { Country = "ID", Region = "JK", ShipMode = "LAND", LeadTimeDays = 3 },
            new() { Country = "ID", Region = "JK", ShipMode = "DEFAULT", IsDefault = true, LeadTimeDays = 4 },
            new() { Country = "ID", Region = "JB", ShipMode = "SEA", LeadTimeDays = 7 },
            new() { Country = "ID", Region = "JB", ShipMode = "DEFAULT", IsDefault = true, LeadTimeDays = 5 },
            new() { Country = "SG", Region = "SG", ShipMode = "AIR", LeadTimeDays = 1 },
            new() { Country = "SG", Region = "SG", ShipMode = "DEFAULT", IsDefault = true, LeadTimeDays = 2 },
        };
        return Task.FromResult(list);
    }
}
