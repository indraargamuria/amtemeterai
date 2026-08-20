# OpexNOW / AMT e-Meterai

Enterprise B2B document automation platform integrating **SAP ERP delivery orders** with **Peruri e-Meterai digital stamping**, S3-compatible document storage, and email distribution.

## What it does

OpexNOW turns SAP outbound delivery orders into **stamped, signed, distributable electronic invoices** end-to-end:

1. **Sync** delivery orders + customer master data from SAP ERP
2. **Receive** buyer confirmation via a public link (PIN-protected, mobile-friendly, GPS-tagged, photo evidence)
3. **Confirm** the delivery in SAP (`zrest_doconfirm`) with per-line variance roll-up
4. **Bill** — manually or auto — calling SAP `zr_createinv` to create the SAP invoice number
5. **Stamp** the invoice PDF with the Indonesian **e-Meterai** via Peruri (on-premise `signadapter` + KeyStamp signing) — serial number, QR code, signed PDF
6. **Distribute** documents by email (salesperson confirmation emails + customer-facing email composer)
7. **Audit** every event in an activity log surfaced on the dashboard

Built for Indonesian tax compliance workflows where every invoice > Rp 5,000,000 must carry an official e-Meterai stamp.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Backend | ASP.NET Core 8 Web API, C#, Entity Framework Core 8, Npgsql (PostgreSQL), MailKit, PdfPig, AWSSDK.S3, JWT bearer auth, Swagger |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix), react-i18next (EN + ID), axios, QRCoder, SheetJS (xlsx export) |
| Storage | PostgreSQL 16 + MinIO (S3-compatible, `AWSSDK.S3` with `ForcePathStyle`) |
| Stamping | Peruri `signadapter:2.0` (on-premise), Peruri KeyStamp PDF signing, Peruri Cloud PDS fallback |
| Reverse proxy | nginx:alpine (single `:80`, stale-DNS 502 fix in `nginx.conf`) |
| Email | MailKit over STARTTLS, prod/staging routing toggle |

---

## Core features

### 1. Delivery order management

**Delivery List** (`/deliveries`) — paginated (10/page) with 9 server-side filters: compliance (BC / Non-BC), fulfillment (Not Received / Fully / Partial / Canceled), invoice state (Billed / Pending / Blocked / Ready to Re-Bill), pipeline (Active default hides canceled), free-text search across delivery# / customer / salesperson / cancel reason. Excel export (SheetJS). Plant-level data isolation enforced server-side via JWT `plant` claims and re-checked client-side. `warehouse` role has customer code/name + order/PO blanked server-side and hidden in the UI; Excel export shows "Confidential".

**Delivery Detail** (`/deliveries/:id`) — full header with compliance + invoice state badges, dynamic SAP invoice action button (Non-BC: "Generate SAP Invoice" works pre-receive; BC: "Sync SAP Invoice" gated on received; disabled while in-flight), GPS map embed (Google Maps iframe from lat/lng), 6-decimal coords, photo evidence grid (click to zoom), QR-code generator for the public receive URL (PNG download), cancel-reason red banner on canceled rows.

**Public Delivery Receive** (`/receive/:token`, **no login**) — token (GUID) + per-customer 6-digit PIN gate, EN/ID language switcher, browser geolocation capture (high accuracy, 5 s timeout), camera capture + multi-file upload (JPEG/PNG, 5 MB each, max 5 photos), inline photo management with deletion markers + undo, per-line variance tracking (delivered / rejected / returned + comments), live variance badges, "Apply to All" guardrail modal, variance confirmation modal on submit with discrepancy summary, sticky submit bar showing live GPS coords.

**Dynamic line-item architecture** — flat delivery lines are folded into a 3-condition tree:
- **Parent Single Batch** — standalone row (has batch, or no batch + no children)
- **Parent with Split Batch** — read-only summary row with expandable children
- **Child Lines** — nested under parent via `ParentLineNumber`

Aggregated at the parent level for SAP sync (line-number roll-up).

