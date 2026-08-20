import { useMemo, useState } from "react"
import { X, Mail, Send, Loader2, Paperclip, FileText, ExternalLink, AlertCircle, CheckCircle2, Ban } from "lucide-react"
import { useApi } from "../../utils/api"
import { cn } from "../../utils/cn"

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

/** Minimal item shape the modal needs (subset of DocumentHubItem). */
export interface HubEmailItem {
  key: string
  type: "delivery-with-invoice" | "delivery-only" | "standalone-invoice"
  customerCode: string
  customerName: string
  customerEmail: string | null
  deliveryNumber: string | null
  invoiceNumber: string | null
  deliveryPrintoutUrl?: string | null
  invoicePrintoutUrl?: string | null
  isReadyToSend?: boolean
}

/** Per-document editable email draft — recipient, subject, body are ALL per-item. */
interface EmailDraft {
  to: string
  subject: string
  body: string
}

interface DocumentsHubEmailModalProps {
  isOpen: boolean
  onClose: () => void
  /** All documents to email — ONE email per item, each with its own draft. */
  items: HubEmailItem[]
}

/** Reference line for the transaction number(s), e.g. "Delivery DO-123 & Invoice INV-456". */
function referenceLine(it: HubEmailItem): string {
  if (it.type === "delivery-only") return `Delivery ${it.deliveryNumber}`
  if (it.type === "standalone-invoice") return `Invoice ${it.invoiceNumber}`
  return `Delivery ${it.deliveryNumber} & Invoice ${it.invoiceNumber}`
}

/** Default draft per document: customer email as recipient, subject/body carry the transaction number. */
function makeDraft(it: HubEmailItem): EmailDraft {
  const ref = referenceLine(it)
  return {
    to: it.customerEmail ?? "",
    subject: `Documents: ${ref}`,
    body: `Dear Valued Customer,\n\nPlease find attached the document(s) for your reference:\n\n${ref}\n\nThank you for your business.`
  }
}

/**
 * 2-level Document Hub email modal:
 *  LEFT: customer → per-document navigation (bookmark style).
 *  RIGHT: email draft editor (recipient, subject, body) + attachment preview.
 * Every field is linked to the ACTIVE document individually; defaults are
 * customer email (recipient) + transaction number (subject & body).
 * Sends ONE email per document, each with its own draft.
 */
