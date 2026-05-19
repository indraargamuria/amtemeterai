using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using amtemeterai.Api.Config;
using Microsoft.Extensions.Options;

namespace amtemeterai.Api.Services;

public class ErpCustomerSource : ICustomerSource
{
    private readonly HttpClient _httpClient;
    private readonly SapOptions _sapOptions;

    public ErpCustomerSource(HttpClient httpClient, IOptions<SapOptions> sapOptions)
    {
        _httpClient = httpClient;
        _sapOptions = sapOptions.Value;
    }

    public async Task<List<CustomerDto>> GetCustomersAsync()
    {
        var targetUrl = $"{_sapOptions.BaseUrl}/sap/bc/zrest_custmstr?sap-client={_sapOptions.Client}";
        
        Console.WriteLine($"\n[DEBUG 1] Sending HTTP GET request to SAP: {targetUrl}");
        
        using var request = new HttpRequestMessage(HttpMethod.Get, targetUrl);
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", _sapOptions.BasicAuthToken);

        try
        {
            var response = await _httpClient.SendAsync(request);
            Console.WriteLine($"[DEBUG 2] SAP Response HTTP Status Code: {response.StatusCode} (Success: {response.IsSuccessStatusCode})");
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"[DEBUG 2.ERROR] SAP Returned Error Content: {errorContent}");
                return new List<CustomerDto>();
            }

            var jsonString = await response.Content.ReadAsStringAsync();

            if (string.IsNullOrWhiteSpace(jsonString))
            {
                Console.WriteLine("[DEBUG 3.WARN] JSON string is entirely empty or null!");
                return new List<CustomerDto>();
            }

            // 🚀 STAGE 1: RUN THE AUTOMATED STRING REPAIR ENGINE
            Console.WriteLine("[SAP REPAIR] Executing Regex Sanitizer to fix unescaped double-quotes in SAP content fields...");
            string repairedJson = RepairSapJson(jsonString);

            var mappedList = new List<CustomerDto>();
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                NumberHandling = JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString
            };

            // STAGE 2: TRY PARSING THE CLEANED STRING DIRECTLY
            try
            {
                var sapCustomers = JsonSerializer.Deserialize<List<SapCustomerItem>>(repairedJson, options);
                if (sapCustomers != null)
                {
                    foreach (var item in sapCustomers)
                    {
                        if (string.IsNullOrWhiteSpace(item.CustomerNo)) continue;

                        mappedList.Add(new CustomerDto
                        {
                            CustomerCode = item.CustomerNo.Trim(),
                            CustomerName = string.IsNullOrWhiteSpace(item.CustomerName) ? "Unknown SAP Customer" : item.CustomerName.Trim(),
                            CustomerEmail = string.IsNullOrWhiteSpace(item.Email) ? null : item.Email.Trim(),
                            CustomerPin = string.IsNullOrWhiteSpace(item.PinCode) ? null : item.PinCode.Trim()
                        });
                    }
                }
            }
            catch (JsonException ex)
            {
                Console.WriteLine($"[SAP REPAIR WARN] Standard parsing failed after initial clean: {ex.Message}");
                Console.WriteLine("[SAP REPAIR] Dropping back to isolated element token tracking strategy...");

                // Final Fallback: Parse item by item using the JsonDocument node framework
                using var doc = JsonDocument.Parse(repairedJson);
                if (doc.RootElement.ValueKind == JsonValueKind.Array)
                {
                    int index = 0;
                    foreach (var element in doc.RootElement.EnumerateArray())
                    {
                        try
                        {
                            string? customerNo = element.TryGetProperty("customer_no", out var noProp) ? noProp.GetString() : null;
                            string? customerName = element.TryGetProperty("customer_name", out var nameProp) ? nameProp.GetString() : null;
                            string? email = element.TryGetProperty("email", out var emailProp) ? emailProp.GetString() : null;
                            string? pinCode = element.TryGetProperty("pin_code", out var pinProp) ? pinProp.GetString() : null;

                            if (string.IsNullOrWhiteSpace(customerNo)) continue;

                            mappedList.Add(new CustomerDto
                            {
                                CustomerCode = customerNo.Trim(),
                                CustomerName = string.IsNullOrWhiteSpace(customerName) ? "Unknown SAP Customer" : customerName.Trim(),
                                CustomerEmail = string.IsNullOrWhiteSpace(email) ? null : email.Trim(),
                                CustomerPin = string.IsNullOrWhiteSpace(pinCode) ? null : pinCode.Trim()
                            });
                        }
                        catch (Exception itemEx)
                        {
                            Console.WriteLine($"[SAP REPAIR ERROR] Skipping completely broken index block element $[{index}]: {itemEx.Message}");
                        }
                        index++;
                    }
                }
            }

            Console.WriteLine($"[DEBUG 5] Successfully processed and salvaged {mappedList.Count} customer records from SAP stream.\n");
            return mappedList;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"\n[DEBUG CRITICAL EXCEPTION IN SOURCE]: {ex.GetType().Name} - {ex.Message}");
            return new List<CustomerDto>();
        }
    }

    /// <summary>
    /// Looks inside the JSON string data stream layout, evaluates customer data boundaries, 
    /// and safely escapes unescaped nested double quotes without corrupting functional JSON keys.
    /// </summary>
    private string RepairSapJson(string rawJson)
    {
        if (string.IsNullOrWhiteSpace(rawJson)) return rawJson;

        // This expression searches for content strings sitting between functional JSON formatting layouts:
        // Ex: "customer_name": "PT. "MAJU" JAYA", -> converts to: "customer_name": "PT. \"MAJU\" JAYA",
        string pattern = @"""(customer_name|customer_no|email|pin_code)""\s*:\s*""(.*?)""\s*(?=[,}\]])";

        return Regex.Replace(rawJson, pattern, match =>
        {
            var key = match.Groups[1].Value;
            var value = match.Groups[2].Value;

            // If the inner value contains unescaped double quotes, escape them cleanly
            if (value.Contains("\""))
            {
                // Unescape anything already half-escaped first to ensure clean uniformity, then escape it all cleanly
                string cleanedValue = value.Replace("\\\"", "\"").Replace("\"", "\\\"");
                return $"\"{key}\":\"{cleanedValue}\"";
            }

            return match.Value;
        });
    }
}

public record SapCustomerItem
{
    [JsonPropertyName("customer_no")]
    public string? CustomerNo { get; init; }

    [JsonPropertyName("customer_name")]
    public string? CustomerName { get; init; }

    [JsonPropertyName("email")]
    public string? Email { get; init; }

    [JsonPropertyName("pin_code")]
    public string? PinCode { get; init; }
}