**SAP `zrest_doconfirm` push** — on every receipt (manual or auto), the system posts `SapDeliveryConfirmationPayload` with customer code, delivery number, receiver name, `ReceiverStatus` "1" (full) / "2" (partial), notes, per-line delivered/rejected/returned/comment + variance %. Parent-line aggregation handled before the call. SAP DB commit latency tolerated by 3×1.5 s retries in the controller. Failure → 502 ERP Synchronization Error.

**Background Delivery Auto-Confirm** (`DeliveryAutoConfirmService`) — `BackgroundService` runs every `DeliveryAutoConfirm:CheckIntervalMinutes` (default 60), auto-confirms deliveries with PGI date + customer `LeadTimeDays` ≤ today. Sets Received=true, marks all lines fully delivered, then runs SAP confirm + Non-BC auto-invoice in the same pipeline.

**Cancellation** (`POST /api/deliveries/cancel/{deliveryNumber}`) — refuses if invoiced or already received; revokes receiver token (sets to `Guid.Empty`), records reason. Visually: strikethrough title + rose-tinted card borders + "Access Token Revoked" replaces the QR card.

### 2. Invoice workbench & billing

**Invoice List** (`/invoices`) — paginated (25/page), dual-currency display:
- IDR-only rows: nett amount prominent, `Base + DownPay` breakdown underneath
- Foreign rows: local amount prominent + foreign amount below with its own Base/DownPay breakdown

KPI cards: Total Invoices, Pending Stamps (red alert), Stamped count. Filters: compliance (BC / Non-BC / Other), status (Draft / Synced / Stamped / Voided), free-text. Each row has a document dropdown (Raw Invoice + Stamped PDF) and a DO download button. Stamping status badge pulses amber for Pending, shows alert icon for Failed. Excel export with dual-currency columns.

**Document Hub** (`/documents`) — unified view of all invoice + delivery-linked documents. Filter toggles (All / Delivery-Centric / Invoice-Centric). Stat cards (Total, Linked Flow, Standalone, Stamped, Pending Stamp). Right-side 480 px slide-over workspace with Delivery Order / Invoice tabs, document link cards, e-Meterai serial number display.

**Email Composer** (`EmailComposerModal`) — opens from Document Hub, pre-filled To (customer email), CC, Subject (`Document: Delivery/Invoice {number}`), HTML body. Backend `POST /api/email/send-with-attachments` streams MinIO docs (excludes photos, includes stamped/unstamped invoice + linked delivery printouts) and sends via MailKit STARTTLS with staging/prod routing.

**SAP invoice creation (`zr_createinv`)** — single endpoint covers three flows:
- **Manual sync** (`POST /api/deliveries/{deliveryNumber}/invoice`) from the delivery detail page
- **BC background sync** (`BcInvoiceSyncService` via `BillingBackgroundService` — *currently disabled in `Program.cs`*)
- **Non-BC auto-invoice** (fires in background after manual receive or auto-confirm)

Idempotency: active invoice → "Invoice already created previously"; voided local + same SAP number → block with "generate new BC billing in SAP first"; transactional delivery update flips `Invoiced=true` + `BillingStatus=Unbilled/ReadyToRebill → Billed`.

**Dual-currency down payment** — model stores `BaseAmount` + `DownPayAmount` + `TaxAmount` + `DownPayTaxAmount` per currency (`Local` + `Foreign`). SAP semantics: `amountLocal` is gross (base), `downPayAmount + downPayTaxAmount` is total down payment, `amountInvoice` is nett. All four sync paths (BC cron, Non-BC auto-invoice, manual CreateSapInvoice, DeliveryAutoConfirmService) apply this mapping consistently.

**Void / re-bill lifecycle** — `POST /api/invoices/by-sap-number/{invoiceNumber}/void` transactionally sets invoice `Voided` + delivery `BillingBlocked` (blocks re-billing). SAP-side `release-rebill` then transitions `Blocked → ReadyToRebill`, allowing a new sync. `DELETE /api/invoices/by-sap-number/{invoiceNumber}` cascades to linked delivery + documents.

### 3. e-Meterai (Peruri) stamping pipeline

The core compliance feature. Two paths:

