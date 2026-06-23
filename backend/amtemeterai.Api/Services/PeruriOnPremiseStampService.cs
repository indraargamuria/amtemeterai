using amtemeterai.Api.Config;
using amtemeterai.Api.Data;
using amtemeterai.Api.Dtos;
using amtemeterai.Api.Models;
using Microsoft.Extensions.Options;
using System.IO;
using System.Text.Json;

namespace amtemeterai.Api.Services;

/// <summary>
/// Service for on-premise Peruri e-Meterai stamping operations with MinIO storage and zero-footprint workspace
/// Handles the complete flow: PDF preparation, cached stamp resolution from MinIO, Peruri API calls, Docker adapter signing, and cleanup
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
        public string? QrImageStorageKey { get; set; }  // MinIO storage key for QR code
        public int? QrImageDocumentId { get; set; }  // Document ID for QR code image
        public string? StampedStorageKey { get; set; }  // MinIO storage key for signed PDF
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
        // Invoice printout storage key for streaming
        public string? PrintoutStorageKey { get; set; }
    }
}

/// <summary>
/// On-premise implementation of Peruri stamping service with MinIO storage and zero-footprint workspace
/// </summary>
public class PeruriOnPremiseStampService : IPeruriOnPremiseStampService
{
    private readonly PeruriOptions _options;
    private readonly IPeruriSessionService _sessionService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<PeruriOnPremiseStampService> _logger;
    private readonly AppDbContext _dbContext;
    private readonly IStorageService _storageService;

