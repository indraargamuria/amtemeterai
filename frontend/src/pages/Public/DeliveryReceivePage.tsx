import { useState, useEffect, useRef, useMemo, useCallback, memo, useTransition, startTransition, useDeferredValue } from "react"
import { useParams } from "react-router-dom"
import { Button } from "../../shared/components/ui/Button"
import { Badge } from "../../shared/components/ui/Badge"
import { Card, CardContent, CardHeader, CardTitle } from "../../shared/components/ui/Card"
import { Input } from "../../shared/components/ui/Input"
import { Label } from "../../shared/components/ui/Label"
import { Camera, Upload, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Package, Lock, FileText, MapPin, Search } from "lucide-react"

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
  receiveDate?: string | null
  invoiced: boolean
  photos?: DeliveryPhoto[]
  lines: DeliveryLine[]
  customerName?: string | null
  buyerPONumber?: string | null
  orderNumber?: string | null
}

interface LineFormState {
  delivered: string
  returned: string
  rejected: string
  lineComment: string
}

interface LineCalculation {
  actualTotal: number
  rawVariance: number
  variancePercent: string
  displayVariance: string
  isOver: boolean
  isShort: boolean
  hasVariance: boolean
  isModified: boolean
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

interface LineItemRowProps {
  line: DeliveryLine
  lineState: LineFormState
  calc: LineCalculation
  isExpanded: boolean
  deliveryReceived: boolean
  isInvoiced: boolean
  isSubmitting: boolean
  isSubmitted: boolean
  onToggleExpansion: () => void
  onInputChange: (field: keyof LineFormState, value: string) => void
}

interface ToastNotificationProps {
  show: boolean
  type: "success" | "error"
  onClose: () => void
}

interface ApplyAllReminderProps {
  show: boolean
  onClose: () => void
}

interface VarianceModalProps {
  show: boolean
  variances: VarianceSummary[] | undefined
  onClose: () => void
  onConfirm: () => void
}

interface GuardrailModalProps {
  show: boolean
  issuesCount: number
  onClose: () => void
  onConfirm: () => void
}

// ============================================================================
// CONSTANTS
// ============================================================================

const API_URL = import.meta.env.VITE_API_URL
const MAX_FILE_SIZE = 5 * 1024 * 1024

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatDate = (ds: string) => new Date(ds).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })

const calculateLineData = (lineState: LineFormState, packQuantity: number): LineCalculation => {
  const delivered = parseFloat(lineState.delivered) || 0
  const returned = parseFloat(lineState.returned) || 0
  const rejected = parseFloat(lineState.rejected) || 0
  const totalActual = delivered + returned + rejected

  const rawVariance = totalActual - packQuantity
  const variancePercent = packQuantity > 0 ? ((rawVariance / packQuantity) * 100).toFixed(2) : "0.00"
  const isOver = parseFloat(variancePercent) > 0
  const isShort = parseFloat(variancePercent) < 0
  const displayVariance = isOver ? `+${variancePercent}%` : `${variancePercent}%`
  const hasVariance = Math.abs(parseFloat(variancePercent)) > 0.01
  const isModified = returned > 0 || rejected > 0 || totalActual !== packQuantity || lineState.lineComment.trim() !== ""

  return {
    actualTotal: totalActual,
    rawVariance,
    variancePercent,
    displayVariance,
    isOver,
    isShort,
    hasVariance,
    isModified
  }
}

// Custom equality checker for LineItemRow to prevent unnecessary re-renders
const areLineItemRowPropsEqual = (prevProps: LineItemRowProps, nextProps: LineItemRowProps) => {
  return (
    prevProps.line.deliveryLineNumber === nextProps.line.deliveryLineNumber &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.lineState === nextProps.lineState &&
    prevProps.calc.displayVariance === nextProps.calc.displayVariance &&
    prevProps.calc.isModified === nextProps.calc.isModified &&
    prevProps.deliveryReceived === nextProps.deliveryReceived &&
    prevProps.isInvoiced === nextProps.isInvoiced &&
    prevProps.isSubmitting === nextProps.isSubmitting &&
    prevProps.isSubmitted === nextProps.isSubmitted
  )
}

