import { useState, useEffect, useMemo, memo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import QRCode from "qrcode"
import { CheckCircle, AlertTriangle } from "lucide-react"
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

const LINES_PER_PAGE = 10

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

  // Calculate pagination for delivery lines
  const totalLines = delivery?.lines?.length || 0
  const totalLinePages = Math.ceil(totalLines / LINES_PER_PAGE)

  const paginatedLines = useMemo(() => {
    if (!delivery?.lines) return []
    const startIndex = (linePage - 1) * LINES_PER_PAGE
    return delivery.lines.slice(startIndex, startIndex + LINES_PER_PAGE)
  }, [delivery?.lines, linePage])

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
            {totalLines > 0
              ? `Showing ${paginatedLines.length} of ${totalLines} items (Page ${linePage} of ${totalLinePages})`
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
              {totalLines === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={delivery.received ? 9 : 8}
                    className="text-center py-12 text-sm text-brand-blue/40 italic"
                  >
                    No dynamic dispatch line items attached to this delivery record.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLines.map((line) => {
                  const totalReceived = line.packQuantityDelivered + line.packQuantityReturned + line.packQuantityRejected
                  const rawVariance = totalReceived - line.packQuantity
                  const variancePercent = line.packQuantity > 0 ? ((rawVariance / line.packQuantity) * 100).toFixed(2) : "0.00"
                  const isOver = parseFloat(variancePercent) > 0
                  const isShort = parseFloat(variancePercent) < 0
                  const displayVariance = isOver ? `+${variancePercent}%` : `${variancePercent}%`

                  return (
                    <TableRow
                      key={line.deliveryLineNumber}
                      className="hover:bg-brand-blue/[0.01] transition-colors"
                    >
                      <TableCell className="py-3.5 font-semibold text-sm text-brand-blue">
                        {line.deliveryItemCode}
                      </TableCell>
                      <TableCell className="py-3.5 text-sm text-brand-blue/70">
                        {line.batchNumber || <span className="text-brand-blue/30 italic">-</span>}
                      </TableCell>
                      <TableCell className="py-3.5 text-sm text-brand-blue/80">
                        {line.deliveryItemDescription || (
                          <span className="text-brand-blue/30 italic">No description</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3.5 text-sm text-right font-medium text-brand-blue/70">
                        {line.packQuantity} {line.packUOM}
                      </TableCell>
                      <TableCell className="py-3.5 text-sm text-right font-semibold text-emerald-600">
                        {delivery.status === 3 ? `0 ${line.packUOM}` : `${line.packQuantityDelivered} ${line.packUOM}`}
                      </TableCell>
                      <TableCell className="py-3.5 text-sm text-right font-semibold">
                        <span
                          className={
                            line.packQuantityRejected > 0 && delivery.status !== 3
                              ? "text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded"
                              : "text-brand-blue/30"
                          }
                        >
                          {delivery.status === 3 ? 0 : line.packQuantityRejected} {line.packUOM}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5 text-sm text-right font-semibold">
                        <span
                          className={
                            line.packQuantityReturned > 0 && delivery.status !== 3
                              ? "text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded"
                              : "text-brand-blue/30"
                          }
                        >
                          {delivery.status === 3 ? 0 : line.packQuantityReturned} {line.packUOM}
                        </span>
                      </TableCell>
                      {/* Variance cell - only shown when delivery is received */}
                      {delivery.received && (
                        <TableCell className="py-3.5 text-sm text-right font-semibold">
                          {delivery.status === 3 ? (
                            <span className="text-rose-500/80 font-medium">—</span>
                          ) : (
                            <span
                              className={
                                isShort
                                  ? "text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded"
                                  : isOver
                                  ? "text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded"
                                  : "text-brand-blue/40"
                              }
                            >
                              {displayVariance}
                            </span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="py-3.5 text-xs text-brand-blue/60 font-medium">
                        {delivery.status === 3 ? (
                          <span className="text-rose-500/80 font-medium">Link Revoked</span>
                        ) : (
                          line.lineComment || <span className="text-brand-blue/20">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
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