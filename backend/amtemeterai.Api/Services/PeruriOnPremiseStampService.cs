using amtemeterai.Api.Config;
using amtemeterai.Api.Data;
using amtemeterai.Api.Dtos;
using amtemeterai.Api.Models;
using Microsoft.Extensions.Options;
using System.IO;
using System.Text.Json;

namespace amtemeterai.Api.Services;

/// <summary>
/// Service for on-premise Peruri e-Meterai stamping operations with database caching
/// Handles the complete flow: PDF preparation, cached stamp resolution, Peruri API calls, Docker adapter signing, and cleanup
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
        public bool UsedCache { get; set; }  // Indicates if cached stamp data was used
    }

    /// <summary>
    /// Request for stamping operation
    /// </summary>
    class PeruriStampRequest
    {
        public int InvoiceId { get; set; }
        public string InvoiceNumber { get; set; } = string.Empty;
        public byte[] PdfContent { get; set; } = Array.Empty<byte>();
        public string CustomerName { get; set; } = string.Empty;
        public string CustomerNumber { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }
}

/// <summary>
/// On-premise implementation of Peruri stamping service with database caching
/// </summary>
public class PeruriOnPremiseStampService : IPeruriOnPremiseStampService
{
    private readonly PeruriOptions _options;
    private readonly IPeruriSessionService _sessionService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<PeruriOnPremiseStampService> _logger;
    private readonly AppDbContext _dbContext;

    public PeruriOnPremiseStampService(
        IOptions<PeruriOptions> options,
        IPeruriSessionService sessionService,
        IHttpClientFactory httpClientFactory,
        ILogger<PeruriOnPremiseStampService> logger,
        AppDbContext dbContext)
    {
        _options = options.Value;
        _sessionService = sessionService;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _dbContext = dbContext;
    }