    public PeruriOnPremiseStampService(
        IOptions<PeruriOptions> options,
        IPeruriSessionService sessionService,
        IHttpClientFactory httpClientFactory,
        ILogger<PeruriOnPremiseStampService> logger,
        AppDbContext dbContext,
        IStorageService storageService)
    {
        _options = options.Value;
        _sessionService = sessionService;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _dbContext = dbContext;
        _storageService = storageService;
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
        // PHASE 1: TRANSIENT WORKSPACE PATH RESOLUTION (Docker Named Volume)
        // =================================================================
        // Standardize base root directory tracks from injected configuration paths
        string sharedRoot = _options.SharedFolder.Replace(Path.DirectorySeparatorChar, '/').TrimEnd('/');

        // Separate processing contexts cleanly by using the absolute file tracking name
        string unsignedDirPath = $"{sharedRoot}/UNSIGNED";
        string stampDirPath = $"{sharedRoot}/STAMP";
        string signedDirPath = $"{sharedRoot}/SIGNED";

        // Guarantee system directories exist in the shared volumes architecture
        Directory.CreateDirectory(unsignedDirPath);
        Directory.CreateDirectory(stampDirPath);
        Directory.CreateDirectory(signedDirPath);

        // Determine if container execution rules apply
        bool isRunningInDocker = Directory.Exists("/app") || Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER") == "true";

        // Fix Linux Permissions: Grant full 777 access to the subdirectories so the non-root signadapter user can read/write files safely
        try
        {
            if (isRunningInDocker)
            {
                System.Diagnostics.Process.Start("chmod", $"-R 777 {unsignedDirPath} {stampDirPath} {signedDirPath}")?.WaitForExit();
                _logger.LogInformation("Successfully adjusted Linux volume folder permissions to 777.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not adjust permissions via chmod. Proceeding anyway.");
        }

        _logger.LogInformation("Using root shared storage paths for processing instance: {Workspace}", sharedRoot);

        // Generate flat paths for files inside the shared root directories
        string localPdfPath = $"{unsignedDirPath}/{invoiceNumber}.pdf";
        string localQrPath = $"{stampDirPath}/{invoiceNumber}_qr.png";
        string localSignedPath = $"{signedDirPath}/stamped_{invoiceNumber}.pdf";
        // Local files for cleanup tracking
        List<string> transientFiles = new List<string>();

        try
        {
            // =================================================================
            // PHASE 2: WRITE UNSIGNED PDF TO SHARED FOLDER (EXPLICIT FLUSH)
            // =================================================================
            _logger.LogInformation("PHASE 1: Writing unsigned PDF to {LocalPdfPath} with explicit stream flush", localPdfPath);
            using (var fs = new FileStream(localPdfPath, FileMode.Create, FileAccess.Write, FileShare.None, 4096, useAsync: true))
            {
                await fs.WriteAsync(request.PdfContent, 0, request.PdfContent.Length);
                await fs.FlushAsync(); // Force physical sector commitment
            }
            transientFiles.Add(localPdfPath);

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
            string? qrImageStorageKey = invoice.QrImageStorageKey;
            bool hasCachedStampData = !string.IsNullOrEmpty(sn) && !string.IsNullOrEmpty(qrImageStorageKey);

            // Fetch session credentials upfront
            string jwtToken = await _sessionService.GetAuthTokenAsync();

            if (hasCachedStampData)
            {
                _logger.LogInformation("OPTIMIZATION: Found existing cached stamp data for Invoice {InvoiceNumber}. SN: {SerialNumber}. Skipping Peruri API call.", invoiceNumber, sn);
                result.UsedCache = true;
                result.SerialNumber = sn;
                result.QrImageStorageKey = qrImageStorageKey;

                if (!File.Exists(localQrPath))
                {
                    _logger.LogInformation("Restoring missing physical QR PNG file from MinIO storage.");
                    try
                    {
                        using var qrStream = await _storageService.GetFileStreamAsync(qrImageStorageKey);
                        using var fileStream = new FileStream(localQrPath, FileMode.Create, FileAccess.Write, FileShare.None, 4096, useAsync: true);
                        await qrStream.CopyToAsync(fileStream);
                        await fileStream.FlushAsync(); 
                        transientFiles.Add(localQrPath);
                        _logger.LogInformation("QR code restored from MinIO to local workspace.");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to restore QR code from MinIO: {Message}", ex.Message);
                        result.Success = false;
                        result.ErrorMessage = $"Failed to restore QR code from MinIO: {ex.Message}";
                        return result;
                    }
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
                    namadoc = "4b", 
                    namafile = "Invoice.pdf",
                    nilaidoc = "0", 
                    namejidentitas = "NPWP", 
                    noidentitas = "3372015407840001", 
                    namedipungut = "William",
                    snOnly = false,
                    nodoc = "0",
                    tgldoc = DateTime.Today.ToString("yyyy-MM-dd") 
                };
                
                var debugJson = JsonSerializer.Serialize(stampRequest, new JsonSerializerOptions { WriteIndented = true });
                _logger.LogInformation("Peruri Payload Data:\n{Json}", debugJson);

                stampClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {jwtToken}");
                var stampResponse = await stampClient.PostAsJsonAsync(stampUrl, stampRequest);
                var responseString = await stampResponse.Content.ReadAsStringAsync();

                if (!stampResponse.IsSuccessStatusCode)
                {
                    _logger.LogError("Peruri Stamp API failed with HTTP status {StatusCode}: {Error}", stampResponse.StatusCode, responseString);
                    result.Success = false;
                    result.ErrorMessage = $"Peruri remote gateway connection error: {stampResponse.StatusCode}";
                    return result;
                }

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

                var parsedJsonString = JsonSerializer.Serialize(jsonDoc.RootElement, new JsonSerializerOptions { WriteIndented = true });
                _logger.LogInformation("=== RECEIVED PERURI API RESPONSE PAYLOAD ===\n{Json}\n============================================", parsedJsonString);

                var root = jsonDoc.RootElement;
                string statusCode = root.GetProperty("statusCode").GetString();

                if (statusCode != "00")
                {
                    string message = root.TryGetProperty("message", out var msgProp) ? (msgProp.GetString() ?? "Unknown error") : "Unknown error";
                    _logger.LogError("Peruri Stamping Error Status ({StatusCode}): {Message}", statusCode, message);
                    result.Success = false;
                    result.ErrorMessage = $"Peruri Stamping Error Status ({statusCode}): {message}";
                    return result;
                }

                var resultData = root.GetProperty("result");
                sn = resultData.GetProperty("sn").GetString() ?? string.Empty;
                var qrBase64 = resultData.GetProperty("image").GetString() ?? string.Empty;

                if (string.IsNullOrEmpty(sn) || string.IsNullOrEmpty(qrBase64))
                {
                    _logger.LogError("Peruri Stamp API response missing required attributes (sn/image). Body: {Content}", responseString);
                    result.Success = false;
                    result.ErrorMessage = $"Peruri payload is missing required layout attributes (sn/image). Body: {responseString}";
                    return result;
                }

                _logger.LogInformation("PHASE 2 Complete: Received SN {SerialNumber} from Peruri API", sn);

                // =================================================================
                // PHASE 5: UPLOAD QR CODE TO MINIO
                // =================================================================
                _logger.LogInformation("PHASE 3: Uploading e-Meterai QR code to MinIO storage");
                byte[] qrBytes;

                try
                {
                    qrBytes = Convert.FromBase64String(qrBase64);
                    if (qrBase64.Contains(","))
                    {
                        qrBase64 = qrBase64.Split(',')[1];
                        qrBytes = Convert.FromBase64String(qrBase64);
                    }

                    string qrGuid = Guid.NewGuid().ToString();
                    string qrStorageKey = $"invoices/{invoiceNumber}/qr/QRINV_{invoiceNumber}_{qrGuid}.png";

                    using (var qrStream = new MemoryStream(qrBytes))
                    {
                        await _storageService.UploadFileAsync(qrStorageKey, qrStream, "image/png");
                    }

                    _logger.LogInformation("PHASE 3 Complete: QR code uploaded to MinIO at {StorageKey}", qrStorageKey);

                    invoice.SerialNumber = sn;
                    invoice.QrImageStorageKey = qrStorageKey;
                    await _dbContext.SaveChangesAsync();

                    result.QrImageStorageKey = qrStorageKey;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to upload QR code to MinIO: {Message}", ex.Message);
                    result.Success = false;
                    result.ErrorMessage = $"Failed to upload QR code to MinIO: {ex.Message}";
                    return result;
                }

                using (var fs = new FileStream(localQrPath, FileMode.Create, FileAccess.Write, FileShare.None, 4096, useAsync: true))
                {
                    await fs.WriteAsync(qrBytes, 0, qrBytes.Length);
                    await fs.FlushAsync(); 
                }
                transientFiles.Add(localQrPath);
            }

            // =================================================================
            // I/O SYNCHRONIZATION BUFFER
            // =================================================================
            await Task.Delay(350); 

            // =================================================================
            // PHASE 6: EXECUTE LOCAL KEYSTAMP CONTAINER SIGNING
            // =================================================================
            _logger.LogInformation("PHASE 4: Invoking KeyStamp Docker adapter");

            var signingClient = _httpClientFactory.CreateClient();
            signingClient.Timeout = TimeSpan.FromSeconds(15);

            string targetUrl = _options.KeyStamp;

            if (!isRunningInDocker)
            {
                targetUrl = targetUrl.Replace("signadapter:7777", "localhost:9999");
                _logger.LogInformation("Running in local development mode. Routing KeyStamp endpoint to localhost:9999");
            }

            var signingUrl = $"{targetUrl.TrimEnd('/')}/adapter/pdfsigning/rest/docSigningZ";

            // Strip the leading "/app/" path prefix so the Peruri adapter does not double-prefix it to "/app/app/sharefolder"
            var signingRequest = new KeyStampSigningRequestDto
            {
                certificatelevel = "NOT_CERTIFIED",

                src = localPdfPath.StartsWith("/app/") ? localPdfPath.Substring(5) : localPdfPath,
                dest = localSignedPath.StartsWith("/app/") ? localSignedPath.Substring(5) : localSignedPath,
                spesimenPath = localQrPath.StartsWith("/app/") ? localQrPath.Substring(5) : localQrPath,

                refToken = sn,
                jwToken = jwtToken,
                visSignaturePage = 1,
                // --- UPDATED COORDINATES FOR METADATA ALIGNMENT ---
                visLLX = 428,
                visLLY = 215,
                visURX = 482,
                visURY = 269, 
                // --------------------------------------------------
                profileName = "default",
                docpass = "",
                location = "Jakarta",
                reason = "Meterai Electronic Integration"
            };

            _logger.LogDebug("KeyStamp Request (Clean Paths): src={Src}, dest={Dest}, spesimenPath={SpesimenPath}",
                signingRequest.src, signingRequest.dest, signingRequest.spesimenPath);

            var signingResponse = await signingClient.PostAsJsonAsync(signingUrl, signingRequest);
            var signingResponseString = await signingResponse.Content.ReadAsStringAsync();

            if (!signingResponse.IsSuccessStatusCode)
            {
                _logger.LogError("KeyStamp signing failed with status {StatusCode}: {Error}", signingResponse.StatusCode, signingResponseString);
                result.Success = false;
                result.ErrorMessage = $"KeyStamp signing failed: {signingResponse.StatusCode}";
                return result;
            }

            _logger.LogInformation("PHASE 4 Complete: KeyStamp signing completed successfully");

            // =================================================================
            // PHASE 7: READ BACK SIGNED PDF
            // =================================================================
            _logger.LogInformation("PHASE 5: Reading signed PDF from {LocalSignedPath}", localSignedPath);
            transientFiles.Add(localSignedPath);

            await Task.Delay(500);

            var maxRetries = 10;
            var retryCount = 0;
            byte[]? signedPdf = null;

            while (retryCount < maxRetries && signedPdf == null)
            {
                try
                {
                    signedPdf = await File.ReadAllBytesAsync(localSignedPath);
                    _logger.LogInformation("PHASE 5 Complete: Signed PDF read ({Size} bytes)", signedPdf.Length);
                }
                catch (FileNotFoundException)
                {
                    retryCount++;
                    if (retryCount >= maxRetries)
                    {
                        result.Success = false;
                        result.ErrorMessage = $"Signed PDF not found after {maxRetries} retries at {localSignedPath}";
                        return result;
                    }
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
            // PHASE 8: UPLOAD SIGNED PDF TO MINIO
            // =================================================================
            try
            {
                string stampedGuid = Guid.NewGuid().ToString();
                string stampedStorageKey = $"invoices/{invoiceNumber}/stamped/STPINV_{invoiceNumber}_{stampedGuid}.pdf";

                using (var stampedStream = new MemoryStream(signedPdf))
                {
                    await _storageService.UploadFileAsync(stampedStorageKey, stampedStream, "application/pdf");
                }

                _logger.LogInformation("PHASE 6 Complete: Signed PDF uploaded to MinIO at {StorageKey}", stampedStorageKey);
                result.StampedStorageKey = stampedStorageKey;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to upload signed PDF to MinIO: {Message}", ex.Message);
            }

            result.Success = true;
            result.SerialNumber = sn;
            result.StampedPdf = signedPdf;

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Stamping process encountered an error for invoice {InvoiceNumber}", invoiceNumber);
            result.Success = false;
            result.ErrorMessage = ex.Message;
            return result;
        }
        finally
        {
            // =================================================================
            // ZERO-FOOTPRINT TRANSIENT WORKSPACE CLEANUP
            // =================================================================
            _logger.LogInformation("PHASE 7: Zero-footprint cleanup - Clearing temporary workspace contents");

            // Clean individual generated files first
            foreach (var file in transientFiles)
            {
                try
                {
                    if (File.Exists(file))
                    {
                        File.Delete(file);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to delete transient file: {Path}", file);
                }
            }

            // Safely delete contents of the subdirectories. DO NOT delete 'sharedRoot' directly because Docker locks it!
            try
            {
                if (Directory.Exists(unsignedDirPath))
                {
                    Directory.Delete(unsignedDirPath, true);
                }
                if (Directory.Exists(stampDirPath))
                {
                    Directory.Delete(stampDirPath, true);
                }
                if (Directory.Exists(signedDirPath))
                {
                    Directory.Delete(signedDirPath, true);
                }
                _logger.LogInformation("PHASE 7 Complete: Subdirectories cleanly flushed.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Fallback directory clearing failed.");
            }
        }
    }

    private static string SanitizeFileName(string invoiceNumber)
    {
        if (string.IsNullOrWhiteSpace(invoiceNumber))
            return "Invoice.pdf";

        try
        {
            var sanitized = System.Text.RegularExpressions.Regex.Replace(invoiceNumber, @"[^a-zA-Z0-9]", "");
            if (string.IsNullOrWhiteSpace(sanitized))
                return "Invoice.pdf";

            return $"{sanitized}.pdf";
        }
        catch
        {
            return "Invoice.pdf";
        }
    }
}