**On-premise path** (`PeruriOnPremiseStampService`) — preferred when `IPeruriOnPremiseStampService` is registered (container deployment). 8 phases:

1. **Shared folder resolution** — dev mode: local `sharefolder` + `http://localhost:9999`; container mode: `Peruri:SharedFolder` + `Peruri:KeyStamp`. Creates `UNSIGNED/STAMP/SIGNED` subdirs, `chmod 777` in container.
2. **Write unsigned PDF** with explicit flush.
3. **DB cache resolution** — if `SerialNumber` + `QrImageStorageKey` already exist, skip the Peruri API call (`UsedCache=true`), restore QR PNG from MinIO if missing.
4. **Call Peruri Stamp V2** — `POST {Stampv2Stg}/chanel/stampv2`, JWT auth, payload `namadoc="4b"` (Invoice/Faktur), `namejidentitas="NPWP"`, `snOnly=false`, `tgldoc=yyyy-MM-dd`. Validates `statusCode=="00"`. Extracts `sn` + base64 QR `image`.
5. **Upload QR** to `invoices/{invoiceNumber}/qr/QRINV_{invoiceNumber}_{guid}.png`, persist `SerialNumber` + `QrImageStorageKey`.
6. **KeyStamp Docker signing** — `POST {KeyStamp}/adapter/pdfsigning/rest/docSigningZ`, guarded by `SemaphoreSlim(1,1)`. `certificatelevel="NOT_CERTIFIED"`, path normalization (strips `/app/`), `refToken=sn`, `jwToken`, `visSignaturePage`, **dynamic coordinate fallback** (`VisLLX ?? 428`, `LLY ?? 215`, `URX ?? 482`, `URY ?? 269`), `location="Jakarta"`, `reason="Meterai Electronic Integration"`.
7. **Read signed PDF** with 10×1 s retry.
8. **Upload stamped** to `invoices/{invoiceNumber}/stamped/STPINV_{invoiceNumber}_{guid}.pdf`. Zero-footprint cleanup in container mode (skipped in dev).

**Cloud PDS fallback** (`PeriuriPdsService`) — `POST {Periuri:BaseUrl}/api/v1/stamp` multipart (`file`, `document_number`, `customer_name`, `document_type=INVOICE`, `page_number=1`) with `X-API-Key`. Status check via `GET /api/v1/stamp/status/{transactionId}`.

**PDF anchor extraction** (`PdfAnchorService` with PdfPig) — scans pages backwards, first hits "Notes" then "Remarks" keyword (case-insensitive); 54×54 pt stamp box; `visURX` hardcoded 482; for "Remarks" anchors shifts **−57 pt left + 14 pt down** (2 cm × 0.5 cm); clamps negative coords; `LLX = URX − 54`, `LLY = URY − 54`; page = index+1. Fallback defaults `(428, 218, 482, 272, page 1)`. Failure is non-fatal — defaults used at stamping.

**Peruri session** (`PeruriSessionService`) — singleton, thread-safe JWT cache with `Double-Checked Locking` + `SemaphoreSlim`. Login `POST {BackendStg}/api/users/login`; token extracted root-level then nested `result.data.login.token`; 1-hour expiry + `TokenExpiryBufferMinutes`.

**Invoice model stamping fields** — `SerialNumber`, `QrImageStorageKey`, `QrImageDocumentId`, `VisLLX/LLY/URX/URY`, `StampPageNumber`, `StampingStatus` (`NotStamped`/`Pending`/`Stamped`/`Failed`), `StampedDocumentId`.

### 4. Customer master data

**Customer Service** (`ICustomerSource` → `CustomerService`) — pluggable source: `DummyCustomerSource` (test seed) vs `ErpCustomerSource` (SAP). Customer carries: code, name, email, 6-digit `CustomerPin` (gates public receive), region, `LeadTimeDays` (drives auto-confirm eligibility). `POST /api/customers/sync` upserts from external source + logs `CustomerSynced`.

### 5. Dashboard & activity log