export function DocumentsHubEmailModal({
  isOpen,
  onClose,
  items
}: DocumentsHubEmailModalProps) {
  const api = useApi()

  // Per-item drafts, initialized once on open (component mounts fresh each time).
  const [drafts, setDrafts] = useState<Record<string, EmailDraft>>(() =>
    Object.fromEntries(items.map((it) => [it.key, makeDraft(it)]))
  )
  const [sending, setSending] = useState(false)
  const [sentCount, setSentCount] = useState(0)
  const [error, setError] = useState("")
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [activeItemKey, setActiveItemKey] = useState<string | null>(null)

  // Group items by customer for the 2-level nav (bookmark concept)
  const customers = useMemo(() => {
    const map = new Map<string, HubEmailItem[]>()
    for (const it of items) {
      const ck = it.customerCode
      if (!map.has(ck)) map.set(ck, [])
      map.get(ck)!.push(it)
    }
    return Array.from(map.entries())
  }, [items])

  // Default to expanding first customer + selecting first item on open
  const activeKey = activeItemKey ?? items[0]?.key ?? null
  const activeItem = items.find((i) => i.key === activeKey) ?? null
  const activeDraft = activeItem ? (drafts[activeItem.key] ?? makeDraft(activeItem)) : null

  const updateActiveDraft = (patch: Partial<EmailDraft>) => {
    if (!activeItem) return
    setDrafts((prev) => {
      const current = prev[activeItem.key] ?? makeDraft(activeItem)
      return { ...prev, [activeItem.key]: { ...current, ...patch } }
    })
  }

  const buildAttachmentRefs = (item: HubEmailItem): EmailAttachmentRef[] => {
    const refs: EmailAttachmentRef[] = []
    if (item.deliveryNumber && item.type !== "standalone-invoice") {
      refs.push({
        referenceType: "delivery",
        referenceNumber: item.deliveryNumber,
        label: `DO ${item.deliveryNumber}`,
        previewUrl: item.deliveryPrintoutUrl ?? undefined,
        hasPreview: !!item.deliveryPrintoutUrl
      })
    }
    if (item.invoiceNumber) {
      refs.push({
        referenceType: "invoice",
        referenceNumber: item.invoiceNumber,
        label: `Invoice ${item.invoiceNumber}`,
        previewUrl: item.invoicePrintoutUrl ?? undefined,
        hasPreview: !!item.invoicePrintoutUrl
      })
    }
    return refs
  }

  const handleSend = async () => {
    // Validate every draft has a recipient (each doc sends its own email)
    const missing = items.filter((it) => !(drafts[it.key]?.to ?? "").trim())
    if (missing.length > 0) {
      const first = missing[0].key
      setError(
        missing.length === 1
          ? `Recipient email is required for ${first}.`
          : `Recipient email is required for ${first} and ${missing.length - 1} more.`
      )
      return
    }
    setSending(true)
    setError("")
    setSentCount(0)

    try {
      // ONE email per document, each with its own recipient/subject/body
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        const d = drafts[it.key] ?? makeDraft(it)
        const attachments = buildAttachmentRefs(it)
        for (const a of attachments) {
          const response = await api.post("/api/email/send-with-attachments", {
            toEmail: d.to,
            toName: it.customerName,
            subject: d.subject,
            body: d.body,
            referenceType: a.referenceType,
            referenceNumber: a.referenceNumber,
            ccEmails: ""
          })
          if (!response.ok) {
            throw new Error(`Failed to send for ${a.referenceNumber}`)
          }
        }
        setSentCount(i + 1)
      }

      alert("Email(s) sent successfully!")
      onClose()
    } catch (err) {
      console.error("Failed to send email:", err)
      setError(
        sentCount > 0
          ? `Sent ${sentCount}/${items.length}, failed on remaining. Please retry.`
          : "An error occurred while sending the email."
      )
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-brand-blue/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-5xl h-[80vh] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-brand-blue/10 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-blue/5 bg-brand-blue/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-blue/10 flex items-center justify-center">
              <Mail className="w-4.5 h-4.5 text-brand-blue dark:text-slate-100" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-brand-blue dark:text-slate-100">Email Documents</h2>
              <p className="text-xs text-brand-blue dark:text-slate-100/50 dark:text-slate-400">
                {items.length} document{items.length !== 1 ? "s" : ""} · one email per document, fields editable per document
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-md text-brand-blue dark:text-slate-100/50 dark:text-slate-400 hover:bg-brand-blue/5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Recipient + Subject (for the ACTIVE document) */}
        {activeItem && activeDraft && (
          <div className="px-6 py-4 border-b border-brand-blue/5 space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-brand-blue dark:text-slate-100/60 dark:text-slate-400 uppercase tracking-wider w-24">To</label>
              <input
                type="email"
                value={activeDraft.to}
                onChange={(e) => updateActiveDraft({ to: e.target.value })}
                placeholder={activeItem.customerEmail || "recipient@company.com"}
                className="flex-1 px-3 py-2 rounded-md bg-white dark:bg-slate-800 border border-brand-blue/10 dark:border-slate-700 text-sm text-brand-blue dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
              {activeItem.customerEmail && (
                <button
                  onClick={() => updateActiveDraft({ to: activeItem.customerEmail! })}
                  className="text-xs text-brand-blue/60 hover:text-brand-blue underline shrink-0"
                >
                  Use customer email
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-brand-blue dark:text-slate-100/60 dark:text-slate-400 uppercase tracking-wider w-24">Subject</label>
              <input
                type="text"
                value={activeDraft.subject}
                onChange={(e) => updateActiveDraft({ subject: e.target.value })}
                className="flex-1 px-3 py-2 rounded-md bg-white dark:bg-slate-800 border border-brand-blue/10 dark:border-slate-700 text-sm text-brand-blue dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>
          </div>
        )}

        {/* Body: LEFT nav + RIGHT preview */}
        <div className="flex-1 flex min-h-0">
          {/* LEFT: 2-level customer → document nav */}
          <div className="w-72 border-r border-brand-blue/5 bg-brand-blue/[0.015] overflow-y-auto p-3">
            {customers.map(([ck, cItems]) => {
              const isExpanded = expandedCustomer === ck || (expandedCustomer === null && ck === customers[0]?.[0])
              return (
                <div key={ck} className="mb-1">
                  <button
                    onClick={() => setExpandedCustomer(isExpanded ? null : ck)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors",
                      isExpanded ? "bg-brand-blue/10 text-brand-blue dark:text-slate-100" : "text-brand-blue dark:text-slate-100/60 dark:text-slate-300 hover:bg-brand-blue/5"
                    )}
                  >
                    <span className={cn("text-xs transition-transform", isExpanded && "rotate-90")}>▶</span>
                    <span className="flex-1 truncate text-sm font-medium">{cItems[0].customerName}</span>
                    <span className="text-xs text-brand-blue/50 dark:text-slate-400">{cItems.length}</span>
                  </button>
                  {isExpanded && (
                    <div className="ml-5 mt-0.5 space-y-0.5">
                      {cItems.map((it) => (
                        <button
                          key={it.key}
                          onClick={() => setActiveItemKey(it.key)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors",
                            activeKey === it.key
                              ? "bg-brand-blue/10 text-brand-blue dark:text-slate-100"
                              : "text-brand-blue dark:text-slate-100/60 dark:text-slate-400 hover:bg-brand-blue/5"
                          )}
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span className="flex-1 truncate text-xs font-mono">{it.key}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* RIGHT: email body (active doc) + attachment preview */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* body editor — active document only */}
            {activeDraft && (
              <div className="p-4 border-b border-brand-blue/5">
                <label className="text-xs font-medium text-brand-blue dark:text-slate-100/60 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Email Body</label>
                <textarea
                  value={activeDraft.body}
                  onChange={(e) => updateActiveDraft({ body: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 rounded-md bg-white dark:bg-slate-800 border border-brand-blue/10 dark:border-slate-700 text-sm text-brand-blue dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none"
                />
              </div>
            )}

            {/* ready-to-send badge + attachment preview */}
            {activeItem && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Ready badge */}
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium",
                  activeItem.isReadyToSend
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                )}>
                  {activeItem.isReadyToSend
                    ? <><CheckCircle2 className="w-4 h-4" /> Ready to send</>
                    : <><AlertCircle className="w-4 h-4" /> Not ready: DO must be confirmed & invoice stamped</>}
                </div>

                {/* Attachment list for active item */}
                <div>
                  <p className="text-xs font-medium text-brand-blue dark:text-slate-100/60 dark:text-slate-400 uppercase tracking-wider mb-2">Attachments ({buildAttachmentRefs(activeItem).length})</p>
                  <div className="space-y-2">
                    {buildAttachmentRefs(activeItem).map((a) => (
                      <div key={a.referenceType + a.referenceNumber} className="flex items-center gap-3 p-2.5 rounded-md bg-white dark:bg-slate-800 border border-brand-blue/10 dark:border-slate-700">
                        <div className="w-8 h-8 rounded-md bg-brand-blue/10 flex items-center justify-center">
                          <FileText className="w-4 h-4 text-brand-blue dark:text-slate-100" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-brand-blue dark:text-slate-100 truncate">{a.label}</p>
                          <p className="text-xs text-brand-blue/50 dark:text-slate-400">
                            {a.hasPreview ? "PDF available for preview" : "No document on file"}
                          </p>
                        </div>
                        {a.hasPreview ? (
                          <a
                            href={a.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-brand-blue/10 text-brand-blue dark:text-slate-100 hover:bg-brand-blue/20 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Preview
                          </a>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Ban className="w-3.5 h-3.5" /> N/A
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-brand-blue/5 bg-brand-blue/[0.02]">
          <div className="text-xs text-brand-blue/60 dark:text-slate-400">
            {error ? (
              <span className="text-brand-red">{error}</span>
            ) : (
              <>
                <Paperclip className="w-3.5 h-3.5 inline mr-1" />
                {items.reduce((acc, it) => acc + (it.deliveryNumber && it.type !== "standalone-invoice" ? 1 : 0) + (it.invoiceNumber ? 1 : 0), 0)} total attachments
                {sending && sentCount > 0 && ` · sent ${sentCount}/${items.length}`}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ButtonGhost onClick={onClose} disabled={sending}>Cancel</ButtonGhost>
            <button
              onClick={handleSend}
              disabled={sending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-brand-blue text-white text-sm font-medium hover:bg-brand-blue/90 disabled:opacity-50 transition-colors min-w-[140px] justify-center"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? "Sending..." : `Send ${items.length} Email${items.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ButtonGhost({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded-md text-sm font-medium text-brand-blue dark:text-slate-100 border border-brand-blue/10 dark:border-slate-700 hover:bg-brand-blue/5 disabled:opacity-50 transition-colors"
    >
      {children}
    </button>
  )
}
