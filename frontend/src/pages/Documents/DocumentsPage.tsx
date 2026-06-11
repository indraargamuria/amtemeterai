import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "../../shared/components/ui/Card"
import { Button } from "../../shared/components/ui/Button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "../../shared/components/ui/Table"
import { Badge } from "../../shared/components/ui/Badge"
import { getInvoices } from "../../shared/utils/api"
import { cn } from "../../shared/utils/cn"
import { FileText, Truck, Package, AlertCircle, ChevronRight, X, Loader2 } from "lucide-react"

type FilterType = "all" | "delivery-centric" | "invoice-centric"

interface DocumentRow {
  id: number
  invoiceNumber: string
  deliveryNumber: string | null
  customerNumber: string
  customerName?: string
  invoiceAmount: number
  invoicedDate: string
  statusText: string
  stampingStatusText: string
  serialNumber?: string
  stampedDocumentUrl?: string
  hasPrintoutDocument: boolean
  isStandalone: boolean
}

type ViewTab = "delivery" | "invoice"

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>("all")
  const [selectedDoc, setSelectedDoc] = useState<DocumentRow | null>(null)
  const [activeTab, setActiveTab] = useState<ViewTab>("invoice")
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const invoices = await getInvoices()

      // Transform invoices into document rows
      const docRows: DocumentRow[] = invoices.map((inv) => ({
        id: inv.invoiceID,
        invoiceNumber: inv.invoiceNumber,
        deliveryNumber: inv.deliveryNumber || null,
        customerNumber: inv.customerNumber,
        customerName: inv.customerName,
        invoiceAmount: inv.invoiceAmount,
        invoicedDate: inv.invoicedDate,
        statusText: inv.statusText,
        stampingStatusText: inv.stampingStatusText,
        serialNumber: inv.serialNumber,
        stampedDocumentUrl: inv.stampedDocumentUrl,
        hasPrintoutDocument: inv.hasPrintoutDocument,
        isStandalone: !inv.deliveryNumber,
      }))

      setDocuments(docRows)
    } catch (err) {
      console.error("Failed to fetch documents:", err)
    } finally {
      setLoading(false)
    }
  }

  // Filter documents based on selected filter
  const filteredDocuments = useMemo(() => {
    switch (filter) {
      case "delivery-centric":
        return documents.filter((d) => !d.isStandalone)
      case "invoice-centric":
        return documents.filter((d) => d.isStandalone)
      default:
        return documents
    }
  }, [documents, filter])

  // Summary stats
  const stats = useMemo(() => ({
    total: documents.length,
    standalone: documents.filter((d) => d.isStandalone).length,
    linked: documents.filter((d) => !d.isStandalone).length,
    stamped: documents.filter((d) => d.stampingStatusText === "Stamped").length,
    pending: documents.filter((d) => d.stampingStatusText === "Not Stamped" || d.stampingStatusText === "Pending").length,
  }), [documents])

  // Format currency
  const formatRp = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Get status badge styling
  const getComplianceBadge = (status: string) => {
    switch (status) {
      case "Stamped":
        return "bg-emerald-50 text-emerald-700 border-emerald-200"
      case "Not Stamped":
      case "Draft":
        return "bg-slate-100 text-slate-600 border-slate-200"
      case "Pending":
        return "bg-amber-50 text-amber-700 border-amber-200"
      case "Failed":
      case "Sync Failed":
        return "bg-brand-red/10 text-brand-red border-brand-red/20"
      default:
        return "bg-slate-50 text-slate-500 border-slate-100"
    }
  }

  // Open sheet with document details
  const openSheet = (doc: DocumentRow) => {
    setSelectedDoc(doc)
    setActiveTab(doc.isStandalone ? "invoice" : "invoice")
    setSheetOpen(true)
  }

  // Close sheet
  const closeSheet = () => {
    setSheetOpen(false)
    // Delay clearing selected doc for animation
    setTimeout(() => setSelectedDoc(null), 300)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-brand-blue/5 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-brand-blue tracking-tight">Document Hub</h1>
            <p className="text-sm text-brand-blue/60 mt-1">
              Unified view of invoices and delivery documents
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Documents" value={stats.total} color="brand-blue" />
        <StatCard label="Linked Flow" value={stats.linked} color="emerald" />
        <StatCard label="Standalone" value={stats.standalone} color="slate" />
        <StatCard label="Stamped" value={stats.stamped} color="emerald" />
        <StatCard label="Pending Stamp" value={stats.pending} color="amber" alert />
      </div>

      {/* Filter Toggles */}
      <div className="flex items-center gap-2 bg-brand-blue/[0.02] p-1.5 rounded-lg border border-brand-blue/5 w-fit">
        <FilterButton
          active={filter === "all"}
          onClick={() => setFilter("all")}
          icon={<FileText className="w-4 h-4" />}
          label="All Documents"
        />
        <FilterButton
          active={filter === "delivery-centric"}
          onClick={() => setFilter("delivery-centric")}
          icon={<Truck className="w-4 h-4" />}
          label="Delivery-Centric"
        />
        <FilterButton
          active={filter === "invoice-centric"}
          onClick={() => setFilter("invoice-centric")}
          icon={<Package className="w-4 h-4" />}
          label="Invoice-Centric"
        />
      </div>

      {/* Documents Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-brand-blue/[0.02]">
                <TableHead className="py-3 px-4 text-xs font-semibold text-brand-blue/60 uppercase tracking-wider">
                  Invoice Ref
                </TableHead>
                <TableHead className="py-3 px-4 text-xs font-semibold text-brand-blue/60 uppercase tracking-wider">
                  Fulfillment
                </TableHead>
                <TableHead className="py-3 px-4 text-xs font-semibold text-brand-blue/60 uppercase tracking-wider text-right">
                  Amount
                </TableHead>
                <TableHead className="py-3 px-4 text-xs font-semibold text-brand-blue/60 uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="py-3 px-4 text-xs font-semibold text-brand-blue/60 uppercase tracking-wider text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-6 h-6 text-brand-blue/40 animate-spin" />
                      <p className="text-sm text-brand-blue/40">Loading documents...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-brand-blue/5 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-brand-blue/30" />
                      </div>
                      <p className="text-sm text-brand-blue/40">No documents found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocuments.map((doc) => (
                  <TableRow
                    key={doc.id}
                    className="hover:bg-brand-blue/[0.02] transition-colors cursor-pointer group"
                    onClick={() => openSheet(doc)}
                  >
                    {/* Invoice Ref - Monospace */}
                    <TableCell className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-md bg-brand-blue/10 flex items-center justify-center">
                          <FileText className="w-4 h-4 text-brand-blue" />
                        </div>
                        <code className="text-sm font-mono text-brand-blue tracking-tight">
                          {doc.invoiceNumber}
                        </code>
                      </div>
                    </TableCell>

                    {/* Fulfillment Tracking */}
                    <TableCell className="py-2.5 px-4">
                      {doc.isStandalone ? (
                        <Badge
                          variant="outline"
                          className="border-dashed border-slate-300 bg-slate-50/50 text-slate-500"
                        >
                          Direct Standalone Bill
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center">
                            <Truck className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                          <code className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            {doc.deliveryNumber}
                          </code>
                        </div>
                      )}
                    </TableCell>

                    {/* Financial Weight */}
                    <TableCell className="py-2.5 px-4 text-right">
                      <span className="text-sm font-mono font-medium text-brand-blue">
                        {formatRp(doc.invoiceAmount)}
                      </span>
                    </TableCell>

                    {/* Compliance Status */}
                    <TableCell className="py-2.5 px-4">
                      <Badge className={getComplianceBadge(doc.stampingStatusText)}>
                        {doc.stampingStatusText}
                      </Badge>
                    </TableCell>

                    {/* Operations Matrix */}
                    <TableCell className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* DO Button - Disabled for standalone */}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={doc.isStandalone}
                          onClick={(e) => {
                            e.stopPropagation()
                            // Navigate to delivery details
                            if (doc.deliveryNumber) {
                              window.location.href = `/deliveries?search=${doc.deliveryNumber}`
                            }
                          }}
                          className={cn(
                            "min-w-[80px]",
                            doc.isStandalone && "opacity-50 cursor-not-allowed"
                          )}
                          title={doc.isStandalone ? "No upstream delivery manifest" : "View delivery order"}
                        >
                          <Truck className="w-3.5 h-3.5" />
                          DO
                        </Button>

                        {/* Inspect Workspace - Primary Action */}
                        <Button
                          variant="default"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openSheet(doc)
                          }}
                          className="min-w-[120px]"
                        >
                          Inspect
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sliding Sheet Overlay */}
      {sheetOpen && selectedDoc && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-brand-blue/20 backdrop-blur-sm z-40 transition-opacity duration-300"
            onClick={closeSheet}
          />

          {/* Sheet Panel */}
          <div className="fixed top-0 right-0 bottom-0 w-[480px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out">
            <div className="h-full flex flex-col">
              {/* Sheet Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-brand-blue/5 bg-brand-blue/[0.02]">
                <div>
                  <h2 className="text-lg font-semibold text-brand-blue">Document Workspace</h2>
                  <p className="text-xs text-brand-blue/50 mt-0.5">
                    {selectedDoc.invoiceNumber}
                  </p>
                </div>
                <button
                  onClick={closeSheet}
                  className="p-2 rounded-md text-brand-blue/50 hover:bg-brand-blue/5 hover:text-brand-blue transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* View Tabs */}
              {!selectedDoc.isStandalone && (
                <div className="flex items-center gap-1 px-6 py-3 border-b border-brand-blue/5 bg-white">
                  <TabButton
                    active={activeTab === "delivery"}
                    onClick={() => setActiveTab("delivery")}
                    icon={<Truck className="w-4 h-4" />}
                    label="Delivery Order"
                  />
                  <TabButton
                    active={activeTab === "invoice"}
                    onClick={() => setActiveTab("invoice")}
                    icon={<FileText className="w-4 h-4" />}
                    label="Invoice PDF"
                  />
                </div>
              )}

              {/* Sheet Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeTab === "delivery" && selectedDoc.deliveryNumber ? (
                  <DeliveryTabContent doc={selectedDoc} />
                ) : (
                  <InvoiceTabContent doc={selectedDoc} />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ============== Sub-Components ==============

function StatCard({
  label,
  value,
  color,
  alert
}: {
  label: string
  value: number
  color: "brand-blue" | "emerald" | "slate" | "amber"
  alert?: boolean
}) {
  const colorMap = {
    "brand-blue": "text-brand-blue bg-brand-blue/10",
    "emerald": "text-emerald-700 bg-emerald-50",
    "slate": "text-slate-600 bg-slate-100",
    "amber": "text-amber-700 bg-amber-50",
  }

  return (
    <div className={cn(
      "p-4 rounded-lg border",
      alert ? "border-amber/30 bg-amber-[0.02]" : "border-brand-blue/5"
    )}>
      <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">{label}</p>
      <p className={cn(
        "text-2xl font-bold tracking-tight mt-1.5",
        colorMap[color]
      )}>{value}</p>
    </div>
  )
}

function FilterButton({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
        active
          ? "bg-white text-brand-blue shadow-sm"
          : "text-brand-blue/60 hover:text-brand-blue hover:bg-white/50"
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
        active
          ? "bg-brand-blue/10 text-brand-blue border border-brand-blue/20"
          : "text-brand-blue/50 hover:text-brand-blue hover:bg-brand-blue/5"
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function InvoiceTabContent({ doc }: { doc: DocumentRow }) {
  return (
    <div className="space-y-6">
      {/* Invoice Details Card */}
      <div className="bg-brand-blue/[0.02] rounded-lg p-5 border border-brand-blue/5">
        <h3 className="text-sm font-semibold text-brand-blue/70 mb-4">Invoice Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <DetailRow label="Invoice Number" value={doc.invoiceNumber} mono />
          <DetailRow label="Customer" value={`${doc.customerNumber} — ${doc.customerName || "N/A"}`} />
          <DetailRow label="Invoice Date" value={new Date(doc.invoicedDate).toLocaleDateString("id-ID", {
            year: "numeric",
            month: "long",
            day: "numeric"
          })} />
          <DetailRow label="Amount" value={new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0
          }).format(doc.invoiceAmount)} mono />
        </div>
      </div>

      {/* e-Meterai Status */}
      <div className="bg-brand-blue/[0.02] rounded-lg p-5 border border-brand-blue/5">
        <h3 className="text-sm font-semibold text-brand-blue/70 mb-4">e-Meterai Status</h3>
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-3 h-3 rounded-full",
            doc.stampingStatusText === "Stamped" ? "bg-emerald-500" :
            doc.stampingStatusText === "Pending" ? "bg-amber-500 animate-pulse" :
            "bg-slate-300"
          )} />
          <span className="text-sm font-medium text-brand-blue">
            {doc.stampingStatusText}
          </span>
        </div>
        {doc.serialNumber && (
          <div className="mt-4">
            <p className="text-xs text-brand-blue/50 uppercase tracking-wider mb-1">Serial Number</p>
            <code className="text-sm font-mono text-brand-blue bg-brand-blue/5 px-2 py-1 rounded">
              {doc.serialNumber}
            </code>
          </div>
        )}
      </div>

      {/* Document Links */}
      <div className="bg-brand-blue/[0.02] rounded-lg p-5 border border-brand-blue/5">
        <h3 className="text-sm font-semibold text-brand-blue/70 mb-4">Document Links</h3>
        <div className="space-y-3">
          {doc.stampedDocumentUrl ? (
            <DocumentLink
              label="Stamped Invoice PDF"
              url={doc.stampedDocumentUrl}
              status="available"
            />
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-md bg-slate-50/50 border border-slate-200">
              <AlertCircle className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-500">No stamped document available</span>
            </div>
          )}
        </div>
      </div>

      {/* Standalone Indicator */}
      {doc.isStandalone && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 border border-dashed border-slate-300">
          <Package className="w-5 h-5 text-slate-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-slate-700">Direct Standalone Invoice</p>
            <p className="text-xs text-slate-500 mt-1">
              This invoice originated directly from ERP billing without an upstream delivery order.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function DeliveryTabContent({ doc }: { doc: DocumentRow }) {
  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 rounded-lg p-5 border border-emerald-100">
        <h3 className="text-sm font-semibold text-emerald-700 mb-4">Linked Delivery Flow</h3>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-md bg-emerald-100 flex items-center justify-center">
            <Truck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-emerald-600 uppercase tracking-wider">Delivery Number</p>
            <code className="text-sm font-mono text-emerald-800 bg-emerald-100 px-2 py-1 rounded mt-0.5 inline-block">
              {doc.deliveryNumber}
            </code>
          </div>
        </div>
        <div className="text-xs text-emerald-600/70">
          This invoice has an associated delivery order in the system.
        </div>
      </div>

      <div className="bg-brand-blue/[0.02] rounded-lg p-5 border border-brand-blue/5">
        <h3 className="text-sm font-semibold text-brand-blue/70 mb-4">Customer Information</h3>
        <div className="space-y-3">
          <DetailRow label="Customer Number" value={doc.customerNumber} mono />
          <DetailRow label="Customer Name" value={doc.customerName || "N/A"} />
        </div>
      </div>

      <div className="bg-brand-blue/[0.02] rounded-lg p-5 border border-brand-blue/5">
        <h3 className="text-sm font-semibold text-brand-blue/70 mb-4">Document Links</h3>
        <div className="space-y-3">
          {doc.stampedDocumentUrl ? (
            <DocumentLink
              label="Stamped Invoice PDF"
              url={doc.stampedDocumentUrl}
              status="available"
            />
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-md bg-slate-50/50 border border-slate-200">
              <AlertCircle className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-500">No stamped document available</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailRow({
  label,
  value,
  mono
}: {
  label: string
  value: string | number
  mono?: boolean
}) {
  return (
    <div>
      <p className="text-xs text-brand-blue/50 uppercase tracking-wider">{label}</p>
      <p className={cn(
        "text-sm font-medium text-brand-blue mt-0.5",
        mono && "font-mono"
      )}>{value}</p>
    </div>
  )
}

function DocumentLink({
  label,
  url
}: {
  label: string
  url: string
  status: "available" | "pending"
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between p-3 rounded-md bg-white border border-brand-blue/10 hover:border-brand-blue/20 hover:bg-brand-blue/[0.02] transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-brand-blue/10 flex items-center justify-center">
          <FileText className="w-4 h-4 text-brand-blue" />
        </div>
        <span className="text-sm font-medium text-brand-blue group-hover:text-brand-blue/80">
          {label}
        </span>
      </div>
      <ChevronRight className="w-4 h-4 text-brand-blue/40 group-hover:text-brand-blue/60 transition-colors" />
    </a>
  )
}
