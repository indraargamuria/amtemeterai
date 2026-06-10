# Task: Resolve Infinite Loading Hang in PeruriOnPremiseStampService Phase 4

We verified that the KeyStamp Docker adapter is healthy on port `9999`, but our stamping pipeline experiences an infinite loading hang right when invoking `PostAsJsonAsync` to the signing URL. 

This behavior likely points to a file lock race condition: our host application is notifying the Docker container before the host operating system has fully released file write descriptors or flushed the physical I/O streams into the shared volume workspace. 

Please modify `PeruriOnPremiseStampService.cs` to implement defensive file-sync guards, explicit stream flushing, and a fail-fast HTTP client timeout constraint.

---

## Technical Enhancements to Implement

### 1. Enforce Explicit File Stream Flushing & Disposal
In **PHASE 2 (Prepare Local Workspace Documents)**, avoid passing raw byte arrays straight to un-flushed disk writes. Use an explicit file stream block to guarantee that bytes are completely committed and file handles are structurally closed before moving forward:

```csharp
// Refactor how the Unsigned PDF is written to disk to guarantee full OS release
var unsignedFileBytes = await _storageService.GetFileBytesAsync(printoutDocument.StorageKey); // or your stream source
using (var fs = new FileStream(localPdfPath, FileMode.Create, FileAccess.Write, FileShare.None, 4096, useAsync: true))
{
    await fs.WriteAsync(unsignedFileBytes, 0, unsignedFileBytes.Length);
    await fs.FlushAsync(); // Force physical sector commitment
}
// Out of block scope: handle is completely closed and unlocked
Apply the exact same strict using scope and FlushAsync() pattern when saving the temporary QR specimen image bytes down into localQrPath inside PHASE 3.

2. Introduce a Pre-Flight I/O Synchronization Delay
Directly between the completion of PHASE 3 and the start of PHASE 4, insert a tiny defensive task buffer. This ensures the Docker virtual machine file system listener has caught up with host disk writes:

C#
_logger.LogInformation("PHASE 3 Complete: Workspace files written to disk. Introducing synchronization buffer.");
await Task.Delay(350); // Gives Docker volume mounting a clear frame to register the files safely
3. Inject a Fail-Fast HTTP Client Timeout
Never let HttpClient default to an infinite or 100-second execution window. If a volume lock or network glitch occurs, the system must error out gracefully and notify the user within a reasonable timeframe.

In PHASE 4: CALL KEYSTAMP DOCKER ADAPTER, refactor how the client is initialized:

C#
var signingClient = _httpClientFactory.CreateClient();

// A cryptographic PDF signing call over localhost should never exceed 15 seconds
signingClient.Timeout = TimeSpan.FromSeconds(15); 

_logger.LogInformation("PHASE 4: Invoking KeyStamp Docker adapter at {Url} with a 15s timeout limit.", signingUrl);
Expected Output
Please refactor PeruriOnPremiseStampService.cs using these guidelines. Retain the business rules mappings, MinIO integrations, and zero-footprint cleanups exactly as they are, adding these file-system safety structures to eliminate the thread lock hang.