import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import QRCode from "qrcode"
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
import { useApi } from "../../shared/utils/api"

interface DeliveryLine {
  deliveryLineNumber: string
  deliveryItemCode: string
  deliveryItemDescription: string
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
  customerCode: string
  customerName: string
  receiverToken: string
  receiverName: string | null
  receiverNotes: string | null
  received: boolean
  invoiced: boolean
  publicUrl: string
  plant?: string | null
  type?: number | null
  status?: number | null
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

export function DeliveryDetailPage() {
  const { deliveryId } = useParams<{ deliveryId: string }>()
  const navigate = useNavigate()
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

  const api = useApi()

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

        // Generate QR code in frontend
        if (data.publicUrl) {
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
        </div>
      </div>

      {/* TOP SECTION: SPLIT PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT PANEL (Metadata 40%) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Core Dispatch Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-brand-blue tracking-tight">
                Core Dispatch Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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

              {delivery.deliveryRemarks && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                    Remarks
                  </p>
                  <p className="text-sm text-brand-blue/80">{delivery.deliveryRemarks}</p>
                </div>
              )}

              {delivery.received && (
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
          {/* Receiver Access */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-3">
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
                  <div className="w-full h-full bg-brand-blue/5 flex items-center justify-center text-sm text-brand-blue/40">
                    Awaiting GPS coordinate telemetry initialization from field...
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
                <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-blue/50">
                  Photographic Evidence
                  {delivery.photos && delivery.photos.length > 0 && (
                    <span className="ml-2 text-brand-blue/40 font-normal">
                      ({delivery.photos.length})
                    </span>
                  )}
                </h4>
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
                      No photographic evidence attached to this delivery record.
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
            Showing {delivery.lines.length} items total
          </span>
        </div>

        <div className="rounded-xl border border-brand-blue/10 overflow-hidden bg-white shadow-sm w-full">
          <Table>
            <TableHeader className="bg-brand-blue/[0.02]">
              <TableRow>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 w-[18%]">
                  Item / SKU
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 w-[32%]">
                  Description
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 text-right w-[12%]">
                  Dispatched
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 text-right w-[12%]">
                  Received
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 text-right w-[12%]">
                  Rejected
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-brand-blue/60 w-[14%]">
                  Remarks / Variance
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {delivery.lines.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-12 text-sm text-brand-blue/40 italic"
                  >
                    No dynamic dispatch line items attached to this delivery record.
                  </TableCell>
                </TableRow>
              ) : (
                delivery.lines.map((line) => (
                  <TableRow
                    key={line.deliveryLineNumber}
                    className="hover:bg-brand-blue/[0.01] transition-colors"
                  >
                    <TableCell className="py-3.5 font-semibold text-sm text-brand-blue">
                      {line.deliveryItemCode}
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
                      {line.packQuantityDelivered} {line.packUOM}
                    </TableCell>
                    <TableCell className="py-3.5 text-sm text-right font-semibold">
                      <span
                        className={
                          line.packQuantityRejected > 0
                            ? "text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded"
                            : "text-brand-blue/30"
                        }
                      >
                        {line.packQuantityRejected} {line.packUOM}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 text-xs text-brand-blue/60 font-medium">
                      {line.lineComment || <span className="text-brand-blue/20">-</span>}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
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
    </div>
  )
}