# implementation.md
### Target Agentic Workflow: Claude Code / Antigravity IDE

This repository instruction file serves as the absolute blueprint for upgrading your existing **Deliveries List Page** (`DeliveriesPage.tsx`) and **Deliveries Detail Page** (`DeliveriesDetailPage.tsx`). All backend API infrastructures are completely compiled, tested, and locked down—**do not modify any backend C#/.cs files**.

---

## 🚀 Core Objectives

1. **Update Deliveries List (`pages/deliveries/DeliveriesPage.tsx`)**:
   * Integrate the financial `invoiced` boolean flag natively as a compact badge stacked inside the existing **Status** column row layout.
   * Remove any standalone, redundant Date columns. Consolidate date sorting logic directly into the interactive `Delivery / Date` header cell block.

2. **Surgically Overhaul Deliveries Detail Page (`pages/deliveries/DeliveriesDetailPage.tsx`)**:
   * **Do not duplicate files or create new components.** Modify the existing component layout structure in-place.
   * Fix invalid type lookups: evaluate the backend model integer enums `type === 1` (**BC Compliance**) and `type === 2` (**Non-BC**). Remove all references to "Express" or "Standard".
   * Restructure the page layout into an ultra-modern, interactive **Hybrid Layout**: Top half is a 2-column split (Left: Metadata, Right: Maps & Photos). Bottom half is a 100% full-width table layout for complete item lines data.
   * Embed an **Interactive Live Google Map** canvas natively inside the visual telemetry panel using the verified coordinates (`latitude`, `longitude`).
   * **Fix Line Completeness**: Expand the fulfillment lines grid into a comprehensive, 100% full-width table capturing SKU, description, dispatch quantities, received amounts, rejections, and line remarks without horizontal truncation.
   * **Fix Interactivity**: Implement a click-to-preview full-screen image modal overlay framework for the MinIO photographic evidence grid assets.

---

## 📐 Enterprise SaaS Hybrid Layout Blueprint

Transform the structural layout rules within the details component to render a stacked hybrid context framework:
+-----------------------------------------------------------------------------+
|  <- Back to Deliveries   [DO-2026-0001]     [BC Compliance]  [Invoiced]     |
+------------------------------------------+----------------------------------+
| TOP SECTION: SPLIT PANELS                                                   |
| LEFT PANEL (Metadata 40%)                | RIGHT PANEL (Visual Telemetry 60%)|
|                                          |                                  |
| +--------------------------------------+ | +------------------------------+ |
| | Core Dispatch Information            | | | LIVE GOOGLE MAPS EMBED      | |
| | • Customer: Code - Full Name         | | |                              | |
| | • Account Owner: Plant (Salesperson) | | |      📍 [Coordinate Pin]     | |
| | • Drop Zone: District, CityRegency   | | +------------------------------+ |
| +--------------------------------------+ | | Clickable Photographic Proof | |
|                                          | | [ Click1 ]        [ Click2 ]   | |
|                                          | +------------------------------+ |
+------------------------------------------+----------------------------------+
| BOTTOM SECTION: UNIFORM FULL WIDTH (100%)                                   |
|                                                                             |
| +-------------------------------------------------------------------------+ |
| | Itemized Complete Audit Table (Full Width - No Horizontal Scroll)       | |
| | SKU/Item Code | Description       | Dispatched | Received | Rej | Note  | |
| | ITEM-2026-99  | Heavy Duty Steel  | 150 Pcs    | 148 Pcs  | 2   | Bent  | |
| +-------------------------------------------------------------------------+ |
+-----------------------------------------------------------------------------+
---

## 📋 Comprehensive Layout & Structural Mappings

### 1. 100% Full-Width Item Lines Audit Table Code Block
Ensure this block sits completely outside of the upper split-panel `div` rows so it spans the entire container page chassis:

