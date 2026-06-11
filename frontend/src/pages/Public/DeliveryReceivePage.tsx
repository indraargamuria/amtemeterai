import { useState, useEffect, useRef, useMemo, useCallback, memo, startTransition, useDeferredValue } from "react"
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
  orderNumber?: string | null
  buyerPONumber?: string | null
  salesQuantity: number
  salesUOM: string
  packQuantity: number
  packUOM: string
  packQuantityDelivered: number
  packQuantityReturned: number
  packQuantityRejected: number
  lineComment?: string | null
}

// ItemGroup for batched items aggregation
interface ItemGroup {
  id: string // Group key
  itemDescription: string
  orderNumber: string | null
  buyerPONumber: string | null
  uom: string
  minLineNumber: number // For sorting (100, 200, 300)
  lines: DeliveryLine[]
  totals: {
    scheduled: number
    received: number
    returned: number
    rejected: number
  }
  status: 'accepted' | 'discrepancy' | 'pending'
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
  type: "success" | "error" | "info"
  onClose: () => void
  title?: string
  message?: string
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
const ITEMS_PER_PAGE = 10

// ============================================================================
// UOM TRANSFORMATION HELPER
// ============================================================================

const transformUOM = (uom: string): string => {
  // Transform "ST" to "PC" for display
  return uom === "ST" ? "PC" : uom
}

// ============================================================================
// ITEM GROUP AGGREGATION HELPER
// ============================================================================

const createItemGroups = (lines: DeliveryLine[]): ItemGroup[] => {
  const groupMap = new Map<string, ItemGroup>()

  lines.forEach((line) => {
    // Standalone items (no batch number) - will be handled separately
    if (!line.batchNumber || line.batchNumber.trim() === "") {
      return
    }

    // Create group key from: Item Description + Order Number + Buyer PO Number + UOM
    const groupKey = `${line.deliveryItemDescription}|${line.orderNumber || ""}|${line.buyerPONumber || ""}|${line.packUOM}`

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        id: groupKey,
        itemDescription: line.deliveryItemDescription,
        orderNumber: line.orderNumber || null,
        buyerPONumber: line.buyerPONumber || null,
        uom: line.packUOM,
        minLineNumber: parseInt(line.deliveryLineNumber) || 0,
        lines: [],
        totals: {
          scheduled: 0,
          received: 0,
          returned: 0,
          rejected: 0
        },
        status: 'pending'
      })
    }

    const group = groupMap.get(groupKey)!
    group.lines.push(line)
    group.totals.scheduled += line.packQuantity

    // Track minimum line number for sorting
    const lineNum = parseInt(line.deliveryLineNumber) || 0
    if (lineNum < group.minLineNumber) {
      group.minLineNumber = lineNum
    }
  })

  // Convert to array and assign uniform indexing coordinates (100, 200, 300)
  const sortedGroups = Array.from(groupMap.values())
    .sort((a, b) => a.minLineNumber - b.minLineNumber)

  // Assign display indices
  sortedGroups.forEach((group, index) => {
    group.minLineNumber = (index + 1) * 100
  })

  return sortedGroups
}

// ============================================================================
// STATUS CALCULATION HELPER
// ============================================================================

// const calculateGroupStatus = (
//   received: number,
//   returned: number,
//   rejected: number,
//   scheduled: number
// ): 'accepted' | 'discrepancy' | 'pending' => {
//   // All zeros = pending
//   if (received === 0 && returned === 0 && rejected === 0) {
//     return 'pending'
//   }

//   // Perfect match = accepted
//   if (received === scheduled && returned === 0 && rejected === 0) {
//     return 'accepted'
//   }

//   // Any discrepancy or rejects/returns = discrepancy
//   return 'discrepancy'
// }

// ============================================================================
// STANDALINE ITEMS HELPER
// ============================================================================

const getStandaloneItems = (lines: DeliveryLine[]): DeliveryLine[] => {
  return lines.filter(line => !line.batchNumber || line.batchNumber.trim() === "")
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatDate = (ds: string) => new Date(ds).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })

