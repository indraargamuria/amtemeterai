import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { Button } from "../../shared/components/ui/Button"
import { Badge } from "../../shared/components/ui/Badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../shared/components/ui/Card"
import { Input } from "../../shared/components/ui/Input"
import { Label } from "../../shared/components/ui/Label"

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
  receiverToken: string
  receiverName: string | null
  receiverNotes: string | null
  received: boolean
  invoiced: boolean
  photos?: DeliveryPhoto[]
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
  
  // 🚀 New state to manage the floating pop-up toast visibility
  const [showToast, setShowToast] = useState(false)

  const [receiverName, setReceiverName] = useState("")
  const [receiverNotes, setReceiverNotes] = useState("")
  const [lines, setLines] = useState<LineFormState[]>([])
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoErrors, setPhotoErrors] = useState<string[]>([])
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)

  // 🗑️ State for tracking legacy image deletion keys before final submit
  const [keysToDelete, setKeysToDelete] = useState<string[]>([])

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

        // Initialize form header states
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
        () => {
          console.warn("Geolocation not available or permission denied")
        },
        { enableHighAccuracy: true, timeout: 5000 }
      )
    }
  }, [])

  // Initialize line values from backend model payload
  useEffect(() => {
    if (delivery && !submitted) {
      setLines(
        delivery.lines.map((line) => ({
          deliveryLineNumber: line.deliveryLineNumber,
          delivered: line.packQuantityDelivered.toString(),
          returned: line.packQuantityReturned.toString(),
          rejected: line.packQuantityRejected.toString(),
          lineComment: line.lineComment || "",
        }))
      )
    }
  }, [delivery, submitted])

  // Auto-dismiss the popup window after 5 seconds to reduce manual interaction load
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [showToast])

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
        errors[line.deliveryLineNumber] = "Total (" + total + ") exceeds item pack limit (" + line.packQuantity + ")"
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

      // 📸 Append fresh uploaded files using the exact key the backend expects
      photoFiles.forEach((file) => {
        formData.append("NewPhotoFiles", file);
      });

      // 🗑️ Append keys to delete for the backend wiping process
      keysToDelete.forEach((key, index) => {
        formData.append(`KeysToDelete[${index}]`, key)
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

      // 🚀 THE INSTANT REFRESH FIX: Map staged uploads to preview states immediately on success!
      setDelivery((prevDelivery) => {
        if (!prevDelivery) return null

        // 1. Filter out the wiped images from local memory
        const remainingLegacyPhotos = prevDelivery.photos?.filter((p) => !keysToDelete.includes(p.storageKey)) || []

        // 2. Map the newly staged files into the identical DeliveryPhoto object signature
        const newlySavedPhotos = photoFiles.map((file) => ({
          fileName: file.name,
          storageKey: file.name, // Temporary key until next refresh fetch
          downloadUrl: URL.createObjectURL(file), // Keeps the local stream preview alive seamlessly
          uploadedAt: new Date().toISOString()
        }))

        return {
          ...prevDelivery,
          photos: [...remainingLegacyPhotos, ...newlySavedPhotos] // Combine both maps back together safely
        }
      })

      // Reset local submission state queues completely
      setSubmitted(true)
      setShowToast(true) // 🚀 Fire popup window on successful processing action
      setKeysToDelete([])
      setPhotoFiles([]) // Safely clears the staged upload block since they're now in part A
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
      const res = await fetch(API_URL + "/api/deliveries/" + token + "/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      })

      if (res.ok) {
        setIsVerified(true)
        sessionStorage.setItem("verified-" + token, "true")
      } else if (res.status === 401) {
        setPinError("Invalid PIN. Please try again.")
      } else if (res.status === 404) {
        setPinError("Delivery record not found.")
      } else {
        setPinError("Verification failed. Please try again.")
      }
    } catch {
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
    // 🚀 SANITIZATION ENGAGED: Force-clamp numerical quantities to zero if drops below zero
    let sanitizedValue = value
    if (field !== "lineComment" && value !== "") {
      const num = parseFloat(value)
      if (num < 0) {
        sanitizedValue = "0"
      }
    }

    setLines((prev) =>
      prev.map((line) =>
        line.deliveryLineNumber === deliveryLineNumber
          ? { ...line, [field]: sanitizedValue }
          : line
      )
    )
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
      if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
        errors.push(file.name + ": Only JPG and PNG files are allowed")
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(file.name + ": File size exceeds 5MB limit")
        return
      }
      validFiles.push(file)
    })

    setPhotoErrors(errors)
    setPhotoFiles((prev) => [...prev, ...validFiles])
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
      <div className="min-h-screen bg-brand-blue/2 flex items-center justify-center p-4">
        <p className="text-brand-blue/60">Loading delivery information...</p>
      </div>
    )
  }

  if (error || !delivery) {
    return (
      <div className="min-h-screen bg-brand-blue/2 flex items-center justify-center p-4">
        <Card className="w-full max-w-xl">
          <CardContent className="py-12 text-center">
            <p className="text-brand-red font-medium mb-4">{error || "Delivery not found"}</p>
            <Button onClick={() => window.location.reload()} variant="outline">Retry Engine Link</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-brand-blue/2 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-brand-blue/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <CardTitle className="text-lg font-semibold text-brand-blue tracking-tight">Delivery Verification</CardTitle>
            <CardDescription className="text-sm text-brand-blue/60">Please enter the security PIN provided by the sender.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin" className="text-sm text-brand-blue/70">Security PIN</Label>
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
              <p className="text-sm text-brand-red bg-brand-red/10 px-3 py-2 rounded-md text-center">{pinError}</p>
            )}
            <Button className="w-full" onClick={handleVerifyPin} disabled={verifying || !pinInput}>
              {verifying ? "Verifying..." : "Access Delivery"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-blue/2 py-8 px-4 relative">
      
      {/* 🚀 FIXED RUNTIME FLOATING POPUP TOAST */}
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-white border border-brand-blue/20 rounded-xl shadow-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-blue/10 flex items-center justify-center shrink-0 text-brand-blue">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1 space-y-0.5">
              <h4 className="text-sm font-semibold text-brand-blue">Response Recorded</h4>
              <p className="text-xs text-brand-blue/60">Your delivery confirmation response has been securely saved.</p>
            </div>
            <button 
              onClick={() => setShowToast(false)}
              className="text-brand-blue/40 hover:text-brand-blue/70 transition-colors p-0.5"
              type="button"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-xl mx-auto space-y-6">
        
        {/* FINANCIAL LOCK BANNER */}
        {delivery.invoiced && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-sm font-semibold text-red-800">
              ⚠️ This record has already been invoiced and cannot be modified.
            </p>
          </div>
        )}

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-brand-blue tracking-tight">Delivery Confirmation</h1>
          <p className="text-sm text-brand-blue/60">Please confirm item counts and fulfillment status</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg font-semibold text-brand-blue tracking-tight">{delivery.deliveryNumber}</CardTitle>
              <Badge variant={delivery.invoiced ? "default" : (delivery.received ? "default" : "accent")}>
                {delivery.invoiced ? "Invoiced & Locked" : (delivery.received ? "Received" : "Not Received")}
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
                <span className="text-sm text-brand-blue/80 text-right max-w-[60%]">{delivery.deliveryRemarks}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {submitted && (
          <Card className="border-brand-blue/20 bg-brand-blue/5">
            <CardContent className="py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-brand-blue/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-brand-blue">Delivery Updates Applied</p>
              <p className="text-xs text-brand-blue/60 mt-1">Changes committed into system database entries</p>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* DELIVERY LINES CONFIG MATRIX */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-brand-blue tracking-tight">Delivery Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {delivery.lines.map((line) => {
                const lineState = lines.find((l) => l.deliveryLineNumber === line.deliveryLineNumber)
                const lineError = validationErrors[line.deliveryLineNumber]

                return (
                  <div key={line.deliveryLineNumber} className="space-y-3 pb-4 border-b border-brand-blue/5 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-brand-blue">{line.deliveryItemCode}</p>
                      <p className="text-xs text-brand-blue/70 mt-0.5">{line.deliveryItemDescription}</p>
                      <p className="text-xs text-brand-blue/50 mt-1">Order Volume Max: {line.packQuantity} {line.packUOM}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-brand-blue/60">Delivered</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          onKeyDown={(e) => {
                            if (e.key === "-") e.preventDefault()
                          }}
                          value={lineState?.delivered || ""}
                          onChange={(e) => handleLineChange(line.deliveryLineNumber, "delivered", e.target.value)}
                          disabled={delivery.invoiced || submitted || submitting}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-brand-blue/60">Returned</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          onKeyDown={(e) => {
                            if (e.key === "-") e.preventDefault()
                          }}
                          value={lineState?.returned || ""}
                          onChange={(e) => handleLineChange(line.deliveryLineNumber, "returned", e.target.value)}
                          disabled={delivery.invoiced || submitted || submitting}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-brand-blue/60">Rejected</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          onKeyDown={(e) => {
                            if (e.key === "-") e.preventDefault()
                          }}
                          value={lineState?.rejected || ""}
                          onChange={(e) => handleLineChange(line.deliveryLineNumber, "rejected", e.target.value)}
                          disabled={delivery.invoiced || submitted || submitting}
                          className="h-9"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-brand-blue/60">Remarks (Optional)</Label>
                      <Input
                        type="text"
                        value={lineState?.lineComment || ""}
                        onChange={(e) => handleLineChange(line.deliveryLineNumber, "lineComment", e.target.value)}
                        disabled={delivery.invoiced || submitted || submitting}
                        placeholder="Item discrepancy comments"
                        className="h-9"
                      />
                    </div>

                    {lineError && <p className="text-xs text-brand-red mt-1">{lineError}</p>}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* SIGNATURE/RECEIVER INFO METADATA */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-brand-blue tracking-tight">Receiver Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="receiverName" className="text-sm text-brand-blue/70">Receiver Name *</Label>
                <Input
                  id="receiverName"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  disabled={delivery.invoiced || submitted || submitting}
                  placeholder="Enter recipient identity signature"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="receiverNotes" className="text-sm text-brand-blue/70">Notes (Optional)</Label>
                <Input
                  id="receiverNotes"
                  value={receiverNotes}
                  onChange={(e) => setReceiverNotes(e.target.value)}
                  disabled={delivery.invoiced || submitted || submitting}
                  placeholder="General operational operational remarks"
                />
              </div>
            </CardContent>
          </Card>

          {/* DYNAMIC HYBRID ATTACHMENTS VIEW GRID */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-brand-blue tracking-tight">Proof Images Asset Portal</CardTitle>
              <CardDescription className="text-xs text-brand-blue/60">Manage existing server assets or upload new images under 5MB limit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-brand-blue/70">Select New Files</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  multiple
                  onChange={handlePhotoUpload}
                  disabled={delivery.invoiced || submitting || (delivery.photos?.length || 0) + photoFiles.length - keysToDelete.length >= 5}
                />
                <p className="text-xs text-brand-blue/50">
                  Total Active Visuals: {((delivery.photos?.length || 0) + photoFiles.length - keysToDelete.length)} / 5 Max
                </p>
              </div>

              {photoErrors.map((pErr, pIdx) => (
                <p key={pIdx} className="text-xs text-brand-red">{pErr}</p>
              ))}

              {/* UNIFIED RENDER CORE */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                
                {/* PART A: Server Trace Photos with State-Driven Deletion Toggles */}
                {delivery.photos?.map((photo) => {
                  const isMarkedForDeletion = keysToDelete.includes(photo.storageKey);

                  return (
                    <div key={photo.storageKey} className="relative group rounded-lg overflow-hidden border border-brand-blue/10">
                      <div className={`aspect-square bg-brand-blue/5 transition-opacity ${isMarkedForDeletion ? "opacity-30 mix-blend-luminosity" : ""}`}>
                        <img src={photo.downloadUrl} alt={photo.fileName} className="w-full h-full object-cover" />
                      </div>
                      
                      {!delivery.invoiced && !submitted && (
                        <button
                          type="button"
                          onClick={() => {
                            setKeysToDelete(prev => 
                              prev.includes(photo.storageKey)
                                ? prev.filter(k => k !== photo.storageKey)
                                : [...prev, photo.storageKey]
                            );
                          }}
                          disabled={submitting}
                          className={`absolute top-1 right-1 rounded px-2 py-1 text-xs font-medium shadow-sm transition-opacity ${
                            isMarkedForDeletion 
                              ? "bg-brand-blue text-white opacity-100" 
                              : "bg-red-600 text-white opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          {isMarkedForDeletion ? "↩️ Keep" : "🗑️ Wipe"}
                        </button>
                      )}
                      
                      <p className="text-[10px] text-brand-blue/60 px-1.5 py-0.5 truncate bg-white/90 absolute bottom-0 w-full flex justify-between items-center">
                        <span className="truncate">{photo.fileName}</span>
                        <span className="text-[9px] font-semibold text-brand-blue/40 shrink-0 ml-1">
                          {isMarkedForDeletion ? "DELETING" : "Legacy"}
                        </span>
                      </p>
                    </div>
                  );
                })}

                {/* PART B: Staged Client File Previews Local Streams */}
                {photoFiles.map((file, idx) => (
                  <div key={`staged-${idx}`} className="relative group rounded-lg overflow-hidden border border-amber-300 bg-amber-50/5">
                    <div className="aspect-square">
                      <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                    </div>
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      disabled={submitting}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded p-1 text-xs"
                    >
                      ✕
                    </button>
                    <p className="text-[10px] text-amber-800 font-bold px-1.5 py-0.5 truncate bg-amber-100 absolute bottom-0 w-full flex justify-between items-center">
                      <span className="truncate">{file.name}</span>
                      <span className="text-[9px] font-extrabold text-amber-600 shrink-0 ml-1 uppercase tracking-wider">Staged</span>
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* DYNAMIC EXECUTION TOGGLE GATE */}
          {!submitted && (
            <Button type="submit" className="w-full" disabled={delivery.invoiced || submitting}>
              {submitting ? "Processing Operations..." : "Save Confirmation Updates"}
            </Button>
          )}

        </form>
      </div>
    </div>
  )
}