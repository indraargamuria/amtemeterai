import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { Button } from "../../shared/components/ui/Button"
import { Badge } from "../../shared/components/ui/Badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../shared/components/ui/Card"
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
  lineComment?: string | null
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
  lineComment: string
}

const API_URL = import.meta.env.VITE_API_URL
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB in bytes

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
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoErrors, setPhotoErrors] = useState<string[]>([])
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)

  // PIN Verification States
  const [isVerified, setIsVerified] = useState(false)
  const [pinInput, setPinInput] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)

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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch delivery")
      } finally {
        setLoading(false)
      }
    }

    fetchDelivery()
  }, [token])

  // Check for existing verification in sessionStorage
  useEffect(() => {
    if (token) {
      const verified = sessionStorage.getItem(`verified-${token}`)
      if (verified === "true") {
        setIsVerified(true)
      }
    }
  }, [token])

  // Clean up verification when token changes or component unmounts
  useEffect(() => {
    return () => {
      if (token) {
        sessionStorage.removeItem(`verified-${token}`)
      }
    }
  }, [token])

  // Auto-capture GPS coordinates
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude)
          setLongitude(position.coords.longitude)
        },
        (error) => {
          // Silently fail - GPS is optional
          console.warn("Geolocation not available or permission denied")
        },
        { enableHighAccuracy: true, timeout: 5000 }
      )
    }
  }, [])

  // Initialize line comments from API response
  useEffect(() => {
    if (delivery && !submitted) {
      setLines(
        delivery.lines.map((line) => ({
          deliveryLineNumber: line.deliveryLineNumber,
          delivered: line.packQuantityDelivered.toString(),
          returned: line.packQuantityReturned.toString(),
          rejected: line.packQuantityRejected.toString(),
          lineComment: (line as any).lineComment || "",
        }))
      )
    }
  }, [delivery, submitted])

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
      const formData = new FormData()

      formData.append("ReceiverName", receiverName || "")
      if (receiverNotes) {
        formData.append("ReceiverNotes", receiverNotes)
      }
      if (latitude !== null) {
        formData.append("Latitude", latitude.toString())
      }
      if (longitude !== null) {
        formData.append("Longitude", longitude.toString())
      }

      // Append photos
      photoFiles.forEach((file) => {
        formData.append("PhotoFiles", file)
      })

      // Append lines
      delivery.lines.forEach((line, index) => {
        const lineState = lines.find((l) => l.deliveryLineNumber === line.deliveryLineNumber)
        formData.append(`Lines[${index}].DeliveryLineNumber`, line.deliveryLineNumber)
        formData.append(`Lines[${index}].PackQuantityDelivered`, parseFloat(lineState?.delivered || "0").toString())
        formData.append(`Lines[${index}].PackQuantityReturned`, parseFloat(lineState?.returned || "0").toString())
        formData.append(`Lines[${index}].PackQuantityRejected`, parseFloat(lineState?.rejected || "0").toString())
        if (lineState?.lineComment) {
          formData.append(`Lines[${index}].LineComment`, lineState.lineComment)
        }
      })

      const res = await fetch(`${API_URL}/api/deliveries/${token}`, {
        method: "PATCH",
        body: formData,
      })

      if (!res.ok) {
        throw new Error("Failed to update delivery")
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit delivery")
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerifyPin = async () => {
    if (!token || !pinInput) {
      setPinError("Please enter a PIN")
      return
    }

    setVerifying(true)
    setPinError(null)

    try {
      const res = await fetch(`${API_URL}/api/deliveries/${token}/verify-pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin: pinInput }),
      })

      if (res.ok) {
        setIsVerified(true)
        // Store verification in sessionStorage for persistence
        sessionStorage.setItem(`verified-${token}`, "true")
      } else if (res.status === 401) {
        setPinError("Invalid PIN. Please try again.")
      } else if (res.status === 404) {
        setPinError("Delivery not found.")
      } else {
        setPinError("Verification failed. Please try again.")
      }
    } catch (err) {
      setPinError("An error occurred during verification. Please try again.")
    } finally {
      setVerifying(false)
    }
  }

  const handleLineChange = (
    deliveryLineNumber: string,
    field: "delivered" | "returned" | "rejected" | "lineComment",
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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const errors: string[] = []
    const validFiles: File[] = []

    files.forEach((file) => {
      // Validate file type
      if (
!["image/jpeg", "image/jpg", "image/png"].includes(file.type)
) {
        errors.push(`${file.name}: Only JPG and PNG files are allowed`)
        return
      }

      // Validate file size (max 5MB)
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File size exceeds 5MB limit`)
        return
      }

      validFiles.push(file)
    })

    setPhotoErrors(errors)
    setPhotoFiles((prev) => [...prev, ...validFiles])

    // Clear input
    e.target.value = ""
  }

  const removePhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index))
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

  // Show PIN verification screen if not verified
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-brand-blue/[0.02] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-brand-blue/10 flex items-center justify-center mx-auto mb-4">
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
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <CardTitle className="text-lg font-semibold text-brand-blue tracking-tight">
              Delivery Verification
            </CardTitle>
            <CardDescription className="text-sm text-brand-blue/60">
              Please enter the security PIN provided by the sender.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin" className="text-sm text-brand-blue/70">
                Security PIN
              </Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value)
                  setPinError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleVerifyPin()
                  }
                }}
                placeholder="Enter 6-digit PIN"
                className="text-center text-lg tracking-widest h-12"
                autoFocus
              />
            </div>
            {pinError && (
              <p className="text-sm text-brand-red bg-brand-red/10 px-3 py-2 rounded-md text-center">
                {pinError}
              </p>
            )}
            <Button
              className="w-full"
              onClick={handleVerifyPin}
              disabled={verifying || !pinInput}
            >
              {verifying ? "Verifying..." : "Access Delivery"}
            </Button>
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

                    <div className="space-y-1">
                      <Label htmlFor={`comment-${line.deliveryLineNumber}`} className="text-xs text-brand-blue/60">
                        Remarks (Optional)
                      </Label>
                      <Input
                        id={`comment-${line.deliveryLineNumber}`}
                        type="text"
                        value={lineState?.lineComment || ""}
                        onChange={(e) =>
                          handleLineChange(line.deliveryLineNumber, "lineComment", e.target.value)
                        }
                        disabled={isAlreadyReceived || submitted || submitting}
                        placeholder="Any remarks for this item"
                        className="h-9"
                      />
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

          {/* Photo Upload */}
          {!isAlreadyReceived && !submitted && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-brand-blue tracking-tight">
                  Proof of Delivery Photos
                </CardTitle>
                <CardDescription className="text-xs text-brand-blue/60">
                  Upload up to 5 photos. Each photo must be JPG or PNG and under 5MB.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="photoUpload" className="text-sm text-brand-blue/70">
                    Select Photos
                  </Label>
                  <Input
                    id="photoUpload"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    multiple
                    onChange={handlePhotoUpload}
                    disabled={submitting || photoFiles.length >= 5}
                  />
                  <p className="text-xs text-brand-blue/50">
                    {photoFiles.length}/5 photos selected
                  </p>
                </div>

                {photoErrors.length > 0 && (
                  <div className="space-y-1">
                    {photoErrors.map((error, index) => (
                      <p key={index} className="text-xs text-brand-red">{error}</p>
                    ))}
                  </div>
                )}

                {photoFiles.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photoFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-square bg-brand-blue/5 rounded-lg overflow-hidden border border-brand-blue/10">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          disabled={submitting}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-brand-red text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                        <p className="text-xs text-brand-blue/60 mt-1 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-brand-blue/40">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    ))}
                  </div>
                )}
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
