using amtemeterai.Api.Config;
using amtemeterai.Api.Dtos;
using Microsoft.Extensions.Options;
using System.IO;

namespace amtemeterai.Api.Services;

/// <summary>
/// Service for on-premise Peruri e-Meterai stamping operations
/// Handles the complete flow: PDF preparation, Peruri API calls, Docker adapter signing, and cleanup
/// </summary>
public interface IPeruriOnPremiseStampService
{
    /// <summary>
    /// Processes an invoice PDF for e-Meterai stamping
    /// Complete flow: file copy, Peruri stamping, Docker signing, and cleanup
    /// </summary>
    Task<PeruriStampResult> StampInvoiceAsync(PeruriStampRequest request);

    /// <summary>
    /// Result of the stamping operation
    /// </summary>
    class PeruriStampResult
    {
        public bool Success { get; set; }
        public string? ErrorMessage { get; set; }
        public string? SerialNumber { get; set; }
        public byte[]? StampedPdf { get; set; }
        public string? InvoiceNumber { get; set; }
    }

    /// <summary>
    /// Request for stamping operation
    /// </summary>
    class PeruriStampRequest
    {
        public string InvoiceNumber { get; set; } = string.Empty;
        public byte[] PdfContent { get; set; } = Array.Empty<byte>();
        public string CustomerName { get; set; } = string.Empty;
        public string CustomerNumber { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }
}

/// <summary>
/// On-premise implementation of Peruri stamping service
/// </summary>
public class PeruriOnPremiseStampService : IPeruriOnPremiseStampService
{
    private readonly PeruriOptions _options;
    private readonly IPeruriSessionService _sessionService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<PeruriOnPremiseStampService> _logger;