// ============================================================================
// MEMOIZED SUB-COMPONENTS
// ============================================================================

const LineItemRow = memo(({
  line,
  lineState,
  calc,
  isExpanded,
  deliveryReceived,
  isInvoiced,
  isSubmitting,
  isSubmitted,
  onToggleExpansion,
  onInputChange,
}: LineItemRowProps) => {
  // Local state for uncontrolled inputs - prevents parent re-renders on typing
  const [localValues, setLocalValues] = useState({
    delivered: lineState.delivered,
    returned: lineState.returned,
    rejected: lineState.rejected,
    lineComment: lineState.lineComment
  })

  // Sync local state when parent state changes (e.g., Apply to All)
  useEffect(() => {
    setLocalValues({
      delivered: lineState.delivered,
      returned: lineState.returned,
      rejected: lineState.rejected,
      lineComment: lineState.lineComment
    })
  }, [lineState])

  const handleFieldChange = (field: keyof LineFormState, value: string) => {
    setLocalValues(prev => ({ ...prev, [field]: value }))
    onInputChange(field, value)
  }

  const handleFocus = (field: "delivered" | "returned" | "rejected") => {
    if (localValues[field] === "0") {
      setLocalValues(prev => ({ ...prev, [field]: "" }))
    }
  }

  const handleBlur = (field: "delivered" | "returned" | "rejected") => {
    if (localValues[field].trim() === "" || localValues[field] === "-") {
      setLocalValues(prev => ({ ...prev, [field]: "0" }))
      onInputChange(field, "0")
    } else {
      const num = parseFloat(localValues[field])
      if (num < 0) {
        setLocalValues(prev => ({ ...prev, [field]: "0" }))
        onInputChange(field, "0")
      }
    }
  }

  return (
    <div className={calc.isModified ? "bg-red-50/30" : ""}>
      <button
        type="button"
        onClick={onToggleExpansion}
        className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-slate-900 truncate">{line.deliveryItemDescription}</span>
            {calc.isModified && (
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
            {calc.isModified && (
              <>
                <span>•</span>
                <span className="text-red-600 font-medium">
                  Actual: <strong>{calc.actualTotal} {line.packUOM}</strong>
                </span>
              </>
            )}
          </div>
        </div>
        {calc.hasVariance && deliveryReceived && (
          <div className="shrink-0 mr-2">
            <Badge
              variant="badge"
              className={
                calc.isShort
                  ? "bg-rose-100 text-rose-700 border-rose-200 text-xs font-semibold px-2 py-1"
                  : calc.isOver
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-xs font-semibold px-2 py-1"
                  : "bg-slate-100 text-slate-500 border-slate-200 text-xs px-2 py-1"
              }
            >
              {calc.displayVariance}
            </Badge>
          </div>
        )}
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
        </div>
      </button>

      {/* Lazy render expansion panel - only renders when expanded */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 bg-slate-50/50 border-t border-slate-100 animate-in slide-in-from-top-1">
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Received</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={localValues.delivered}
                onChange={(e) => handleFieldChange("delivered", e.target.value)}
                onFocus={() => handleFocus("delivered")}
                onBlur={() => handleBlur("delivered")}
                disabled={isInvoiced || isSubmitted || isSubmitting}
                className="h-10 text-sm border-slate-300 focus:border-[#1d2351] focus:ring-[#1d2351]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Returned</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={localValues.returned}
                onChange={(e) => handleFieldChange("returned", e.target.value)}
                onFocus={() => handleFocus("returned")}
                onBlur={() => handleBlur("returned")}
                disabled={isInvoiced || isSubmitted || isSubmitting}
                className="h-10 text-sm border-slate-300 focus:border-[#1d2351] focus:ring-[#1d2351]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Rejected</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={localValues.rejected}
                onChange={(e) => handleFieldChange("rejected", e.target.value)}
                onFocus={() => handleFocus("rejected")}
                onBlur={() => handleBlur("rejected")}
                disabled={isInvoiced || isSubmitted || isSubmitting}
                className="h-10 text-sm border-slate-300 focus:border-[#1d2351] focus:ring-[#1d2351]"
              />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Notes</Label>
            <Input
              type="text"
              value={localValues.lineComment}
              onChange={(e) => handleFieldChange("lineComment", e.target.value)}
              disabled={isInvoiced || isSubmitted || isSubmitting}
              placeholder="Add any notes about this item..."
              className="h-10 text-sm border-slate-300 focus:border-[#1d2351] focus:ring-[#1d2351]"
            />
          </div>
        </div>
      )}
    </div>
  )
}, areLineItemRowPropsEqual)

LineItemRow.displayName = "LineItemRow"

const ToastNotification = memo(({ show, type, onClose }: ToastNotificationProps) => {
  if (!show) return null

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className={`bg-white border rounded-lg shadow-xl p-4 flex items-start gap-3 min-w-[300px] ${type === "error" ? "border-red-200" : "border-emerald-200"}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${type === "error" ? "bg-red-100" : "bg-emerald-100"}`}>
          {type === "error" ? <AlertTriangle className="w-4 h-4 text-red-600" /> : <CheckCircle className="w-4 h-4 text-emerald-600" />}
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-slate-900">
            {type === "error" ? "Action Required" : "Success"}
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            {type === "error" ? "Please correct the highlighted issues." : "Your changes have been saved."}
          </p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0">
          ×
        </button>
      </div>
    </div>
  )
})

