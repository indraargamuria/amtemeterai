import { useState, useEffect, useRef, useMemo } from "react"
import { useParams } from "react-router-dom"
import { Button } from "../../shared/components/ui/Button"
import { Badge } from "../../shared/components/ui/Badge"
import { Card, CardContent, CardHeader, CardTitle } from "../../shared/components/ui/Card"
import { Input } from "../../shared/components/ui/Input"
import { Label } from "../../shared/components/ui/Label"
import { Camera, Upload, Trash2, Search, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Package, Lock, FileText, MapPin } from "lucide-react"

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface DeliveryPhoto {
  fileName: string
  storageKey: string
  downloadUrl: string
  uploadedAt: string
}

interface DeliveryLine {
  deliveryLineNumber: string
  deliveryItemCode: string
  deliveryItemDescription: string
  batchNumber?: string | null
  salesQuantity: number
  salesUOM: string
  packQuantity: number
  packUOM: string
  packQuantityDelivered: number
  packQuantityReturned: number
  packQuantityRejected: number
  lineComment?: string | null
}

interface DeliveryDetail {
  deliveryID: number
  deliveryNumber: string
  deliveryDate: string
  deliveryRemarks: string | null
  shipToAddress?: string | null
  receiverToken: string
  receiverName: string | null
  receiverNotes: string | null
  received: boolean
  invoiced: boolean
  photos?: DeliveryPhoto[]
  lines: DeliveryLine[]
  customerName?: string | null
  buyerPONumber?: string | null
  orderNumber?: string | null
}

interface LineFormState {
  deliveryLineNumber: string
  delivered: string
  returned: string
  rejected: string
  lineComment: string
}

interface VarianceSummary {
  lineNumber: string
  itemCode: string
  description: string
  scheduled: number
  actualTotal: number
  variancePercent: string
  uom: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const API_URL = import.meta.env.VITE_API_URL
const MAX_FILE_SIZE = 5 * 1024 * 1024

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DeliveryReceivePage() {
  const { token } = useParams<{ token: string }>()

  // Core state
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // UI state
  const [showToast, setShowToast] = useState(false)
  const [toastType, setToastType] = useState<"success" | "error">("success")

  // Form state
  const [receiverName, setReceiverName] = useState("")
  const [receiverNotes, setReceiverNotes] = useState("")
  const [lines, setLines] = useState<LineFormState[]>([])
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoErrors, setPhotoErrors] = useState<string[]>([])
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [keysToDelete, setKeysToDelete] = useState<string[]>([])