    public PeruriOnPremiseStampService(
        IOptions<PeruriOptions> options,
        IPeruriSessionService sessionService,
        IHttpClientFactory httpClientFactory,
        ILogger<PeruriOnPremiseStampService> logger)
    {
        _options = options.Value;
        _sessionService = sessionService;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<IPeruriOnPremiseStampService.PeruriStampResult> StampInvoiceAsync(
        IPeruriOnPremiseStampService.PeruriStampRequest request)
    {
        var invoiceNumber = request.InvoiceNumber;
        var result = new IPeruriOnPremiseStampService.PeruriStampResult
        {
            InvoiceNumber = invoiceNumber
        };

        // Ensure shared folder exists
        var sharedFolder = _options.SharedFolder;
        if (!Directory.Exists(sharedFolder))
        {
            try
            {
                Directory.CreateDirectory(sharedFolder);
                _logger.LogInformation("Created shared folder: {SharedFolder}", sharedFolder);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create shared folder: {SharedFolder}", sharedFolder);
                result.Success = false;
                result.ErrorMessage = $"Failed to create shared folder: {ex.Message}";
                return result;
            }
        }

        // Create subdirectories
        var unsignedDir = Path.Combine(sharedFolder, "UNSIGNED");
        var stampDir = Path.Combine(sharedFolder, "STAMP");
        var signedDir = Path.Combine(sharedFolder, "SIGNED");

        foreach (var dir in new[] { unsignedDir, stampDir, signedDir })
        {
            if (!Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }
        }

        var unsignedPath = Path.Combine(unsignedDir, $"{invoiceNumber}.pdf");
        var qrPath = Path.Combine(stampDir, $"{invoiceNumber}_qr.png");
        var signedPath = Path.Combine(signedDir, $"stamped_{invoiceNumber}.pdf");

        try
        {
            // Step 1: Write unsigned PDF to shared folder
            _logger.LogInformation("Step 1: Writing unsigned PDF to {UnsignedPath}", unsignedPath);
            await File.WriteAllBytesAsync(unsignedPath, request.PdfContent);

            // Step 2: Get JWT token
            _logger.LogInformation("Step 2: Getting Peruri JWT token");
            var jwtToken = await _sessionService.GetAuthTokenAsync();

            // Step 3: Call Peruri Stamp v2 API to get serial number and QR code
            _logger.LogInformation("Step 3: Calling Peruri Stamp v2 API at {Stampv2Stg}", _options.Stampv2Stg);

            var stampClient = _httpClientFactory.CreateClient();
            var stampUrl = $"{_options.Stampv2Stg.TrimEnd('/')}/chanel/stampv2";

            var stampRequest = new PeruriStampRequestDto
            {
                invoiceNumber = invoiceNumber,
                customerName = request.CustomerName,
                customerNumber = request.CustomerNumber,
                amount = request.Amount,
                currency = "IDR"
            };

            stampClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {jwtToken}");
            var stampResponse = await stampClient.PostAsJsonAsync(stampUrl, stampRequest);

            if (!stampResponse.IsSuccessStatusCode)
            {
                var errorContent = await stampResponse.Content.ReadAsStringAsync();
                _logger.LogError("Peruri Stamp API failed with status {StatusCode}: {Error}",
                    stampResponse.StatusCode, errorContent);
                result.Success = false;
                result.ErrorMessage = $"Peruri Stamp API failed: {stampResponse.StatusCode}";
                return result;
            }

            var stampResponseData = await stampResponse.Content.ReadFromJsonAsync<PeruriStampResponseDto>();

            if (stampResponseData == null || !stampResponseData.status || stampResponseData.result == null)
            {
                result.Success = false;
                result.ErrorMessage = "Peruri Stamp API returned invalid response";
                return result;
            }

            var serialNumber = stampResponseData.result.sn;
            var qrBase64 = stampResponseData.result.filenameQR;

            _logger.LogInformation("Step 3 Complete: Received SN {SerialNumber}", serialNumber);

            // Step 4: Decode and save QR code image
            _logger.LogInformation("Step 4: Decoding QR code and saving to {QrPath}", qrPath);

            try
            {
                // Remove data URL prefix if present
                var base64Data = qrBase64;
                if (qrBase64.Contains(","))
                {
                    base64Data = qrBase64.Split(',')[1];
                }

                var qrBytes = Convert.FromBase64String(base64Data);
                await File.WriteAllBytesAsync(qrPath, qrBytes);
                _logger.LogInformation("Step 4 Complete: QR code saved ({Size} bytes)", qrBytes.Length);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to decode/save QR code");
                result.Success = false;
                result.ErrorMessage = $"Failed to save QR code: {ex.Message}";
                return result;
            }

            // Step 5: Call Docker adapter for signing
            _logger.LogInformation("Step 5: Calling KeyStamp Docker adapter at {KeyStamp}", _options.KeyStamp);

            var signingRequest = new KeyStampSigningRequestDto
            {
                certificatelevel = "NOT_CERTIFIED",
                src = $"/sharefolder/UNSIGNED/{invoiceNumber}.pdf",
                dest = $"/sharefolder/SIGNED/stamped_{invoiceNumber}.pdf",
                spesimenPath = $"/sharefolder/STAMP/{invoiceNumber}_qr.png",
                refToken = serialNumber,
                jwToken = jwtToken,
                visSignaturePage = 1,
                visLLX = 237,
                visLLY = 559,
                visURX = 337,
                visURY = 459
            };

            var signingClient = _httpClientFactory.CreateClient();
            var signingUrl = $"{_options.KeyStamp.TrimEnd('/')}/adapter/pdfsigning/rest/docSigningZ";

            var signingResponse = await signingClient.PostAsJsonAsync(signingUrl, signingRequest);

            if (!signingResponse.IsSuccessStatusCode)
            {
                var errorContent = await signingResponse.Content.ReadAsStringAsync();
                _logger.LogError("KeyStamp signing failed with status {StatusCode}: {Error}",
                    signingResponse.StatusCode, errorContent);
                result.Success = false;
                result.ErrorMessage = $"KeyStamp signing failed: {signingResponse.StatusCode}";
                return result;
            }

            _logger.LogInformation("Step 5 Complete: KeyStamp signing completed successfully");

            // Step 6: Read back signed PDF
            _logger.LogInformation("Step 6: Reading signed PDF from {SignedPath}", signedPath);

            // Wait a moment for file write to complete
            await Task.Delay(500);

            var maxRetries = 5;
            var retryCount = 0;
            byte[] signedPdf;

            while (retryCount < maxRetries)
            {
                try
                {
                    signedPdf = await File.ReadAllBytesAsync(signedPath);
                    _logger.LogInformation("Step 6 Complete: Signed PDF read ({Size} bytes)", signedPdf.Length);
                    break;
                }
                catch (FileNotFoundException)
                {
                    retryCount++;
                    if (retryCount >= maxRetries)
                    {
                        result.Success = false;
                        result.ErrorMessage = $"Signed PDF not found after {maxRetries} retries";
                        return result;
                    }
                    _logger.LogWarning("Signed PDF not found, retrying ({Retry}/{MaxRetries})", retryCount, maxRetries);
                    await Task.Delay(1000);
                }
            }

            signedPdf = await File.ReadAllBytesAsync(signedPath);

            // Step 7: Cleanup transient files
            _logger.LogInformation("Step 7: Cleaning up transient files");

            try
            {
                if (File.Exists(unsignedPath)) File.Delete(unsignedPath);
                if (File.Exists(qrPath)) File.Delete(qrPath);
                if (File.Exists(signedPath)) File.Delete(signedPath);
                _logger.LogInformation("Step 7 Complete: Transient files cleaned up");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Some transient files could not be deleted");
            }

            // Success
            result.Success = true;
            result.SerialNumber = serialNumber;
            result.StampedPdf = signedPdf;

            _logger.LogInformation(
                "Stamping completed successfully for invoice {InvoiceNumber}. SN: {SerialNumber}",
                invoiceNumber, serialNumber);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Stamping failed for invoice {InvoiceNumber}", invoiceNumber);
            result.Success = false;
            result.ErrorMessage = ex.Message;

            // Cleanup on error
            try
            {
                if (File.Exists(unsignedPath)) File.Delete(unsignedPath);
                if (File.Exists(qrPath)) File.Delete(qrPath);
                if (File.Exists(signedPath)) File.Delete(signedPath);
            }
            catch { }

            return result;
        }
    }
}