**Dashboard** (`/`) — KPI cards, charts, recent activity feed pulling from `ActivityLog`:
- `DeliveryCreated` / `DeliveryCanceled` / `DeliveryAutoConfirmed` / `DeliveryAutoConfirmFailed`
- `SapInvoiceCreated` / `SapInvoiceCreationFailed` / `SapInvoiceCreationTimedOut` / `SapInvoiceAutoCreated`
- `BcInvoiceSyncSuccess` / `BcInvoiceSyncFailed` / `BcInvoiceSyncSkipped`
- `NonBcInvoiceAutoCreated` / `NonBcInvoiceAutoCreationFailed`
- `InvoiceVoided` / `SyncBlockedVoidedInvoice` / `RebillAuthorizationReleased`

"Pending Invoice" KPI = deliveries `Received && !Invoiced`, backed by `GET /api/dashboard/stats`.

### 6. User access management (UAM)

**Sysadmin only** (`/admin/uam`, route gated by `sysadmin` role claim). CRUD on users, roles, and the **user-matrix** (per-plant data isolation) + **role-menu** matrix (route access). Endpoints:
- `GET /api/admin/uam/users` — list users with assigned plants + roles
- `GET /api/admin/uam/users/{id}/matrix` / `POST .../matrix` — plant assignments
- `GET /api/admin/uam/roles` / `GET /api/admin/uam/roles/{roleName}/menus` / `POST .../menus` — menu gating
- `POST /api/admin/uam/users/register` — create user with initial plant/role assignments

### 7. Background jobs control panel

**Background Jobs** (`/background-jobs`) — `GET /api/background-jobs` lists all registered hosted services with their config + last-run state, `PATCH /api/background-jobs/{key}` enables/disables, `POST /api/background-jobs/{key}/run-now` triggers an immediate run, `GET /api/background-jobs/{key}/logs` returns recent run output. Backed by `BillingBackgroundService` + `DeliveryAutoConfirmService`.

### 8. Authentication

JWT bearer with plant + role claims. `POST /api/account/login` (email/password) → token + plant list. `POST /api/account/register` (sysadmin). `GET /api/account/me` returns the current principal's claims. Routes:
- **Public** (no auth): `/receive/:token`, public photo download, login page
- **Authenticated**: dashboard, customers, deliveries, invoices, documents
- **Sysadmin**: `/admin/uam`, `/background-jobs`, dev seed endpoints

### 9. Dark mode (UI)