ToastNotification.displayName = "ToastNotification"

const ApplyAllReminder = memo(({ show, onClose }: ApplyAllReminderProps) => {
  if (!show) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-white border border-blue-200 rounded-lg shadow-xl p-4 flex items-start gap-3 min-w-[320px]">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <CheckCircle className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-slate-900">"Apply to All" Ready</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            All items set to scheduled quantities. Click <strong>"Post Goods Receipt"</strong> at the bottom to confirm and submit.
          </p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0">
          ×
        </button>
      </div>
    </div>
  )
})

ApplyAllReminder.displayName = "ApplyAllReminder"

const VarianceModal = memo(({ show, variances, onClose, onConfirm }: VarianceModalProps) => {
  if (!show) return null

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-white border border-amber-200 rounded-lg shadow-xl p-4 flex items-start gap-3 min-w-[400px] w-full max-w-lg">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-700" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-slate-900">Quantity Discrepancies</h4>
          <p className="text-xs text-slate-500 mt-0.5">The following items have quantity mismatches</p>
          <div className="mt-3 max-h-[160px] overflow-y-auto divide-y divide-slate-100">
            {variances?.map((v) => (
              <div key={v.lineNumber} className="py-2 flex items-start gap-2">
                <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center shrink-0">
                  <Package className="w-3 h-3 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-900 truncate">{v.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                    <span>{v.itemCode}</span>
                    <span className="text-slate-300">|</span>
                    <span>Scheduled: <strong>{v.scheduled}</strong></span>
                    <span className="text-slate-300">|</span>
                    <span>Actual: <strong>{v.actualTotal}</strong></span>
                    <span className={`ml-auto font-bold ${v.variancePercent.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                      {v.variancePercent}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-9 border-slate-300 text-slate-700 hover:bg-slate-50 text-xs"
              onClick={onClose}
            >
              Review & Edit
            </Button>
            <Button
              type="button"
              className="flex-1 h-9 bg-[#1d2351] hover:bg-[#2a3266] text-white text-xs"
              onClick={onConfirm}
            >
              Confirm & Post
            </Button>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0">
          ×
        </button>
      </div>
    </div>
  )
})

VarianceModal.displayName = "VarianceModal"

const GuardrailModal = memo(({ show, issuesCount, onClose, onConfirm }: GuardrailModalProps) => {
  if (!show) return null

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-white border border-red-200 rounded-lg shadow-xl p-4 flex items-start gap-3 min-w-[360px]">
        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-600" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-slate-900">Warning: Manual Changes Detected</h4>
          <p className="text-xs text-slate-500 mt-0.5">You have entered manual discrepancies on {issuesCount} item(s)</p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-2">
            <p className="text-xs text-amber-900">
              Clicking <strong>"Apply to All"</strong> will overwrite all your manual entries and reset all items to their scheduled quantities.
            </p>
          </div>
          <p className="text-xs text-slate-600 mt-2">Are you sure you want to proceed? This action cannot be undone.</p>
          <div className="flex gap-2 mt-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-9 border-slate-300 text-slate-700 hover:bg-slate-50 text-xs"
              onClick={onClose}
            >
              Keep Manual Changes
            </Button>
            <Button
              type="button"
              className="flex-1 h-9 bg-red-600 hover:bg-red-700 text-white text-xs"
              onClick={onConfirm}
            >
              Overwrite & Apply
            </Button>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0">
          ×
        </button>
      </div>
    </div>
  )
})

GuardrailModal.displayName = "GuardrailModal"

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DeliveryReceivePage() {
  const { token } = useParams<{ token: string }>()
  const [isPending, startTransition] = useTransition()

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
  const [receiveDate, setReceiveDate] = useState("")
  const [receiveDateError, setReceiveDateError] = useState<string | null>(null)

  // OPTIMIZATION: Use Map instead of array for O(1) lookups
  const [linesMap, setLinesMap] = useState<Map<string, LineFormState>>(new Map())

  // Track which lines have issues - Set for O(1) lookup
  const [issueLines, setIssueLines] = useState<Set<string>>(new Set())

  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoErrors, setPhotoErrors] = useState<string[]>([])
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [keysToDelete, setKeysToDelete] = useState<string[]>([])

  // List UI state - deferred for non-critical updates
  const [searchQuery, setSearchQuery] = useState("")
  const deferredSearchQuery = useDeferredValue(searchQuery.toLowerCase())
  const [activeTab, setActiveTab] = useState<"all" | "issues">("all")
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

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
  const [showGuardrailModal, setShowGuardrailModal] = useState(false)
  const [showApplyAllReminder, setShowApplyAllReminder] = useState(false)

  // Refs for stable callbacks
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const deliveryRef = useRef<DeliveryDetail | null>(null)
  const linesMapRef = useRef<Map<string, LineFormState>>(new Map())
  const issueLinesRef = useRef<Set<string>>(new Set())

  // Keep refs in sync
  useEffect(() => {
    deliveryRef.current = delivery
  }, [delivery])

  useEffect(() => {
    linesMapRef.current = linesMap
  }, [linesMap])

  useEffect(() => {
    issueLinesRef.current = issueLines
  }, [issueLines])

  // ============================================================================
  // COMPUTED VALUES (Memoized with O(1) Map lookups)
  // ============================================================================

  // Memoized calculations Map - O(1) per line lookup
  const calculationsMap = useMemo(() => {
    const calcMap = new Map<string, LineCalculation>()
    if (!delivery) return calcMap

    delivery.lines.forEach((line) => {
      const lineState = linesMap.get(line.deliveryLineNumber)
      if (!lineState) return

      calcMap.set(line.deliveryLineNumber, calculateLineData(lineState, line.packQuantity))
    })

    return calcMap
  }, [delivery, linesMap])

  // Issues count - O(1) from Set size
  const issuesCount = issueLines.size

  // Active photos count
  const activePhotosCount = useMemo(() =>
    (delivery?.photos?.length || 0) + photoFiles.length - keysToDelete.length,
    [delivery?.photos?.length, photoFiles.length, keysToDelete.length]
  )

  const isUploadDisabled = useMemo(() =>
    delivery?.invoiced || submitting || activePhotosCount >= 5,
    [delivery?.invoiced, submitting, activePhotosCount]
  )

  // Memoized filtered lines - O(N) but only when search changes
  const filteredLines = useMemo(() => {
    if (!delivery) return []

    // Early return if no search
    if (!deferredSearchQuery && activeTab === "all") {
      return delivery.lines
    }

    return delivery.lines.filter((line) => {
      // Search filter
      if (deferredSearchQuery) {
        const matchesSearch =
          line.deliveryItemCode.toLowerCase().includes(deferredSearchQuery) ||
          line.deliveryItemDescription.toLowerCase().includes(deferredSearchQuery)
        if (!matchesSearch) return false
      }

      // Issues tab filter
      if (activeTab === "issues") {
        return issueLines.has(line.deliveryLineNumber)
      }

      return true
    })
  }, [delivery, deferredSearchQuery, activeTab, issueLines])

  // Photo URLs memoization
  const photoUrls = useMemo(() => {
    return photoFiles.map(file => URL.createObjectURL(file))
  }, [photoFiles])

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initial delivery fetch
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

  // Initialize lines Map from delivery
  useEffect(() => {
    if (delivery && !submitted) {
      if (!delivery.received) {
        const today = new Date().toISOString().split('T')[0]
        setReceiveDate(today)
      } else if (delivery.receiveDate) {
        setReceiveDate(delivery.receiveDate.split('T')[0])
      }

      // Initialize Map with default values - O(N) once
      const newMap = new Map<string, LineFormState>()
      const newIssueSet = new Set<string>()

      delivery.lines.forEach((line) => {
        const lineState: LineFormState = {
          delivered: line.packQuantityDelivered.toString() === "0" ? line.packQuantity.toString() : line.packQuantityDelivered.toString(),
          returned: line.packQuantityReturned.toString(),
          rejected: line.packQuantityRejected.toString(),
          lineComment: line.lineComment || ""
        }
        newMap.set(line.deliveryLineNumber, lineState)

        // Check if it's an issue line
        const calc = calculateLineData(lineState, line.packQuantity)
        if (calc.isModified) {
          newIssueSet.add(line.deliveryLineNumber)
        }
      })

      setLinesMap(newMap)
      setIssueLines(newIssueSet)
    }
  }, [delivery, submitted])

  // Check verification status
  useEffect(() => {
    if (token) {
      const verified = sessionStorage.getItem(`verified-${token}`)
      if (verified === "true") setIsVerified(true)
    }
  }, [token])

  // Cleanup verification on unmount
  useEffect(() => {
    return () => {
      if (token) sessionStorage.removeItem(`verified-${token}`)
    }
  }, [token])

  // Get geolocation
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

  // Toast auto-dismiss
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [showToast])

  // Apply All Reminder auto-dismiss
  useEffect(() => {
    if (showApplyAllReminder) {
      const timer = setTimeout(() => setShowApplyAllReminder(false), 8000)
      return () => clearTimeout(timer)
    }
  }, [showApplyAllReminder])

  // Cleanup photo URLs on unmount
  useEffect(() => {
    return () => {
      photoUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [photoUrls])

  // ============================================================================
  // HANDLERS (Optimized with callbacks and minimal dependencies)
  // ============================================================================

  // OPTIMIZATION: Direct Map mutation for O(1) updates
  const updateLineField = useCallback((lineNumber: string, field: keyof LineFormState, value: string) => {
    setLinesMap(prev => {
      const newMap = new Map(prev)
      const current = newMap.get(lineNumber)
      if (current) {
        const updated = { ...current, [field]: value }
        newMap.set(lineNumber, updated)

        // Use startTransition for non-critical UI updates
        startTransition(() => {
          if (deliveryRef.current) {
            const line = deliveryRef.current.lines.find(l => l.deliveryLineNumber === lineNumber)
            if (line) {
              const calc = calculateLineData(updated, line.packQuantity)
              setIssueLines(prevIssues => {
                const newIssues = new Set(prevIssues)
                if (calc.isModified) {
                  newIssues.add(lineNumber)
                } else {
                  newIssues.delete(lineNumber)
                }
                return newIssues
              })
            }
          }
        })
      }
      return newMap
    })
  }, [])

  const toggleRowExpansion = useCallback((lineNumber: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(lineNumber)) {
        newSet.delete(lineNumber)
      } else {
        newSet.add(lineNumber)
      }
      return newSet
    })
  }, [])

  const handleReceiveAllClean = useCallback((skipGuardrail = false) => {
    if (!delivery) return

    if (!receiverName.trim()) {
      setToastType("error")
      setShowToast(true)
      return
    }

    if (!skipGuardrail && issuesCount > 0) {
      setShowGuardrailModal(true)
      return
    }

    // OPTIMIZATION: Batch update all lines at once
    const newMap = new Map<string, LineFormState>()
    const newIssueSet = new Set<string>()

    delivery.lines.forEach((line) => {
      const cleanLine: LineFormState = {
        delivered: line.packQuantity.toString(),
        returned: "0",
        rejected: "0",
        lineComment: ""
      }
      newMap.set(line.deliveryLineNumber, cleanLine)
    })

    setLinesMap(newMap)
    setIssueLines(newIssueSet)
    setShowApplyAllReminder(true)
  }, [delivery, receiverName, issuesCount])

  const processFormSubmission = useCallback(async () => {
    if (!delivery || !token) return
    setSubmitting(true)
    setShowVarianceModal(false)

    try {
      const formData = new FormData()
      formData.append("ReceiverName", receiverName || "")
      if (receiverNotes) formData.append("ReceiverNotes", receiverNotes)
      if (receiveDate) formData.append("ReceiveDate", receiveDate)
      if (latitude !== null) formData.append("Latitude", latitude.toString())
      if (longitude !== null) formData.append("Longitude", longitude.toString())

      photoFiles.forEach((file) => formData.append("NewPhotoFiles", file))
      keysToDelete.forEach((key, idx) => formData.append(`KeysToDelete[${idx}]`, key))

      // OPTIMIZATION: Use Map for O(1) lookups instead of find
      delivery.lines.forEach((line, idx) => {
        const lineState = linesMap.get(line.deliveryLineNumber)
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
  }, [delivery, token, receiverName, receiverNotes, receiveDate, latitude, longitude, photoFiles, keysToDelete, linesMap])

  const handleValidationCheck = useCallback((e: React.FormEvent | null) => {
    if (e) e.preventDefault()
    if (!delivery) return

    if (!receiverName.trim()) {
      setToastType("error")
      setShowToast(true)
      return
    }

    if (!receiveDate) {
      setToastType("error")
      setShowToast(true)
      return
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const selected = new Date(receiveDate)
    selected.setHours(0, 0, 0, 0)

    if (selected > today) {
      setReceiveDateError("Receive date cannot be in the future")
      setToastType("error")
      setShowToast(true)
      return
    }

    const variancesList: VarianceSummary[] = []

    // OPTIMIZATION: Use Map for O(1) lookups
    delivery.lines.forEach((line) => {
      const lineState = linesMap.get(line.deliveryLineNumber)
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
      processFormSubmission()
    }
  }, [delivery, receiverName, receiveDate, linesMap, processFormSubmission])

  const handleVerifyPin = useCallback(async () => {
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
  }, [token, pinInput])

  const handleRequestPin = useCallback(async () => {
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
  }, [token])

  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
  }, [])

  const removePhoto = useCallback((idx: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const toggleKeyToDelete = useCallback((storageKey: string) => {
    setKeysToDelete(prev => {
      const newSet = new Set(prev)
      if (newSet.has(storageKey)) {
        newSet.delete(storageKey)
      } else {
        newSet.add(storageKey)
      }
      return Array.from(newSet)
    })
  }, [])

  // OPTIMIZATION: Create stable callback factories for each row
  // This prevents creating new functions on every render
  const createRowHandlers = useCallback((lineNumber: string) => ({
    onToggleExpansion: () => toggleRowExpansion(lineNumber),
    onInputChange: (field: keyof LineFormState, value: string) => updateLineField(lineNumber, field, value)
  }), [toggleRowExpansion, updateLineField])

  // Cache of row handlers to avoid recreating
  const rowHandlersCache = useRef<Map<string, ReturnType<typeof createRowHandlers>>>(new Map())

  const getRowHandlers = useCallback((lineNumber: string) => {
    if (!rowHandlersCache.current.has(lineNumber)) {
      rowHandlersCache.current.set(lineNumber, createRowHandlers(lineNumber))
    }
    return rowHandlersCache.current.get(lineNumber)!
  }, [createRowHandlers])

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
        <div className="h-1 bg-[#1d2351]" />

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1d2351] mb-4 shadow-lg shadow-[#1d2351]/20">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-xl font-bold text-[#1d2351] tracking-tight mb-1">Secure Delivery Access</h1>
              <p className="text-sm text-slate-500">Enter your security PIN to verify this delivery</p>
            </div>

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

        {/* Delivery Info Card */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="px-4 py-3 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-800" />
              Delivery Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
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

            {delivery.deliveryRemarks && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Shipping Notes</p>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <p className="text-sm font-semibold text-slate-600">{delivery.deliveryRemarks}</p>
                </div>
              </div>
            )}

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

        {/* Receiver Info */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="px-4 py-3 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              Receiver Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Label htmlFor="receiveDate" className="text-xs font-medium text-slate-600">Receive Date <span className="text-red-500">*</span></Label>
                <Input
                  id="receiveDate"
                  type="date"
                  value={receiveDate}
                  onChange={(e) => {
                    const selectedDate = e.target.value
                    setReceiveDate(selectedDate)
                    setReceiveDateError(null)

                    if (selectedDate) {
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)
                      const selected = new Date(selectedDate)
                      selected.setHours(0, 0, 0, 0)

                      if (selected > today) {
                        setReceiveDateError("Receive date cannot be in the future")
                      }
                    }
                  }}
                  disabled={delivery.invoiced || submitted || submitting}
                  className="h-10 text-sm border-slate-300 focus:border-[#1d2351] focus:ring-[#1d2351]"
                  required
                  max={new Date().toISOString().split('T')[0]}
                />
                {receiveDateError && (
                  <p className="text-xs text-red-600 font-medium mt-1">{receiveDateError}</p>
                )}
              </div>
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
              onClick={() => handleReceiveAllClean(false)}
              disabled={submitting || !receiverName.trim()}
            >
              Apply to All
            </Button>
          </div>
        )}

        <form id="delivery-form" onSubmit={(e) => handleValidationCheck(e)} className="space-y-5">

          {/* Items List */}
          <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
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

            {/* OPTIMIZATION: Virtual scrolling ready container - Items List */}
            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
              {filteredLines.length === 0 ? (
                <div className="p-8 text-center">
                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No items found</p>
                </div>
              ) : (
                filteredLines.map((line) => {
                  // OPTIMIZATION: O(1) Map lookups instead of array.find()
                  const lineState = linesMap.get(line.deliveryLineNumber) || {
                    delivered: line.packQuantity.toString(),
                    returned: "0",
                    rejected: "0",
                    lineComment: ""
                  }
                  const calc = calculationsMap.get(line.deliveryLineNumber) || calculateLineData(lineState, line.packQuantity)
                  const isExpanded = expandedRows.has(line.deliveryLineNumber)
                  const handlers = getRowHandlers(line.deliveryLineNumber)

                  return (
                    <LineItemRow
                      key={line.deliveryLineNumber}
                      line={line}
                      lineState={lineState}
                      calc={calc}
                      isExpanded={isExpanded}
                      deliveryReceived={delivery.received}
                      isInvoiced={delivery.invoiced}
                      isSubmitting={submitting}
                      isSubmitted={submitted}
                      onToggleExpansion={handlers.onToggleExpansion}
                      onInputChange={handlers.onInputChange}
                    />
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
                          onClick={() => toggleKeyToDelete(p.storageKey)}
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
                    <img src={photoUrls[idx]} alt={file.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      disabled={submitting}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 rotate-45" />
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

      {/* Toast Notification - Memoized */}
      <ToastNotification show={showToast} type={toastType} onClose={() => setShowToast(false)} />

      {/* Apply to All Info Pop-up - Memoized */}
      <ApplyAllReminder show={showApplyAllReminder} onClose={() => setShowApplyAllReminder(false)} />

      {/* Variance Modal - Memoized */}
      <VarianceModal
        show={showVarianceModal}
        variances={pendingVariances}
        onClose={() => setShowVarianceModal(false)}
        onConfirm={processFormSubmission}
      />

      {/* Guardrail Modal - Memoized */}
      <GuardrailModal
        show={showGuardrailModal}
        issuesCount={issuesCount}
        onClose={() => setShowGuardrailModal(false)}
        onConfirm={() => {
          setShowGuardrailModal(false)
          handleReceiveAllClean(true)
        }}
      />

    </div>
  )
}