  // List UI state
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"all" | "issues">("all")
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})

  // PIN Verification state
  const [isVerified, setIsVerified] = useState(false)
  const [pinInput, setPinInput] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [sentToEmail, setSentToEmail] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)

  // Modal state
  const [showVarianceModal, setShowVarianceModal] = useState(false)
  const [pendingVariances, setPendingVariances] = useState<VarianceSummary[]>()

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    const fetchDelivery = async () => {
      if (!token) {
        setError("Invalid secure warehouse token parameter.")
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`${API_URL}/api/deliveries/${token}`)
        if (!res.ok) throw new Error("Delivery reference payload not resolved.")
        const data: DeliveryDetail = await res.json()
        setDelivery(data)

        setReceiverName(data.receiverName || "")
        setReceiverNotes(data.receiverNotes || "")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to establish enterprise link.")
      } finally {
        setLoading(false)
      }
    }

    fetchDelivery()
  }, [token])

  useEffect(() => {
    if (token) {
      const verified = sessionStorage.getItem(`verified-${token}`)
      if (verified === "true") setIsVerified(true)
    }
  }, [token])

  useEffect(() => {
    return () => {
      if (token) sessionStorage.removeItem(`verified-${token}`)
    }
  }, [token])

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude)
          setLongitude(position.coords.longitude)
        },
        () => console.warn("Location tracking permission withheld."),
        { enableHighAccuracy: true, timeout: 5000 }
      )
    }
  }, [])

  useEffect(() => {
    if (delivery && !submitted) {
      setLines(
        delivery.lines.map((line) => ({
          deliveryLineNumber: line.deliveryLineNumber,
          delivered: line.packQuantityDelivered.toString() === "0" ? line.packQuantity.toString() : line.packQuantityDelivered.toString(),
          returned: line.packQuantityReturned.toString(),
          rejected: line.packQuantityRejected.toString(),
          lineComment: line.lineComment || "",
        }))
      )
    }
  }, [delivery, submitted])

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [showToast])

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const checkIsIssueLine = (lineState: LineFormState, originalPackQuantity: number) => {
    const delivered = parseFloat(lineState.delivered) || 0
    const returned = parseFloat(lineState.returned) || 0
    const rejected = parseFloat(lineState.rejected) || 0
    return returned > 0 || rejected > 0 || (delivered + returned + rejected) !== originalPackQuantity || lineState.lineComment.trim() !== ""
  }

  const filteredLines = useMemo(() => {
    if (!delivery) return []
    return delivery.lines.filter((line) => {
      const lineState = lines.find((l) => l.deliveryLineNumber === line.deliveryLineNumber)
      const matchesSearch =
        line.deliveryItemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        line.deliveryItemDescription.toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false
      if (activeTab === "issues" && lineState) {
        return checkIsIssueLine(lineState, line.packQuantity)
      }
      return true
    })
  }, [delivery, lines, searchQuery, activeTab])

  const issuesCount = useMemo(() => {
    if (!delivery) return 0
    return lines.filter(l => {
      const orig = delivery.lines.find(ol => ol.deliveryLineNumber === l.deliveryLineNumber)
      return orig ? checkIsIssueLine(l, orig.packQuantity) : false
    }).length
  }, [delivery, lines])

  const activePhotosCount = (delivery?.photos?.length || 0) + photoFiles.length - keysToDelete.length
  const isUploadDisabled = delivery?.invoiced || submitting || activePhotosCount >= 5

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleReceiveAllClean = () => {
    if (!delivery) return

    // Validation: Check if receiver name is provided
    if (!receiverName.trim()) {
      setToastType("error")
      setShowToast(true)
      return
    }

    // Generate the baseline lines immediately
    const cleanLines = delivery.lines.map((line) => ({
      deliveryLineNumber: line.deliveryLineNumber,
      delivered: line.packQuantity.toString(),
      returned: "0",
      rejected: "0",
      lineComment: "",
    }))

    // Sync the local component state layout
    setLines(cleanLines)
    setToastType("success")
    setShowToast(true)

    // Fire the validation layout sequence using the freshly computed lines array
    handleValidationCheck(null, cleanLines)
  }

  const toggleRowExpansion = (lineNumber: string) => {
    setExpandedRows(prev => ({ ...prev, [lineNumber]: !prev[lineNumber] }))
  }

  const processFormSubmission = async (overrideLines?: LineFormState[]) => {
    if (!delivery || !token) return
    setSubmitting(true)
    setShowVarianceModal(false)

    try {
      const formData = new FormData()
      formData.append("ReceiverName", receiverName || "")
      if (receiverNotes) formData.append("ReceiverNotes", receiverNotes)
      if (latitude !== null) formData.append("Latitude", latitude.toString())
      if (longitude !== null) formData.append("Longitude", longitude.toString())

      photoFiles.forEach((file) => formData.append("NewPhotoFiles", file))
      keysToDelete.forEach((key, idx) => formData.append(`KeysToDelete[${idx}]`, key))

      // Use the specified line array or fall back to application component state
      const targetLines = overrideLines || lines

      delivery.lines.forEach((line, idx) => {
        const lineState = targetLines.find((l) => l.deliveryLineNumber === line.deliveryLineNumber)
        formData.append(`Lines[${idx}].DeliveryLineNumber`, line.deliveryLineNumber)
        formData.append(`Lines[${idx}].PackQuantityDelivered`, parseFloat(lineState?.delivered || "0").toString())
        formData.append(`Lines[${idx}].PackQuantityReturned`, parseFloat(lineState?.returned || "0").toString())
        formData.append(`Lines[${idx}].PackQuantityRejected`, parseFloat(lineState?.rejected || "0").toString())
        if (lineState?.lineComment) formData.append(`Lines[${idx}].LineComment`, lineState.lineComment)
      })

      const res = await fetch(`${API_URL}/api/deliveries/${token}`, {
        method: "PATCH",
        body: formData,
      })

      if (!res.ok) throw new Error("Posting operation failed on ERP interface.")

      setDelivery((prev) => {
        if (!prev) return null
        const legacy = prev.photos?.filter((p) => !keysToDelete.includes(p.storageKey)) || []
        const staged = photoFiles.map((f) => ({
          fileName: f.name,
          storageKey: f.name,
          downloadUrl: URL.createObjectURL(f),
          uploadedAt: new Date().toISOString()
        }))
        return { ...prev, photos: [...legacy, ...staged] }
      })

      setSubmitted(true)
      setToastType("success")
      setShowToast(true)
      setKeysToDelete([])
      setPhotoFiles([])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post physical goods receipt updates.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleValidationCheck = (e: React.FormEvent | null, overrideLines?: LineFormState[]) => {
    if (e) e.preventDefault()
    if (!delivery) return

    // Validation: Check if receiver name is provided
    if (!receiverName.trim()) {
      setToastType("error")
      setShowToast(true)
      return
    }

    const variancesList: VarianceSummary[] = []
    const targetLines = overrideLines || lines

    delivery.lines.forEach((line) => {
      const lineState = targetLines.find((l) => l.deliveryLineNumber === line.deliveryLineNumber)
      if (!lineState) return

      const delivered = parseFloat(lineState.delivered) || 0
      const returned = parseFloat(lineState.returned) || 0
      const rejected = parseFloat(lineState.rejected) || 0
      const totalActual = delivered + returned + rejected

      if (Number(totalActual.toFixed(4)) !== Number(line.packQuantity.toFixed(4))) {
        const rawVariance = totalActual - line.packQuantity
        const percentCalc = ((rawVariance / line.packQuantity) * 100).toFixed(2)
        const displayPercent = rawVariance > 0 ? `+${percentCalc}%` : `${percentCalc}%`

        variancesList.push({
          lineNumber: line.deliveryLineNumber,
          itemCode: line.deliveryItemCode,
          description: line.deliveryItemDescription,
          scheduled: line.packQuantity,
          actualTotal: totalActual,
          variancePercent: displayPercent,
          uom: line.packUOM
        })
      }
    })

    if (variancesList.length > 0) {
      setPendingVariances(variancesList)
      setShowVarianceModal(true)
    } else {
      processFormSubmission(targetLines)
    }
  }

  const handleVerifyPin = async () => {
    if (!token || !pinInput) {
      setPinError("Verification code entry required.")
      return
    }
    setVerifying(true)
    setPinError(null)

    try {
      const res = await fetch(`${API_URL}/api/deliveries/${token}/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      })

      if (res.ok) {
        setIsVerified(true)
        sessionStorage.setItem(`verified-${token}`, "true")
      } else {
        setPinError(res.status === 401 ? "Incorrect security verification PIN." : "Validation pathway failure.")
      }
    } catch {
      setPinError("Network error matching warehouse secure keys.")
    } finally {
      setVerifying(false)
    }
  }

  const handleRequestPin = async () => {
    if (!token) return
    setIsSending(true)
    setRequestError(null)
    setSentToEmail(null)

    try {
      const res = await fetch(`${API_URL}/api/deliveries/public/request-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverToken: token }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSentToEmail(data.sentTo)
      } else {
        setRequestError(data.message || "Unable to dispatch security token request.")
      }
    } catch {
      setRequestError("Inbound network pathway exception.")
    } finally {
      setIsSending(false)
    }
  }

  const handleLineChange = (deliveryLineNumber: string, field: "delivered" | "returned" | "rejected" | "lineComment", value: string) => {
    let sanitized = value
    if (field !== "lineComment" && value !== "") {
      if (parseFloat(value) < 0) sanitized = "0"
    }
    setLines((prev) => prev.map((l) => l.deliveryLineNumber === deliveryLineNumber ? { ...l, [field]: sanitized } : l))
  }

  const handleInputFocus = (deliveryLineNumber: string, field: "delivered" | "returned" | "rejected") => {
    setLines((prev) => prev.map((l) => l.deliveryLineNumber === deliveryLineNumber && parseFloat(l[field]) === 0 ? { ...l, [field]: "" } : l))
  }

  const handleInputBlur = (deliveryLineNumber: string, field: "delivered" | "returned" | "rejected") => {
    setLines((prev) => prev.map((l) => l.deliveryLineNumber === deliveryLineNumber && l[field].trim() === "" ? { ...l, [field]: "0" } : l))
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const errors: string[] = []
    const valid: File[] = []

    files.forEach((f) => {
      if (!["image/jpeg", "image/jpg", "image/png"].includes(f.type)) {
        errors.push(`${f.name}: Invalid attachment format (JPEG/PNG only).`)
        return
      }
      if (f.size > MAX_FILE_SIZE) {
        errors.push(`${f.name}: Image exceeds 5MB memory footprint threshold.`)
        return
      }
      valid.push(f)
    })
    setPhotoErrors(errors)
    setPhotoFiles((prev) => [...prev, ...valid])
    e.target.value = ""
  }

  const removePhoto = (idx: number) => setPhotoFiles((prev) => prev.filter((_, i) => i !== idx))
  const formatDate = (ds: string) => new Date(ds).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })

  // ============================================================================
  // RENDER STATES
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-[#1d2351]/10 border-t-[#1d2351] animate-spin mx-auto" />
          <p className="text-xs font-mono tracking-widest text-slate-400 uppercase">Loading Delivery Data</p>
        </div>
      </div>
    )
  }

  if (error || !delivery) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-slate-200 shadow-lg bg-white">
          <CardContent className="py-12 text-center space-y-5">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-red-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900">Unable to Load Delivery</h3>
              <p className="text-xs text-slate-500 max-w-[240px] mx-auto">{error || "The delivery reference could not be found or has expired."}</p>
            </div>
            <Button onClick={() => window.location.reload()} variant="outline" className="text-xs h-10 px-6">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ============================================================================
  // PIN VERIFICATION SCREEN
  // ============================================================================

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Top decorative bar */}
        <div className="h-1 bg-[#1d2351]" />

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            {/* Logo/Brand area */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1d2351] mb-4 shadow-lg shadow-[#1d2351]/20">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-xl font-bold text-[#1d2351] tracking-tight mb-1">Secure Delivery Access</h1>
              <p className="text-sm text-slate-500">Enter your security PIN to verify this delivery</p>
            </div>

            {/* PIN Card */}
            <Card className="border-slate-200 shadow-xl bg-white">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="pin" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Security PIN</Label>
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value.replace(/\D/g, ""))
                      setPinError(null)
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleVerifyPin() }}
                    placeholder="••••••"
                    className="text-center text-2xl font-mono tracking-[0.5em] h-14 border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1d2351] focus:ring-1 focus:ring-[#1d2351]"
                    autoFocus
                  />
                </div>

                {pinError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 font-medium">{pinError}</p>
                  </div>
                )}

                <Button
                  className="w-full h-12 text-sm font-semibold bg-[#1d2351] hover:bg-[#2a3266] text-white shadow-lg shadow-[#1d2351]/20"
                  onClick={handleVerifyPin}
                  disabled={verifying || !pinInput || isSending}
                >
                  {verifying ? "Verifying..." : "Verify & Continue"}
                </Button>

                <div className="pt-5 border-t border-slate-100">
                  {!sentToEmail ? (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 text-center">Don't have a PIN? Request one to be sent to your email.</p>
                      <Button
                        variant="outline"
                        className="w-full h-10 border-slate-300 text-slate-700 hover:bg-slate-50"
                        onClick={handleRequestPin}
                        disabled={isSending || verifying}
                      >
                        {isSending ? "Sending..." : "Request PIN via Email"}
                      </Button>
                      {requestError && <p className="text-xs text-red-600 text-center font-medium mt-2">{requestError}</p>}
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center space-y-2">
                      <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto" />
                      <div>
                        <p className="text-xs font-semibold text-emerald-900">PIN Sent Successfully</p>
                        <p className="text-xs text-emerald-700 mt-1">Check your email at:</p>
                        <p className="text-sm font-mono font-bold text-emerald-800 mt-1">{sentToEmail}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSentToEmail(null); setRequestError(null) }}
                        className="text-xs text-emerald-700 hover:text-emerald-900 underline font-medium"
                      >
                        Request again
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="py-4 text-center">
          <p className="text-xs text-slate-400">Enterprise Warehouse Management System</p>
        </div>
      </div>
    )
  }

  // ============================================================================
  // MAIN RECEIVING FORM
  // ============================================================================

  return (
    <div className="min-h-screen bg-slate-50 pb-32 pt-6 px-4">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#1d2351] tracking-tight">Goods Receipt</h1>
            <p className="text-xs text-slate-500 mt-0.5">Verify and document incoming delivery</p>
          </div>
          <Badge
            variant={delivery.invoiced ? "warning" : (delivery.received ? "success" : "info")}
            className="text-xs font-medium px-3 py-1"
          >
            {delivery.invoiced ? "Locked" : (delivery.received ? "Completed" : "Pending")}
          </Badge>
        </div>

        {/* Blocked alert */}
        {delivery.invoiced && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-900">Goods Receipt Blocked</h3>
              <p className="text-xs text-amber-700 mt-0.5">Invoice document has been posted. No further modifications allowed.</p>
            </div>
          </div>
        )}

        {/* Success alert */}
        {submitted && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-emerald-900">Receipt Posted Successfully</h3>
              <p className="text-xs text-emerald-700 mt-0.5">Warehouse inventory registers have been updated.</p>
            </div>
          </div>
        )}

        {/* Delivery Info Card - Consolidated with all fields */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="px-4 py-3 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-800" />
              Delivery Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* Top Row: Primary Details Split */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Delivery Number</p>
                <p className="text-sm font-semibold text-[#1d2351] font-mono">{delivery.deliveryNumber}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Customer Name</p>
                <p className="text-sm font-semibold text-slate-700">{delivery.customerName || "—"}</p>
              </div>
            </div>

            {/* Middle Row: Meta Parameters with a top border */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Buyer PO Number</p>
                <p className="text-sm font-semibold text-slate-700 font-mono">{delivery.buyerPONumber || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Order Number</p>
                <p className="text-sm font-semibold text-slate-700 font-mono">{delivery.orderNumber || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Delivery Date</p>
                <p className="text-sm font-semibold text-slate-700">{formatDate(delivery.deliveryDate)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Total Items</p>
                <p className="text-sm font-semibold text-slate-700">
                  <strong className="font-semibold">{delivery.lines.length}</strong> <span className="text-slate-400">items</span>
                </p>
              </div>
            </div>

            {/* Bottom Row: Wrapped Shipping Notes container */}
            {delivery.deliveryRemarks && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Shipping Notes</p>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <p className="text-sm font-semibold text-slate-600">{delivery.deliveryRemarks}</p>
                </div>
              </div>
            )}

            {/* Ship To Address */}
            {delivery.shipToAddress && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Ship To Address</p>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-sm font-semibold text-slate-700">{delivery.shipToAddress}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receiver Info - Moved above Quick Actions for validation flow */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="px-4 py-3 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              Receiver Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="receiverName" className="text-xs font-medium text-slate-600">Receiver Name <span className="text-red-500">*</span></Label>
              <Input
                id="receiverName"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                disabled={delivery.invoiced || submitted || submitting}
                placeholder="Enter your full name"
                className="h-10 text-sm border-slate-300 focus:border-[#1d2351] focus:ring-[#1d2351]"
                required
              />
              {!receiverName.trim() && (
                <p className="text-xs text-red-600 font-medium mt-1">Receiver name is required before applying actions or submitting.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receiverNotes" className="text-xs font-medium text-slate-600">Additional Notes</Label>
              <Input
                id="receiverNotes"
                value={receiverNotes}
                onChange={(e) => setReceiverNotes(e.target.value)}
                disabled={delivery.invoiced || submitted || submitting}
                placeholder="Any additional delivery notes..."
                className="h-10 text-sm border-slate-300 focus:border-[#1d2351] focus:ring-[#1d2351]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        {!delivery.invoiced && !submitted && (
          <div className="bg-[#1d2351]/5 border border-[#1d2351]/10 rounded-lg p-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#1d2351]/10 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5 text-[#1d2351]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#1d2351]">Full Receipt</h3>
                <p className="text-xs text-slate-600 mt-0.5">All items received without discrepancies</p>
                {!receiverName.trim() && (
                  <p className="text-xs text-red-600 font-medium mt-1">Enter receiver name above to enable this action</p>
                )}
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="bg-[#1d2351] hover:bg-[#2a3266] text-white shadow-sm"
              onClick={handleReceiveAllClean}
              disabled={submitting || !receiverName.trim()}
            >
              {submitting ? "Posting..." : "Apply to All"}
            </Button>
          </div>
        )}

        <form id="delivery-form" onSubmit={(e) => handleValidationCheck(e)} className="space-y-5">

          {/* Items List */}
          <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
            {/* Card Header with Search & Tabs */}
            <div className="p-4 border-b border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-800">Line Items</CardTitle>
                <span className="text-xs text-slate-500">{filteredLines.length} of {delivery.lines.length}</span>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 text-sm border-slate-300 focus:border-[#1d2351] focus:ring-[#1d2351]"
                />
              </div>

              <div className="flex border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === "all"
                    ? "border-[#1d2351] text-[#1d2351]"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                >
                  All Items ({delivery.lines.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("issues")}
                  className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === "issues"
                    ? "border-red-500 text-red-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                >
                  Discrepancies {issuesCount > 0 && `(${issuesCount})`}
                </button>
              </div>
            </div>

            {/* Items List */}
            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
              {filteredLines.length === 0 ? (
                <div className="p-8 text-center">
                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No items found</p>
                </div>
              ) : (
                filteredLines.map((line) => {
                  const lineState = lines.find((l) => l.deliveryLineNumber === line.deliveryLineNumber)
                  const isExpanded = !!expandedRows[line.deliveryLineNumber]
                  const isModified = lineState ? checkIsIssueLine(lineState, line.packQuantity) : false
                  const actualTotal = lineState
                    ? parseFloat(lineState.delivered) + parseFloat(lineState.returned) + parseFloat(lineState.rejected)
                    : line.packQuantity

                  return (
                    <div key={line.deliveryLineNumber} className={isModified ? "bg-red-50/30" : ""}>
                      <button
                        type="button"
                        onClick={() => toggleRowExpansion(line.deliveryLineNumber)}
                        className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-slate-900 truncate">{line.deliveryItemDescription}</span>
                            {isModified && (
                              <Badge className="bg-red-100 text-red-700 border-none text-[10px] px-1.5 h-5 font-semibold">
                                Modified
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span>Delivery: <strong className="text-slate-700">{line.packQuantity} {line.packUOM}</strong></span>
                            {line.batchNumber && (
                              <>
                                <span>•</span>
                                <span>Batch: <strong className="text-slate-700">{line.batchNumber}</strong></span>
                              </>
                            )}
                            {isModified && (
                              <>
                                <span>•</span>
                                <span className={isModified ? "text-red-600 font-medium" : ""}>
                                  Actual: <strong>{actualTotal} {line.packUOM}</strong>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 bg-slate-50/50 border-t border-slate-100 animate-in slide-in-from-top-1">
                          <div className="grid grid-cols-3 gap-3 sm:gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-slate-600">Received</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={lineState?.delivered ?? "0"}
                                onChange={(e) => handleLineChange(line.deliveryLineNumber, "delivered", e.target.value)}
                                onFocus={() => handleInputFocus(line.deliveryLineNumber, "delivered")}
                                onBlur={() => handleInputBlur(line.deliveryLineNumber, "delivered")}
                                disabled={delivery.invoiced || submitted || submitting}
                                className="h-10 text-sm border-slate-300 focus:border-[#1d2351] focus:ring-[#1d2351]"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-slate-600">Returned</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={lineState?.returned ?? "0"}
                                onChange={(e) => handleLineChange(line.deliveryLineNumber, "returned", e.target.value)}
                                onFocus={() => handleInputFocus(line.deliveryLineNumber, "returned")}
                                onBlur={() => handleInputBlur(line.deliveryLineNumber, "returned")}
                                disabled={delivery.invoiced || submitted || submitting}
                                className="h-10 text-sm border-slate-300 focus:border-[#1d2351] focus:ring-[#1d2351]"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-slate-600">Rejected</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={lineState?.rejected ?? "0"}
                                onChange={(e) => handleLineChange(line.deliveryLineNumber, "rejected", e.target.value)}
                                onFocus={() => handleInputFocus(line.deliveryLineNumber, "rejected")}
                                onBlur={() => handleInputBlur(line.deliveryLineNumber, "rejected")}
                                disabled={delivery.invoiced || submitted || submitting}
                                className="h-10 text-sm border-slate-300 focus:border-[#1d2351] focus:ring-[#1d2351]"
                              />
                            </div>
                          </div>
                          <div className="mt-3 space-y-1.5">
                            <Label className="text-xs font-medium text-slate-600">Notes</Label>
                            <Input
                              type="text"
                              value={lineState?.lineComment || ""}
                              onChange={(e) => handleLineChange(line.deliveryLineNumber, "lineComment", e.target.value)}
                              disabled={delivery.invoiced || submitted || submitting}
                              placeholder="Add any notes about this item..."
                              className="h-10 text-sm border-slate-300 focus:border-[#1d2351] focus:ring-[#1d2351]"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </Card>

          {/* Photo Upload */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="px-4 py-3 border-b border-slate-100">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Camera className="w-4 h-4 text-slate-500" />
                Delivery Photos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isUploadDisabled}
                  className="h-11 border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Take Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadDisabled}
                  className="h-11 border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Files
                </Button>
              </div>

              <input
                type="file"
                ref={cameraInputRef}
                accept="image/jpeg,image/png"
                capture="environment"
                onChange={handlePhotoUpload}
                disabled={isUploadDisabled}
                className="hidden"
              />
              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png"
                multiple
                onChange={handlePhotoUpload}
                disabled={isUploadDisabled}
                className="hidden"
              />

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{activePhotosCount} / 5 photos</span>
                {activePhotosCount >= 5 && <span className="text-red-600 font-medium">Maximum reached</span>}
              </div>

              {photoErrors.map((pErr, idx) => (
                <p key={idx} className="text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-100">{pErr}</p>
              ))}

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {delivery.photos?.map((p) => {
                  const marked = keysToDelete.includes(p.storageKey)
                  return (
                    <div key={p.storageKey} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group">
                      <img src={p.downloadUrl} alt={p.fileName} className={`w-full h-full object-cover transition-all ${marked ? "opacity-30" : ""}`} />
                      {!delivery.invoiced && !submitted && (
                        <button
                          type="button"
                          onClick={() => setKeysToDelete(prev => prev.includes(p.storageKey) ? prev.filter(k => k !== p.storageKey) : [...prev, p.storageKey])}
                          disabled={submitting}
                          className={`absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase transition-all ${marked
                            ? "bg-slate-900/80 text-white"
                            : "bg-red-600/0 text-white opacity-0 group-hover:opacity-100 group-hover:bg-red-600/80"
                            }`}
                        >
                          {marked ? "Undo" : "Remove"}
                        </button>
                      )}
                    </div>
                  )
                })}
                {photoFiles.map((file, idx) => (
                  <div key={`staged-${idx}`} className="relative aspect-square rounded-lg overflow-hidden border border-blue-200 bg-blue-50">
                    <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      disabled={submitting}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </form>
      </div>

      {/* Sticky Submit Button */}
      {!submitted && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] z-50">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            {latitude && longitude && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 hidden sm:flex">
                <MapPin className="w-3.5 h-3.5" />
                <span className="font-mono">{latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
              </div>
            )}
            <Button
              type="submit"
              form="delivery-form"
              onClick={(e) => {
                const form = document.querySelector('form')
                if (form) {
                  form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
                }
                e.preventDefault()
              }}
              className="flex-1 h-12 text-sm font-semibold bg-[#1d2351] hover:bg-[#2a3266] text-white shadow-lg shadow-[#1d2351]/20"
              disabled={delivery.invoiced || submitting || !receiverName.trim()}
            >
              {submitting ? "Posting..." : "Post Goods Receipt"}
            </Button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={`bg-white border rounded-lg shadow-xl p-4 flex items-start gap-3 min-w-[300px] ${toastType === "error" ? "border-red-200" : "border-emerald-200"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${toastType === "error" ? "bg-red-100" : "bg-emerald-100"}`}>
              {toastType === "error" ? <AlertTriangle className="w-4 h-4 text-red-600" /> : <CheckCircle className="w-4 h-4 text-emerald-600" />}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-slate-900">
                {toastType === "error" ? "Action Required" : "Success"}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {toastType === "error" ? "Please correct the highlighted issues." : "Your changes have been saved."}
              </p>
            </div>
            <button
              onClick={() => setShowToast(false)}
              className="text-slate-400 hover:text-slate-600 shrink-0"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Variance Modal */}
      {showVarianceModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl bg-white">
            <CardHeader className="p-4 border-b border-slate-100 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-base font-semibold text-slate-900">Quantity Discrepancies</CardTitle>
                <p className="text-xs text-slate-500">The following items have quantity mismatches</p>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="max-h-[200px] overflow-y-auto divide-y divide-slate-100">
                {pendingVariances?.map((v) => (
                  <div key={v.lineNumber} className="py-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{v.description}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{v.itemCode}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs">
                        <span className="text-slate-600">Scheduled: <strong>{v.scheduled}</strong></span>
                        <span className="text-slate-400">|</span>
                        <span className="text-slate-600">Actual: <strong>{v.actualTotal}</strong></span>
                        <span className={`ml-auto font-bold ${v.variancePercent.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                          {v.variancePercent}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-10 border-slate-300 text-slate-700 hover:bg-slate-50"
                  onClick={() => setShowVarianceModal(false)}
                >
                  Review & Edit
                </Button>
                <Button
                  type="button"
                  className="flex-1 h-10 bg-[#1d2351] hover:bg-[#2a3266] text-white"
                  onClick={() => processFormSubmission()}
                >
                  Confirm & Post
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  )
}