Manual theme toggle wired through `shared/hooks/useTheme.ts` + `index.css` CSS variables (`--color-bg`, `--color-fg`, `--color-border`, etc.). System preference respected on first load; toggle persists in `localStorage`. DashboardLayout carries the toggle button; all in-app surfaces are dark-aware via `dark:` Tailwind variants. The public `DeliveryReceivePage` is forced light (customer-facing, 51 surfaces).

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       nginx:alpine (reverse-proxy)               │
│                            :80                                   │
└─────────────┬─────────────────────────────┬──────────────────────┘
              │ /                           │ /api /receive/*
              ▼                             ▼
┌────────────────────────┐    ┌────────────────────────────────────┐
│  React 19 SPA          │    │  ASP.NET Core 8 API                │
│  Vite build → nginx    │    │  Controllers → Services → EF Core  │
│  (TypeScript + Tailwind│    │                                    │
│   + shadcn/ui)         │    │  BackgroundServices:               │
│                        │    │   - BillingBackgroundService       │
│  Routes:               │    │   - DeliveryAutoConfirmService     │
│   /login               │    │                                    │
│   /                    │    │  Integrations:                     │
│   /customers           │    │   - SAP ERP (Basic Auth)           │
│   /deliveries          │    │   - Peruri on-premise (signadapter)│
│   /invoices            │    │   - Peruri Cloud PDS (fallback)    │
│   /documents           │    │   - Google Geocoding API           │
│   /admin/uam           │    │   - MailKit SMTP                   │
│   /background-jobs     │    │   - AWSSDK.S3 → MinIO              │
│   /receive/:token (pub)│    │                                    │
└────────────────────────┘    └────┬──────────────┬────────┬───────┘
                                  │              │        │
                                  ▼              ▼        ▼
                          ┌───────────┐  ┌──────────┐  ┌──────────────┐
                          │PostgreSQL │  │  MinIO   │  │ signadapter  │
                          │    16     │  │ (S3 API) │  │   :7777      │
                          │ opexdb    │  │  :9000   │  │ KeyStamp JWT │
                          └───────────┘  └──────────┘  └──────────────┘
```

**Storage keys (MinIO):**
- `deliveries/{deliveryId}/photos/{guid}{ext}` — proof of delivery photos
- `deliveries/{deliveryNumber}/printouts/DO_{deliveryNumber}_{guid}.{ext}` — delivery order printout
- `invoices/{invoiceNumber}/printouts/INV_{invoiceNumber}_{guid}.{ext}` — invoice printout
- `invoices/{invoiceNumber}/qr/QRINV_{invoiceNumber}_{guid}.png` — e-Meterai QR image
- `invoices/{invoiceNumber}/stamped/STPINV_{invoiceNumber}_{guid}.pdf` — signed stamped PDF

**Document types:** `DeliveryPhoto` (1), `DeliveryPrintOut` (2), `InvoicePrintOut` (3), `EmeteraiQrCode` (4).

---

## Repository layout

```
.
├── backend/amtemeterai.Api/
│   ├── Controllers/           # REST endpoints
│   ├── Services/              # Business logic + background jobs
│   ├── Models/                # EF entities
│   ├── Dtos/                  # Request/response shapes
│   ├── Data/                  # AppDbContext + migrations
│   └── Program.cs             # DI wiring + auth + Swagger
├── frontend/src/
│   ├── pages/                 # Route components
│   │   ├── Login/             # Auth
│   │   ├── Dashboard/         # KPIs + activity
│   │   ├── Customers/         # Master data
│   │   ├── Deliveries/        # List + Detail
│   │   ├── Invoices/          # Workbench
│   │   ├── Documents/         # Hub + slide-over
│   │   ├── BackgroundJobs/    # Hosted service control
│   │   ├── UserAccessManagement/  # Sysadmin UAM
│   │   └── Public/            # DeliveryReceivePage (no login)
│   ├── shared/                # Layouts, hooks, ui components, api
│   ├── i18n/                  # EN + ID translations
│   └── index.css              # Tailwind + dark-mode CSS vars
├── docker-compose.yml         # Production stack
├── docker-compose.dev.yml     # Local dev overrides
└── nginx.conf                 # Reverse proxy config
```

---

## Quickstart (production)

```bash
git clone https://github.com/indraargamuria/amtemeterai.git
cd amtemeterai
cp .env.template .env                 # fill SAP_URL, PERURI_*, SMTP_*, JWT_SECRET, DB_PASSWORD, etc.
docker compose up -d
# Frontend: http://localhost
# API:      http://localhost/api
# MinIO UI: http://localhost:9001  (MINIO_ROOT_USER / MINIO_ROOT_PASSWORD from .env)
```

Images pinned by tag (`:v5` on the production server, registry-prefixed `indraargaaa/amtemeterai-api:v5` + `.../frontend:v5`).

---

## Configuration reference

All settings environment-injectable via double-underscore (`Section__Key=value`):

| Section | Keys |
|---------|------|
| `Peruri` | `BackendStg`, `Stampv2Stg`, `InventoryStg`, `User`, `Password`, `KeyStamp`, `SharedFolder`, `TokenExpiryBufferMinutes` |
| `Sap` | `BaseUrl`, `Client`, `BasicAuth` (user:pass) |
| `SmtpSettings` | Host, Port, User, Password, FromAddress |
| `EmailRouting` | `UseStagingAddress`, `StagingAddress` |
| `BillingSync` | `CheckIntervalMinutes` (default 5) |
| `DeliveryAutoConfirm` | `CheckIntervalMinutes` (default 60) |
| `Jwt` | `Key`, `Issuer`, `Audience` |
| `App` | `PublicBaseUrl`, `ApiBaseUrl`, `MinioEndpoint` |
| `GoogleMaps` | API key for reverse geocoding |

---

## Not implemented / disabled

- **`BillingBackgroundService`** — registered but commented out in `Program.cs`. Re-enable when BC auto-sync is desired; idempotency guards already in place.
- **e-Invoice XML generation** — only Peruri `namadoc="4b"` is supported. No Faktur Pajak XML.
- **Payment status / due-date tracking** — no `PaymentStatus`/`DueDate` fields on the Invoice model.
- **UI for stamping / printout upload / invoice create** — backend endpoints exist (`stampInvoice`, `uploadInvoicePrintout`, `createInvoice`, `uploadDeliveryPrintout`); no UI triggers them. Use Swagger or Postman.
- **Invoice emails** — delivery confirmation emails exist; no invoice email feature (use Document Hub email composer for manual sending).

---

## API surface (selected)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/account/login` | JWT login |
| `GET` | `/api/account/me` | Current principal claims |
| `GET` | `/api/customers` | List customers |
| `POST` | `/api/customers/sync` | Upsert from ERP source |
| `GET` | `/api/deliveries` | List (plant-filtered) |
| `POST` | `/api/deliveries` | Create delivery |
| `PATCH` | `/api/deliveries` | Upsert |
| `GET` | `/api/deliveries/{id}` | Full detail |
| `GET` | `/api/deliveries/{token}` | Public detail (anonymous, PIN-gated) |
| `PATCH` | `/api/deliveries/{token}` | Public receipt submission |
| `POST` | `/api/deliveries/{token}/verify-pin` | PIN verification |
| `POST` | `/api/deliveries/{token}/request-pin` | Email PIN to customer |
| `POST` | `/api/deliveries/cancel/{deliveryNumber}` | Cancel + revoke token |
| `POST` | `/api/deliveries/{deliveryNumber}/invoice` | SAP invoice create/sync |
| `POST` | `/api/deliveries/by-number/{deliveryNumber}/release-rebill` | SAP-initiated re-bill unlock |
| `GET` | `/api/deliveries/files/download?key=` | MinIO stream (anonymous) |
| `GET` | `/api/invoices` | List with dual-currency + stamping state |
| `GET` | `/api/invoices/{id}` | Single invoice |
| `POST` | `/api/invoices` | Manual create (linked to delivery) |
| `POST` | `/api/invoices/without-delivery` | Manual create (standalone) |
| `POST` | `/api/invoices/{id}/stamp` | Stamp (cloud PDS) |
| `POST` | `/api/invoices/by-sap-number/{invoiceNumber}/stamp` | Stamp (on-premise, preferred) |
| `PUT` | `/api/invoices/{id}/downpay` | Update down payment |
| `PUT` | `/api/invoices/by-sap-number/{invoiceNumber}/downpay` | Update down payment by SAP# |
| `POST` | `/api/invoices/{id}/upload-printout` | Upload PDF/image printout |
| `POST` | `/api/invoices/by-sap-number/{invoiceNumber}/void` | Void + block re-billing |
| `DELETE` | `/api/invoices/by-sap-number/{invoiceNumber}` | Hard delete + cascade |
| `POST` | `/api/email/send-with-attachments` | Email document bundle |
| `GET` | `/api/dashboard/stats` | KPI counts |
| `GET` | `/api/dashboard/charts` | Chart data |
| `GET` | `/api/dashboard/logs` | Activity feed |
| `GET/POST` | `/api/admin/uam/users[/{id}/matrix]` | User CRUD + plant matrix |
| `GET/POST` | `/api/admin/uam/roles[/{roleName}/menus]` | Role + menu matrix |
| `GET/PATCH/POST` | `/api/background-jobs[/{key}[/run-now | /logs]]` | Hosted service control |
| `POST` | `/api/sap-sim/billing` | SAP `zr_createinv` simulator |
| `POST` | `/api/test/deliveries/{deliveryNumber}/process-settlement` | Full pipeline test (dev) |

Full Swagger UI at `/swagger` in Development mode.

---

## Detailed inventory

Per-feature row-level breakdown (with backend file references, business rules, line numbers) lives in [`FUNCTIONALITY_INVENTORY.md`](./FUNCTIONALITY_INVENTORY.md) (git-ignored; generated from source analysis).

---

## License

Proprietary. Internal distribution only.
