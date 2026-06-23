import { useState, useEffect, useMemo, memo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import QRCode from "qrcode"
import { CheckCircle, AlertTriangle, Package, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "../../shared/components/ui/Button"
import { Badge } from "../../shared/components/ui/Badge"
import { Card, CardContent, CardHeader, CardTitle } from "../../shared/components/ui/Card"
import { Input } from "../../shared/components/ui/Input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../shared/components/ui/Table"
import { Pagination } from "../../shared/components/ui/Pagination"
import { useApi } from "../../shared/utils/api"

interface DeliveryLine {
  deliveryLineNumber: string
  parentLineNumber?: string | null
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

interface DeliveryPhoto {
  fileName: string
  storageKey: string
  downloadUrl: string
  uploadedAt: string
}

interface DeliveryDetail {
  deliveryID: number
  deliveryNumber: string
  deliveryDate: string
  deliveryRemarks: string | null
  shipToAddress?: string | null
  customerCode: string
  customerName: string
  orderNumber?: string | null
  buyerPONumber?: string | null
  receiverToken: string
  receiverName: string | null
  receiverNotes: string | null
  received: boolean
  receiveDate?: string | null
  invoiced: boolean
  invoiceNumber?: string | null // 🆕 Added: SAP invoice number from backend
  publicUrl: string
  plant?: string | null
  type?: number | null
  status?: number | null
  cancelReason?: string | null // 🚀 Added: backend cancel reason trace mapping
  salesPersonName?: string | null
  salesPersonEmail?: string | null
  latitude?: number | null
  longitude?: number | null
  province?: string | null
  cityRegency?: string | null
  district?: string | null
  formattedAddress?: string | null
  photos?: DeliveryPhoto[]
  lines: DeliveryLine[]
}

// 🆕 Toast notification interface
interface ToastNotificationProps {
  show: boolean
  type: "success" | "error" | "info"
  title?: string
  message?: string
  onClose: () => void
}

// ============================================================================
// LINE ITEM GROUPING TYPES
// ============================================================================

// Type for single-batch line items
interface SingleBatchLineItem {
  type: 'single-batch'
  line: DeliveryLine
}

// Type for split-batch line items with children
interface SplitBatchLineItem {
  type: 'split-batch'
  parentLine: DeliveryLine
  children: DeliveryLine[]
  aggregatedTotals: {
    scheduled: number
    delivered: number
    returned: number
    rejected: number
  }
}

// Union type for displayable line items
type DisplayableLineItem = SingleBatchLineItem | SplitBatchLineItem

const LINES_PER_PAGE = 10

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const transformUOM = (uom: string | null | undefined): string => {
  if (!uom) return ''
  const uomMap: Record<string, string> = {
    'ROL': 'Roll',
    'PCS': 'Pcs',
    'KG': 'kg',
    'M': 'm',
    'MTR': 'mtr',
    'EA': 'ea',
  }
  return uomMap[uom.toUpperCase()] || uom
}

/**
 * Transforms flat delivery lines into the new 3-condition architecture:
 *
 * Condition 1: Parent Single Batch
 *   - Has batchNumber (regardless of children existence), OR
 *   - No batchNumber AND no children (standalone item without batch info)
 *   - Displays as standalone row with unified visual style
 *
 * Condition 2: Parent with Split Batch
 *   - No batchNumber AND has children (actual split scenario)
 *   - Displays as read-only summary with expandable children
 *
 * Condition 3: Child Lines (parentLineNumber matches parent's deliveryLineNumber)
 *   - Nested under their parent
 */
const buildLineItemTree = (lines: DeliveryLine[]): DisplayableLineItem[] => {
  const result: DisplayableLineItem[] = []

  // Separate parent lines from child lines
  const parentLines = lines.filter(
    line => !line.parentLineNumber || line.parentLineNumber === "0"
  )
  const childLines = lines.filter(
    line => line.parentLineNumber && line.parentLineNumber !== "0"
  )

  // Create a map for quick child lookup
  const childrenMap = new Map<string, DeliveryLine[]>()
  childLines.forEach(child => {
    const parentLineNumber = child.parentLineNumber!
    if (!childrenMap.has(parentLineNumber)) {
      childrenMap.set(parentLineNumber, [])
    }
    childrenMap.get(parentLineNumber)!.push(child)
  })

  // Process each parent line
  parentLines.forEach(parentLine => {
    const hasBatchNumber = parentLine.batchNumber && parentLine.batchNumber.trim() !== ""
    const children = childrenMap.get(parentLine.deliveryLineNumber) || []

    // Unified single-batch condition:
    // - Has batch number (regardless of children), OR
    // - No batch number AND no children (standalone item without batch info)
    if (hasBatchNumber || children.length === 0) {
      // Condition 1: Parent Single Batch - standalone row
      result.push({
        type: 'single-batch',
        line: parentLine
      })
    } else {
      // Condition 2: Parent with Split Batch - read-only summary with children
      result.push({
        type: 'split-batch',
        parentLine: parentLine,
        children: children,
        aggregatedTotals: {
          scheduled: children.reduce((sum, child) => sum + child.packQuantity, 0) + parentLine.packQuantity,
          delivered: children.reduce((sum, child) => sum + child.packQuantityDelivered, 0) + parentLine.packQuantityDelivered,
          returned: children.reduce((sum, child) => sum + child.packQuantityReturned, 0) + parentLine.packQuantityReturned,
          rejected: children.reduce((sum, child) => sum + child.packQuantityRejected, 0) + parentLine.packQuantityRejected,
        }
      })
    }
  })

  // Sort by deliveryLineNumber for consistent display
  result.sort((a, b) => {
    const lineNumA = a.type === 'single-batch' ? a.line.deliveryLineNumber : a.parentLine.deliveryLineNumber
    const lineNumB = b.type === 'single-batch' ? b.line.deliveryLineNumber : b.parentLine.deliveryLineNumber
    return parseInt(lineNumA) - parseInt(lineNumB)
  })

  return result
}

// ============================================================================
// GROUPED LINE ITEM ROW COMPONENTS
// ============================================================================

// Props for single-batch row component
interface SingleBatchRowProps {
  line: DeliveryLine
  received: boolean
  canceled: boolean
}

const SingleBatchDetailRow = memo(({ line, received, canceled }: SingleBatchRowProps) => {
  const totalReceived = line.packQuantityDelivered + line.packQuantityReturned + line.packQuantityRejected
  const rawVariance = totalReceived - line.packQuantity
  const variancePercent = line.packQuantity > 0 ? ((rawVariance / line.packQuantity) * 100).toFixed(2) : "0.00"
  const isOver = parseFloat(variancePercent) > 0
  const isShort = parseFloat(variancePercent) < 0
  const displayVariance = isOver ? `+${variancePercent}%` : `${variancePercent}%`

  const getVarianceBadge = () => {
    if (!received || canceled) {
      return <span className="text-brand-blue/40">—</span>
    }
    if (isShort) {
      return <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded text-xs">{displayVariance}</span>
    }
    if (isOver) {
      return <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded text-xs">{displayVariance}</span>
    }
    return <span className="text-brand-blue/40">0%</span>
  }

  return (
    <TableRow className="hover:bg-brand-blue/[0.01] transition-colors">
      <TableCell className="py-3.5" colSpan={received ? 9 : 8}>
        <div className="flex items-center gap-3">
          {/* Icon Container - Same styling as split-batch parent */}
          <div className="w-8 h-8 rounded-lg bg-blue-5 flex items-center justify-center shrink-0">
            <Package className="w-4 h-4 text-[#1d2351]" />
          </div>

          {/* Main Content - Unified structure */}
          <div className="flex-1">
            {/* First Row: Line Number + Item Description */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-[#1d2351] bg-blue-5 px-2 py-1 rounded-md">
                Line #{line.deliveryLineNumber}
              </span>
              <span className="text-sm font-semibold text-slate-900">{line.deliveryItemDescription}</span>
              <span className="text-xs text-slate-500">(1 batch)</span>
            </div>

            {/* Second Row: Order/PO Info + Batch */}
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>Order: <strong className="text-slate-700">{line.orderNumber || '-'}</strong></span>
              <span>PO: <strong className="text-slate-700">{line.buyerPONumber || '-'}</strong></span>
              {line.batchNumber && (
                <span>Batch: <strong className="text-slate-700">{line.batchNumber}</strong></span>
              )}
            </div>
          </div>

          {/* Right Side: Metrics Display - Same layout as split-batch */}
          <div className="flex items-center gap-4 text-right">
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-medium">Quantity</div>
              <div className="text-sm font-bold text-slate-900">{line.packQuantity}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-medium">Received</div>
              <div className="text-sm font-bold text-emerald-600">{canceled ? 0 : line.packQuantityDelivered}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-medium">Rejected</div>
              <div className="text-sm font-bold text-amber-600">{canceled ? 0 : line.packQuantityRejected}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-medium">Returned</div>
              <div className="text-sm font-bold text-red-600">{canceled ? 0 : line.packQuantityReturned}</div>
            </div>
            {received && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-medium">Variance</div>
                <div className="text-sm font-semibold">{getVarianceBadge()}</div>
              </div>
            )}
            {/* Remarks indicator */}
            <div className="text-xs text-brand-blue/60 font-medium">
              {canceled ? (
                <span className="text-rose-500/80">Link Revoked</span>
              ) : line.lineComment ? (
                <span className="text-brand-blue/60 max-w-[150px] truncate">{line.lineComment}</span>
              ) : null}
            </div>
          </div>

          {/* Static indicator (no toggle for single-batch) */}
          <div className="shrink-0 ml-2">
            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-[#1d2351]" />
            </div>
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
})

SingleBatchDetailRow.displayName = "SingleBatchDetailRow"

// Props for split-batch parent row component
interface SplitBatchParentRowProps {
  parentLine: DeliveryLine
  children: DeliveryLine[]
  aggregatedTotals: {
    scheduled: number
    delivered: number
    returned: number
    rejected: number
  }
  received: boolean
  canceled: boolean
}

const SplitBatchParentDetailRow = memo(({
  parentLine,
  children,
  aggregatedTotals,
  received,
  canceled
}: SplitBatchParentRowProps) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const totalReceived = aggregatedTotals.delivered + aggregatedTotals.returned + aggregatedTotals.rejected
  const rawVariance = totalReceived - aggregatedTotals.scheduled
  const variancePercent = aggregatedTotals.scheduled > 0 ? ((rawVariance / aggregatedTotals.scheduled) * 100).toFixed(2) : "0.00"
  const isOver = parseFloat(variancePercent) > 0
  const isShort = parseFloat(variancePercent) < 0
  const displayVariance = isOver ? `+${variancePercent}%` : `${variancePercent}%`

  const getVarianceBadge = () => {
    if (!received || canceled) {
      return <span className="text-brand-blue/40">—</span>
    }
    if (isShort) {
      return <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded text-xs">{displayVariance}</span>
    }
    if (isOver) {
      return <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded text-xs">{displayVariance}</span>
    }
    return <span className="text-brand-blue/40">0%</span>
  }

  return (
    <>
      {/* Parent Summary Row */}
      <TableRow
        className="hover:bg-brand-blue/[0.01] transition-colors cursor-pointer bg-brand-blue/[0.02]"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <TableCell className="py-3.5" colSpan={received ? 9 : 8}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-5 flex items-center justify-center shrink-0">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-[#1d2351]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#1d2351]" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-[#1d2351] bg-blue-5 px-2 py-1 rounded-md">
                  Line #{parentLine.deliveryLineNumber}
                </span>
                <span className="text-sm font-semibold text-slate-900">{parentLine.deliveryItemDescription}</span>
                <span className="text-xs text-slate-500">({children.length + 1} batches)</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>Order: <strong className="text-slate-700">{parentLine.orderNumber || '-'}</strong></span>
                <span>PO: <strong className="text-slate-700">{parentLine.buyerPONumber || '-'}</strong></span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-medium">Total Qty</div>
                <div className="text-sm font-bold text-slate-900">{aggregatedTotals.scheduled.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-medium">Received</div>
                <div className="text-sm font-bold text-emerald-600">{canceled ? 0 : aggregatedTotals.delivered.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-medium">Rejected</div>
                <div className="text-sm font-bold text-amber-600">{canceled ? 0 : aggregatedTotals.rejected.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-medium">Returned</div>
                <div className="text-sm font-bold text-red-600">{canceled ? 0 : aggregatedTotals.returned.toFixed(2)}</div>
              </div>
              {received && (
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-medium">Variance</div>
                  <div className="text-sm font-semibold">{getVarianceBadge()}</div>
                </div>
              )}
            </div>
          </div>
        </TableCell>
      </TableRow>

      {/* Child Rows - Expanded */}
      {isExpanded && children.map((child) => {
        const childTotal = child.packQuantityDelivered + child.packQuantityReturned + child.packQuantityRejected
        const childRawVariance = childTotal - child.packQuantity
        const childVariancePercent = child.packQuantity > 0 ? ((childRawVariance / child.packQuantity) * 100).toFixed(2) : "0.00"
        const childIsOver = parseFloat(childVariancePercent) > 0
        const childIsShort = parseFloat(childVariancePercent) < 0
        const childDisplayVariance = childIsOver ? `+${childVariancePercent}%` : `${childVariancePercent}%`

        const getChildVarianceBadge = () => {
          if (!received || canceled) {
            return <span className="text-brand-blue/40">—</span>
          }
          if (childIsShort) {
            return <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded text-xs">{childDisplayVariance}</span>
          }
          if (childIsOver) {
            return <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded text-xs">{childDisplayVariance}</span>
          }
          return <span className="text-brand-blue/40">0%</span>
        }

        return (
          <TableRow key={child.deliveryLineNumber} className="bg-brand-blue/[0.01]">
            <TableCell className="py-3" colSpan={received ? 9 : 8}>
              <div className="flex items-center gap-3 pl-4">
                {/* Icon Container - Same styling, slightly smaller for child */}
                <div className="w-7 h-7 rounded-lg bg-blue-5 flex items-center justify-center shrink-0">
                  <Package className="w-3.5 h-3.5 text-[#1d2351]" />
                </div>

                {/* Main Content - Unified structure */}
                <div className="flex-1">
                  {/* First Row: Item Code + Description */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-600 px-2 py-0.5 rounded-md bg-slate-100">
                      {child.deliveryItemCode}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{child.deliveryItemDescription}</span>
                  </div>

                  {/* Second Row: Batch Number */}
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>Batch: <strong className="text-slate-700 font-mono">{child.batchNumber}</strong></span>
                    <span>Qty: <strong className="text-slate-700">{child.packQuantity} {child.packUOM}</strong></span>
                  </div>
                </div>

                {/* Right Side: Metrics Display - Same layout */}
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-medium">Received</div>
                    <div className="text-sm font-bold text-emerald-600">{canceled ? 0 : child.packQuantityDelivered}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-medium">Rejected</div>
                    <div className="text-sm font-bold text-amber-600">{canceled ? 0 : child.packQuantityRejected}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-medium">Returned</div>
                    <div className="text-sm font-bold text-red-600">{canceled ? 0 : child.packQuantityReturned}</div>
                  </div>
                  {received && (
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-medium">Variance</div>
                      <div className="text-sm font-semibold">{getChildVarianceBadge()}</div>
                    </div>
                  )}
                  {/* Remarks */}
                  <div className="text-xs text-brand-blue/60 font-medium">
                    {canceled ? (
                      <span className="text-rose-500/80">Link Revoked</span>
                    ) : child.lineComment ? (
                      <span className="text-brand-blue/60 max-w-[150px] truncate">{child.lineComment}</span>
                    ) : null}
                  </div>
                </div>

                {/* Static indicator */}
                <div className="shrink-0 ml-1">
                  <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  </div>
                </div>
              </div>
            </TableCell>
          </TableRow>
        )
      })}
    </>
  )
})

SplitBatchParentDetailRow.displayName = "SplitBatchParentDetailRow"

// 🆕 Toast notification component (memoized)
const ToastNotification = memo(({ show, type, onClose, title, message }: ToastNotificationProps) => {
  if (!show) return null

  const defaultTitles = {
    success: "Success",
    error: "Action Required",
    info: "Information"
  }

  const displayTitle = title ?? defaultTitles[type]

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
          {message && (
            <p className="text-xs text-slate-500 mt-0.5">
              {message}
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

export function DeliveryDetailPage() {
  const { deliveryId } = useParams<{ deliveryId: string }>()
  const navigate = useNavigate()
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [linePage, setLinePage] = useState(1)

  // 🆕 SAP invoice generation state
  const [processingBilling, setProcessingBilling] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastType, setToastType] = useState<"success" | "error" | "info">("success")
  const [toastTitle, setToastTitle] = useState<string | undefined>(undefined)
  const [toastMessage, setToastMessage] = useState<string | undefined>(undefined)

  const api = useApi()

  // Build grouped line items tree
  const groupedLineItems = useMemo(() => {
    if (!delivery?.lines) return []
    return buildLineItemTree(delivery.lines)
  }, [delivery?.lines])

  // Calculate pagination for grouped line items
  const totalGroupedItems = groupedLineItems.length
  const totalLinePages = Math.ceil(totalGroupedItems / LINES_PER_PAGE)

  const paginatedGroupedItems = useMemo(() => {
    const startIndex = (linePage - 1) * LINES_PER_PAGE
    return groupedLineItems.slice(startIndex, startIndex + LINES_PER_PAGE)
  }, [groupedLineItems, linePage])

  // Count total physical batches for display
  const totalPhysicalBatches = useMemo(() => {
    if (!delivery?.lines) return 0
    let count = 0
    delivery.lines.forEach((line) => {
      const isParent = !line.parentLineNumber || line.parentLineNumber === "0"
      const hasBatchNumber = line.batchNumber && line.batchNumber.trim() !== ""

      // Count if: child line OR (parent with batch number) OR (parent without batch but no children)
      // Parent without batch but with children = don't count (it's a summary header)
      if (!isParent || hasBatchNumber) {
        count++
      }
    })
    return count
  }, [delivery?.lines])

  // Reset line page when delivery changes
  useEffect(() => {
    setLinePage(1)
  }, [deliveryId])

  // 🆕 Toast auto-dismiss
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [showToast])

  useEffect(() => {
    const fetchDeliveryDetail = async () => {
      if (!deliveryId) return

      try {
        const res = await api.get(`/api/deliveries/${deliveryId}`)
        if (!res.ok) {
          throw new Error("Delivery not found")
        }
        const data: DeliveryDetail = await res.json()
        setDelivery(data)

        // Generate QR code in frontend if not canceled
        if (data.publicUrl && data.status !== 3) {
          const qrDataUrl = await QRCode.toDataURL(data.publicUrl, {
            width: 200,
            margin: 1,
            color: {
              dark: "#1d2351",
              light: "#ffffff",
            },
          })
          setQrCode(qrDataUrl)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch delivery")
      } finally {
        setLoading(false)
      }
    }

    fetchDeliveryDetail()
  }, [deliveryId])

  const handleCopyUrl = async () => {
    if (delivery?.publicUrl) {
      await navigator.clipboard.writeText(delivery.publicUrl)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  const handleOpenLink = () => {
    if (delivery?.publicUrl) {
      window.open(delivery.publicUrl, "_blank")
    }
  }

  const handleDownloadQr = () => {
    if (qrCode && delivery) {
      const link = document.createElement("a")
      link.href = qrCode
      link.download = `delivery-${delivery.deliveryNumber}.png`
      link.click()
    }
  }

  // 🆕 Handle SAP invoice generation/sync
  const handleGenerateInvoice = async () => {
    if (!delivery || processingBilling) return

    setProcessingBilling(true)

    try {
      const res = await api.post(`/api/deliveries/${delivery.deliveryNumber}/invoice`, {})

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Failed to generate invoice" }))
        setToastType("error")
        setToastTitle("Invoice Generation Failed")
        setToastMessage(errorData.message || "An error occurred while generating the SAP invoice.")
        setShowToast(true)
        setProcessingBilling(false)
        return
      }

      const data = await res.json()

      // Refresh delivery data to get updated invoice status
      const deliveryRes = await api.get(`/api/deliveries/${deliveryId}`)
      if (deliveryRes.ok) {
        const updatedDelivery: DeliveryDetail = await deliveryRes.json()
        setDelivery(updatedDelivery)
      }

      // Show appropriate success message based on response
      if (data.message === "Invoice already created previously") {
        setToastType("success")
        setToastTitle("Invoice Synchronized")
        setToastMessage(`Invoice ${data.invoiceNumber} successfully synchronized.`)
      } else {
        setToastType("success")
        setToastTitle("Invoice Created")
        setToastMessage(`Invoice ${data.invoiceNumber} successfully created.`)
      }
      setShowToast(true)
    } catch (err) {
      setToastType("error")
      setToastTitle("Invoice Generation Failed")
      setToastMessage("Network error occurred while communicating with the server.")
      setShowToast(true)
    } finally {
      setProcessingBilling(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getTypeBadge = (type: number | null | undefined) => {
    if (type === 1) {
      return <Badge variant="bc">BC Compliance</Badge>
    }
    if (type === 2) {
      return <Badge variant="nonbc">Non-BC</Badge>
    }
    return <Badge variant="outline">-</Badge>
  }

  const getStatusBadge = (status: number | null | undefined) => {
    if (status === 3) {
      return (
        <Badge className="bg-rose-50 text-rose-700 border-rose-200/40">
          <span className="mr-1">🛑</span>Canceled / Revoked
        </Badge>
      )
    }
    if (status === 2) {
      return (
        <Badge variant="warning" className="text-amber-700 border-amber/20">
          <span className="mr-1">⚠</span>Partial / Discrepancy
        </Badge>
      )
    }
    if (status === 1) {
      return (
        <Badge variant="success" className="text-emerald-700 border-emerald/20">
          <span className="mr-1">✓</span>Fully Received
        </Badge>
      )
    }
    return <Badge variant="info" className="text-brand-blue/70 border-brand-blue/10">Pending</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-brand-blue/60">Loading delivery details...</p>
      </div>
    )
  }

  if (error || !delivery) {
    return (
      <div className="space-y-8">
        <Button variant="ghost" onClick={() => navigate("/deliveries")}>
          ← Back to Deliveries
        </Button>
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-brand-blue/60">{error || "Delivery not found"}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Page Header with Badges */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/deliveries")}
              className="px-2"
            >
              ←
            </Button>
            <h1 className="text-2xl font-semibold text-brand-blue tracking-tight">
              {delivery.deliveryNumber}
            </h1>
            {delivery.status === 3 && getStatusBadge(delivery.status)}
          </div>
          <p className="text-sm text-brand-blue/60 ml-8">
            {formatDate(delivery.deliveryDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getTypeBadge(delivery.type)}
          {delivery.invoiced ? (
            <Badge variant="outline" className="border-brand-blue/30 text-brand-blue/70">
              Invoiced
            </Badge>
          ) : (
            <Badge variant="outline" className="border-dashed border-slate-300 text-slate-400">
              Uninvoiced
            </Badge>
          )}
          {/* 🆕 SAP Invoice Generate/Sync Button */}
          {delivery.received && delivery.status !== 3 && (
            <Button
              variant={delivery.invoiced || delivery.invoiceNumber ? "outline" : "default"}
              size="sm"
              onClick={handleGenerateInvoice}
              disabled={processingBilling}
              className="whitespace-nowrap"
            >
              {processingBilling ? (
                <>Processing...</>
              ) : delivery.invoiced || delivery.invoiceNumber ? (
                <>Sync SAP Invoice</>
              ) : (
                <>Generate SAP Invoice</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* TOP SECTION: SPLIT PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT PANEL (Metadata 40%) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Core Dispatch Information */}
          <Card className={delivery.status === 3 ? "border-rose-200/60 bg-rose-50/[0.01]" : ""}>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-brand-blue tracking-tight">
                Core Dispatch Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer Section - Hidden completely for warehouse role */}
              {(delivery.customerCode || delivery.customerName) && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                    Customer
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="badge" className="text-brand-blue/70 font-normal text-xs">
                      {delivery.customerCode}
                    </Badge>
                    <span className="text-sm text-brand-blue/80">{delivery.customerName}</span>
                  </div>
                </div>
              )}

              {/* Buyer PO Number - Only shown if user has access (non-warehouse) */}
              {delivery.buyerPONumber && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                    Buyer PO Number
                  </p>
                  <p className="text-sm text-brand-blue/80">{delivery.buyerPONumber}</p>
                </div>
              )}

              {/* Order Number - Only shown if user has access (non-warehouse) */}
              {delivery.orderNumber && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                    Order Number
                  </p>
                  <p className="text-sm text-brand-blue/80">{delivery.orderNumber}</p>
                </div>
              )}

              {/* Receive Date - Only shown when delivery is received */}
              {delivery.received && delivery.receiveDate && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                    Receive Date
                  </p>
                  <p className="text-sm text-brand-blue/80">
                    {formatDate(delivery.receiveDate)}
                  </p>
                </div>
              )}

              {/* 🆕 Invoice Number Badge - Shown when invoice exists */}
              {delivery.invoiceNumber && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                    SAP Invoice Number
                  </p>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-normal text-xs">
                    {delivery.invoiceNumber}
                  </Badge>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                  Account Owner
                </p>
                <p className="text-sm text-brand-blue/80">
                  {delivery.plant && delivery.salesPersonName
                    ? `${delivery.plant} (${delivery.salesPersonName})`
                    : delivery.plant || delivery.salesPersonName || "-"}
                </p>
                {delivery.salesPersonEmail && (
                  <p className="text-xs text-brand-blue/60 mt-0.5">{delivery.salesPersonEmail}</p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                  Drop Zone
                </p>
                <p className="text-sm text-brand-blue/80">
                  {delivery.district && delivery.cityRegency
                    ? `Kec. ${delivery.district}, ${delivery.cityRegency}`
                    : delivery.cityRegency || delivery.district || "-"}
                </p>
                {delivery.formattedAddress && (
                  <p className="text-xs text-brand-blue/60 mt-0.5">{delivery.formattedAddress}</p>
                )}
              </div>

              {delivery.shipToAddress && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                    Ship To Address
                  </p>
                  <p className="text-sm text-brand-blue/80">{delivery.shipToAddress}</p>
                </div>
              )}

              {delivery.deliveryRemarks && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                    Remarks
                  </p>
                  <p className="text-sm text-brand-blue/80">{delivery.deliveryRemarks}</p>
                </div>
              )}

              {/* 🛑 Cancellation Context Block */}
              {delivery.status === 3 && (
                <div className="space-y-1 pt-3 border-t border-rose-100">
                  <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
                    Cancellation Reason
                  </p>
                  <p className="text-sm text-rose-900 bg-rose-50/50 p-2.5 rounded-lg border border-rose-100 italic">
                    {delivery.cancelReason || "No contextual reason provided."}
                  </p>
                </div>
              )}

              {delivery.received && delivery.status !== 3 && (
                <div className="space-y-3 pt-3 border-t border-brand-blue/10">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                      Fulfillment Status
                    </p>
                    {getStatusBadge(delivery.status)}
                  </div>
                  {delivery.receiverName && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                        Received By
                      </p>
                      <p className="text-sm text-brand-blue/80">{delivery.receiverName}</p>
                    </div>
                  )}
                  {delivery.receiverNotes && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                        Receiver Notes
                      </p>
                      <p className="text-sm text-brand-blue/80">{delivery.receiverNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Receiver Access Tokens */}
          <Card>
            <CardContent className="pt-4">
              <CardTitle className="text-base font-semibold text-brand-blue tracking-tight">
                Delivery Confirmation Link for Buyer
              </CardTitle>
              {delivery.status === 3 ? (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-center">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Access Token Revoked
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    This dispatch action link is broken because the delivery configuration record is marked as canceled.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex gap-3 mt-3">
                    <Input
                      value={delivery.publicUrl}
                      readOnly
                      placeholder="Public delivery link"
                      className="bg-brand-blue/5 text-sm flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyUrl}
                      className="whitespace-nowrap"
                    >
                      {copySuccess ? "Copied!" : "Copy"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenLink}
                    >
                      Open
                    </Button>
                  </div>
                  {qrCode && (
                    <div className="mt-3 flex flex-col items-center gap-2">
                      <div className="p-2 bg-white rounded-lg border border-brand-blue/10">
                        <img
                          src={qrCode}
                          alt="Delivery QR Code"
                          className="w-28 h-28"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDownloadQr}
                        className="text-xs"
                      >
                        Download QR
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT PANEL (Visual Telemetry 60%) */}
        <div className="lg:col-span-3 space-y-6">
          {/* LIVE GOOGLE MAPS EMBED */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-brand-blue tracking-tight">
                Delivery Location
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                  <div className="w-full h-full bg-brand-blue/5 flex items-center justify-center text-sm text-brand-blue/40 text-center px-4">
                    {delivery.status === 3 
                      ? "Telemetry tracing skipped for canceled route records."
                      : "Awaiting GPS coordinate telemetry initialization from field..."
                    }
                  </div>
                )}
              </div>
              {(delivery.latitude || delivery.longitude) && (
                <div className="mt-3 flex justify-between items-center text-xs text-brand-blue/50">
                  <span>
                    Coordinates: {delivery.latitude?.toFixed(6) || "-"}, {delivery.longitude?.toFixed(6) || "-"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      window.open(
                        `https://www.google.com/maps?q=${delivery.latitude},${delivery.longitude}`,
                        "_blank"
                      )
                    }
                    className="text-xs h-7"
                  >
                    Open in Google Maps
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Photographic Evidence */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <CardTitle className="text-base font-semibold text-brand-blue tracking-tight">
                  Proof of Delivery
                </CardTitle>
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
                        <div className="p-2 text-xs text-brand-blue/60 border-t border-brand-blue/5 bg-brand-blue/[0.01] flex justify-between items-center">
                          <span className="truncate max-w-[80%] font-medium">{photo.fileName}</span>
                          <span className="text-[10px] text-brand-blue/40 font-semibold bg-brand-blue/5 px-1.5 py-0.5 rounded">
                            🔍 Preview
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-brand-blue/40 italic col-span-2 py-4">
                      {delivery.status === 3 
                        ? "No photographic confirmation records collected prior to cancellation execution."
                        : "No photographic evidence attached to this delivery record."
                      }
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* BOTTOM SECTION: UNIFORM FULL WIDTH (100%) */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-brand-blue tracking-tight">Fulfillment Line Items</h3>
          <span className="text-xs text-brand-blue/50 font-medium">
            {totalPhysicalBatches > 0
              ? `Showing ${paginatedGroupedItems.length} of ${totalGroupedItems} item groups (${totalPhysicalBatches} total batches) - Page ${linePage} of ${totalLinePages}`
              : "No items"}
          </span>
        </div>

        <div className="rounded-xl border border-brand-blue/10 overflow-hidden bg-white shadow-sm w-full">
          <Table>
            <TableHeader className="bg-brand-blue/[0.02]">
              <TableRow>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 w-[14%]">
                  Item / SKU
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 w-[11%]">
                  Batch
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 w-[26%]">
                  Description
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 text-right w-[10%]">
                  Dispatched
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 text-right w-[10%]">
                  Received
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 text-right w-[10%]">
                  Rejected
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 text-right w-[10%]">
                  Returned
                </TableHead>
                {/* Variance column - only shown when delivery is received */}
                {delivery.received && (
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 text-right w-[9%]">
                    Variance
                  </TableHead>
                )}
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 w-[10%]">
                  Remarks
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {totalGroupedItems === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={delivery.received ? 9 : 8}
                    className="text-center py-12 text-sm text-brand-blue/40 italic"
                  >
                    No dynamic dispatch line items attached to this delivery record.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedGroupedItems.map((item) => {
                  if (item.type === 'single-batch') {
                    return (
                      <SingleBatchDetailRow
                        key={item.line.deliveryLineNumber}
                        line={item.line}
                        received={delivery.received}
                        canceled={delivery.status === 3}
                      />
                    )
                  } else {
                    return (
                      <SplitBatchParentDetailRow
                        key={item.parentLine.deliveryLineNumber}
                        parentLine={item.parentLine}
                        children={item.children}
                        aggregatedTotals={item.aggregatedTotals}
                        received={delivery.received}
                        canceled={delivery.status === 3}
                      />
                    )
                  }
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination for Delivery Lines */}
        {totalLinePages > 1 && (
          <div className="mt-4 flex justify-center">
            <Pagination
              currentPage={linePage}
              totalPages={totalLinePages}
              onPageChange={setLinePage}
            />
          </div>
        )}
      </div>

      {/* Light Overlay Popup Modal */}
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

      {/* 🆕 Toast Notification */}
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
    </div>
  )
}