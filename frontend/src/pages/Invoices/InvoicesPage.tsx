import { useState, useEffect } from "react"
import { Card, CardContent } from "../../shared/components/ui/Card"
import { Button } from "../../shared/components/ui/Button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "../../shared/components/ui/Table"
import { Badge } from "../../shared/components/ui/Badge"
import { getInvoices, uploadInvoicePrintout, stampInvoice, type Invoice } from "../../shared/utils/api"
import { cn } from "../../shared/utils/cn"

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<number | null>(null)
  const [stamping, setStamping] = useState<number | null>(null)
  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null)

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

  const handleFileUpload = async (invoiceId: number) => {
    const file = fileInput?.files?.[0]
    if (!file) return

    try {
      setUploading(invoiceId)
      await uploadInvoicePrintout(invoiceId, file)
      await fetchInvoices()
    } catch (err) {
      console.error("Failed to upload printout:", err)
      alert("Failed to upload printout. Please try again.")
    } finally {
      setUploading(null)
      if (fileInput) fileInput.value = ""
    }
  }

  const handleStamp = async (invoiceId: number) => {
    if (!window.confirm("Are you sure you want to stamp this invoice?")) return

    try {
      setStamping(invoiceId)
      await stampInvoice(invoiceId)
      await fetchInvoices()
    } catch (err) {
      console.error("Failed to stamp invoice:", err)
      alert("Failed to stamp invoice. Please try again.")
    } finally {
      setStamping(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Draft": return "bg-brand-blue/10 text-brand-blue"
      case "Stamped": return "bg-emerald-500/10 text-emerald-700"
      case "Sync Failed": return "bg-brand-red/10 text-brand-red"
      case "Synced to SAP": return "bg-emerald-500/10 text-emerald-700"
      case "Canceled": return "bg-brand-blue/20 text-brand-blue/60"
      default: return "bg-brand-blue/5 text-brand-blue/60"
    }
  }

  const getStampingStatusColor = (status: string) => {
    switch (status) {
      case "Not Stamped": return "bg-brand-blue/10 text-brand-blue"
      case "Pending": return "bg-amber-500/10 text-amber-700"
      case "Stamped": return "bg-emerald-500/10 text-emerald-700"
      case "Failed": return "bg-brand-red/10 text-brand-red"
      default: return "bg-brand-blue/5 text-brand-blue/60"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-brand-blue/5 pb-5">
        <h1 className="text-2xl font-semibold text-brand-blue tracking-tight">Invoices</h1>
        <p className="text-sm text-brand-blue/60">Invoice management and e-Meterai stamping</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <SummaryCard
          title="Total Invoices"
          value={invoices.length}
          subtitle="All invoice records"
        />
        <SummaryCard
          title="Pending Stamps"
          value={invoices.filter(i => i.stampingStatusText === "Not Stamped" || i.stampingStatusText === "Pending").length}
          subtitle="Awaiting e-Meterai"
          isAlert
        />
        <SummaryCard
          title="Stamped"
          value={invoices.filter(i => i.stampingStatusText === "Stamped").length}
          subtitle="Completed stamping"
        />
      </div>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Stamping</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-brand-blue/50 py-8">
                    Loading invoices...
                  </TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-brand-blue/50 py-8">
                    No invoices found
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => (
                  <TableRow
                    key={invoice.invoiceID}
                    onClick={() => setSelectedInvoice(invoice)}
                    className={cn(
                      "cursor-pointer hover:bg-brand-blue/[0.02]",
                      selectedInvoice?.invoiceID === invoice.invoiceID && "bg-brand-blue/5"
                    )}
                  >
                    <TableCell className="font-medium text-brand-blue">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm text-brand-blue">{invoice.customerNumber}</p>
                        {invoice.customerName && (
                          <p className="text-xs text-brand-blue/50">{invoice.customerName}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-brand-blue">
                        {invoice.invoiceAmount.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(invoice.statusText)}>
                        {invoice.statusText}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStampingStatusColor(invoice.stampingStatusText)}>
                        {invoice.stampingStatusText}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <input
                          ref={(el) => {
                            if (el && fileInput === null) setFileInput(el)
                          }}
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={() => invoice.invoiceID && handleFileUpload(invoice.invoiceID)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            fileInput?.click()
                          }}
                          disabled={uploading === invoice.invoiceID || invoice.stampingStatusText === "Stamped"}
                        >
                          {uploading === invoice.invoiceID ? "Uploading..." : invoice.hasPrintoutDocument ? "Reupload" : "Upload"}
                        </Button>
                        {invoice.hasPrintoutDocument && invoice.stampingStatusText !== "Stamped" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStamp(invoice.invoiceID)
                            }}
                            disabled={stamping === invoice.invoiceID}
                          >
                            {stamping === invoice.invoiceID ? "Stamping..." : "Stamp"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invoice Detail Panel */}
      {selectedInvoice && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-brand-blue">
                  {selectedInvoice.invoiceNumber}
                </h2>
                <p className="text-sm text-brand-blue/50 mt-1">
                  {selectedInvoice.invoicedDate ? new Date(selectedInvoice.invoicedDate).toLocaleDateString() : ""}
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-2 rounded-md text-brand-blue/50 hover:bg-brand-blue/5 hover:text-brand-blue"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6 mt-6">
              <DetailItem label="Invoice Number" value={selectedInvoice.invoiceNumber} />
              <DetailItem label="Customer Number" value={selectedInvoice.customerNumber} />
              <DetailItem label="Invoice Amount" value={selectedInvoice.invoiceAmount.toLocaleString()} />
              <DetailItem label="Status" value={selectedInvoice.statusText} />
              {selectedInvoice.deliveryNumber && (
                <DetailItem label="Delivery Number" value={selectedInvoice.deliveryNumber} />
              )}
              {selectedInvoice.serialNumber && (
                <DetailItem label="e-Meterai Serial" value={selectedInvoice.serialNumber} />
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-brand-blue/5">
              <h3 className="text-sm font-semibold text-brand-blue/70 mb-4">Documents</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-brand-blue/[0.02] rounded-md">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-brand-blue/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-brand-blue">
                        {selectedInvoice.hasPrintoutDocument ? "Invoice Printout" : "No Printout Uploaded"}
                      </p>
                    </div>
                  </div>
                  {selectedInvoice.stampedDocumentUrl && (
                    <a
                      href={selectedInvoice.stampedDocumentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-brand-blue hover:text-brand-blue/70"
                    >
                      View Stamped
                    </a>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryCard({ title, value, subtitle, isAlert }: { title: string, value: number, subtitle: string, isAlert?: boolean }) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-6">
        <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">{title}</p>
        <p className={`text-3xl font-bold tracking-tight mt-1.5 ${isAlert ? 'text-brand-red' : 'text-brand-blue'}`}>{value}</p>
        <p className="text-xs text-brand-blue/40 mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

function DetailItem({ label, value }: { label: string, value: string | number }) {
  return (
    <div>
      <p className="text-xs text-brand-blue/50 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-brand-blue mt-0.5">{value}</p>
    </div>
  )
}