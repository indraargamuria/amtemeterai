import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import QRCode from "qrcode"
import { Button } from "../../shared/components/ui/Button"
import { Badge } from "../../shared/components/ui/Badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../shared/components/ui/Card"
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
    <div className="space-y-6">
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

      {/* Split Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT PANEL (Metadata & Line Items 40%) */}
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

          {/* Itemized Fulfillment Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-brand-blue tracking-tight">
                Itemized Fulfillment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                      SKU
                    </TableHead>
                    <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider text-right">
                      Delivered
                    </TableHead>
                    <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider text-right">
                      Rejected
                    </TableHead>
                    <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                      Notes
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {delivery.lines.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-brand-blue/60 py-4"
                      >
                        No items found
                      </TableCell>
                    </TableRow>
                  ) : (
                    delivery.lines.map((line) => (
                      <TableRow key={line.deliveryLineNumber}>
                        <TableCell className="font-medium text-brand-blue">
                          <div>
                            <p className="text-sm">{line.deliveryItemCode}</p>
                            <p className="text-xs text-brand-blue/60">{line.deliveryItemDescription}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-brand-blue/80">
                          {line.packQuantityDelivered} {line.packUOM}
                        </TableCell>
                        <TableCell className="text-right text-brand-blue/80">
                          {line.packQuantityRejected} {line.packUOM}
                        </TableCell>
                        <TableCell className="text-brand-blue/70 max-w-[120px]">
                          <p className="text-xs truncate">{line.lineComment || "-"}</p>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
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
              <div className="w-full h-80 rounded-xl overflow-hidden border border-brand-blue/10 shadow-sm relative">
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
            <CardHeader>
              <CardTitle className="text-base font-semibold text-brand-blue tracking-tight">
                Photographic Evidence
              </CardTitle>
              {delivery.photos && delivery.photos.length > 0 && (
                <CardDescription className="text-sm text-brand-blue/60">
                  {delivery.photos.length} photo{delivery.photos.length !== 1 ? "s" : ""} uploaded
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {delivery.photos && delivery.photos.length > 0 ? (
                  delivery.photos.map((photo, index) => (
                    <div key={index} className="group relative rounded-lg overflow-hidden border border-brand-blue/10 bg-white">
                      <img
                        src={photo.downloadUrl}
                        alt={photo.fileName || "Proof of Delivery Asset"}
                        loading="lazy"
                        className="w-full h-48 object-cover transition-transform group-hover:scale-[1.02]"
                      />
                      <div className="p-2 text-xs text-brand-blue/60 border-t border-brand-blue/5 bg-brand-blue/[0.01]">
                        {photo.fileName}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-brand-blue/40 italic col-span-2">
                    No photographic evidence attached to this delivery record.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Receiver Access */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-brand-blue tracking-tight">
                Receiver Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input
                  value={delivery.publicUrl}
                  readOnly
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
                <div className="mt-4 flex flex-col items-center gap-2">
                  <div className="p-3 bg-white rounded-lg border border-brand-blue/10">
                    <img
                      src={qrCode}
                      alt="Delivery QR Code"
                      className="w-32 h-32"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadQr}
                    className="text-xs"
                  >
                    Download QR Code
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}