    public async Task<IPeruriOnPremiseStampService.PeruriStampResult> StampInvoiceAsync(
        IPeruriOnPremiseStampService.PeruriStampRequest request)
    {
        var invoiceId = request.InvoiceId;
        var invoiceNumber = request.InvoiceNumber;
        var result = new IPeruriOnPremiseStampService.PeruriStampResult
        {
            InvoiceNumber = invoiceNumber
        };

        // =================================================================
        // PHASE 1: RELATIVE FOLDER TRAVERSAL PATH RESOLUTION
        // =================================================================
        // Navigates securely out from 'backend/amtemeterai.Api/bin/Debug/...' to the shared project root path
        string baseShareFolder = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "sharefolder"));

        string unsignedDir = Path.Combine(baseShareFolder, "UNSIGNED");
        string stampDir = Path.Combine(baseShareFolder, "STAMP");
        string signedDir = Path.Combine(baseShareFolder, "SIGNED");

        // Guarantee directory tree initialization exists
        Directory.CreateDirectory(unsignedDir);
        Directory.CreateDirectory(stampDir);
        Directory.CreateDirectory(signedDir);

        string localPdfPath = Path.Combine(unsignedDir, $"{invoiceNumber}.pdf");
        string localQrPath = Path.Combine(stampDir, $"{invoiceNumber}_qr.png");
        string localSignedPath = Path.Combine(signedDir, $"stamped_{invoiceNumber}.pdf");

        try
        {
            // =================================================================
            // PHASE 2: WRITE UNSIGNED PDF TO SHARED FOLDER
            // =================================================================
            _logger.LogInformation("PHASE 1: Writing unsigned PDF to {LocalPdfPath}", localPdfPath);
            await File.WriteAllBytesAsync(localPdfPath, request.PdfContent);

            // =================================================================
            // PHASE 3: DATABASE CACHE RESOLUTION (QUOTA SAVER)
            // =================================================================
            var invoice = await _dbContext.Invoices.FindAsync(invoiceId);
            if (invoice == null)
            {
                result.Success = false;
                result.ErrorMessage = $"Invoice record with ID {invoiceId} not found in database.";
                return result;
            }

            string sn = invoice.SerialNumber ?? string.Empty;
            string qrBase64 = invoice.QrCodeBase64 ?? string.Empty;
            bool hasCachedStampData = !string.IsNullOrEmpty(sn) && !string.IsNullOrEmpty(qrBase64);

            // Fetch session credentials upfront
            string jwtToken = await _sessionService.GetAuthTokenAsync();

            if (hasCachedStampData)
            {
                _logger.LogInformation("OPTIMIZATION: Found existing cached stamp data for Invoice {InvoiceNumber}. Skipping Peruri API call.", invoiceNumber);
                result.UsedCache = true;

                // If database contains cached metadata but local folder image got cleared out, recreate it instantly
                if (!File.Exists(localQrPath))
                {
                    _logger.LogInformation("Restoring missing physical QR PNG file from database Base64 cache string.");
                    byte[] qrBytes = Convert.FromBase64String(qrBase64);
                    await File.WriteAllBytesAsync(localQrPath, qrBytes);
                }
            }
            else
            {
                // =================================================================
                // PHASE 4: BRAND NEW SUBMISSION (CALL PERURI API STAMP V2)
                // =================================================================
                _logger.LogInformation("PHASE 2: No cached stamp data found. Invoking remote Peruri Stamp V2 API for Invoice {InvoiceNumber}", invoiceNumber);

                var stampClient = _httpClientFactory.CreateClient();
                var stampUrl = $"{_options.Stampv2Stg.TrimEnd('/')}/chanel/stampv2";

                var stampRequest = new PeruriStampRequestDto
                {
                    isUpload = false,
                    namadoc = "4b", // Hardcoded standard value
                    namafile = "INVA.pdf",
                    nilaidoc = "10000",
                    namejidentitas = "KTP",
                    noidentitas = "1251038765430004",
                    namedipungut = "Santosa",
                    snOnly = false,
                    nodoc = "1",
                    tgldoc = DateTime.Today.ToString("yyyy-MM-dd") // Format: YYYY-MM-DD
                };
                // Map business fields to Peruri API contract structure
                // var stampRequest = new PeruriStampRequestDto
                // {
                //     isUpload = false,
                //     namadoc = "4b",  // Document type code for Invoice/Faktur
                //     namafile = $"{invoiceNumber}.pdf",
                //     nilaidoc = "10000",  // e-Meterai nominal price tier
                //     namejidentitas = "KTP",  // ID type
                //     noidentitas = !string.IsNullOrEmpty(request.CustomerNumber) ? request.CustomerNumber : "1251038765430004",  // Fallback placeholder for staging
                //     namedipungut = !string.IsNullOrEmpty(request.CustomerName) ? request.CustomerName : "Customer Name",
                //     snOnly = false,
                //     nodoc = "invoiceNumber",
                //     tgldoc = DateTime.Today.ToString("yyyy-MM-dd")  // Format: YYYY-MM-DD
                // };

                _logger.LogDebug("Peruri Stamp Request: isUpload={IsUpload}, nodoc={NoDoc}, tgldoc={TglDoc}, noidentitas={NoIdentitas}, namedipungut={NameDipungut}",
                    stampRequest.isUpload, stampRequest.nodoc, stampRequest.tgldoc, stampRequest.noidentitas, stampRequest.namedipungut);

                stampClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {jwtToken}");
                var stampResponse = await stampClient.PostAsJsonAsync(stampUrl, stampRequest);
                var responseString = await stampResponse.Content.ReadAsStringAsync();

                if (!stampResponse.IsSuccessStatusCode)
                {
                    _logger.LogError("Peruri Stamp API failed with HTTP status {StatusCode}: {Error}",
                        stampResponse.StatusCode, responseString);
                    result.Success = false;
                    result.ErrorMessage = $"Peruri remote gateway connection error: {stampResponse.StatusCode}";
                    return result;
                }

                // Parse response using JsonDocument for better error handling
                JsonDocument jsonDoc;
                try
                {
                    jsonDoc = JsonDocument.Parse(responseString);
                }
                catch (JsonException jsonEx)
                {
                    _logger.LogError(jsonEx, "Failed to parse Peruri Stamp response. Content: {Content}", responseString);
                    result.Success = false;
                    result.ErrorMessage = $"Critical parsing fault on stamp payload schema. Content: {responseString}";
                    return result;
                }

                var root = jsonDoc.RootElement;
                string statusCode = root.GetProperty("statusCode").GetString();

                if (statusCode != "00")
                {
                    string message = root.TryGetProperty("message", out var msgProp) ? msgProp.GetString() : "Unknown error";
                    _logger.LogError("Peruri Stamping Error Status ({StatusCode}): {Message}", statusCode, message);
                    result.Success = false;
                    result.ErrorMessage = $"Peruri Stamping Error Status ({statusCode}): {message}";
                    return result;
                }

                // Parse out returned data parameters
                var resultData = root.GetProperty("result");
                sn = resultData.GetProperty("sn").GetString() ?? string.Empty;
                qrBase64 = resultData.GetProperty("image").GetString() ?? string.Empty;

                if (string.IsNullOrEmpty(sn) || string.IsNullOrEmpty(qrBase64))
                {
                    _logger.LogError("Peruri Stamp API response missing required attributes (sn/image). Body: {Content}", responseString);
                    result.Success = false;
                    result.ErrorMessage = $"Peruri payload is missing required layout attributes (sn/image). Body: {responseString}";
                    return result;
                }

                // 1. Write the decoded byte file down to the local project sharefolder specimen structure
                byte[] qrBytes = Convert.FromBase64String(qrBase64);
                await File.WriteAllBytesAsync(localQrPath, qrBytes);
                _logger.LogInformation("PHASE 2 Complete: Physical QR code stamp saved locally into sharefolder structure.");

                // 2. Persist directly inside the database columns to prevent duplicate calls
                invoice.SerialNumber = sn;
                invoice.QrCodeBase64 = qrBase64;
                await _dbContext.SaveChangesAsync();
                _logger.LogInformation("PHASE 2 Complete: Serial Number and Base64 QR code saved safely to Invoice entity record.");
            }

            // =================================================================
            // PHASE 5: EXECUTE LOCAL KEYSTAMP CONTAINER SIGNING
            // =================================================================
            _logger.LogInformation("PHASE 3: Invoking KeyStamp Docker adapter at port 9999");

            var signingClient = _httpClientFactory.CreateClient();
            var signingUrl = $"{_options.KeyStamp.TrimEnd('/')}/adapter/pdfsigning/rest/docSigningZ";

            var signingRequest = new KeyStampSigningRequestDto
            {
                certificatelevel = "NOT_CERTIFIED",

                // Keep target paths absolute to the container volume layout (/app root bound)
                src = $"/app/sharefolder/UNSIGNED/{invoiceNumber}.pdf",
                dest = $"/app/sharefolder/SIGNED/stamped_{invoiceNumber}.pdf",
                spesimenPath = $"/app/sharefolder/STAMP/{invoiceNumber}_qr.png",

                refToken = sn,
                jwToken = jwtToken,
                visSignaturePage = 1,
                visLLX = 237,
                visLLY = 559,
                visURX = 337,
                visURY = 459,
                profileName = "default",
                docpass = "",
                location = "Jakarta",
                reason = "Meterai Electronic Integration"
            };

            _logger.LogDebug("KeyStamp Request: src={Src}, dest={Dest}, spesimenPath={SpesimenPath}, refToken={RefToken}",
                signingRequest.src, signingRequest.dest, signingRequest.spesimenPath, signingRequest.refToken);

            var signingResponse = await signingClient.PostAsJsonAsync(signingUrl, signingRequest);
            var signingResponseString = await signingResponse.Content.ReadAsStringAsync();

            if (!signingResponse.IsSuccessStatusCode)
            {
                _logger.LogError("KeyStamp signing failed with status {StatusCode}: {Error}",
                    signingResponse.StatusCode, signingResponseString);
                result.Success = false;
                result.ErrorMessage = $"KeyStamp signing failed: {signingResponse.StatusCode}";
                return result;
            }

            _logger.LogInformation("PHASE 3 Complete: KeyStamp signing completed successfully");

            // =================================================================
            // PHASE 6: READ BACK SIGNED PDF
            // =================================================================
            _logger.LogInformation("PHASE 4: Reading signed PDF from {LocalSignedPath}", localSignedPath);

            // Wait a moment for file write to complete
            await Task.Delay(500);

            var maxRetries = 10;
            var retryCount = 0;
            byte[]? signedPdf = null;

            while (retryCount < maxRetries && signedPdf == null)
            {
                try
                {
                    signedPdf = await File.ReadAllBytesAsync(localSignedPath);
                    _logger.LogInformation("PHASE 4 Complete: Signed PDF read ({Size} bytes)", signedPdf.Length);
                }
                catch (FileNotFoundException)
                {
                    retryCount++;
                    if (retryCount >= maxRetries)
                    {
                        _logger.LogError("Signed PDF not found after {MaxRetries} retries at {Path}", maxRetries, localSignedPath);
                        result.Success = false;
                        result.ErrorMessage = $"Signed PDF not found after {maxRetries} retries at {localSignedPath}";
                        return result;
                    }
                    _logger.LogWarning("Signed PDF not found, retrying ({Retry}/{MaxRetries})...", retryCount, maxRetries);
                    await Task.Delay(1000);
                }
            }

            if (signedPdf == null)
            {
                result.Success = false;
                result.ErrorMessage = "Failed to read signed PDF after retries.";
                return result;
            }

            // =================================================================
            // PHASE 7: CLEANUP TRANSIENT FILES
            // =================================================================
            _logger.LogInformation("PHASE 5: Cleaning up transient files");

            try
            {
                if (File.Exists(localPdfPath)) File.Delete(localPdfPath);
                if (File.Exists(localQrPath)) File.Delete(localQrPath);
                if (File.Exists(localSignedPath)) File.Delete(localSignedPath);
                _logger.LogInformation("PHASE 5 Complete: Transient files cleaned up");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Some transient files could not be deleted");
            }

            // =================================================================
            // SUCCESS
            // =================================================================
            result.Success = true;
            result.SerialNumber = sn;
            result.StampedPdf = signedPdf;

            _logger.LogInformation(
                "Stamping workflow completed successfully for Invoice {InvoiceNumber}! SN: {SerialNumber}, UsedCache: {UsedCache}",
                invoiceNumber, sn, result.UsedCache);

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
                if (File.Exists(localPdfPath)) File.Delete(localPdfPath);
                if (File.Exists(localQrPath)) File.Delete(localQrPath);
                if (File.Exists(localSignedPath)) File.Delete(localSignedPath);
            }
            catch { }

            return result;
        }
    }
}
