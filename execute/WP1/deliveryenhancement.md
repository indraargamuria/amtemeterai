# README.md
### Target Agentic Workflow: Claude Code / Antigravity IDE

This repository subdirectory contains the implementation guidelines for updating the existing frontend components (`Hono`, `Astro`/`React`, `Tailwind CSS`, `shadcn/ui`). All backend services, controllers, and object storage streaming pipelines are finalized and fully locked down. **Do not modify or add any backend C#/.cs files.**

---

## 🚀 Core Objectives

1. **Modify Existing Self-Delivery Confirmation Page**:
   * **Do not create a new page.** Locate your existing public/DeliveryReceivePage.tsx.
   * Inject state tracking and input text elements for inline item verification remarks (`LineComment`) directly inside each existing line-item row/card.
   * Update the existing file upload section to handle multiple file attachment streams for Proof of Delivery (PoD) with strict asset weight validations (**Max 5MB per image**).
   * Ensure the existing submission handler binds all data natively into a `multipart/form-data` structure to sync perfectly with the backend gateway tracking endpoint.

2. **Modify Existing Admin Delivery Detail Page**:
   * **Do not create a new page.** Locate your existing Deliveries/DeliveryDetailPage.tsx.
   * Update the existing metadata container to map and display the newly exposed parameters (`Plant`, `SalesPersonName`, `SalesPersonEmail`).
   * Render dynamic status alerts by mapping type tracking parameters (`Type` and `Status` primitive integers) to clean structural visual indicator badges.
   * Add a section for geographical telemetry tracking (`Latitude`, `Longitude`) using an interactive Google Maps iframe or fallback navigation link alongside physical address tokens.
   * Loop and render the multiple uploaded proof photos using optimized streaming `downloadUrl` address properties directly inside the layout.
   * Append a new column titled **"Customer Discrepancy Remarks"** into the existing line-items data table layout.

---

## 📋 Technical Contract Overview

### 1. Existing Form Ingestion Payload Structure (`PATCH /api/deliveries/{token}`)
When submitting confirmations from the public anonymous terminal link, the existing submission handler must format data as `multipart/form-data`:

| Form Parameter Key | Type | Purpose | Validation Guardrail |
| :--- | :--- | :--- | :--- |
| `ReceiverName` | `string` | Legal name of receiving coordinator | Required |
| `ReceiverNotes` | `string?` | General overview text comments | Optional |
| `Latitude` | `double?` | GPS Coordinate captured via device hardware | Auto-populated |
| `Longitude` | `double?` | GPS Coordinate captured via device hardware | Auto-populated |
| `PhotoFiles` | `File[]` | Raw binary image files (`.jpg`, `.jpeg`, `.png`) | **Max 5MB per file** |
| `Lines[i].DeliveryLineNumber` | `string` | Unique identifier key mapping line index | Loop bound |
| `Lines[i].PackQuantityDelivered`| `decimal`| Actual count accepted at delivery point | Bound logic |
| `Lines[i].PackQuantityReturned` | `decimal`| Count of packages rolled back to truck | Bound logic |
| `Lines[i].PackQuantityRejected` | `decimal`| Count of packages voided due to damage | Bound logic |
| `Lines[i].LineComment` | `string?` | Text feedback regarding line item anomalies | Optional |

### 2. High-Density Detail View Data Nodes (`GET /api/deliveries/{deliveryId}`)
The management dashboard fetches details using the standard integer look-up signature block, returning the following object layer payload schema configuration:

```json
{
  "deliveryID": 3,
  "deliveryNumber": "DO-2026-0001",
  "deliveryDate": "2026-05-19T00:00:00Z",
  "deliveryRemarks": "Fragile items",
  "customerCode": "CUST-001",
  "customerName": "PT. Arga Sukses Mandiri",
  "receiverToken": "72f07993-98d4-4d26-908d-552bea839579",
  "receiverName": "Budi Utomo",
  "receiverNotes": "Received in good condition, slight box damage",
  "received": true,
  "invoiced": false,
  "publicUrl": "http://...",
  "plant": "PLANT-A",
  "type": 1, 
  "status": 2,
  "salesPersonName": "Indra Arga",
  "salesPersonEmail": "arga@amtemeterai.com",
  "latitude": -6.200000,
  "longitude": 106.816666,
  "province": "DKI Jakarta",
  "cityRegency": "Jakarta Pusat",
  "district": "Tanah Abang",
  "formattedAddress": "Jl. Jend. Sudirman No.1, RT.1/RW.3...",
  "photos": [
    {
      "fileName": "proof_box.jpg",
      "storageKey": "deliveries/3/photos/11d29fac-359d-4aa0-a4a8-2f7ee5963551.jpg",
      "downloadUrl": "http://localhost:8080/api/deliveries/files/download?key=deliveries%2F3%2Fphotos%2F11d29fac-359d-4aa0-a4a8-2f7ee5963551.jpg",
      "uploadedAt": "2026-05-19T14:00:55Z"
    }
  ],
  "lines": [
    {
      "deliveryLineNumber": "LN-001",
      "deliveryItemCode": "ITEM-99",
      "deliveryItemDescription": "Premium Electronic Component",
      "salesQuantity": 100.00,
      "salesUOM": "PCS",
      "packQuantity": 10.00,
      "packUOM": "BOX",
      "packQuantityDelivered": 9.00,
      "packQuantityReturned": 1.00,
      "packQuantityRejected": 0.00,
      "lineComment": "1 box wet due to rain route"
    }
  ]
}