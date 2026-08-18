# Peruri Digital Security — e-Meterai Stamping Integration Summary

This document summarizes the full end-to-end flow for digitally stamping invoice PDFs with Peruri e-Meterai inside the **Opex Launchpad / AmteMeterai** application.

## Architecture Overview

```
┌──────────┐   upload-printout   ┌─────────────────────────────┐   MinIO (S3)
│ Frontend │ ──────────────────► │ Backend API (ASP.NET Core)   │ ──► invoices/{no}/printouts/
└──────────┘                     │                             │ ◄── invoices/{no}/printouts/ (fetch)
      │                          │  PeruriSessionService        │
      │   by-sap-number/stamp    │  PeruriOnPremiseStampService │ ──► invoices/{no}/qr/QRINV_*.png
      └────────────────────────► │  PdfAnchorService            │ ──► invoices/{no}/stamped/STPINV_*.pdf
                                 └──────────────┬──────────────┘
                                                │
                    shared Docker volume ┌──────▼──────┐
                    /app/sharefolder     │  signadapter│  Peruri KeyStamp Docker adapter
                    (UNSIGNED/STAMP/     │  :7777/:9999│  registry.perurica.co.id/e-meterai/signadapter:2.0
                     SIGNED)             └─────────────┘
                                                ▲
                                                │ Bearer JWT
                        Peruri Cloud APIs ──────┘
                        • POST /api/users/login   (auth)
                        • POST /chanel/stampv2    (SN + QR image)
```

## Components & Key Files

| Component | File |
|---|---|
| Peruri config (`Peruri:...`) | `backend/amtemeterai.Api/Config/PeruriOptions.cs` |
| JWT login + token cache | `backend/amtemeterai.Api/Services/PeruriSessionService.cs` |
| Main on-premise stamping orchestration | `backend/amtemeterai.Api/Services/PeruriOnPremiseStampService.cs` |
| Cloud PDS fallback service | `backend/amtemeterai.Api/Services/PeriuriPdsService.cs` |
| PDF anchor / OCR positioning | `backend/amtemeterai.Api/Services/PdfAnchorService.cs` |
| Object storage (MinIO, S3-compatible) | `backend/amtemeterai.Api/Services/MinioStorageService.cs` / `IStorageService.cs` |
| API endpoints | `backend/amtemeterai.Api/Controllers/InvoicesController.cs` |
| File download endpoint | `backend/amtemeterai.Api/Controllers/DeliveriesController.cs` (`GET api/deliveries/files/download`) |
| DTOs (Peruri / KeyStamp contracts) | `backend/amtemeterai.Api/Dtos/PeruriApiDtos.cs` |
| Docker topology (MinIO + signadapter + shared volume) | `docker-compose.yml` |
| Frontend API wrappers | `frontend/src/shared/utils/api.ts` |
| Frontend Invoices workbench | `frontend/src/pages/Invoices/InvoicesPage.tsx` |

---

## Step-by-Step Flow

### Step 0 — Invoice creation (billing)

- **BC deliveries:** `BillingBackgroundService` polls `BillingStatus = Unbilled` BC deliveries and calls `BcInvoiceSyncService.CreateSapInvoiceAsync()` → SAP billing endpoint `ZR_CREATEINV` → creates an `Invoice` row (`StampingStatus = NotStamped`).
- **Non-BC deliveries:** `DeliveryAutoConfirmService` auto-confirms the delivery on PGI date + lead time, then auto-generates the invoice via SAP billing in a background task.
- Invoices can also be created manually via `POST /api/invoices` or `POST /api/invoices/without-delivery`.
- The resulting invoice is in `Draft` state with `StampingStatus = NotStamped`.

### Step 1 — Invoice printout upload + anchor configuration

The user uploads the invoice PDF printout (SAP-generated):

- **Frontend:** `uploadInvoicePrintout()` → `POST /api/invoices/{id}/upload-printout`
  (or `POST /api/invoices/by-number/{invoiceNumber}/upload-printout` — preferred for SAP integration).

**Backend `UploadInvoicePrintoutInternal`** then does:

1. **Validate file** — only `application/pdf` or image content types accepted.
2. **Upload to MinIO** — object key `invoices/{invoiceNumber}/printouts/INV_{invoiceNumber}_{guid}.{ext}`.
3. **Create `Document` row** (`Type = InvoicePrintOut`, linked to the invoice).
4. **Configure anchor (stamp position)** — if the file is a PDF, `PdfAnchorService.ExtractStampCoordinatesAsync()` runs:
   - Opens the PDF with **PdfPig** and scans pages **back-to-front**.
   - **Sequential keyword search:** looks for the word `"Notes"` first; if not found, searches for `"Remarks"`.
   - For **"Notes"**: stamp is placed below the keyword; hardcoded `visURX = 482`, vertical target = keyword bottom Y.
   - For **"Remarks"**: stamp is shifted **2 cm left (~57 pt)** and **0.5 cm down (~14 pt)** from the "Notes" position.
   - Maintains a uniform **54×54 pt** bounding box: `visLLX = visURX − 54`, `visLLY = visURY − 54`.
   - If no anchor found, defaults `(428, 218, 482, 272)` on **page 1**.
