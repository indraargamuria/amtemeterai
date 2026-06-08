# Task: Optimize e-Meterai Workspace Lifecycle, Database Cleanliness, and Docker Portability

We have successfully completed the core e-Meterai stamping integration loop using our on-premise Peruri service and KeyStamp Docker adapter. Now, we want to refactor the architecture to make it production-ready, ultra-clean, and fully portable.

Please implement the following architectural improvements inside `PeruriOnPremiseStampService.cs`, `InvoicesController.cs`, and update any necessary database entities or configurations.

---

## High-Level Requirements

### 1. Zero-Footprint Transient Workspace (`sharefolder` Lifecycle)
Currently, intermediate files (`.pdf` and `.png`) sometimes linger in the local host filesystem. We want the `sharefolder` tree to act strictly as a temporary, self-clearing workspace.
* Wrap the entire execution block in a `try/catch/finally` structure.
* In the `finally` block, guarantee that all intermediate files created during the pipeline (`sharefolder/UNSIGNED/*`, `sharefolder/STAMP/*`, and `sharefolder/SIGNED/*`) are strictly deleted from disk, regardless of whether the operation succeeded, rolled back, or threw an unhandled exception.

### 2. Eliminate Database Base64 Image Bloat
We want to keep the relational database table highly performant. The `SerialNumber` text string must be stored in the database, but the raw QR code Base64 string should **not** reside there.
* Immediately convert the Base64 QR code image string received from the Peruri API into a binary byte array or stream.
* Stream and upload this QR image asset directly to MinIO object storage using a clean folder convention (e.g., `invoices/{invoiceId}/qr/{serialNumber}.png`).
* If the stamping process ever runs using the cache or needs a re-sign, pull down the QR image bytes from MinIO programmatically on demand, then place them inside the transient `sharefolder/STAMP/` location for KeyStamp to pick up.

### 3. Native Docker Environment Portability
To ensure the code runs flawlessly on clean remote servers using only a `docker-compose.yml` deployment without manual server SSH folder creation:
* Ensure that the initialization code checks and auto-generates the directory tree structure (`UNSIGNED`, `STAMP`, `SIGNED`) using `Directory.CreateDirectory()` if they don't exist at runtime.
* Ensure file paths do not rely on hardcoded OS root structures, allowing them to map correctly into standard Docker Shared Named Volumes.

---

## Detailed Implementation Plan

### Step A: Update Service Level Flow (`PeruriOnPremiseStampService.cs`)

1. **Refactor the Core Method:** Ensure the signature handling logic streams the newly minted QR code straight up to MinIO instead of expecting the controller to manage database byte arrays.
2. **Implement Strict Cleanups:**
```csharp
try
{
    // 1. Setup local folders dynamically if missing
    // 2. Stream unsigned PDF from MinIO to /sharefolder/UNSIGNED/
    // 3. Call Peruri API -> Get SN & Base64 QR Image
    // 4. Decode Base64 QR directly and Upload to MinIO object storage
    // 5. Write QR bytes locally to /sharefolder/STAMP/ for KeyStamp usage
    // 6. Invoke KeyStamp container -> output generated in /sharefolder/SIGNED/
    // 7. Upload finalized Signed PDF to MinIO
}
catch (Exception ex)
{
    _logger.LogError(ex, "Stamping process encountered an error.");
    throw;
}
finally
{
    _logger.LogInformation("Cleaning up transient workspace files safely.");
    // Force deletion of local unsigned PDF, temporary QR png, and signed PDF
    string[] transientFiles = { localPdfPath, localQrPath, localSignedPath };
    foreach (var file in transientFiles)
    {
        try
        {
            if (File.Exists(file)) File.Delete(file);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to delete transient file: {Path}", file);
        }
    }
}
Step B: Align the Controller Hook (InvoicesController.cs)
Clean up the StampInvoiceByNumber endpoint to fit this streamlined abstraction.

The controller should trigger the service, receive the successful execution parameters (SerialNumber, storage paths), and then update the database tracking records in two separate .SaveChangesAsync() executions to prevent foreign key errors.

Please analyze the current project state, adjust the entities accordingly, and output the refactored source code for both files.