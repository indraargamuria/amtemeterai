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
}

interface DeliveryDetail {
  deliveryNumber: string
  deliveryDate: string
  deliveryRemarks: string | null
  receiverToken: string
  receiverName: string | null
  receiverNotes: string | null
  received: boolean
  invoiced: boolean
  publicUrl: string
  lines: DeliveryLine[]
}

const API_URL = import.meta.env.VITE_API_URL

export function DeliveryDetailPage() {
  const { deliveryId } = useParams<{ deliveryId: string }>()
  const navigate = useNavigate()
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  useEffect(() => {
    const fetchDeliveryDetail = async () => {
      if (!deliveryId) return

      try {
        const res = await fetch(`${API_URL}/api/deliveries/${deliveryId}`)
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
      {/* Page Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-brand-blue tracking-tight">
            Delivery Details
          </h1>
          <p className="text-sm text-brand-blue/60">
            View complete delivery information and line items
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/deliveries")}>
          ← Back to Deliveries
        </Button>
      </div>

      {/* Delivery Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-brand-blue tracking-tight">
            {delivery.deliveryNumber}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                  Delivery Date
                </p>
                <p className="text-sm text-brand-blue/80">{formatDate(delivery.deliveryDate)}</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                  Customer Code
                </p>
                <p className="text-sm text-brand-blue/80">
                  {/* Customer info will be populated from API */}
                  -
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                  Customer Name
                </p>
                <p className="text-sm text-brand-blue/80">
                  {/* Customer info will be populated from API */}
                  -
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                  Remarks
                </p>
                <p className="text-sm text-brand-blue/80">
                  {delivery.deliveryRemarks || "-"}
                </p>
              </div>
            </div>

            {/* Right Column - Status */}
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                  Received Status
                </p>
                <Badge variant={delivery.received ? "default" : "accent"}>
                  {delivery.received ? "Received" : "Not Received"}
                </Badge>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                  Invoice Status
                </p>
                <Badge variant={delivery.invoiced ? "default" : "outline"}>
                  {delivery.invoiced ? "Invoiced" : "Not Invoiced"}
                </Badge>
              </div>

              {delivery.receiverName && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                    Receiver Name
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
          </div>
        </CardContent>
      </Card>

      {/* Receiver Access Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-brand-blue tracking-tight">
            Receiver Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Public URL */}
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                  Public Link
                </p>
                <div className="flex gap-2">
                  <Input
                    value={delivery.publicUrl}
                    readOnly
                    className="bg-brand-blue/5 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyUrl}
                    className="whitespace-nowrap"
                  >
                    {copySuccess ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenLink}
                className="w-full"
              >
                Open Link in New Tab
              </Button>
            </div>

            {/* Right Column - QR Code */}
            <div className="flex flex-col items-center justify-center space-y-4">
              {qrCode && (
                <>
                  <div className="p-4 bg-white rounded-lg border border-brand-blue/10">
                    <img
                      src={qrCode}
                      alt="Delivery QR Code"
                      className="w-40 h-40"
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
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Lines Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-brand-blue tracking-tight">
            Delivery Lines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                  Line #
                </TableHead>
                <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                  Item Code
                </TableHead>
                <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                  Description
                </TableHead>
                <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider text-right">
                  Sales Qty
                </TableHead>
                <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider text-right">
                  Pack Qty
                </TableHead>
                <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider text-right">
                  Delivered
                </TableHead>
                <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider text-right">
                  Returned
                </TableHead>
                <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider text-right">
                  Rejected
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {delivery.lines.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-brand-blue/60 py-8"
                  >
                    No delivery lines found
                  </TableCell>
                </TableRow>
              ) : (
                delivery.lines.map((line, index) => (
                  <TableRow key={`${line.deliveryLineNumber}-${index}`}>
                    <TableCell className="font-medium text-brand-blue">
                      {line.deliveryLineNumber}
                    </TableCell>
                    <TableCell className="text-brand-blue/70">
                      {line.deliveryItemCode}
                    </TableCell>
                    <TableCell>{line.deliveryItemDescription}</TableCell>
                    <TableCell className="text-right text-brand-blue/80">
                      {line.salesQuantity.toLocaleString()} {line.salesUOM}
                    </TableCell>
                    <TableCell className="text-right text-brand-blue/80">
                      {line.packQuantity.toLocaleString()} {line.packUOM}
                    </TableCell>
                    <TableCell className="text-right text-brand-blue/80">
                      {line.packQuantityDelivered.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-brand-blue/80">
                      {line.packQuantityReturned.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-brand-blue/80">
                      {line.packQuantityRejected.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