```tsx
<div className="w-full mt-8">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-base font-bold text-brand-blue tracking-tight">Fulfillment Line Items</h3>
    <span className="text-xs text-brand-blue/50 font-medium">Showing {delivery.items?.length || 0} items total</span>
  </div>
  
  <div className="rounded-xl border border-brand-blue/10 overflow-hidden bg-white shadow-sm w-full">
    <Table>
      <TableHeader className="bg-brand-blue/2">
        <TableRow>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 w-[18%]">Item / SKU</TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 w-[32%]">Description</TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 text-right w-[12%]">Dispatched</TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 text-right w-[12%]">Received</TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 text-right w-[12%]">Rejected</TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 w-[14%]">Remarks / Variance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {delivery.items && delivery.items.length > 0 ? (
          delivery.items.map((line) => (
            <TableRow key={line.lineId || line.id} className="hover:bg-brand-blue/1 transition-colors">
              <TableCell className="py-3.5 font-semibold text-sm text-brand-blue">
                {line.itemCode || line.sku}
              </TableCell>
              <TableCell className="py-3.5 text-sm text-brand-blue/80">
                {line.itemName || line.description || <span className="text-brand-blue/30 italic">No description</span>}
              </TableCell>
              <TableCell className="py-3.5 text-sm text-right font-medium text-brand-blue/70">
                {line.quantityDispatched || line.qtyOrdered || 0}
              </TableCell>
              <TableCell className="py-3.5 text-sm text-right font-semibold text-emerald-600">
                {line.quantityReceived || line.qtyReceived || 0}
              </TableCell>
              <TableCell className="py-3.5 text-sm text-right font-semibold text-brand-red">
                <span className={(line.quantityRejected || line.qtyRejected) > 0 ? "text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded" : "text-brand-blue/30"}>
                  {line.quantityRejected || line.qtyRejected || 0}
                </span>
              </TableCell>
              <TableCell className="py-3.5 text-xs text-brand-blue/60 font-medium">
                {line.remarks || line.notes || <span className="text-brand-blue/20">-</span>}
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-12 text-sm text-brand-blue/40 italic">
              No dynamic dispatch line items attached to this delivery record.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  </div>
</div>
2. Clickable Image Evidence Gallery & Active Modal State
Add an internal single-image pointer string state (previewImageUrl / setPreviewImageUrl) using standard React useState<string | null>(null) at the top of your details component definition layout.

TypeScript
{/* Photo Proof Grid Wrapper */}
<div className="space-y-3 mt-6">
  <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-blue/50">Photographic Evidence</h4>
  <div className="grid grid-cols-2 gap-4">
    {delivery.photos && delivery.photos.length > 0 ? (
      delivery.photos.map((photo, index) => (
        <div 
          key={index} 
          onClick={() => setPreviewImageUrl(photo.downloadUrl)}
          className="group relative rounded-lg overflow-hidden border border-brand-blue/10 bg-white cursor-pointer hover:border-brand-blue/30 transition-all shadow-xs"
        >
          <img 
            src={photo.downloadUrl} 
            alt={photo.fileName || "Proof of Delivery"}
            loading="lazy"
            className="w-full h-40 object-cover transition-transform group-hover:scale-[1.01]"
          />
          <div className="p-2 text-xs text-brand-blue/60 border-t border-brand-blue/5 bg-brand-blue/1 flex justify-between items-center">
            <span className="truncate max-w-[80%] font-medium">{photo.fileName}</span>
            <span className="text-[10px] text-brand-blue/40 font-semibold bg-brand-blue/5 px-1.5 py-0.5 rounded">🔍 Preview</span>
          </div>
        </div>
      ))
    ) : (
      <p className="text-sm text-brand-blue/40 italic col-span-2 py-4">No photographic evidence attached to this delivery record.</p>
    )}
  </div>
</div>

{/* Light Overlay Popup Modal Structure appended cleanly at bottom of layout container */}
{previewImageUrl && (
  <div 
    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
    onClick={() => setPreviewImageUrl(null)}
  >
    <div className="relative max-w-4xl max-h-[90vh] rounded-xl overflow-hidden shadow-2xl bg-slate-900 animate-in fade-in zoom-in-95 duration-150">
      <img 
        src={previewImageUrl} 
        alt="High Definition Proof Preview" 
        className="max-w-full max-h-[85vh] object-contain block"
      />
      <button 
        className="absolute top-3 right-3 bg-black/40 text-white rounded-full p-2 hover:bg-black/60 transition-colors text-xs font-bold w-8 h-8 flex items-center justify-center"
        onClick={() => setPreviewImageUrl(null)}
      >
        ✕
      </button>
    </div>
  </div>
)}
3. Native Live Google Maps Embed Container
TypeScript
<div className="w-full h-72 rounded-xl overflow-hidden border border-brand-blue/10 shadow-sm relative">
  {delivery.latitude && delivery.longitude ? (
    <iframe
      title="Delivery Drop Tracking Map"
      width="100%"
      height="100%"
      style={{ border: 0 }}
      loading="lazy"
      allowFullScreen
      referrerPolicy="no-referrer-when-downgrade"
      src={`https://www.google.com/maps?q=${delivery.latitude},${delivery.longitude}&z=15&output=embed`}
    />
  ) : (
    <div className="w-full h-full bg-brand-blue/5 flex items-center justify-center text-sm text-brand-blue/40">
      Awaiting GPS coordinate telemetry initialization from field...
    </div>
  )}
</div>