5. **Persist coordinates** on the `Invoice` entity: `VisLLX, VisLLY, VisURX, VisURY, StampPageNumber`.

> These saved coordinates are later injected into the KeyStamp signing request (they override the hardcoded defaults in `PeruriOnPremiseStampService`).

### Step 2 — Trigger stamping

- **Frontend:** `stampInvoice()` → `POST /api/invoices/by-sap-number/{invoiceNumber}/stamp`
  (legacy: `POST /api/invoices/{id}/stamp`).
- Backend guards: invoice must exist and not already be `Stamped`; a `Document` of type `InvoicePrintOut` must exist.
- Sets `StampingStatus = Pending`, then dispatches to the **on-premise service** (`IPeruriOnPremiseStampService`) if registered, else falls back to the cloud PDS service.

### Step 3 — Fetch invoice PDF from object storage

Inside `PeruriOnPremiseStampService.StampInvoiceAsync()` (Phase 1–2):

1. **Resolve shared-folder paths** (environment-aware):
   - Development → `./sharefolder` (host) / `/app/sharefolder` (container paths).
   - Production → `Peruri:SharedFolder` = `/app/sharefolder`.
   - Ensures `UNSIGNED/`, `STAMP/`, `SIGNED/` subdirectories exist; `chmod 777` in Linux.
2. **Fetch PDF from MinIO:** the controller downloads the printout via `IStorageService.GetFileStreamAsync(printoutDocument.StorageKey)` and passes the bytes in the request.
3. **Write unsigned PDF** to `sharefolder/UNSIGNED/{invoiceNumber}.pdf` with explicit `FlushAsync()`.

### Step 4 — Authenticate with Peruri (JWT)

`PeruriSessionService.GetAuthTokenAsync()` (called before stamping):

- `POST {Peruri:BackendStg}/api/users/login` with service-account `user`/`password`.
- Reads JWT from root `token` (fallback: `result.data.login.token`).
- **Caches the token** in a Singleton with double-checked locking (`SemaphoreSlim`), refreshed `TokenExpiryBufferMinutes` (default 5) before expiry. Tokens default to 1-hour expiry.

### Step 5 — Send to Peruri → receive Serial Number + QR image (quota saver cache)

`StampInvoiceAsync()` Phase 3–4:

1. **Cache check (quota saver):** if the invoice already has `SerialNumber` + `QrImageStorageKey`, the Peruri API is **skipped**. The QR PNG is restored from MinIO to `sharefolder/STAMP/{invoiceNumber}_qr.png` and the flow jumps straight to signing.
2. **New submission:** `POST {Peruri:Stampv2Stg}/chanel/stampv2` with `Authorization: Bearer {jwt}` and the `PeruriStampRequestDto` payload:
   ```json
   {
     "isUpload": false,
     "namadoc": "4b",
     "namafile": "Invoice.pdf",
     "nilaidoc": "0",
     "namejidentitas": "NPWP",
     "noidentitas": "3372015407840001",
     "namedipungut": "William",
     "snOnly": false,
     "nodoc": "0",
     "tgldoc": "yyyy-MM-dd"
   }
   ```
3. **Validate response:** `statusCode == "00"`; extract `result.sn` (serial number) and `result.image` (base64 QR PNG).
4. **Upload QR to MinIO:** decode base64 → key `invoices/{invoiceNumber}/qr/QRINV_{invoiceNumber}_{guid}.png` → `UploadFileAsync(..., "image/png")`.
5. **Persist** `invoice.SerialNumber` and `invoice.QrImageStorageKey`; save DB.
6. **Write QR locally** to `sharefolder/STAMP/{invoiceNumber}_qr.png` for the signing adapter.
7. Short I/O sync buffer (`Task.Delay(350)`).

### Step 6 — Stamping via Peruri Docker Sign Adapter (KeyStamp)

Phase 6 (serialized with a global `SemaphoreSlim` so only one signing runs at a time):

1. Resolve adapter URL:
   - Development → `http://localhost:9999` (host port mapping from container).
   - Production → `Peruri:KeyStamp` = `http://signadapter:7777` (internal Docker network).
