import { useState } from "react"
import { X, Mail, Send, Loader2, Paperclip } from "lucide-react"
import { useApi } from "../../utils/api"

interface EmailComposerModalProps {
  isOpen: boolean
  onClose: () => void
  referenceType: "delivery" | "invoice"
  referenceNumber: string
  customerName: string
  customerEmail?: string
}

export function EmailComposerModal({
  isOpen,
  onClose,
  referenceType,
  referenceNumber,
  customerName,
  customerEmail = ""
}: EmailComposerModalProps) {
  const [toEmail, setToEmail] = useState(customerEmail)
  const [subject, setSubject] = useState(`Document: ${referenceType === "delivery" ? "Delivery" : "Invoice"} ${referenceNumber}`)
  const [body, setBody] = useState("")
  const [ccEmails, setCcEmails] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  const api = useApi()

  const defaultEmailBody = `
    <div style="font-family: Arial, sans-serif; color: #1d2351; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1d2351;">Document Notification</h2>
      <p>Dear ${customerName},</p>
      <p>Please find attached the documents related to your ${referenceType === "delivery" ? "Delivery" : "Invoice"} ${referenceNumber}.</p>
      <p>If you have any questions, please don't hesitate to contact us.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 11px; color: #94a3b8;">This email was sent automatically from the document management system.</p>
    </div>
  `

  const handleSend = async () => {
    if (!toEmail) {
      setError("Recipient email is required")
      return
    }

    if (!subject) {
      setError("Subject is required")
      return
    }

    setSending(true)
    setError("")

    try {
      const response = await api.post("/api/email/send-with-attachments", {
        toEmail,
        toName: customerName,
        subject,
        body: body || defaultEmailBody,
        referenceType,
        referenceNumber,
        ccEmails
      })

      if (response.ok) {
        alert("Email sent successfully!")
        onClose()
      } else {
        setError("Failed to send email. Please try again.")
      }
    } catch (err) {
      console.error("Failed to send email:", err)
      setError("An error occurred while sending the email.")
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-brand-blue/20 backdrop-blur-sm z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-brand-blue/5 bg-brand-blue/[0.02]">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-brand-blue" />
              <h2 className="text-lg font-semibold text-brand-blue">Send Email with Attachments</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-md text-brand-blue/50 hover:bg-brand-blue/5 hover:text-brand-blue transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Reference Info */}
            <div className="bg-brand-blue/5 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <Paperclip className="w-4 h-4 text-brand-blue/60" />
                <span className="font-medium text-brand-blue/80">Attachment Reference:</span>
              </div>
              <div className="text-brand-blue/60">
                <span className="font-medium">{referenceType === "delivery" ? "Delivery" : "Invoice"}:</span> {referenceNumber}
              </div>
            </div>

            {/* To Email */}
            <div>
              <label className="block text-sm font-medium text-brand-blue mb-1">
                To <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                className="w-full px-3 py-2 border border-brand-blue/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                placeholder="customer@example.com"
              />
            </div>

            {/* CC Emails */}
            <div>
              <label className="block text-sm font-medium text-brand-blue mb-1">CC (comma-separated)</label>
              <input
                type="text"
                value={ccEmails}
                onChange={(e) => setCcEmails(e.target.value)}
                className="w-full px-3 py-2 border border-brand-blue/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                placeholder="cc1@example.com, cc2@example.com"
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-brand-blue mb-1">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border border-brand-blue/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                placeholder="Email subject"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-sm font-medium text-brand-blue mb-1">Message</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-3 py-2 border border-brand-blue/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 min-h-[150px]"
                placeholder="Enter your message (HTML allowed)..."
              />
              <p className="text-xs text-brand-blue/40 mt-1">Leave blank to use default template</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-brand-blue/5 bg-brand-blue/[0.02]">
            <button
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 text-sm font-medium text-brand-blue/70 hover:text-brand-blue hover:bg-brand-blue/5 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-blue hover:bg-brand-blue/90 rounded-lg transition-colors disabled:opacity-50"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Email
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
