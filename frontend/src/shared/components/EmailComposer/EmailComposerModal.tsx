import { useState } from "react"
import { X, Mail, Send, Loader2, Paperclip, FileText, Truck, ExternalLink } from "lucide-react"
import { useApi } from "../../utils/api"

export interface EmailAttachmentRef {
  /** "delivery" or "invoice" — passed to the backend email service */
  referenceType: "delivery" | "invoice"
  /** Reference number used by the backend to resolve + attach documents */
  referenceNumber: string
  /** Human label shown in the preview list, e.g. "DO 12345" */
  label: string
  /** Direct PDF URL (AllowAnonymous download endpoint) for inline preview */
  previewUrl?: string
  /** Whether a stamped invoice / DO printout exists for preview */
  hasPreview?: boolean
}

interface EmailComposerModalProps {
  isOpen: boolean
  onClose: () => void
  /** One or more documents to attach. Multiple = one email per reference sent in sequence. */
  attachments: EmailAttachmentRef[]
  customerName: string
  customerEmail?: string
  /** Optional bulk email subject override (used when sending several docs at once) */
  subject?: string
}

export function EmailComposerModal({
  isOpen,
  onClose,
  attachments,
  customerName,
  customerEmail = "",
  subject
}: EmailComposerModalProps) {
  const [toEmail, setToEmail] = useState(customerEmail)
  const [subjectText, setSubjectText] = useState(
    subject ||
      (attachments.length === 1
        ? `Document: ${attachments[0].referenceType === "delivery" ? "Delivery" : "Invoice"} ${attachments[0].referenceNumber}`
        : `Documents (${attachments.length}): ${attachments.map((a) => a.referenceNumber).join(", ")}`)
  )
  const [body, setBody] = useState("")
  const [ccEmails, setCcEmails] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [sentCount, setSentCount] = useState(0)
  const [previewIdx, setPreviewIdx] = useState(0)

  const api = useApi()

  const defaultEmailBody = `
    <div style="font-family: Arial, sans-serif; color: #1d2351; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1d2351;">Document Notification</h2>
      <p>Dear ${customerName},</p>
      <p>Please find attached the documents related to your ${attachments.map((a) => a.label).join(", ")}.</p>
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

    if (!subjectText) {
      setError("Subject is required")
      return
    }

    setSending(true)
    setError("")
    setSentCount(0)

    try {
      // Send one email per attachment reference (backend resolves + attaches docs for each)
      for (let i = 0; i < attachments.length; i++) {
        const a = attachments[i]
        const response = await api.post("/api/email/send-with-attachments", {
          toEmail,
          toName: customerName,
          subject: subjectText,
          body: body || defaultEmailBody,
          referenceType: a.referenceType,
          referenceNumber: a.referenceNumber,
          ccEmails
        })

        if (!response.ok) {
          throw new Error(`Failed to send for ${a.referenceNumber}`)
        }
        setSentCount(i + 1)
      }

      alert("Email(s) sent successfully!")
      onClose()
    } catch (err) {
      console.error("Failed to send email:", err)
      setError(sentCount > 0 ? `Sent ${sentCount}/${attachments.length}, failed on remaining. Please retry.` : "An error occurred while sending the email.")
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  const previewable = attachments.filter((a) => a.previewUrl)
  const activePreview = previewable[previewIdx] ?? null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-brand-blue/20 backdrop-blur-sm z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl transform transition-all max-h-[92vh] flex flex-col dark:bg-slate-900 dark:border dark:border-slate-800">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-brand-blue/5 bg-brand-blue/[0.02] dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-brand-blue dark:text-slate-200" />
              <h2 className="text-lg font-semibold text-brand-blue dark:text-slate-200">
                Send Email with Attachments
                {attachments.length > 1 && (
                  <span className="ml-2 text-xs font-medium text-brand-blue/60 dark:text-slate-400 bg-brand-blue/5 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    {attachments.length} documents
                  </span>
                )}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-md text-brand-blue/50 hover:bg-brand-blue/5 hover:text-brand-blue transition-colors dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content: two-column (form + attachment preview) */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-6 p-6">
              {/* Left: form fields */}
              <div className="space-y-4">
                {/* Attachment Reference list */}
                <div className="bg-brand-blue/5 rounded-lg p-3 text-sm dark:bg-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Paperclip className="w-4 h-4 text-brand-blue/60 dark:text-slate-300" />
                    <span className="font-medium text-brand-blue/80 dark:text-slate-300">
                      Attachments ({attachments.length})
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {attachments.map((a, idx) => (
                      <div
                        key={`${a.referenceType}-${a.referenceNumber}`}
                        className="flex items-center gap-2 text-brand-blue/70 dark:text-slate-400"
                      >
                        {a.referenceType === "delivery" ? (
                          <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-brand-blue shrink-0" />
                        )}
                        <span className="font-mono text-xs truncate">{a.label}</span>
                        {a.hasPreview === false ? (
                          <span className="text-[10px] uppercase tracking-wide text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400 px-1.5 py-0.5 rounded ml-auto shrink-0">
                            no PDF
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPreviewIdx(idx)}
                            className="text-[11px] text-brand-blue/60 hover:text-brand-blue dark:text-slate-400 dark:hover:text-slate-200 ml-auto shrink-0 underline underline-offset-2"
                          >
                            preview
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* To Email */}
                <div>
                  <label className="block text-sm font-medium text-brand-blue mb-1 dark:text-slate-300">
                    To <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-brand-blue/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:ring-brand-blue/40"
                    placeholder="customer@example.com"
                  />
                </div>

                {/* CC Emails */}
                <div>
                  <label className="block text-sm font-medium text-brand-blue mb-1 dark:text-slate-300">CC (comma-separated)</label>
                  <input
                    type="text"
                    value={ccEmails}
                    onChange={(e) => setCcEmails(e.target.value)}
                    className="w-full px-3 py-2 border border-brand-blue/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:ring-brand-blue/40"
                    placeholder="cc1@example.com, cc2@example.com"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-brand-blue mb-1 dark:text-slate-300">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={subjectText}
                    onChange={(e) => setSubjectText(e.target.value)}
                    className="w-full px-3 py-2 border border-brand-blue/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:ring-brand-blue/40"
                    placeholder="Email subject"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm font-medium text-brand-blue mb-1 dark:text-slate-300">Message</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full px-3 py-2 border border-brand-blue/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 min-h-[120px] dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:ring-brand-blue/40"
                    placeholder="Enter your message (HTML allowed)..."
                  />
                  <p className="text-xs text-brand-blue/40 mt-1 dark:text-slate-500">Leave blank to use default template</p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm dark:bg-red-950 dark:border-red-900 dark:text-red-400">
                    {error}
                  </div>
                )}
              </div>

              {/* Right: attachment preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-brand-blue dark:text-slate-300 uppercase tracking-wider">Attachment Preview</p>
                  {activePreview && (
                    <a
                      href={activePreview.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-brand-blue/60 hover:text-brand-blue dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open full size
                    </a>
                  )}
                </div>
                {activePreview ? (
                  <div className="border border-brand-blue/10 rounded-lg overflow-hidden bg-brand-blue/[0.02] dark:border-slate-700">
                    <div className="flex items-center justify-between px-3 py-2 bg-brand-blue/[0.03] dark:bg-slate-800 border-b border-brand-blue/5 dark:border-slate-700">
                      <span className="text-xs font-medium font-mono text-brand-blue dark:text-slate-300 truncate">
                        {activePreview.label}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-brand-blue/40 dark:text-slate-500 shrink-0 ml-2">PDF</span>
                    </div>
                    <iframe
                      src={`${activePreview.previewUrl}#toolbar=0&navpanes=0&view=FitH`}
                      title={`Preview ${activePreview.label}`}
                      className="w-full h-64 md:h-80 bg-white"
                    />
                  </div>
                ) : (
                  <div className="border border-dashed border-brand-blue/10 rounded-lg p-8 text-center dark:border-slate-700">
                    <FileText className="w-8 h-8 text-brand-blue/20 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-brand-blue/50 dark:text-slate-400">No PDF preview available for the selected documents</p>
                    <p className="text-xs text-brand-blue/30 dark:text-slate-500 mt-1">The email will still include the files stored for each reference.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-brand-blue/5 bg-brand-blue/[0.02] dark:border-slate-800">
            <span className="text-xs text-brand-blue/50 dark:text-slate-500 mr-auto">
              {attachments.length > 1 ? `${attachments.length} email${attachments.length > 1 ? "s" : ""} will be sent (one per document)` : "1 email will be sent"}
              {sending && sentCount > 0 && ` — ${sentCount}/${attachments.length} sent`}
            </span>
            <button
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 text-sm font-medium text-brand-blue/70 hover:text-brand-blue hover:bg-brand-blue/5 rounded-lg transition-colors disabled:opacity-50 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-800"
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
                  Send {attachments.length > 1 ? `${attachments.length} Emails` : "Email"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
