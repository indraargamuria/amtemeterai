# Task: End-to-End Invoice Processing, e-Meterai Stamping, and UI Modernization

You are an expert full-stack engineer and enterprise systems architect. We need to implement an end-to-end invoice lifecycle management module integrated with SAP and Peruri PDS (e-Meterai stamping).

## Context & Architecture Checklist
- **Backend Architecture:** .NET Core Web API, Entity Framework Core (Code-First Migrations), Controller-based API structure.
- **Frontend Architecture:** React, Vite, Bun, Tailwind CSS, shadcn/ui. High-density enterprise SaaS layout following minimalist design patterns.
- **Storage Infrastructure:** Existing `IStorageService` and `MinioStorageService` configured to save files into a `documents` context.
- **External Interfaces:** SAP ERP RFC/REST API structures, Peruri PDS e-Meterai stamping service.

---

## Part 1: Pre-requisites & Database Schema (Models)

### 1.1 Invoice Model Definition
Create `Models/Invoice.cs` ensuring full relational integrity:
- **Primary Fields:** `Id` (Guid/Int), `InvoiceNumber` (String, Unique/Indexed), `CustomerNumber` (String, linked to Customer context), `InvoiceAmount` (Decimal), `InvoicedDate` (DateTime), `Status` (Enum: Draft, Stamped, SyncFailed, SyncedToSap, Canceled).
- **Relationships:** 
  - `DeliveryHeaderId` (Nullable Guid/Int) representing a optional 1:1 or N:1 link to a Delivery Order (`DeliveryHeader`).
  - Navigation property back to `DeliveryHeader`.
- **E-Meterai Tracking Fields:** `SerialNumber` (String), `StampingStatus` (Enum/String), `StampedDocumentId` (Nullable Guid/Int linking to `Document`).

### 1.2 Database Context Update
- Register the new `Invoice` entity inside `Data/AppDbContext.cs`.
- Configure the fluent API relationships inside `OnModelCreating`, explicitly ensuring that a delivery order (`DeliveryHeader`) has a clean nullable foreign key relationship back from an invoice.

---

## Part 2: Backend Implementation (APIs & Background Workers)

### 2.1 API 1: Delivery Order Printout Upload
- Extend or create endpoints in `Controllers/DeliveriesController.cs` to allow uploading an official delivery printout PDF/Image.
- Utilize the existing `IStorageService` (`MinioStorageService`) infrastructure to persist the file.
- Register the entry into the unified `Document` table, linking its metadata to the corresponding `DeliveryHeader`.

### 2.2 Background Job: Delayed SAP Billing Processing
- Implement a background processing lifecycle worker (or Hangfire/Quartz/HostedService equivalent) to scan confirmed delivery records.
- **Configurable Delay:** Read a delay setting from `appsettings.json` (e.g., `BillingSyncDelayMinutes: 30`).
- **Workflow:** 30 minutes after `DeliveryStatus == Confirmed`, collect delivery lines and push data to the SAP integration gateway endpoint for invoice billing document generation.
- **On SAP Success:** 
  - Update the `IsInvoiced` flag to true inside the `DeliveryHeader` table.
  - Automate the insertion of a new record into your newly created `Invoice` database table capturing `CustomerNumber`, auto-generated `InvoiceNumber`, `InvoiceAmount`, and the original `DeliveryHeaderId`.

### 2.3 API 3: Standalone/Manual Invoice Insertion
- Implement an endpoint `POST /api/invoices` inside a new `Controllers/InvoicesController.cs`.
- This endpoint must support creating invoices **with or without a linked Delivery Order (DO)** to accommodate standard standalone billing models alongside structured workflows.

### 2.4 API 4: Invoice Printout Attachment Upload
- Implement an endpoint `POST /api/invoices/{id}/upload-printout` inside `Controllers/InvoicesController.cs`.
- Cleanly orchestrate upload handling through `IStorageService`, streaming directly to the dedicated MinIO storage buckets and mapping the generated reference code back to the target Invoice row.

### 2.5 Peruri PDS Integration Layer (e-Meterai Stamping)
- Create a service method triggered directly after an invoice document printout becomes verified in the system.
- Stream the source PDF file payload directly to Peruri PDS digital stamping API layout parameters.
- Process and record the transaction responses (`SerialNumber`, stamp coordinates placement metadata status).
- Save the newly stamped PDF directly back into MinIO, cross-referencing it via the unified `Document` system layer, then dispatch an asynchronous status update confirmation back to SAP to synchronize financial ledgers.

---

## Part 3: Frontend Modernization (React & Enterprise UI Layouts)

Modify our multi-tab panel view components directly from the user workspace interface (`src/pages/`, `src/shared/layouts/DashboardLayout.tsx`).

### 3.1 Tab Architecture Restructuring
Transform the current layout into a high-density tabular view mapping:
1. **Dashboard Tab:** Add summary metrics tracking *Uninvoiced Deliveries*, *Pending e-Meterai Stamps*, and *SAP Ledger Discrepancies*.
2. **Customers Tab:** Keep existing layout architecture.
3. **Deliveries Tab:** Incorporate quick action links allowing immediate printout file uploads and visual status tracking flags showing if an order is *Pending Sync*, *Invoiced*, or *Exempt*.
4. **Invoices Tab (New Panel Component):** 
   - Render a master-detail dashboard showing outstanding invoices, financial breakdown items, and current fiscal positions.
   - Embed intuitive quick-action buttons to handle immediate on-demand manual uploads, direct Peruri document stamping pipelines, and forced background SAP resynchronizations.

### 3.2 Design Requirements
- Rely exclusively on **shadcn/ui** layout component patterns (`Table`, `Badge`, `Button`, `Dialog`).
- Utilize clean space optimizations with responsive layout structures tailored for analytical dashboard platforms.
- Ensure loading configurations, transaction success message toasts, and fallback alert screens gracefully account for slow or missing API networks.

---

## Execution Guidelines
1. Generate the database model schemas and register DbContext adjustments first. Run a code-first database migration sequence immediately following model compilation tests.
2. Formulate backend data transaction transfer payloads (DTOs) and API controllers following architectural guidelines.
3. Implement core frontend application enhancements using clean TypeScript types.