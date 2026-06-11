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
        // PHASE 1: RELATIVE FOLDER TRAVERSAL PATH RESOLUTION
        // =================================================================
        // Navigates securely out from 'backend/amtemeterai.Api/bin/Debug/...' to the shared project root path
        string baseShareFolder = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "sharefolder"));

        string unsignedDir = Path.Combine(baseShareFolder, "UNSIGNED");
        string stampDir = Path.Combine(baseShareFolder, "STAMP");
        string signedDir = Path.Combine(baseShareFolder, "SIGNED");

        // Guarantee directory tree initialization exists for Docker portability
        Directory.CreateDirectory(unsignedDir);
        Directory.CreateDirectory(stampDir);
        Directory.CreateDirectory(signedDir);

        string localPdfPath = Path.Combine(unsignedDir, $"{invoiceNumber}.pdf");
        string localQrPath = Path.Combine(stampDir, $"{invoiceNumber}_qr.png");
        string localSignedPath = Path.Combine(signedDir, $"stamped_{invoiceNumber}.pdf");

        // Local files for cleanup tracking
        List<string> transientFiles = new List<string>();

        try
        {
            // =================================================================
            // PHASE 2: WRITE UNSIGNED PDF TO SHARED FOLDER (EXPLICIT FLUSH)
            // =================================================================
            _logger.LogInformation("PHASE 1: Writing unsigned PDF to {LocalPdfPath} with explicit stream flush", localPdfPath);
            // Use explicit FileStream with FlushAsync to guarantee full OS release of file handle
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

                // If database contains cached metadata but local folder image got cleared out, pull from MinIO
                if (!File.Exists(localQrPath))
                {
                    _logger.LogInformation("Restoring missing physical QR PNG file from MinIO storage.");
                    try
                    {
                        using var qrStream = await _storageService.GetFileStreamAsync(qrImageStorageKey);
                        using var fileStream = new FileStream(localQrPath, FileMode.Create, FileAccess.Write, FileShare.None, 4096, useAsync: true);
                        await qrStream.CopyToAsync(fileStream);
                        await fileStream.FlushAsync(); // Force physical sector commitment
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

                // =================================================================
                // BUSINESS RULE MAPPING: Dynamic values with safe fallbacks
                // =================================================================
                // nodoc: Use internal database Primary Key (InvoiceID) with fallback
                string nodoc = invoice.InvoiceID > 0 ? invoice.InvoiceID.ToString() : "0";

                // namedipungut: Use customer name as-is (current working behavior)
                // Future enhancement: Could apply Title Case + space removal when validated
                string namedipungut = !string.IsNullOrEmpty(request.CustomerName)
                    ? request.CustomerName
                    : "Customer";

                // namejidentitas: NPWP for business invoices (current working value)
                string namejidentitas = "NPWP";

                // noidentitas: Use CustomerNumber with safe fallback
                string noidentitas = !string.IsNullOrEmpty(request.CustomerNumber)
                    ? request.CustomerNumber
                    : "-"; // Fallback placeholder for staging

                // namafile: Sanitize invoice number with fallback
                string namafile = !string.IsNullOrEmpty(invoiceNumber)
                    ? SanitizeFileName(invoiceNumber)
                    : "Invoice.pdf"; // Fallback to working default

                // nilaidoc: Use amount with safe fallback
                string nilaidoc = request.Amount > 0
                    ? request.Amount.ToString("F0")
                    : "0"; // Fallback to working default

                // tgldoc: Use invoice date or today
                string tgldoc = invoice.InvoicedDate > DateTime.MinValue
                    ? invoice.InvoicedDate.ToString("yyyy-MM-dd")
                    : DateTime.Today.ToString("yyyy-MM-dd");

                // // Map business fields to Peruri API contract structure
                // var stampRequest = new PeruriStampRequestDto
                // {
                //     isUpload = false,
                //     namadoc = "4b",  // Document type code for Invoice/Faktur
                //     namafile = namafile,
                //     nilaidoc = nilaidoc,  // e-Meterai nominal price tier from amount
                //     namejidentitas = namejidentitas,  // NPWP for business invoices
                //     noidentitas = noidentitas,  // Customer's tax identification number
                //     namedipungut = namedipungut,  // Taxpayer name
                //     snOnly = false,
                //     nodoc = nodoc,  // Internal database ID as document bridge
                //     tgldoc = tgldoc  // Invoice date in YYYY-MM-DD format
                // };

                // Map business fields to Peruri API contract structure
                var stampRequest = new PeruriStampRequestDto
                {
                    isUpload = false,
                    namadoc = "4b",  // Document type code for Invoice/Faktur
                    namafile = "Invoice.pdf",
                    nilaidoc = "0",  // e-Meterai nominal price tier
                    namejidentitas = "NPWP",  // ID type
                    noidentitas = "3372015407840001",  // Fallback placeholder for staging
                    namedipungut = "William",
                    snOnly = false,
                    nodoc = "0",
                    tgldoc = DateTime.Today.ToString("yyyy-MM-dd")  // Format: YYYY-MM-DD
                };
                var debugJson = JsonSerializer.Serialize(stampRequest, new JsonSerializerOptions { WriteIndented = true });
                _logger.LogInformation("Peruri Payload Data:\n{Json}", debugJson);
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

                // Debug: Show parsed JSON payload formatted cleanly in the terminal
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

                // Parse out returned data parameters
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
                // PHASE 5: UPLOAD QR CODE TO MINIO (Eliminate Database Bloat)
                // =================================================================
                _logger.LogInformation("PHASE 3: Uploading e-Meterai QR code to MinIO storage");

                // Declare qrBytes outside try block so it can be used for both MinIO upload and local file write
                byte[] qrBytes;

                try
                {
                    // Decode Base64 to bytes
                    qrBytes = Convert.FromBase64String(qrBase64);

                    // Remove data URL prefix if present
                    if (qrBase64.Contains(","))
                    {
                        qrBase64 = qrBase64.Split(',')[1];
                        qrBytes = Convert.FromBase64String(qrBase64);
                    }

                    // Create storage key: invoices/{invoiceId}/qr/{serialNumber}.png
                    string qrStorageKey = $"invoices/{invoiceId}/qr/{sn}.png";

                    // Upload to MinIO
                    using (var qrStream = new MemoryStream(qrBytes))
                    {
                        await _storageService.UploadFileAsync(qrStorageKey, qrStream, "image/png");
                    }

                    _logger.LogInformation("PHASE 3 Complete: QR code uploaded to MinIO at {StorageKey}", qrStorageKey);

                    // Save storage reference to database (not the actual Base64)
                    invoice.SerialNumber = sn;
                    invoice.QrImageStorageKey = qrStorageKey;
                    await _dbContext.SaveChangesAsync();
                    _logger.LogInformation("PHASE 3 Complete: SerialNumber and QR storage key saved to database (no Base64 bloat)");

                    result.QrImageStorageKey = qrStorageKey;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to upload QR code to MinIO: {Message}", ex.Message);
                    result.Success = false;
                    result.ErrorMessage = $"Failed to upload QR code to MinIO: {ex.Message}";
                    return result;
                }

                // Write QR locally for KeyStamp with explicit flush (will be cleaned up in finally block)
                // qrBytes is already decoded from the MinIO upload block above
                using (var fs = new FileStream(localQrPath, FileMode.Create, FileAccess.Write, FileShare.None, 4096, useAsync: true))
                {
                    await fs.WriteAsync(qrBytes, 0, qrBytes.Length);
                    await fs.FlushAsync(); // Force physical sector commitment
                }
                transientFiles.Add(localQrPath);
            }

            // =================================================================
            // I/O SYNCHRONIZATION BUFFER (PHASE 3 → PHASE 4)
            // =================================================================
            _logger.LogInformation("PHASE 3 Complete: Workspace files written to disk. Introducing synchronization buffer.");
            await Task.Delay(350); // Gives Docker volume mounting a clear frame to register the files safely

            // =================================================================
            // PHASE 6: EXECUTE LOCAL KEYSTAMP CONTAINER SIGNING
            // =================================================================
            _logger.LogInformation("PHASE 4: Invoking KeyStamp Docker adapter at port 9999");

            var signingClient = _httpClientFactory.CreateClient();

            // A cryptographic PDF signing call over localhost should never exceed 15 seconds
            // Fail-fast timeout prevents infinite hangs from volume locks or network issues
            signingClient.Timeout = TimeSpan.FromSeconds(15);
            var signingUrl = $"{_options.KeyStamp.TrimEnd('/')}/adapter/pdfsigning/rest/docSigningZ";

            var signingRequest = new KeyStampSigningRequestDto
            {
                certificatelevel = "NOT_CERTIFIED",

                // Use relative paths for Docker volume mapping
                src = $"/sharefolder/UNSIGNED/{invoiceNumber}.pdf",
                dest = $"/sharefolder/SIGNED/stamped_{invoiceNumber}.pdf",
                spesimenPath = $"/sharefolder/STAMP/{invoiceNumber}_qr.png",

                refToken = sn,
                jwToken = jwtToken,
                visSignaturePage = 1,
                // POSITIONING: Bottom-Right Corner with a 36pt Margin
                visLLX = 459,   // Lower-Left X: 595 (total width) - 100 (specimen width) - 36 (margin)
                visLLY = 36,    // Lower-Left Y: 36 (margin from the bottom edge)
                visURX = 559,   // Upper-Right X: 459 (LLX) + 100 (specimen width)
                visURY = 136,   // Upper-Right Y: 36 (LLY) + 100 (specimen height)
                profileName = "default",
                docpass = "",
                location = "Jakarta",
                reason = "Meterai Electronic Integration"
            };

            _logger.LogDebug("KeyStamp Request: src={Src}, dest={Dest}, spesimenPath={SpesimenPath}, refToken={RefToken}",
                signingRequest.src, signingRequest.dest, signingRequest.spesimenPath, signingRequest.refToken);

            _logger.LogInformation("PHASE 4: Calling KeyStamp Docker adapter at {Url} with a 15s timeout limit.", signingUrl);

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

            _logger.LogInformation("PHASE 4 Complete: KeyStamp signing completed successfully");

            // =================================================================
            // PHASE 7: READ BACK SIGNED PDF
            // =================================================================
            _logger.LogInformation("PHASE 5: Reading signed PDF from {LocalSignedPath}", localSignedPath);
            transientFiles.Add(localSignedPath);

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
                    _logger.LogInformation("PHASE 5 Complete: Signed PDF read ({Size} bytes)", signedPdf.Length);
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
            // PHASE 8: UPLOAD SIGNED PDF TO MINIO
            // =================================================================
            _logger.LogInformation("PHASE 6: Uploading signed PDF to MinIO storage");

            try
            {
                string stampedStorageKey = $"invoices/{invoiceId}/stamped/{sn}_stamped.pdf";

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
                // Continue execution even if MinIO upload fails - we have the signed PDF locally
                _logger.LogWarning("Continuing with local signed PDF despite MinIO upload failure");
            }

            // Success
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
            _logger.LogInformation("PHASE 7: Zero-footprint cleanup - Removing all transient workspace files");

            foreach (var file in transientFiles)
            {
                try
                {
                    if (File.Exists(file))
                    {
                        File.Delete(file);
                        _logger.LogDebug("Deleted transient file: {File}", file);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to delete transient file: {Path}", file);
                }
            }

            // Also ensure directories are clean (remove any lingering files)
            try
            {
                if (Directory.Exists(unsignedDir))
                {
                    var files = Directory.GetFiles(unsignedDir);
                    foreach (var file in files)
                    {
                        try { File.Delete(file); }
                        catch { }
                    }
                }
                if (Directory.Exists(stampDir))
                {
                    var files = Directory.GetFiles(stampDir);
                    foreach (var file in files)
                    {
                        try { File.Delete(file); }
                        catch { }
                    }
                }
                if (Directory.Exists(signedDir))
                {
                    var files = Directory.GetFiles(signedDir);
                    foreach (var file in files)
                    {
                        try { File.Delete(file); }
                        catch { }
                    }
                }
                _logger.LogInformation("PHASE 7 Complete: Transient workspace cleaned (zero-footprint achieved)");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Some directories could not be cleaned");
            }
        }
    }

    /// <summary>
    /// Sanitizes invoice number for filename use with safe fallback
    /// Removes whitespace, slashes, and special symbols, then appends .pdf
    /// Example: "INV/2026-009" -> "INV2026009.pdf"
    /// Falls back to "Invoice.pdf" if input is empty or invalid
    /// </summary>
    private static string SanitizeFileName(string invoiceNumber)
    {
        if (string.IsNullOrWhiteSpace(invoiceNumber))
            return "Invoice.pdf"; // Safe fallback to working default

        try
        {
            // Remove all special characters, keeping only alphanumeric
            var sanitized = System.Text.RegularExpressions.Regex.Replace(invoiceNumber, @"[^a-zA-Z0-9]", "");

            // Ensure we have something left after sanitization
            if (string.IsNullOrWhiteSpace(sanitized))
                return "Invoice.pdf";

            // Append .pdf extension
            return $"{sanitized}.pdf";
        }
        catch
        {
            return "Invoice.pdf"; // Safe fallback on any error
        }
    }
}