const calculateLineData = (lineState: LineFormState, packQuantity: number, deliveryReceived: boolean): LineCalculation => {
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
  // A line is only considered "modified" if user changed values away from initial baseline
  // Initial baseline: when not received, all values start at 0 (pristine state)
  const isModified = deliveryReceived
    ? (returned > 0 || rejected > 0 || totalActual !== packQuantity || lineState.lineComment.trim() !== "")
    : (delivered > 0 || returned > 0 || rejected > 0 || lineState.lineComment.trim() !== "")

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
            <span>Quantity: <strong className="text-slate-700">{line.packQuantity} {transformUOM(line.packUOM)}</strong></span>
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

const ToastNotification = memo(({ show, type, onClose, title, message }: ToastNotificationProps) => {
  if (!show) return null

  const defaultTitles = {
    success: "Success",
    error: "Action Required",
    info: "Information"
  }

  const defaultMessages = {
    success: "Your changes have been saved.",
    error: "Please correct the highlighted issues.",
    info: ""
  }

  const displayTitle = title ?? defaultTitles[type]
  const displayMessage = message ?? defaultMessages[type]

  const typeStyles = {
    success: {
      border: "border-emerald-200",
      bg: "bg-emerald-100",
      iconColor: "text-emerald-600"
    },
    error: {
      border: "border-red-200",
      bg: "bg-red-100",
      iconColor: "text-red-600"
    },
    info: {
      border: "border-blue-200",
      bg: "bg-blue-100",
      iconColor: "text-blue-600"
    }
  }

  const styles = typeStyles[type]

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className={`bg-white border rounded-lg shadow-xl p-4 flex items-start gap-3 min-w-[300px] ${styles.border}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${styles.bg}`}>
          {type === "error" ? (
            <AlertTriangle className={`w-4 h-4 ${styles.iconColor}`} />
          ) : (
            <CheckCircle className={`w-4 h-4 ${styles.iconColor}`} />
          )}
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-slate-900">
            {displayTitle}
          </h4>
          {displayMessage && (
            <p className="text-xs text-slate-500 mt-0.5">
              {displayMessage}
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0 text-lg leading-none">
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
    <div className="fixed top-4 right-4 z-40 animate-in slide-in-from-top-4 fade-in duration-300">
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
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0 text-lg leading-none">
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
// ITEM GROUP ROW COMPONENT
// ============================================================================

interface ItemGroupRowProps {
  group: ItemGroup
  isExpanded: boolean
  isInvoiced: boolean
  isSubmitting: boolean
  linesMap: Map<string, LineFormState>
  onToggleExpansion: () => void
  onInputChange: (lineNumber: string, field: keyof LineFormState, value: string) => void
}

const ItemGroupRow = memo(({
  group,
  isExpanded,
  isInvoiced,
  isSubmitting,
  linesMap,
  onToggleExpansion,
  onInputChange
}: ItemGroupRowProps) => {
  // Calculate current totals from all child lines (read-only aggregation)
  const aggregatedValues = useMemo(() => {
    const totals = {
      delivered: 0,
      returned: 0,
      rejected: 0
    }

    group.lines.forEach((line) => {
      const lineState = linesMap.get(line.deliveryLineNumber)
      if (lineState) {
        totals.delivered += parseFloat(lineState.delivered) || 0
        totals.returned += parseFloat(lineState.returned) || 0
        totals.rejected += parseFloat(lineState.rejected) || 0
      }
    })

    return totals
  }, [linesMap, group.lines])

  // Calculate group status based on batch-level evaluation
  const groupStatus = useMemo(() => {
    let allAccepted = true
    let allPending = true

    group.lines.forEach((line) => {
      const lineState = linesMap.get(line.deliveryLineNumber)
      if (!lineState) return

      const delivered = parseFloat(lineState.delivered) || 0
      const returned = parseFloat(lineState.returned) || 0
      const rejected = parseFloat(lineState.rejected) || 0
      const scheduled = line.packQuantity

      // All zeros = pending
      if (delivered === 0 && returned === 0 && rejected === 0) {
        // Still pending, continue checking
      } else {
        allPending = false
      }

      // Perfect match = received equals scheduled, rejected/returned are 0
      if (delivered === scheduled && returned === 0 && rejected === 0) {
        // Accepted batch
      } else {
        allAccepted = false
      }
    })

    if (allPending) return 'pending'
    if (allAccepted) return 'accepted'
    return 'discrepancy'
  }, [linesMap, group.lines])

  // Calculate discrepancy percentage badge
  const discrepancyBadge = useMemo(() => {
    const totalReceived = aggregatedValues.delivered
    const totalIntended = group.totals.scheduled

    // Only calculate and render if total received > 0
    if (totalReceived <= 0) return null

    // Calculate variance percentage
    const rawVariance = ((totalIntended - totalReceived) / totalIntended) * 100
    const variancePercent = Math.abs(rawVariance).toFixed(1)

    // Determine badge style and text based on variance state
    if (rawVariance === 0) {
      // Perfect match
      return {
        text: `0.0% Discrepancy`,
        className: 'bg-emerald-50 text-emerald-700 border-emerald-100'
      }
    } else if (totalReceived < totalIntended) {
      // Short-delivery
      return {
        text: `⚠️ -${variancePercent}% Short`,
        className: 'bg-amber-50 text-amber-700 border-amber-200'
      }
    } else {
      // Over-delivery
      return {
        text: `📦 +${variancePercent}% Surplus`,
        className: 'bg-blue-50 text-blue-700 border-blue-200'
      }
    }
  }, [aggregatedValues.delivered, group.totals.scheduled])

  const statusConfig = {
    accepted: { color: 'bg-emerald-50 border-emerald-200 text-emerald-700', label: 'Accepted' },
    discrepancy: { color: 'bg-amber-50 border-amber-200 text-amber-700', label: 'Discrepancy' },
    pending: { color: 'bg-slate-50 border-slate-200 text-slate-500', label: 'Pending' }
  }

  const statusStyle = statusConfig[groupStatus]
  const lineNoDisplay = `Line No. ${group.minLineNumber}`

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      {/* Parent ItemGroup Row */}
      <button
        type="button"
        onClick={onToggleExpansion}
        className="w-full p-4 flex items-start gap-4 hover:bg-blue-5/30 transition-colors text-left bg-white"
      >
        {/* Expand/Collapse Icon */}
        <div className="w-8 h-8 rounded-lg bg-blue-5 flex items-center justify-center shrink-0">
          <Package className="w-4 h-4 text-[#1d2351]" />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header with Description and Line Number */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              {/* First Row: Line Number + Item Description + Badges */}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-bold text-[#1d2351] bg-blue-5 px-2 py-1 rounded-md shrink-0">
                  {lineNoDisplay}
                </span>
                <span className="text-sm font-semibold text-slate-900">{group.itemDescription}</span>
                <Badge className={`text-[10px] px-2 py-0.5 border ${statusStyle.color}`}>
                  {statusStyle.label}
                </Badge>
                {discrepancyBadge && (
                  <Badge className={`text-[10px] px-2 py-0.5 border ${discrepancyBadge.className}`}>
                    {discrepancyBadge.text}
                  </Badge>
                )}
              </div>

              {/* Order/PO Info */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                {group.orderNumber && (
                  <span>Order: <strong className="text-slate-700">{group.orderNumber}</strong></span>
                )}
                {group.buyerPONumber && (
                  <span>PO: <strong className="text-slate-700">{group.buyerPONumber}</strong></span>
                )}
                <span>UOM: <strong className="text-slate-700">{transformUOM(group.uom)}</strong></span>
                <span>Batches: <strong className="text-slate-700">{group.lines.length}</strong></span>
              </div>
            </div>
          </div>

          {/* Four-Metric Financial/Inventory Audit Display (Read-Only) */}
          <div className="grid grid-cols-4 gap-2 mt-2">
            <div className="bg-slate-50 rounded border border-slate-200 p-2 space-y-1">
              <div className="text-[10px] font-medium text-slate-500 uppercase">Quantity</div>
              <div className="text-sm font-bold text-slate-900">{group.totals.scheduled.toFixed(2)}</div>
              <div className="text-[10px] text-slate-400">{transformUOM(group.uom)}</div>
            </div>
            <div className="bg-slate-50 rounded border border-slate-200 p-2 space-y-1">
              <div className="text-[10px] font-medium text-slate-500 uppercase">Total Received</div>
              <div className="text-sm font-bold text-emerald-700">{aggregatedValues.delivered.toFixed(2)}</div>
              <div className="text-[10px] text-slate-400">{transformUOM(group.uom)}</div>
            </div>
            <div className="bg-slate-50 rounded border border-slate-200 p-2 space-y-1">
              <div className="text-[10px] font-medium text-slate-500 uppercase">Total Rejected</div>
              <div className="text-sm font-bold text-amber-700">{aggregatedValues.rejected.toFixed(2)}</div>
              <div className="text-[10px] text-slate-400">{transformUOM(group.uom)}</div>
            </div>
            <div className="bg-slate-50 rounded border border-slate-200 p-2 space-y-1">
              <div className="text-[10px] font-medium text-slate-500 uppercase">Total Returned</div>
              <div className="text-sm font-bold text-red-700">{aggregatedValues.returned.toFixed(2)}</div>
              <div className="text-[10px] text-slate-400">{transformUOM(group.uom)}</div>
            </div>
          </div>
        </div>

        {/* Expand/Collapse Icon */}
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 ml-2">
          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
        </div>
      </button>

      {/* Expanded Child Rows - High-Density Side-by-Side Layout */}
      {isExpanded && (
        <div className="px-4 pb-3 pt-2 bg-slate-50/50 border-t border-slate-100 animate-in slide-in-from-top-1">
          <div className="space-y-2">
            {group.lines.map((line) => {
              const lineState = linesMap.get(line.deliveryLineNumber)
              if (!lineState) return null

              return (
                <div
                  key={line.deliveryLineNumber}
                  className="bg-white rounded-lg border border-slate-200 p-2"
                >
                  {/* Single-row side-by-side layout */}
                  <div className="flex items-center gap-3">
                    {/* Left Side: Informational Details */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-6 h-6 rounded bg-blue-50 flex items-center justify-center shrink-0">
                        <Package className="w-3 h-3 text-[#1d2351]" />
                      </div>
                      <div className="flex items-center gap-x-2 gap-y-1 text-xs text-slate-600 flex-wrap">
                        <span className="font-medium text-slate-900">{line.deliveryItemDescription}</span>
                        <span className="text-slate-300">|</span>
                        <span>Qty: <strong className="text-slate-700">{line.packQuantity} {transformUOM(line.packUOM)}</strong></span>
                        <span className="text-slate-300">|</span>
                        <span>Batch: <strong className="font-mono text-slate-700">{line.batchNumber}</strong></span>
                        {group.orderNumber && (
                          <>
                            <span className="text-slate-300">|</span>
                            <span>Order: <strong className="text-slate-700">{group.orderNumber}</strong></span>
                          </>
                        )}
                        {group.buyerPONumber && (
                          <>
                            <span className="text-slate-300">|</span>
                            <span>PO: <strong className="text-slate-700">{group.buyerPONumber}</strong></span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right Side: Interactive Form Controls */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        <div className="space-y-0">
                          <Label className="text-[9px] font-medium text-slate-500 uppercase block mb-0.5">Received</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={lineState.delivered}
                            onChange={(e) => onInputChange(line.deliveryLineNumber, 'delivered', e.target.value)}
                            disabled={isInvoiced || isSubmitting}
                            className="h-7 w-16 text-xs border-slate-300 focus:border-[#1d2351] focus:ring-[#1d2351] px-2"
                          />
                        </div>
                        <div className="space-y-0">
                          <Label className="text-[9px] font-medium text-slate-500 uppercase block mb-0.5">Rejected</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={lineState.rejected}
                            onChange={(e) => onInputChange(line.deliveryLineNumber, 'rejected', e.target.value)}
                            disabled={isInvoiced || isSubmitting}
                            className="h-7 w-16 text-xs border-slate-300 focus:border-[#1d2351] focus:ring-[#1d2351] px-2"
                          />
                        </div>
                        <div className="space-y-0">
                          <Label className="text-[9px] font-medium text-slate-500 uppercase block mb-0.5">Returned</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={lineState.returned}
                            onChange={(e) => onInputChange(line.deliveryLineNumber, 'returned', e.target.value)}
                            disabled={isInvoiced || isSubmitting}
                            className="h-7 w-16 text-xs border-slate-300 focus:border-[#1d2351] focus:ring-[#1d2351] px-2"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes Field for this batch - compact */}
                  <div className="mt-2 flex items-center gap-2">
                    <Label className="text-[10px] font-medium text-slate-500 uppercase shrink-0">Notes:</Label>
                    <Input
                      type="text"
                      value={lineState.lineComment}
                      onChange={(e) => onInputChange(line.deliveryLineNumber, 'lineComment', e.target.value)}
                      disabled={isInvoiced || isSubmitting}
                      placeholder="Add notes for this batch..."
                      className="h-7 text-xs border-slate-300 focus:border-[#1d2351] focus:ring-[#1d2351]"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
})

ItemGroupRow.displayName = "ItemGroupRow"

// ============================================================================
// DASHBOARD SUMMARY CARD COMPONENT
// ============================================================================

interface DashboardSummaryProps {
  totalItems: number
  totalBatches: number
  summaries: {
    accepted: number
    discrepancy: number
    pending: number
  }
}

const DashboardSummary = memo(({ totalItems, totalBatches, summaries }: DashboardSummaryProps) => {
  return (
    <div className="bg-gradient-to-br from-[#1d2351] to-[#2a3266] rounded-xl p-5 shadow-lg shadow-[#1d2351]/20">
      <div className="grid grid-cols-4 gap-4 sm:gap-6">
        {/* Total Items */}
        <div className="text-center">
          <div className="text-3xl font-bold text-white mb-1">{totalItems}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-blue-200">Total Items</div>
        </div>

        {/* Total Batches */}
        <div className="text-center">
          <div className="text-3xl font-bold text-white mb-1">{totalBatches}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-blue-200">Total Batches</div>
        </div>

        {/* Status Indicators */}
        <div className="col-span-2 grid grid-cols-3 gap-2">
          {/* Accepted */}
          <div className="bg-emerald-500/20 rounded-lg p-3 text-center border border-emerald-400/30">
            <div className="text-2xl font-bold text-emerald-300">{summaries.accepted}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-emerald-200">Accepted</div>
          </div>

          {/* Discrepancy */}
          <div className="bg-amber-500/20 rounded-lg p-3 text-center border border-amber-400/30">
            <div className="text-2xl font-bold text-amber-300">{summaries.discrepancy}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-amber-200">Discrepancy</div>
          </div>

          {/* Pending */}
          <div className="bg-slate-400/20 rounded-lg p-3 text-center border border-slate-300/30">
            <div className="text-2xl font-bold text-slate-300">{summaries.pending}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-200">Pending</div>
          </div>
        </div>
      </div>
    </div>
  )
})

DashboardSummary.displayName = "DashboardSummary"

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DeliveryReceivePage() {
  const { token } = useParams<{ token: string }>()
  // const [isPending, startTransition] = useTransition()

  // Core state
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // UI state
  const [showToast, setShowToast] = useState(false)
  const [toastType, setToastType] = useState<"success" | "error" | "info">("success")
  const [toastTitle, setToastTitle] = useState<string | undefined>(undefined)
  const [toastMessage, setToastMessage] = useState<string | undefined>(undefined)

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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)

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

      calcMap.set(line.deliveryLineNumber, calculateLineData(lineState, line.packQuantity, delivery.received))
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

  // ============================================================================
  // ITEM GROUPS & DASHBOARD SUMMARIES
  // ============================================================================

  // Create ItemGroups from delivery lines (memoized)
  const itemGroups = useMemo(() => {
    if (!delivery) return []
    return createItemGroups(delivery.lines)
  }, [delivery?.lines])

  // Get standalone items (non-batched)
  const standaloneItems = useMemo(() => {
    if (!delivery) return []
    return getStandaloneItems(delivery.lines)
  }, [delivery?.lines])

  // Total root elements (ItemGroups + Standalone Items)
  const totalRootElements = useMemo(() => {
    return itemGroups.length + standaloneItems.length
  }, [itemGroups.length, standaloneItems.length])

  // Total concrete batches (all delivery lines)
  const totalBatches = useMemo(() => {
    return delivery?.lines.length || 0
  }, [delivery?.lines.length])

  // Dashboard status summaries with live calculation - evaluated at granular batch level
  const dashboardSummaries = useMemo(() => {
    const summaries = {
      accepted: 0,
      discrepancy: 0,
      pending: 0
    }

    // Evaluate each individual batch line directly from form state
    delivery?.lines.forEach((line) => {
      const lineState = linesMap.get(line.deliveryLineNumber)
      if (!lineState) {
        // No form state = pending
        summaries.pending++
        return
      }

      const delivered = parseFloat(lineState.delivered) || 0
      const returned = parseFloat(lineState.returned) || 0
      const rejected = parseFloat(lineState.rejected) || 0
      const targetQty = line.packQuantity // Original expected delivery quantity

      // Pending: untouched row (all zeros)
      if (delivered === 0 && rejected === 0 && returned === 0) {
        summaries.pending++
      }
      // Accepted: perfectly matched row (received == target, rejected/returned are 0)
      else if (delivered === targetQty && rejected === 0 && returned === 0) {
        summaries.accepted++
      }
      // Discrepancy: any variance, short-delivery, rejection, or return
      else {
        summaries.discrepancy++
      }
    })

    return summaries
  }, [delivery?.lines, linesMap])

  // Enhanced search with OrderNumber, BuyerPONumber, BatchNumber
  const searchFilter = useCallback((line: DeliveryLine | ItemGroup): boolean => {
    if (!deferredSearchQuery) return true

    const searchLower = deferredSearchQuery.toLowerCase()

    // For ItemGroup
    if ('lines' in line) {
      const group = line as ItemGroup
      return (
        group.itemDescription.toLowerCase().includes(searchLower) ||
        (group.orderNumber || "").toLowerCase().includes(searchLower) ||
        (group.buyerPONumber || "").toLowerCase().includes(searchLower) ||
        group.lines.some(l => (l.batchNumber || "").toLowerCase().includes(searchLower))
      )
    }

    // For DeliveryLine
    const l = line as DeliveryLine
    return (
      l.deliveryItemDescription.toLowerCase().includes(searchLower) ||
      (l.orderNumber || "").toLowerCase().includes(searchLower) ||
      (l.buyerPONumber || "").toLowerCase().includes(searchLower) ||
      (l.batchNumber || "").toLowerCase().includes(searchLower)
    )
  }, [deferredSearchQuery])

  // Filter ItemGroups and standalone items
  const filteredItemGroups = useMemo(() => {
    return itemGroups.filter(searchFilter)
  }, [itemGroups, searchFilter])

  const filteredStandaloneItems = useMemo(() => {
    return standaloneItems.filter(searchFilter)
  }, [standaloneItems, searchFilter])

  // Combined filtered list with ItemGroups first, then standalone items
  const allFilteredItems = useMemo(() => {
    return [...filteredItemGroups, ...filteredStandaloneItems]
  }, [filteredItemGroups, filteredStandaloneItems])

  // Pagination - get current page items
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return allFilteredItems.slice(startIndex, endIndex)
  }, [allFilteredItems, currentPage])

  const totalPages = Math.ceil(allFilteredItems.length / ITEMS_PER_PAGE)

  // Photo URLs memoization
  const photoUrls = useMemo(() => {
    return photoFiles.map(file => URL.createObjectURL(file))
  }, [photoFiles])

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [deferredSearchQuery, activeTab])

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
          delivered: !delivery.received ? "0" : (line.packQuantityDelivered.toString() === "0" ? line.packQuantity.toString() : line.packQuantityDelivered.toString()),
          returned: line.packQuantityReturned.toString(),
          rejected: line.packQuantityRejected.toString(),
          lineComment: line.lineComment || ""
        }
        newMap.set(line.deliveryLineNumber, lineState)

        // Check if it's an issue line
        const calc = calculateLineData(lineState, line.packQuantity, delivery.received)
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
              const calc = calculateLineData(updated, line.packQuantity, deliveryRef.current?.received || false)
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

  // Toggle ItemGroup expansion
  const toggleGroupExpansion = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
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
      setToastTitle("Receipt Posted Successfully")
      setToastMessage("Warehouse inventory registers have been updated.")
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
        <Card className="w-full max-w-md shadow-sm border border-slate-200/80 rounded-xl bg-white">
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

            <Card className="shadow-sm border border-slate-200/80 rounded-xl bg-white">
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

        {/* Delivery Info Card */}
        <Card className="shadow-sm border border-slate-200/80 rounded-xl bg-white">
          <CardHeader className="px-4 py-3 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-800" />
              Delivery Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* Optimized layout with 3 columns across all screen sizes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Delivery Number</p>
                <p className="text-sm font-semibold text-slate-900">{delivery.deliveryNumber}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Customer Name</p>
                <p className="text-sm font-semibold text-slate-900">{delivery.customerName || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Delivery Date</p>
                <p className="text-sm font-semibold text-slate-900">{formatDate(delivery.deliveryDate)}</p>
              </div>
            </div>

            {/* Shipping Notes and Ship To Address - Side by Side */}
            {(delivery.deliveryRemarks || delivery.shipToAddress) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                {delivery.deliveryRemarks && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Shipping Notes</p>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <p className="text-sm text-slate-900">{delivery.deliveryRemarks}</p>
                    </div>
                  </div>
                )}
                {delivery.shipToAddress && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Ship To Address</p>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <p className="text-sm text-slate-900">{delivery.shipToAddress}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receiver Info */}
        <Card className="shadow-sm border border-slate-200/80 rounded-xl bg-white">
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

          {/* Dashboard Summary */}
          <DashboardSummary
            totalItems={totalRootElements}
            totalBatches={totalBatches}
            summaries={dashboardSummaries}
          />

          {/* Items List */}
          <Card className="shadow-sm border border-slate-200/80 rounded-xl bg-white overflow-hidden">
            <div className="p-4 border-b border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-800">Line Items</CardTitle>
                <span className="text-xs text-slate-500">{allFilteredItems.length} of {delivery.lines.length}</span>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by Description, Order #, PO #, Batch..."
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
                  All Items ({allFilteredItems.length})
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

            {/* Items List with ItemGroups and Standalone Items */}
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {allFilteredItems.length === 0 ? (
                <div className="p-8 text-center">
                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No items found</p>
                </div>
              ) : (
                <>
                  {paginatedItems.map((item) => {
                    if ('lines' in item) {
                      // ItemGroup
                      const group = item as ItemGroup
                      const isExpanded = expandedGroups.has(group.id)
                      return (
                        <ItemGroupRow
                          key={group.id}
                          group={group}
                          isExpanded={isExpanded}
                          isInvoiced={delivery.invoiced}
                          isSubmitting={submitting}
                          linesMap={linesMap}
                          onToggleExpansion={() => toggleGroupExpansion(group.id)}
                          onInputChange={(lineNumber, field, value) => updateLineField(lineNumber, field, value)}
                        />
                      )
                    } else {
                      // Standalone line
                      const line = item as DeliveryLine
                      const lineState = linesMap.get(line.deliveryLineNumber) || {
                        delivered: line.packQuantity.toString(),
                        returned: "0",
                        rejected: "0",
                        lineComment: ""
                      }
                      const calc = calculationsMap.get(line.deliveryLineNumber) || calculateLineData(lineState, line.packQuantity, delivery.received)
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
                    }
                  })}
                </>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-4">
                <span className="text-xs text-slate-500">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0 border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0 border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Photo Upload */}
          <Card className="shadow-sm border border-slate-200/80 rounded-xl bg-white">
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
      <ToastNotification
        show={showToast}
        type={toastType}
        title={toastTitle}
        message={toastMessage}
        onClose={() => {
          setShowToast(false)
          setToastTitle(undefined)
          setToastMessage(undefined)
        }}
      />

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
