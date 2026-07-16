import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "../../shared/components/ui/Card"
import { Button } from "../../shared/components/ui/Button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "../../shared/components/ui/Table"
import { Badge } from "../../shared/components/ui/Badge"
import { getInvoices, type Invoice } from "../../shared/utils/api"
import { cn } from "../../shared/utils/cn"
import { FileText, Download, Stamp, AlertCircle, Filter, X } from "lucide-react"
import { utils as xlsxUtils, writeFile } from "xlsx"

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  // Filter states
  const [complianceFilter, setComplianceFilter] = useState<"all" | "bc" | "nonbc">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "syncedtosap" | "stamped" | "voided">("all")

  const ITEMS_PER_PAGE = 25

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

    // Apply compliance filter
    if (complianceFilter !== "all") {
      filtered = filtered.filter((inv) => {
        if (complianceFilter === "bc") return inv.complianceCategory === "BC"
        if (complianceFilter === "nonbc") return inv.complianceCategory === "NonBC"
        return true
      })
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((inv) => {
        const statusLower = inv.statusText.toLowerCase().replace(/\s+/g, "")
        return statusLower === statusFilter
      })
    }

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
  }, [invoices, complianceFilter, statusFilter, searchQuery])

  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const currentInvoices = filteredInvoices.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, complianceFilter, statusFilter])

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

  // const formatForeignCurrency = (amount: number, currency: string) => {
  //   if (!currency || currency === "IDR") {
  //     return formatCurrency(amount)
  //   }
  //   try {
  //     return new Intl.NumberFormat("en-US", {
  //       style: "currency",
  //       currency: currency,
  //       minimumFractionDigits: 2,
  //       maximumFractionDigits: 2
  //     }).format(amount / 100)
  //   } catch {
  //     return `${currency} ${(amount / 100).toFixed(2)}`
  //   }
  // }
  const formatForeignCurrency = (amount: number, currency: string) => {
    if (!currency || currency === "IDR") {
      return formatCurrency(amount)
    }
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount)
    } catch {
      return `${currency} ${amount.toFixed(2)}`
    }
  }

  const getComplianceBadgeVariant = (category?: string): "default" | "success" | "warning" | "accent" | "outline" => {
    if (category === "BC") return "success"
    if (category === "NonBC") return "default"
    return "outline"
  }

  const getStatusVariant = (statusText: string): "default" | "success" | "warning" | "accent" | "outline" => {
    switch (statusText) {
      case "Draft": return "default"
      case "Stamped": return "success"
      case "Sync Failed": return "accent"
      case "Synced to SAP": return "success"
      case "Canceled": return "outline"
      case "Voided": return "accent"
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
    if (!url) return

    try {
      const urlObj = new URL(url)
      const storageKey = urlObj.searchParams.get("key") || ""
      const filename = storageKey.split("/").pop() || "document.pdf"

      const response = await fetch(url)
      if (!response.ok) throw new Error("Network response was not ok")
      const blob = await response.blob()

      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("Download failed:", error)
      window.open(url, "_blank", "noopener,noreferrer")
    }
  }

  const clearAllFilters = () => {
    setComplianceFilter("all")
    setStatusFilter("all")
    setSearchQuery("")
  }

  const hasActiveFilters = complianceFilter !== "all" || statusFilter !== "all" || searchQuery

  // Excel Export Function
  const handleExportToExcel = () => {
    interface ExcelExportRow {
      "Invoice Number": string
      "Billing Date": string
      "Customer Name": string
      "Currency": string
      "Local Amount": string
      "Foreign Amount": string
      "Type": string
      "Status": string
    }

    const exportData: ExcelExportRow[] = filteredInvoices.map((inv) => ({
      "Invoice Number": inv.invoiceNumber,
      "Billing Date": formatDate(inv.invoicedDate),
      "Customer Name": inv.customerName || "-",
      "Currency": inv.currency || "IDR",
      "Local Amount": formatCurrency(inv.amountLocal),
      "Foreign Amount": inv.currency && inv.currency !== "IDR"
        ? formatForeignCurrency(inv.amountForeign, inv.currency)
        : "0",
      "Type": inv.complianceCategory || "-",
      "Status": inv.statusText,
    }))

    const worksheet = xlsxUtils.json_to_sheet(exportData)
    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 15 },
      { wch: 30 },
      { wch: 10 },
      { wch: 20 },
      { wch: 20 },
      { wch: 10 },
      { wch: 15 },
    ]

    const workbook = xlsxUtils.book_new()
    xlsxUtils.book_append_sheet(workbook, worksheet, "Invoices")

    const dateStamp = new Date().toISOString().slice(0, 10)
    const filename = `OpexNOW_Invoices_Report_${dateStamp}.xlsx`

    writeFile(workbook, filename)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="border-b border-brand-blue/5 pb-4">
        <h1 className="text-2xl font-semibold text-brand-blue tracking-tight">Invoices Workbench</h1>
        <p className="text-sm text-brand-blue/60 mt-0.5">High-density invoice processing and e-Meterai management</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {/* Search & Filter Bar */}
      <Card className="shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-col gap-3">
            {/* Search & Export Row */}
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Search Input */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search invoice, customer, serial..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-brand-blue/10 rounded-md bg-white text-brand-blue placeholder:text-brand-blue/40 focus:outline-none focus:ring-2 focus:ring-brand-blue/10 focus:border-brand-blue/20"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-blue/40 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-blue/40 hover:text-brand-blue/60"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Export to Excel Button */}
              <button
                onClick={handleExportToExcel}
                disabled={filteredInvoices.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-200"
                title="Export to Excel"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm font-medium">Export to Excel</span>
              </button>
            </div>

            {/* Filter Toggles Row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Compliance Filter */}
              <div className="flex items-center bg-brand-blue/5 rounded-lg px-3 py-2">
                <span className="text-xs text-brand-blue/60 whitespace-nowrap mr-2">Type:</span>
                <div className="flex gap-1">
                  {[
                    { value: "all", label: "All" },
                    { value: "bc", label: "BC" },
                    { value: "nonbc", label: "Non BC" }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setComplianceFilter(option.value as any)}
                      className={cn(
                        "px-2 py-1 text-xs rounded-md transition-colors",
                        complianceFilter === option.value
                          ? "bg-brand-blue text-white"
                          : "text-brand-blue/70 hover:bg-brand-blue/10"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div className="flex items-center bg-brand-blue/5 rounded-lg px-3 py-2">
                <span className="text-xs text-brand-blue/60 whitespace-nowrap mr-2">Status:</span>
                <div className="flex gap-1">
                  {[
                    { value: "all", label: "All" },
                    { value: "draft", label: "Draft" },
                    { value: "syncedtosap", label: "Synced" },
                    { value: "stamped", label: "Stamped" },
                    { value: "voided", label: "Voided" }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setStatusFilter(option.value as any)}
                      className={cn(
                        "px-2 py-1 text-xs rounded-md transition-colors",
                        statusFilter === option.value
                          ? "bg-brand-blue text-white"
                          : "text-brand-blue/70 hover:bg-brand-blue/10"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-8 px-3 text-xs text-brand-blue/60 hover:text-brand-blue"
                >
                  <Filter className="w-3.5 h-3.5 mr-1.5" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* High-Density Invoice Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-brand-blue/5">
                  <TableHead className="font-semibold text-brand-blue text-xs uppercase tracking-wider py-2 px-3 whitespace-nowrap">Invoice</TableHead>
                  <TableHead className="font-semibold text-brand-blue text-xs uppercase tracking-wider py-2 px-3 whitespace-nowrap">Customer</TableHead>
                  <TableHead className="font-semibold text-brand-blue text-xs uppercase tracking-wider py-2 px-3 whitespace-nowrap">Date</TableHead>
                  <TableHead className="font-semibold text-brand-blue text-xs uppercase tracking-wider py-2 px-3 text-right whitespace-nowrap">Amount</TableHead>
                  <TableHead className="font-semibold text-brand-blue text-xs uppercase tracking-wider py-2 px-3 whitespace-nowrap">Type</TableHead>
                  <TableHead className="font-semibold text-brand-blue text-xs uppercase tracking-wider py-2 px-3 whitespace-nowrap">Status</TableHead>
                  <TableHead className="font-semibold text-brand-blue text-xs uppercase tracking-wider py-2 px-3 whitespace-nowrap">Stamp</TableHead>
                  <TableHead className="font-semibold text-brand-blue text-xs uppercase tracking-wider py-2 px-3 text-right whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-brand-blue/50 py-16">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-brand-blue/20 border-t-brand-blue/80 rounded-full animate-spin" />
                        Loading invoices...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-brand-blue/50 py-16">
                      {invoices.length === 0 ? "No invoices found" : "No invoices match your filters"}
                    </TableCell>
                  </TableRow>
                ) : (
                  currentInvoices.map((invoice) => (
                    <TableRow
                      key={invoice.invoiceID}
                      className="hover:bg-brand-blue/[0.02] transition-colors"
                    >
                      {/* Invoice Number */}
                      <TableCell className="py-2 px-3 whitespace-nowrap">
                        <span className="font-mono text-sm font-semibold text-brand-blue tracking-tight">
                          {invoice.invoiceNumber}
                        </span>
                      </TableCell>

                      {/* Customer */}
                      <TableCell className="py-2 px-3 whitespace-nowrap">
                        <div className="min-w-[140px] max-w-[200px]">
                          <p className="text-sm font-medium text-brand-blue truncate" title={invoice.customerName || undefined}>
                            {invoice.customerName || "-"}
                          </p>
                          <p className="text-xs text-brand-blue/50 font-mono truncate" title={invoice.customerNumber}>
                            {invoice.customerNumber}
                          </p>
                        </div>
                      </TableCell>

                      {/* Invoice Date */}
                      <TableCell className="py-2 px-3 whitespace-nowrap">
                        <span className="text-sm text-brand-blue/70">
                          {formatDate(invoice.invoicedDate)}
                        </span>
                      </TableCell>

                      {/* Conditional Amount Cell */}
                      <TableCell className="py-2 px-3 text-right whitespace-nowrap">
                        {invoice.currency === "IDR" || !invoice.currency ? (
                          // IDR only - single bold amount
                          <span className="text-sm font-semibold text-brand-blue tabular-nums">
                            {formatCurrency(invoice.amountLocal)}
                          </span>
                        ) : (
                          // Foreign currency - dual-line layout
                          <div className="text-right">
                            <span className="text-sm font-semibold text-brand-blue tabular-nums block">
                              {formatCurrency(invoice.amountLocal)}
                            </span>
                            <span className="text-xs text-brand-blue/50 tabular-nums font-medium block">
                              {formatForeignCurrency(invoice.amountForeign, invoice.currency)}
                            </span>
                          </div>
                        )}
                      </TableCell>

                      {/* Compliance Type Badge */}
                      <TableCell className="py-2 px-3 whitespace-nowrap">
                        {invoice.complianceCategory ? (
                          <Badge
                            variant={getComplianceBadgeVariant(invoice.complianceCategory)}
                            className="text-xs font-medium px-2 py-0.5"
                          >
                            {invoice.complianceCategory === 'BC' ? 'BC' : 'Non-BC'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-brand-blue/30">—</span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-2 px-3 whitespace-nowrap">
                        <Badge
                          variant={getStatusVariant(invoice.statusText)}
                          className="text-xs font-medium px-2 py-0.5"
                        >
                          {invoice.statusText}
                        </Badge>
                      </TableCell>

                      {/* Stamping Status */}
                      <TableCell className="py-2 px-3 whitespace-nowrap">
                        <Badge
                          variant={getStampingStatusVariant(invoice.stampingStatusText)}
                          className="text-xs font-medium px-2 py-0.5"
                        >
                          {invoice.stampingStatusText === "Pending" && (
                            <span className="inline-block w-1.5 h-1.5 bg-amber-500 rounded-full mr-1.5 animate-pulse" />
                          )}
                          {invoice.stampingStatusText === "Failed" && (
                            <AlertCircle className="w-3 h-3 mr-0.5 inline" />
                          )}
                          {invoice.stampingStatusText}
                        </Badge>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-2 px-3 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Download Unstamped */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(invoice.unstampedDocumentUrl)}
                            disabled={!invoice.unstampedDocumentUrl}
                            title="Download unstamped document"
                            className="h-7 px-2 text-xs text-brand-blue/70 hover:text-brand-blue hover:bg-brand-blue/5 disabled:text-brand-blue/30 disabled:hover:bg-transparent"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Raw
                          </Button>

                          {/* Download Stamped */}
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
                              "h-7 px-2 text-xs",
                              invoice.stampingStatusText === "Stamped"
                                ? "text-emerald-700 hover:bg-emerald-500/10"
                                : "text-brand-blue/40"
                            )}
                          >
                            <Download className="w-3 h-3 mr-1" />
                            PDF
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
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <p className="text-sm text-brand-blue/50">
          Showing <span className="font-medium text-brand-blue/70">{currentInvoices.length}</span> of{" "}
          <span className="font-medium text-brand-blue/70">{filteredInvoices.length}</span> invoices
          {hasActiveFilters && (
            <span className="text-brand-blue/40"> (filtered)</span>
          )}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 px-3 text-xs"
            >
              Previous
            </Button>
            <span className="text-sm text-brand-blue/70 px-1">
              <span className="font-medium">{currentPage}</span> / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 px-3 text-xs"
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
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">{title}</p>
            <p className={`text-2xl font-bold tracking-tight ${isAlert ? 'text-brand-red' : 'text-brand-blue'}`}>
              {value}
            </p>
            <p className="text-xs text-brand-blue/40 mt-0.5">{subtitle}</p>
          </div>
          {icon && (
            <div className={cn(
              "p-2 rounded-lg flex-shrink-0",
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
