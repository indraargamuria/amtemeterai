# Task: Implement e-Meterai Database Caching & Folder Path Optimization

The core Peruri API connectivity is now functioning. However, we need to optimize our workflow to avoid burning stamp quota unnecessarily. If an invoice has already been stamped, we must reuse its cached Serial Number and Base64 QR code instead of calling Peruri's API again. Additionally, we need to correct the file paths to match our project directory layout where `sharefolder` lives completely outside the `backend` project directory.

Please fully update `PeruriOnPremiseStampService.cs` with the following comprehensive structural workflow.

---

## 1. Prerequisites (DTO & Entity Property Setup)

### Step A: Ensure DTO and EF Context Compatibility
Ensure your database context tracked schema (`Invoice` entity model) or your system configuration matches these target properties:
* `invoice.SerialNumber` (string)
* `invoice.QrCodeBase64` (string)

Ensure `PeruriStampRequestDto` utilizes lowercase names to prevent schema errors:
```csharp
public class PeruriStampRequestDto
{
    public bool isUpload { get; set; } = false;
    public string namadoc { get; set; } = "4b";
    public string namafile { get; set; } = "INVA.pdf";
    public string nilaidoc { get; set; } = "10000";
    public string namejidentitas { get; set; } = "KTP";
    public string noidentitas { get; set; } = "1251038765430004";
    public string namedipungut { get; set; } = "Santosa";
    public bool snOnly { get; set; } = false;
    public string nodoc { get; set; } = "1";
    public string tgldoc { get; set; } = string.Empty;
}
2. Core Implementation Rewrite
Replace your entire execution structure inside PeruriOnPremiseStampService.cs with this unified, quota-safe codebase:

C#
using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using amtemeterai.Api.Dtos;

namespace amtemeterai.Api.Services
{
    public class PeruriOnPremiseStampService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<PeruriOnPremiseStampService> _logger;
        private readonly AppDbContext _dbContext; // Adjust naming to match your actual EF Core context

        public PeruriOnPremiseStampService(
            IHttpClientFactory httpClientFactory, 
            ILogger<PeruriOnPremiseStampService> logger,
            AppDbContext dbContext)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _dbContext = dbContext;
        }

        public async Task StampInvoiceAsync(int invoiceId, string invoiceNumber, PeruriStampRequest request)
        {
            // =================================================================
            // PHASE 1: RELATIVE FOLDER TRAVERSAL PATH RESOLUTION
            // =================================================================
            // Navigates securely out from 'backend/amtemeterai.Api/bin/Debug/...' to the shared project root path
            string baseShareFolder = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "sharefolder"));
            
            string unsignedDir = Path.Combine(baseShareFolder, "UNSIGNED");
            string stampDir = Path.Combine(baseShareFolder, "STAMP");
            string signedDir = Path.Combine(baseShareFolder, "SIGNED");

            // Guarantee directory tree initialization exits
            Directory.CreateDirectory(unsignedDir);
            Directory.CreateDirectory(stampDir);
            Directory.CreateDirectory(signedDir);

            string localPdfPath = Path.Combine(unsignedDir, $"{invoiceNumber}.pdf");
            string localQrPath = Path.Combine(stampDir, $"{invoiceNumber}_qr.png");

            // =================================================================
            // PHASE 2: DATABASE CACHE RESOLUTION (QUOTA SAVER)
            // =================================================================
            var invoice = await _dbContext.Invoices.FindAsync(invoiceId);
            if (invoice == null) throw new Exception($"Invoice record with ID {invoiceId} not found in database.");

            string sn = invoice.SerialNumber;
            string qrBase64 = invoice.QrCodeBase64;
            bool hasCachedStampData = !string.IsNullOrEmpty(sn) && !string.IsNullOrEmpty(qrBase64);

            // Fetch session credentials upfront
            string jwtToken = await GetPeruriJwtTokenAsync(); 

            if (hasCachedStampData)
            {
                _logger.LogInformation("OPTIMIZATION: Found existing cached stamp data for Invoice {Inv}. Skipping Peruri API.", invoiceNumber);
                
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
                // PHASE 3: BRAND NEW SUBMISSION (CALL PERURI API STAMP V2)
                // =================================================================
                _logger.LogInformation("No cached stamp data found. Invoking remote Peruri Stamp V2 API for Invoice {Inv}", invoiceNumber);

                var stampClient = _httpClientFactory.CreateClient();
                var stampUrl = "[https://stampv2stg.e-meterai.co.id/chanel/stampv2](https://stampv2stg.e-meterai.co.id/chanel/stampv2)";

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

                stampClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {jwtToken}");
                var stampResponse = await stampClient.PostAsJsonAsync(stampUrl, stampRequest);
                var responseString = await stampResponse.Content.ReadAsStringAsync();

                if (!stampResponse.IsSuccessStatusCode)
                {
                    throw new Exception($"Peruri remote gateway connection error: {stampResponse.StatusCode}");
                }

                var jsonDoc = JsonDocument.Parse(responseString);
                var root = jsonDoc.RootElement;
                string statusCode = root.GetProperty("statusCode").GetString();

                if (statusCode != "00")
                {
                    throw new Exception($"Peruri Stamping Error Status ({statusCode}): {root.GetProperty("message").GetString()}");
                }

                // Parse out returned data parameters
                var resultData = root.GetProperty("result");
                sn = resultData.GetProperty("sn").GetString();
                qrBase64 = resultData.GetProperty("image").GetString();

                // 1. Write the decoded byte file down to the local project sharefolder specimen structure
                byte[] qrBytes = Convert.FromBase64String(qrBase64);
                await File.WriteAllBytesAsync(localQrPath, qrBytes);
                _logger.LogInformation("Step 4 Complete: Physical QR code stamp saved locally into sharefolder structure.");

                // 2. Persist directly inside the database columns to prevent duplicate calls
                invoice.SerialNumber = sn;
                invoice.QrCodeBase64 = qrBase64;
                await _dbContext.SaveChangesAsync();
                _logger.LogInformation("Success: Serial Number and Base64 QR code saved safely to Invoice entity record.");
            }

            // =================================================================
            // PHASE 4: EXECUTE LOCAL KEYSTAMP CONTAINER SIGNING
            // =================================================================
            _logger.LogInformation("Step 5: Invoking KeyStamp Docker adapter at port 9999");

            var signingClient = _httpClientFactory.CreateClient();
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

            var signingResponse = await signingClient.PostAsJsonAsync("http://localhost:9999/adapter/pdfsigning/rest/docSigningZ", signingRequest);
            var signingResponseString = await signingResponse.Content.ReadAsStringAsync();

            if (!signingResponse.IsSuccessStatusCode)
            {
                throw new Exception($"KeyStamp signing failed with status {signingResponse.StatusCode}: {signingResponseString}");
            }

            _logger.LogInformation("Stamping workflow executed successfully for Invoice {Inv}!", invoiceNumber);
        }

        // Dummy helper mapping placeholder for illustration - update to your dynamic service method call
        private Task<string> GetPeruriJwtTokenAsync() => Task.FromResult("YOUR_JWT_REFRESH_TOKEN_HERE");
    }
}
3. Post-Implementation Check
Run an entry verification pass. Ensure that on a duplicate execution test for an already-stamped transaction ID, the log directly states OPTIMIZATION: Found existing cached stamp data... and cuts straight to the signing adapter phase without querying Peruri.

***