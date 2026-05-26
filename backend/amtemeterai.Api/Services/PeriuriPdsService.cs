using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace amtemeterai.Api.Services;

public class PeriuriPdsService : IPeriuriPdsService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PeriuriPdsService> _logger;

    private string BaseUrl => _configuration["Periuri:BaseUrl"] ?? "https://api.peruri.go.id";
    private string ApiKey => _configuration["Periuri:ApiKey"] ?? string.Empty;

    public PeriuriPdsService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<PeriuriPdsService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<PeriuriStampingResult> StampPdfAsync(
        byte[] pdfContent,
        string invoiceNumber,
        string customerName)
    {
        try
        {
            _logger.LogInformation(
                "Starting e-Meterai stamping for invoice {InvoiceNumber}",
                invoiceNumber);

            using var client = _httpClientFactory.CreateClient();
            client.BaseAddress = new Uri(BaseUrl);
            client.DefaultRequestHeaders.Add("X-API-Key", ApiKey);

            using var content = new MultipartFormDataContent();
            content.Add(new ByteArrayContent(pdfContent), "file", $"{invoiceNumber}.pdf");
            content.Add(new StringContent(invoiceNumber), "document_number");
            content.Add(new StringContent(customerName), "customer_name");
            content.Add(new StringContent("INVOICE"), "document_type");
            content.Add(new StringContent("1"), "page_number"); // Stamp on first page

            var response = await client.PostAsync("/api/v1/stamp", content);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogError(
                    "Periuri PDS API error: {StatusCode} - {Error}",
                    response.StatusCode,
                    errorContent);

                return new PeriuriStampingResult
                {
                    Success = false,
                    ErrorMessage = $"API returned {response.StatusCode}: {errorContent}"
                };
            }

            var responseContent = await response.Content.ReadAsStringAsync();
            var stampResponse = JsonSerializer.Deserialize<PeriuriStampResponse>(responseContent);

            if (stampResponse == null || !stampResponse.Success)
            {
                return new PeriuriStampingResult
                {
                    Success = false,
                    ErrorMessage = stampResponse?.Message ?? "Unknown error from Periuri API"
                };
            }

            _logger.LogInformation(
                "Successfully initiated e-Meterai stamping for invoice {InvoiceNumber}. Transaction ID: {TransactionId}",
                invoiceNumber,
                stampResponse.TransactionId);

            return new PeriuriStampingResult
            {
                Success = true,
                SerialNumber = stampResponse.SerialNumber,
                TransactionId = stampResponse.TransactionId,
                Coordinates = new StampCoordinates
                {
                    PageNumber = 1,
                    X = stampResponse.X,
                    Y = stampResponse.Y,
                    Width = stampResponse.Width,
                    Height = stampResponse.Height
                }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling Periuri PDS API for invoice {InvoiceNumber}", invoiceNumber);

            return new PeriuriStampingResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }

    public async Task<PeriuriStampingStatusResponse> CheckStampingStatusAsync(string transactionId)
    {
        try
        {
            using var client = _httpClientFactory.CreateClient();
            client.BaseAddress = new Uri(BaseUrl);
            client.DefaultRequestHeaders.Add("X-API-Key", ApiKey);

            var response = await client.GetAsync($"/api/v1/stamp/status/{transactionId}");

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError(
                    "Failed to check stamping status for transaction {TransactionId}: {StatusCode}",
                    transactionId,
                    response.StatusCode);

                return new PeriuriStampingStatusResponse
                {
                    IsCompleted = false,
                    ErrorMessage = $"API returned {response.StatusCode}"
                };
            }

            var responseContent = await response.Content.ReadAsStringAsync();
            var statusResponse = JsonSerializer.Deserialize<PeriuriStatusResponse>(responseContent);

            return new PeriuriStampingStatusResponse
            {
                IsCompleted = statusResponse?.Status == "completed",
                SerialNumber = statusResponse?.SerialNumber,
                StampedPdfUrl = statusResponse?.StampedPdfUrl
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking stamping status for transaction {TransactionId}", transactionId);

            return new PeriuriStampingStatusResponse
            {
                IsCompleted = false,
                ErrorMessage = ex.Message
            };
        }
    }

    // Internal DTOs for Periuri API responses
    private record PeriuriStampResponse(
        bool Success,
        string? Message,
        string? TransactionId,
        string? SerialNumber,
        double X,
        double Y,
        double Width,
        double Height
    );

    private record PeriuriStatusResponse(
        string Status,
        string? SerialNumber,
        string? StampedPdfUrl
    );
}