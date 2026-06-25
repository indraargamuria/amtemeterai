import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "../../shared/components/ui/Card"
import { Button } from "../../shared/components/ui/Button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "../../shared/components/ui/Table"
import { Badge } from "../../shared/components/ui/Badge"
import { getInvoices, type Invoice } from "../../shared/utils/api"
import { cn } from "../../shared/utils/cn"
import { FileText, Download, Stamp, AlertCircle } from "lucide-react"

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 20

  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const data = await getInvoices()
      setInvoices(data)
    } catch (err) {
      console.error("Failed to fetch invoices:", err)
    } finally {
      setLoading(false)
    }
  }

  const filteredInvoices = useMemo(() => {
    let filtered = [...invoices]

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(query) ||
          (inv.customerName?.toLowerCase().includes(query) ?? false) ||
          (inv.customerNumber?.toLowerCase().includes(query) ?? false) ||
          (inv.serialNumber?.toLowerCase().includes(query) ?? false)
      )
    }

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.invoicedDate).getTime() - new Date(a.invoicedDate).getTime())

    return filtered
  }, [invoices, searchQuery])

  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const currentInvoices = filteredInvoices.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const getStatusVariant = (statusText: string): "default" | "success" | "warning" | "accent" | "outline" => {
    switch (statusText) {
      case "Draft": return "default"
      case "Stamped": return "success"
      case "Sync Failed": return "accent"
      case "Synced to SAP": return "success"
      case "Canceled": return "outline"
      default: return "default"
    }
  }

  const getStampingStatusVariant = (statusText: string): "default" | "success" | "warning" | "accent" | "outline" => {
    switch (statusText) {
      case "Not Stamped": return "default"
      case "Pending": return "warning"
      case "Stamped": return "success"
      case "Failed": return "accent"
      default: return "default"
    }
  }

  const handleDownload = async (url?: string) => {
    if (!url) {
      console.warn("Download blocked: The URL provided is undefined or empty.")
      return
    }

    try {
      // 1. Extract the filename from the URL query string parameter 'key'
      // Example: ...?key=invoices/3410023355/printouts/INV_3410023355.pdf -> INV_3410023355.pdf
      const urlObj = new URL(url)
      const storageKey = urlObj.searchParams.get("key") || ""
      const filename = storageKey.split("/").pop() || "document.pdf"

      // 2. Fetch the file data as a binary blob stream
      const response = await fetch(url)
      if (!response.ok) throw new Error("Network response was not ok")
      const blob = await response.blob()

      // 3. Create a transient local object URL representing the file data
      const blobUrl = window.URL.createObjectURL(blob)

      // 4. Mount a temporary hidden anchor tag to trigger a programmatically targeted save action
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = filename // <-- THIS ENFORCES THE CUSTOM FILE NAME
      document.body.appendChild(link)
      link.click()

      // 5. Clean up the system memory and DOM bindings immediately
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("Frontend download routing failed, falling back to window.open:", error)
      // Fallback if CORS or fetch errors occur
      window.open(url, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-brand-blue/5 pb-5">
        <h1 className="text-2xl font-semibold text-brand-blue tracking-tight">Invoices Workbench</h1>
        <p className="text-sm text-brand-blue/60">High-density invoice processing and e-Meterai management</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <SummaryCard
          title="Total Invoices"
          value={invoices.length}
          subtitle="All records"
          icon={<FileText className="w-5 h-5" />}
        />
        <SummaryCard
          title="Pending Stamps"
          value={invoices.filter(i => i.stampingStatusText === "Not Stamped" || i.stampingStatusText === "Pending").length}
          subtitle="Awaiting e-Meterai"
          isAlert
          icon={<Stamp className="w-5 h-5" />}
        />
        <SummaryCard
          title="Stamped"
          value={invoices.filter(i => i.stampingStatusText === "Stamped").length}
          subtitle="Completed"
          icon={<Stamp className="w-5 h-5" />}
        />
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search by invoice number, customer, or serial number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-brand-blue/10 rounded-lg bg-white text-brand-blue placeholder:text-brand-blue/40 focus:outline-none focus:ring-2 focus:ring-brand-blue/10 focus:border-brand-blue/20"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-blue/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* High-Density Invoice Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-brand-blue/5 hover:bg-brand-blue/5">
                  <TableHead className="font-semibold text-brand-blue text-xs uppercase tracking-wider py-3 px-4">Invoice</TableHead>
                  <TableHead className="font-semibold text-brand-blue text-xs uppercase tracking-wider py-3 px-4">Customer</TableHead>
                  <TableHead className="font-semibold text-brand-blue text-xs uppercase tracking-wider py-3 px-4">Invoice Date</TableHead>
                  <TableHead className="font-semibold text-brand-blue text-xs uppercase tracking-wider py-3 px-4 text-right">Amount</TableHead>
                  <TableHead className="font-semibold text-brand-blue text-xs uppercase tracking-wider py-3 px-4">Serial</TableHead>
                  <TableHead className="font-semibold text-brand-blue text-xs uppercase tracking-wider py-3 px-4">Status</TableHead>
                  <TableHead className="font-semibold text-brand-blue text-xs uppercase tracking-wider py-3 px-4">Stamping</TableHead>
                  <TableHead className="font-semibold text-brand-blue text-xs uppercase tracking-wider py-3 px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-brand-blue/50 py-12">
                      Loading invoices...
                    </TableCell>
                  </TableRow>
                ) : filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-brand-blue/50 py-12">
                      {invoices.length === 0 ? "No invoices found" : "No invoices match your search"}
                    </TableCell>
                  </TableRow>
                ) : (
                  currentInvoices.map((invoice) => (
                    <TableRow
                      key={invoice.invoiceID}
                      className="hover:bg-brand-blue/[0.02] transition-colors"
                    >
                      {/* Invoice Number */}
                      <TableCell className="py-2.5 px-4">
                        <span className="font-mono text-sm font-medium text-brand-blue tracking-tight">
                          {invoice.invoiceNumber}
                        </span>
                      </TableCell>

                      {/* Customer */}
                      <TableCell className="py-2.5 px-4">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-brand-blue">
                            {invoice.customerName || "-"}
                          </p>
                          <p className="text-xs text-brand-blue/50 font-mono">
                            {invoice.customerNumber}
                          </p>
                        </div>
                      </TableCell>

                      {/* Invoice Date */}
                      <TableCell className="py-2.5 px-4">
                        <span className="text-sm text-brand-blue/70">
                          {formatDate(invoice.invoicedDate)}
                        </span>
                      </TableCell>

                      {/* Amount */}
                      <TableCell className="py-2.5 px-4 text-right">
                        <span className="text-sm font-semibold text-brand-blue tabular-nums">
                          {formatCurrency(invoice.invoiceAmount)}
                        </span>
                      </TableCell>

                      {/* Serial Number */}
                      <TableCell className="py-2.5 px-4">
                        {invoice.serialNumber ? (
                          <span className="text-xs font-mono text-brand-blue/70 bg-brand-blue/5 px-2 py-1 rounded">
                            {invoice.serialNumber}
                          </span>
                        ) : (
                          <span className="text-xs text-brand-blue/30">—</span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-2.5 px-4">
                        <Badge variant={getStatusVariant(invoice.statusText)} className="text-xs">
                          {invoice.statusText}
                        </Badge>
                      </TableCell>

                      {/* Stamping Status */}
                      <TableCell className="py-2.5 px-4">
                        <Badge variant={getStampingStatusVariant(invoice.stampingStatusText)} className="text-xs">
                          {invoice.stampingStatusText === "Pending" && (
                            <span className="inline-block w-1.5 h-1.5 bg-amber-500 rounded-full mr-1.5 animate-pulse" />
                          )}
                          {invoice.stampingStatusText === "Failed" && (
                            <AlertCircle className="w-3 h-3 mr-1 inline" />
                          )}
                          {invoice.stampingStatusText}
                        </Badge>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-2.5 px-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* Download Unstamped (Always enabled) */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(invoice.unstampedDocumentUrl)}
                            disabled={!invoice.unstampedDocumentUrl}
                            title={invoice.unstampedDocumentUrl ? "Download unstamped document" : "No unstamped document available"}
                            className="h-8 px-2 text-xs"
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            Unstamped
                          </Button>

                          {/* Download Stamped (Enabled only when stamped) */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(invoice.stampedDocumentUrl)}
                            disabled={invoice.stampingStatusText !== "Stamped" || !invoice.stampedDocumentUrl}
                            title={
                              invoice.stampingStatusText === "Stamped"
                                ? "Download stamped document"
                                : "Document not stamped yet"
                            }
                            className={cn(
                              "h-8 px-2 text-xs",
                              invoice.stampingStatusText === "Stamped"
                                ? "text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800"
                                : "text-brand-blue/40"
                            )}
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            Stamped
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary & Pagination */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-sm text-brand-blue/50">
          Showing {currentInvoices.length} of {filteredInvoices.length} invoices
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 px-3"
            >
              Previous
            </Button>
            <span className="text-sm text-brand-blue/70 px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 px-3"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  subtitle,
  isAlert = false,
  icon
}: {
  title: string
  value: number
  subtitle: string
  isAlert?: boolean
  icon?: React.ReactNode
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">{title}</p>
            <p className={`text-3xl font-bold tracking-tight mt-1.5 ${isAlert ? 'text-brand-red' : 'text-brand-blue'}`}>
              {value}
            </p>
            <p className="text-xs text-brand-blue/40 mt-1">{subtitle}</p>
          </div>
          {icon && (
            <div className={cn(
              "p-2 rounded-lg",
              isAlert ? "bg-brand-red/10 text-brand-red" : "bg-brand-blue/10 text-brand-blue"
            )}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