2. `POST {adapter}/adapter/pdfsigning/rest/docSigningZ` with `KeyStampSigningRequestDto`:
   - `src` → `sharefolder/UNSIGNED/{invoiceNumber}.pdf`
   - `dest` → `sharefolder/SIGNED/stamped_{invoiceNumber}.pdf`
   - `spesimenPath` → `sharefolder/STAMP/{invoiceNumber}_qr.png`
   - `refToken` = Peruri serial number, `jwToken` = Peruri JWT
   - `visSignaturePage` = saved `StampPageNumber`
   - `visLLX/visLLY/visURX/visURY` = saved anchor coordinates (fallback defaults `428/215/482/269`)
   - `certificatelevel = "NOT_CERTIFIED"`, `profileName = "default"`, `location = "Jakarta"`, `reason = "Meterai Electronic Integration"`.
   - **Path normalization:** physical paths are converted to container-relative `sharefolder/...` paths (the adapter always runs in a container and prepends `/app/` itself — the `/app/` prefix is stripped).
3. Both containers share the **Docker named volume `stamping-share`** mounted at `/app/sharefolder`, so the adapter reads the unsigned PDF + QR and writes the signed PDF.

### Step 7 — Read back signed PDF

Phase 7:

- Waits (`Task.Delay(500)`), then reads `sharefolder/SIGNED/stamped_{invoiceNumber}.pdf`.
- Retries up to **10×** (1 s apart) in case the adapter hasn't flushed the file yet.

### Step 8 — Save stamped document to object storage

Phase 8:

1. Upload signed PDF to MinIO: key `invoices/{invoiceNumber}/stamped/STPINV_{invoiceNumber}_{guid}.pdf`, content type `application/pdf`.
2. Controller (`StampInvoiceByNumber`) creates a `Document` row (`Type = InvoicePrintOut`, `StorageKey` = stamped key) and updates the invoice:
   - `SerialNumber` = Peruri SN
   - `StampedDocumentId` = new document
   - `StampingStatus = Stamped`
   - `Status = SyncedToSap`
3. Response includes `stampedDocumentUrl = {ApiBaseUrl}/api/deliveries/files/download?key={stampedStorageKey}` — served by `DeliveriesController.DownloadFile()` which streams the object back from MinIO.
4. **Zero-footprint cleanup** (production only): deletes transient files and clears the `UNSIGNED`/`STAMP`/`SIGNED` subdirectories. In development, cleanup is skipped so the `sharefolder` state can be inspected.

---

## Result / Outcome

- **Serial number** persisted on the invoice (deduplication + re-stamp prevention).
- **QR image** archived in MinIO (`.../qr/QRINV_*.png`) — reusable for re-signing without consuming Peruri quota.
- **Stamped PDF** archived in MinIO (`.../stamped/STPINV_*.pdf`) and downloadable from the Invoices/Documents workbench.

## Key Configuration (`.env` / `docker-compose`)

| Setting | Value |
|---|---|
| `Peruri__BackendStg` | `https://backendservicestg.e-meterai.co.id` |
| `Peruri__Stampv2Stg` | `https://stampv2stg.e-meterai.co.id` |
| `Peruri__KeyStamp` | `http://signadapter:7777` (prod) / `http://localhost:9999` (dev) |
| `Peruri__SharedFolder` | `/app/sharefolder` |
| `Peruri__User` / `Peruri__Password` | Peruri service account credentials |
| `Minio__*` | MinIO S3-compatible endpoint/keys/bucket (`amtemeterai-documents`) |
| `signadapter` service | `registry.perurica.co.id/e-meterai/signadapter:2.0`, `ENV: STAGING`, maps `9999:7777`, mounts `stamping-share` |
| `api` service | mounts `stamping-share:/app/sharefolder` |

## Service Registration (`Program.cs`)

```csharp
builder.Services.Configure<PeruriOptions>(builder.Configuration.GetSection("Peruri"));
builder.Services.AddSingleton<IPeruriSessionService, PeruriSessionService>();        // token cache
builder.Services.AddScoped<IPeruriOnPremiseStampService, PeruriOnPremiseStampService>();
builder.Services.AddScoped<IPdfAnchorService, PdfAnchorService>();
builder.Services.AddScoped<IPeriuriPdsService, PeriuriPdsService>();                  // cloud fallback
builder.Services.AddSingleton<IStorageService, MinioStorageService>();
```

## Notable Behaviors / Gotchas

- **Quota saver:** re-stamping an already-SN-issued invoice skips the Peruri API and reuses the stored QR + SN (fast path).
- **Path convention:** the KeyStamp adapter always prepends `/app/`; paths sent to it must be relative (`sharefolder/...`), so `/app/` is stripped before sending.
- **Concurrency:** a process-wide `SemaphoreSlim` serializes all signing calls (adapter is single-slot).
- **Anchor OCR:** sequential `Notes` → `Remarks` fallback; "Remarks" shifts the stamp 2 cm left + 0.5 cm down; bounding box is always 54×54 pt.
- **Cleanup:** production removes transient workspace files after each run; dev mode keeps them for debugging.
- **Cloud fallback:** if `IPeruriOnPremiseStampService` is not registered, `StampInvoiceByNumber` uses the cloud PDS path (`PeriuriPdsService`) instead.
