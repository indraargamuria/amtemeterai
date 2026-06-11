# implementation_frontend.md
### Target Agentic Workflow: Claude Code / Antigravity IDE

This instruction file maps out the precise frontend modifications required to upgrade the **Delivery Confirmation Page** to support full, continuous editing of quantities, recipient details, and file attachments until the records are officially invoiced.

---

## 🚀 Core Objectives

1. **Gate Modification Access**:
   * If delivery.invoiced is true, immediately disable all input actions, file attachments, and button interactions. Display a prominent banner warning the user: "This confirmation record is locked because it has already been invoiced."

2. **Build the Staging Photo Asset Engine**:
   * **Handle Deletions Safely**: When an existing image's "Delete/Trash" icon is clicked, do not fire an API call. Hide the thumbnail from the layout view and push its storageKey string value into a local state array (keysToDelete).
   * **Handle New Uploads Safely**: When a new image is selected via file input, generate a temporary local preview string layout utilizing URL.createObjectURL(file) to render it immediately. Store the raw binary entity inside a staging state array (newPhotoFiles).

3. **Convert Lines to High-Density Inline Input Rows**:
   * Replace static text cells for PackQuantityDelivered, PackQuantityReturned, and PackQuantityRejected with controlled numerical input boxes.
   * Connect an onChange routine to update individual items dynamically within the local editedLines tracking state array layout.

4. **Package the Unified Multi-Part Form Data Payload**:
   * Construct an atomic FormData submission package targeting PATCH /api/deliveries/YOUR_TOKEN to commit all text, array indices, deletions, and binary files over the wire in a single transaction.

---

## 📋 Comprehensive Layout Code Snippets

### 1. Photo Grid Attachment Logic Component Block
Update your photo attachment sector using this responsive layout wrapper to combine existing and staged image states into a single unified grid:

```tsx
// Staging states to initialize at the top of the component:
// const [keysToDelete, setKeysToDelete] = useState<string[]>([]);
// const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([]);
// const [previewUrls, setPreviewUrls] = useState<string[]>([]);

<div className="space-y-4">
  <div className="flex items-center justify-between">
    <h3 className="text-sm font-bold uppercase tracking-wider text-brand-blue">Proof of Delivery Photos</h3>
    <label className="cursor-pointer bg-brand-blue/5 hover:bg-brand-blue/10 border border-brand-blue/10 text-brand-blue text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors">
      ➕ Add Photo Asset
      <input
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            setNewPhotoFiles(prev => [...prev, ...filesArray]);
            
            // Generate immediate local browser preview strings
            const urls = filesArray.map(file => URL.createObjectURL(file));
            setPreviewUrls(prev => [...prev, ...urls]);
          }
        }}
        disabled={delivery.invoiced}
      />
    </label>
  </div>

  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
    {/* RENDER PHASE A: Display original backend images if NOT targeted for deletion */}
    {delivery.photos?.filter(p => !keysToDelete.includes(p.storageKey)).map((photo) => (
      <div key={photo.storageKey} className="group relative rounded-lg overflow-hidden border border-brand-blue/10 bg-white">
        <img src={photo.downloadUrl} className="w-full h-32 object-cover" alt="Proof Asset" />
        <button
          type="button"
          onClick={() => setKeysToDelete(prev => [...prev, photo.storageKey])}
          className="absolute top-2 right-2 bg-red-600/90 text-white rounded-md p-1 hover:bg-red-700 transition-colors shadow-xs"
          disabled={delivery.invoiced}
        >
          🗑️ Remove
        </button>
      </div>
    ))}

    {/* RENDER PHASE B: Display newly staged temporary image uploads side-by-side */}
    {previewUrls.map((url, idx) => (
      <div key={idx} className="group relative rounded-lg overflow-hidden border border-amber-300/30 bg-amber-50/5">
        <img src={url} className="w-full h-32 object-cover opacity-90" alt="Staged Preview" />
        <span className="absolute bottom-2 left-2 text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Staged</span>
        <button
          type="button"
          onClick={() => {
            setPreviewUrls(prev => prev.filter((_, i) => i !== idx));
            setNewPhotoFiles(prev => prev.filter((_, i) => i !== idx));
          }}
          className="absolute top-2 right-2 bg-red-600/90 text-white rounded-md p-1 hover:bg-red-700 transition-colors shadow-xs"
        >
          ✕
        </button>
      </div>
    ))}
  </div>
</div>
2. High-Density Unified Submit Handler Configuration
Inject this dispatch sequence into your save action framework to safely feed your new controller properties:

TypeScript
const handleConfirmationUpdateSubmit = async () => {
  try {
    const formData = new FormData();
    formData.append("ReceiverName", receiverName);
    formData.append("ReceiverNotes", receiverNotes || "");
    
    if (latitude) formData.append("Latitude", latitude.toString());
    if (longitude) formData.append("Longitude", longitude.toString());

    // 1. Pack individual line data metrics safely using indexed multi-part keys
    editedLines.forEach((line, index) => {
      formData.append("Lines[" + index + "].DeliveryLineNumber", line.deliveryLineNumber);
      formData.append("Lines[" + index + "].PackQuantityDelivered", (line.packQuantityDelivered || 0).toString());
      formData.append("Lines[" + index + "].PackQuantityReturned", (line.packQuantityReturned || 0).toString());
      formData.append("Lines[" + index + "].PackQuantityRejected", (line.packQuantityRejected || 0).toString());
      formData.append("Lines[" + index + "].LineComment", line.lineComment || "");
    });

    // 2. Append keys marked for MinIO system cleanup purges
    keysToDelete.forEach((key, index) => {
      formData.append("KeysToDelete[" + index + "]", key);
    });

    // 3. Append physical new binary stream data layers
    newPhotoFiles.forEach((file) => {
      formData.append("NewPhotoFiles", file);
    });

    // 4. Send everything across the wire in one atomic transaction payload
    await axios.patch("/api/deliveries/" + token, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });

    toast.success("Delivery confirmation record updated successfully!");
    
    // Refresh or wipe local state changes safely
    setKeysToDelete([]);
    setNewPhotoFiles([]);
    setPreviewUrls([]);
    
  } catch (err: any) {
    const errorMsg = err.response?.data || "Failed to commit confirmation parameters.";
    toast.error(errorMsg);
  }
};