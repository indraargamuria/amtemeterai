import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { Button } from "../../shared/components/ui/Button"
import { Badge } from "../../shared/components/ui/Badge"
import { Card, CardContent, CardHeader, CardTitle } from "../../shared/components/ui/Card"
import { Input } from "../../shared/components/ui/Input"
import { Label } from "../../shared/components/ui/Label"

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
  lines: DeliveryLine[]
}

interface LineFormState {
  deliveryLineNumber: string
  delivered: string
  returned: string
  rejected: string
}

const API_URL = import.meta.env.VITE_API_URL

export function DeliveryReceivePage() {
  const { token } = useParams<{ token: string }>()
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [receiverName, setReceiverName] = useState("")
  const [receiverNotes, setReceiverNotes] = useState("")
  const [lines, setLines] = useState<LineFormState[]>([])
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchDelivery = async () => {
      if (!token) {
        setError("Invalid delivery token")
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`${API_URL}/api/deliveries/${token}`)
        if (!res.ok) {
          throw new Error("Delivery not found")
        }
        const data: DeliveryDetail = await res.json()
        setDelivery(data)

        // Initialize form state
        setReceiverName(data.receiverName || "")
        setReceiverNotes(data.receiverNotes || "")
        setLines(
          data.lines.map((line) => ({
            deliveryLineNumber: line.deliveryLineNumber,
            delivered: line.packQuantityDelivered.toString(),
            returned: line.packQuantityReturned.toString(),
            rejected: line.packQuantityRejected.toString(),
          }))
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch delivery")
      } finally {
        setLoading(false)
      }
    }

    fetchDelivery()
  }, [token])

  const validateLines = (): boolean => {
    const errors: Record<string, string> = {}
    let isValid = true

    if (!delivery) return false

    delivery.lines.forEach((line) => {
      const lineState = lines.find((l) => l.deliveryLineNumber === line.deliveryLineNumber)
      if (!lineState) return

      const delivered = parseFloat(lineState.delivered) || 0
      const returned = parseFloat(lineState.returned) || 0
      const rejected = parseFloat(lineState.rejected) || 0
      const total = delivered + returned + rejected

      if (total > line.packQuantity) {
        errors[line.deliveryLineNumber] = `Total (${total}) exceeds pack quantity (${line.packQuantity})`
        isValid = false
      }
    })

    setValidationErrors(errors)
    return isValid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!delivery || !token) return

    if (!validateLines()) {
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        receiverName: receiverName || null,
        receiverNotes: receiverNotes || null,
        lines: delivery.lines.map((line) => {
          const lineState = lines.find((l) => l.deliveryLineNumber === line.deliveryLineNumber)
          return {
            deliveryLineNumber: line.deliveryLineNumber,
            packQuantityDelivered: parseFloat(lineState?.delivered || "0"),
            packQuantityReturned: parseFloat(lineState?.returned || "0"),
            packQuantityRejected: parseFloat(lineState?.rejected || "0"),
          }
        }),
      }

      const res = await fetch(`${API_URL}/api/deliveries/${token}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error("Failed to update delivery")
      }

      // Update delivery state locally (PATCH returns no content)
      setDelivery((prev) => {
        if (!prev) return prev

        return {
          ...prev,
          received: true,
          receiverName: receiverName || null,
          receiverNotes: receiverNotes || null,
          lines: prev.lines.map((line) => {
            const lineState = lines.find(
              (l) => l.deliveryLineNumber === line.deliveryLineNumber
            )

            return {
              ...line,
              packQuantityDelivered: parseFloat(lineState?.delivered || "0"),
              packQuantityReturned: parseFloat(lineState?.returned || "0"),
              packQuantityRejected: parseFloat(lineState?.rejected || "0"),
            }
          }),
        }
      })

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit delivery")
    } finally {
      setSubmitting(false)
    }
  }

  const handleLineChange = (
    deliveryLineNumber: string,
    field: "delivered" | "returned" | "rejected",
    value: string
  ) => {
    setLines((prev) =>
      prev.map((line) =>
        line.deliveryLineNumber === deliveryLineNumber
          ? { ...line, [field]: value }
          : line
      )
    )
    // Clear validation error for this line when user makes changes
    if (validationErrors[deliveryLineNumber]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[deliveryLineNumber]
        return newErrors
      })
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
      <div className="min-h-screen bg-brand-blue/[0.02] flex items-center justify-center p-4">
        <p className="text-brand-blue/60">Loading delivery information...</p>
      </div>
    )
  }

  if (error || !delivery) {
    return (
      <div className="min-h-screen bg-brand-blue/[0.02] flex items-center justify-center p-4">
        <Card className="w-full max-w-xl">
          <CardContent className="py-12">
            <p className="text-center text-brand-blue/60">{error || "Delivery not found"}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isAlreadyReceived = delivery.received && !submitted

  return (
    <div className="min-h-screen bg-brand-blue/[0.02] py-8 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-brand-blue tracking-tight">
            Delivery Confirmation
          </h1>
          <p className="text-sm text-brand-blue/60">
            Please confirm the delivery details below
          </p>
        </div>

        {/* Delivery Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg font-semibold text-brand-blue tracking-tight">
                {delivery.deliveryNumber}
              </CardTitle>
              <Badge variant={delivery.received ? "default" : "accent"}>
                {delivery.received ? "Received" : "Not Received"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-brand-blue/60">Delivery Date</span>
              <span className="text-sm text-brand-blue/80">{formatDate(delivery.deliveryDate)}</span>
            </div>
            {delivery.deliveryRemarks && (
              <div className="flex justify-between">
                <span className="text-sm text-brand-blue/60">Remarks</span>
                <span className="text-sm text-brand-blue/80 text-right max-w-[60%]">
                  {delivery.deliveryRemarks}
                </span>
              </div>
            )}
            {delivery.receiverName && (
              <div className="flex justify-between">
                <span className="text-sm text-brand-blue/60">Previously Received By</span>
                <span className="text-sm text-brand-blue/80">{delivery.receiverName}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Success Message */}
        {submitted && (
          <Card className="border-brand-blue/20 bg-brand-blue/5">
            <CardContent className="py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-brand-blue/10 flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-6 h-6 text-brand-blue"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-brand-blue">Delivery Confirmed</p>
              <p className="text-xs text-brand-blue/60 mt-1">
                Thank you for confirming the receipt
              </p>
            </CardContent>
          </Card>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Instruction Text */}
          {!isAlreadyReceived && !submitted && (
            <p className="text-sm text-brand-blue/70 text-center">
              Please verify each item and enter the quantities received, returned, or rejected.
            </p>
          )}

          {isAlreadyReceived && !submitted && (
            <p className="text-sm text-brand-blue/70 text-center">
              This delivery has already been received. You can view the details below.
            </p>
          )}

          {/* Delivery Lines */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-brand-blue tracking-tight">
                Delivery Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {delivery.lines.map((line) => {
                const lineState = lines.find((l) => l.deliveryLineNumber === line.deliveryLineNumber)
                const error = validationErrors[line.deliveryLineNumber]

                return (
                  <div
                    key={line.deliveryLineNumber}
                    className="space-y-3 pb-4 border-b border-brand-blue/5 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-brand-blue">
                        {line.deliveryItemCode}
                      </p>
                      <p className="text-xs text-brand-blue/70 mt-0.5">
                        {line.deliveryItemDescription}
                      </p>
                      <p className="text-xs text-brand-blue/50 mt-1">
                        Pack Qty: {line.packQuantity} {line.packUOM}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor={`delivered-${line.deliveryLineNumber}`} className="text-xs text-brand-blue/60">
                          Delivered
                        </Label>
                        <Input
                          id={`delivered-${line.deliveryLineNumber}`}
                          type="number"
                          step="0.01"
                          min="0"
                          max={line.packQuantity}
                          value={lineState?.delivered || ""}
                          onChange={(e) =>
                            handleLineChange(line.deliveryLineNumber, "delivered", e.target.value)
                          }
                          disabled={isAlreadyReceived || submitted || submitting}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`returned-${line.deliveryLineNumber}`} className="text-xs text-brand-blue/60">
                          Returned
                        </Label>
                        <Input
                          id={`returned-${line.deliveryLineNumber}`}
                          type="number"
                          step="0.01"
                          min="0"
                          max={line.packQuantity}
                          value={lineState?.returned || ""}
                          onChange={(e) =>
                            handleLineChange(line.deliveryLineNumber, "returned", e.target.value)
                          }
                          disabled={isAlreadyReceived || submitted || submitting}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`rejected-${line.deliveryLineNumber}`} className="text-xs text-brand-blue/60">
                          Rejected
                        </Label>
                        <Input
                          id={`rejected-${line.deliveryLineNumber}`}
                          type="number"
                          step="0.01"
                          min="0"
                          max={line.packQuantity}
                          value={lineState?.rejected || ""}
                          onChange={(e) =>
                            handleLineChange(line.deliveryLineNumber, "rejected", e.target.value)
                          }
                          disabled={isAlreadyReceived || submitted || submitting}
                          className="h-9"
                        />
                      </div>
                    </div>

                    {error && (
                      <p className="text-xs text-brand-red mt-1">{error}</p>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Receiver Info */}
          {!isAlreadyReceived && !submitted && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-brand-blue tracking-tight">
                  Receiver Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="receiverName" className="text-sm text-brand-blue/70">
                    Receiver Name *
                  </Label>
                  <Input
                    id="receiverName"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    disabled={submitting}
                    placeholder="Enter your name"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="receiverNotes" className="text-sm text-brand-blue/70">
                    Notes (Optional)
                  </Label>
                  <Input
                    id="receiverNotes"
                    value={receiverNotes}
                    onChange={(e) => setReceiverNotes(e.target.value)}
                    disabled={submitting}
                    placeholder="Any additional notes"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          {!isAlreadyReceived && !submitted && (
            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Confirm Delivery"}
            </Button>
          )}
        </form>
      </div>
    </div>
  )
}
