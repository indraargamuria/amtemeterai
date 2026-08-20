import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "../../shared/components/ui/Card"
import { Button } from "../../shared/components/ui/Button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "../../shared/components/ui/Table"
import { Badge } from "../../shared/components/ui/Badge"
import { getDocumentsHub, type DocumentHubGroup, type DocumentHubItem } from "../../shared/utils/api"
import { cn } from "../../shared/utils/cn"
import { FileText, Truck, Package, AlertCircle, ChevronRight, ChevronDown, X, Loader2, Mail, CheckSquare, CheckCircle2, Clock, Search } from "lucide-react"
import { DocumentsHubEmailModal, type HubEmailItem } from "../../shared/components/EmailComposer/DocumentsHubEmailModal"

type FilterType = "all" | "delivery-with-invoice" | "delivery-only" | "standalone-invoice"

const TYPE_META: Record<DocumentHubItem["type"], { label: string; icon: React.ReactNode; color: string }> = {
  "delivery-with-invoice": {
    label: "Delivery + Invoice",
    icon: <Truck className="w-3.5 h-3.5" />,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200"
  },
  "delivery-only": {
    label: "Delivery (Unbilled)",
    icon: <Package className="w-3.5 h-3.5" />,
    color: "bg-slate-100 text-slate-600 border-slate-200"
  },
  "standalone-invoice": {
    label: "Misc. Invoice",
    icon: <FileText className="w-3.5 h-3.5" />,
    color: "bg-brand-blue/10 text-brand-blue border-brand-blue/20"
  }
}

export function DocumentsPage() {
  const [groups, setGroups] = useState<DocumentHubGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<DocumentHubItem | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailItems, setEmailItems] = useState<HubEmailItem[]>([])

  useEffect(() => {
    fetchHub()
  }, [])

  const fetchHub = async () => {
    try {
      setLoading(true)
      setError("")
      const data = await getDocumentsHub()
      setGroups(data)
      // All customers start collapsed
      setExpanded(new Set())
    } catch (err) {
      console.error("Failed to fetch document hub:", err)
      setError("Failed to load document hub. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Filter items by type + search (customer code/name, delivery#, invoice#)
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase()
    let groupsToUse = groups
    if (filter !== "all") {
      groupsToUse = groups
        .map((g) => ({ ...g, items: g.items.filter((i) => i.type === filter) }))
        .filter((g) => g.items.length > 0)
    }
    if (!q) return groupsToUse
    return groupsToUse
      .map((g) => ({
        ...g,
        items: g.items.filter((i) =>
          i.customerCode.toLowerCase().includes(q) ||
          i.customerName.toLowerCase().includes(q) ||
          i.deliveryNumber?.toLowerCase().includes(q) ||
          i.invoiceNumber?.toLowerCase().includes(q) ||
          i.keyNumber.toLowerCase().includes(q)
        )
      }))
      .filter((g) => g.items.length > 0)
  }, [groups, filter, search])

  // (allItems removed — selection uses all groups, not filtered)

  // Stats
  const stats = useMemo(() => {
    const items = groups.flatMap((g) => g.items)
    return {
      total: items.length,
      customers: groups.length,
      ready: items.filter((i) => i.isReadyToSend).length,
      stamped: items.filter((i) => i.isInvoiceStamped).length,
      pending: items.filter((i) => i.invoiceStampingStatusText === "Pending").length,
      sent: items.filter((i) => i.emailCount > 0).length
    }
  }, [groups])

  // Selection helpers
  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleSelectCustomer = (code: string) => {
    const itemKeys = filteredGroups.find((g) => g.customerCode === code)?.items.map((i) => i.keyNumber) ?? []
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      const allSelected = itemKeys.every((k) => next.has(k))
      itemKeys.forEach((k) => (allSelected ? next.delete(k) : next.add(k)))
      return next
    })
  }

  const toggleExpand = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  // Selection is global — persists across search/filter; email acts on ALL selected, not just visible
  const selectedItems = groups.flatMap((g) => g.items).filter((i) => selectedKeys.has(i.keyNumber))
  const selectedCustomerCount = new Set(selectedItems.map((i) => i.customerCode)).size

  const openEmail = () => {
    if (selectedItems.length === 0) return
    setEmailItems(
      selectedItems.map((i) => ({
        key: i.keyNumber,
        type: i.type,
        customerCode: i.customerCode,
        customerName: i.customerName,
        customerEmail: i.customerEmail,
        deliveryNumber: i.deliveryNumber,
        invoiceNumber: i.invoiceNumber,
        deliveryPrintoutUrl: i.deliveryPrintoutUrl,
        invoicePrintoutUrl: i.invoicePrintoutUrl,
        isReadyToSend: i.isReadyToSend
      }))
    )
    setEmailOpen(true)
  }

  const openSheet = (doc: DocumentHubItem) => {
    setSelectedDoc(doc)
    setSheetOpen(true)
  }

  const typeIcon = (t: DocumentHubItem["type"]) => TYPE_META[t].icon

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-brand-blue/5 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-brand-blue dark:text-slate-100 tracking-tight">Document Hub</h1>
            <p className="text-sm text-brand-blue dark:text-slate-100/60 dark:text-slate-300 mt-1">
              All customer documents — grouped by customer, ready for emailing
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchHub} className="gap-2">
            <Loader2 className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
        <StatCard label="Customers" value={stats.customers} color="brand-blue" />
        <StatCard label="Total Documents" value={stats.total} color="slate" />
        <StatCard label="Ready to Send" value={stats.ready} color="emerald" />
        <StatCard label="Stamped" value={stats.stamped} color="emerald" />
        <StatCard label="Pending Stamp" value={stats.pending} color="amber" alert />
        <StatCard label="Emailed" value={stats.sent} color="brand-blue" />
      </div>

      {/* Search + Filter Toggles */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-blue/40 dark:text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer ID, name, delivery #, invoice #..."
            className="w-full pl-9 pr-9 py-2 rounded-lg border border-brand-blue/10 bg-white dark:bg-slate-900 dark:border-slate-700 text-sm text-brand-blue dark:text-slate-100 placeholder:text-brand-blue/40 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/30 transition-shadow"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-brand-blue/40 hover:text-brand-blue/80 dark:text-slate-400 dark:hover:text-slate-200"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 bg-brand-blue/[0.02] p-1.5 rounded-lg border border-brand-blue/5 w-fit">
          <FilterButton active={filter === "all"} onClick={() => setFilter("all")} label={`All (${groups.flatMap((g) => g.items).length})`} />
          <FilterButton active={filter === "delivery-with-invoice"} onClick={() => setFilter("delivery-with-invoice")} label="Delivery + Invoice" />
          <FilterButton active={filter === "delivery-only"} onClick={() => setFilter("delivery-only")} label="Delivery Only" />
          <FilterButton active={filter === "standalone-invoice"} onClick={() => setFilter("standalone-invoice")} label="Misc. Invoice" />
        </div>
      </div>

      {/* Floating email button + selection info (fixed bottom-right) */}
      {selectedKeys.size > 0 && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white dark:bg-slate-900 shadow-lg border border-brand-blue/10 dark:border-slate-700 text-sm text-brand-blue dark:text-slate-200">
            <CheckSquare className="w-4 h-4 text-emerald-600" />
            <span>
              {selectedCustomerCount} customer{selectedCustomerCount !== 1 ? "s" : ""} selected
              <span className="mx-1.5 text-brand-blue/30 dark:text-slate-600">·</span>
              {selectedKeys.size} data selected
            </span>
          </div>
          <Button variant="default" size="lg" onClick={openEmail} className="shadow-xl gap-2 h-12 px-6 rounded-full">
            <Mail className="w-5 h-5" />
            Email {selectedKeys.size} Document{selectedKeys.size > 1 ? "s" : ""}
          </Button>
        </div>
      )}

      {/* Customer Grid */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-brand-red/10 border border-brand-red/20 text-brand-red text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="w-6 h-6 text-brand-blue dark:text-slate-100/40 dark:text-slate-400 animate-spin mx-auto" />
            <p className="text-sm text-brand-blue dark:text-slate-100/40 dark:text-slate-400 mt-3">Loading document hub...</p>
          </CardContent>
        </Card>
      ) : filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-brand-blue/5 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6 text-brand-blue dark:text-slate-100/30 dark:text-slate-500" />
            </div>
            <p className="text-sm text-brand-blue dark:text-slate-100/40 dark:text-slate-400 mt-3">No documents found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const isExpanded = expanded.has(group.customerCode)
            const customerSelected = group.items.every((i) => selectedKeys.has(i.keyNumber))
            const customerPartial = !customerSelected && group.items.some((i) => selectedKeys.has(i.keyNumber))
            return (
              <Card key={group.customerCode} className="overflow-hidden">
                {/* Customer header row */}
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors",
                    "hover:bg-brand-blue/[0.02] border-b",
                    isExpanded ? "border-brand-blue/10 bg-brand-blue/[0.02]" : "border-brand-blue/5"
                  )}
                  onClick={() => toggleExpand(group.customerCode)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleExpand(group.customerCode)
                    }}
                    className="p-1 rounded-md text-brand-blue dark:text-slate-100/50 dark:text-slate-400 hover:bg-brand-blue/5 transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <input
                    type="checkbox"
                    checked={customerSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = customerPartial
                    }}
                    onChange={(e) => {
                      e.stopPropagation()
                      toggleSelectCustomer(group.customerCode)
                    }}
                    className="w-4 h-4 rounded border-brand-blue/20 accent-brand-blue cursor-pointer"
                    title="Select all for this customer"
                  />
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-brand-blue/10 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-brand-blue dark:text-slate-100" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-brand-blue dark:text-slate-100 truncate">{group.customerName}</p>
                      <p className="text-xs text-brand-blue/50 dark:text-slate-400 truncate">
                        {group.customerCode}
                        {group.customerEmail ? ` · ${group.customerEmail}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="border-brand-blue/10 bg-brand-blue/[0.02] text-brand-blue/70 dark:text-slate-300">
                      {group.items.length} doc{group.items.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>

                {/* Expandable rows */}
                {isExpanded && (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-brand-blue/[0.02]">
                        <TableHead className="w-10 py-2 px-4" />
                        <TableHead className="py-2 px-4 text-xs font-semibold text-brand-blue dark:text-slate-100/60 dark:text-slate-300 uppercase tracking-wider">Reference</TableHead>
                        <TableHead className="py-2 px-4 text-xs font-semibold text-brand-blue dark:text-slate-100/60 dark:text-slate-300 uppercase tracking-wider">Type</TableHead>
                        <TableHead className="py-2 px-4 text-xs font-semibold text-brand-blue dark:text-slate-100/60 dark:text-slate-300 uppercase tracking-wider">Status</TableHead>
                        <TableHead className="py-2 px-4 text-xs font-semibold text-brand-blue dark:text-slate-100/60 dark:text-slate-300 uppercase tracking-wider">Email</TableHead>
                        <TableHead className="py-2 px-4 text-right text-xs font-semibold text-brand-blue dark:text-slate-100/60 dark:text-slate-300 uppercase tracking-wider">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.items.map((item) => (
                        <TableRow
                          key={item.keyNumber}
                          className="hover:bg-brand-blue/[0.02] transition-colors cursor-pointer group"
                          onClick={() => openSheet(item)}
                        >
                          {/* Select */}
                          <TableCell className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedKeys.has(item.keyNumber)}
                              onChange={() => toggleSelect(item.keyNumber)}
                              className="w-4 h-4 rounded border-brand-blue/20 accent-brand-blue cursor-pointer"
                              title={`Select ${item.keyNumber}`}
                            />
                          </TableCell>

                          {/* Key column — dynamic: DO#+INV# | DO# | INV# */}
                          <TableCell className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-md bg-brand-blue/10 flex items-center justify-center">
                                {typeIcon(item.type)}
                              </div>
                              <code className="text-sm font-mono text-brand-blue dark:text-slate-100 tracking-tight">
                                {item.keyNumber}
                              </code>
                            </div>
                          </TableCell>

                          {/* Type */}
                          <TableCell className="py-2.5 px-4">
                            <Badge variant="outline" className={TYPE_META[item.type].color}>
                              {TYPE_META[item.type].label}
                            </Badge>
                          </TableCell>

                          {/* Status: stamped / confirmed */}
                          <TableCell className="py-2.5 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              {item.type !== "delivery-only" && (
                                <Badge className={cn(
                                  "gap-1",
                                  item.isInvoiceStamped
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                )}>
                                  {item.isInvoiceStamped ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                  {item.invoiceStampingStatusText ?? "Invoice"}
                                </Badge>
                              )}
                              {item.type !== "standalone-invoice" && item.isReceived !== null && (
                                <Badge className={cn(
                                  "gap-1",
                                  item.isReceived
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                )}>
                                  {item.isReceived ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                  {item.isReceived ? "Confirmed" : "Not Confirmed"}
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Email state: count */}
                          <TableCell className="py-2.5 px-4">
                            {item.emailCount > 0 ? (
                              <div className="flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-xs font-medium text-emerald-700">
                                  {item.emailCount}× sent
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">Never</span>
                            )}
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEmailItems([{
                                    key: item.keyNumber,
                                    type: item.type,
                                    customerCode: item.customerCode,
                                    customerName: item.customerName,
                                    customerEmail: item.customerEmail,
                                    deliveryNumber: item.deliveryNumber,
                                    invoiceNumber: item.invoiceNumber,
                                    deliveryPrintoutUrl: item.deliveryPrintoutUrl,
                                    invoicePrintoutUrl: item.invoicePrintoutUrl,
                                    isReadyToSend: item.isReadyToSend
                                  }])
                                  setEmailOpen(true)
                                }}
                                className="min-w-[80px]"
                                title="Send email with attachments"
                              >
                                <Mail className="w-3.5 h-3.5" /> Email
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openSheet(item)
                                }}
                                className="min-w-[90px]"
                              >
                                Inspect <ChevronRight className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Sliding Sheet Overlay */}
      {sheetOpen && selectedDoc && (
        <>
          <div className="fixed inset-0 bg-brand-blue/20 backdrop-blur-sm z-40 transition-opacity duration-300" onClick={() => setSheetOpen(false)} />
          <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out dark:bg-slate-900">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-brand-blue/5 bg-brand-blue/[0.02] dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-semibold text-brand-blue dark:text-slate-100">Document Workspace</h2>
                  <p className="text-xs text-brand-blue dark:text-slate-100/50 dark:text-slate-400 mt-0.5">{selectedDoc.keyNumber}</p>
                </div>
                <button onClick={() => setSheetOpen(false)} className="p-2 rounded-md text-brand-blue dark:text-slate-100/50 dark:text-slate-400 hover:bg-brand-blue/5 hover:text-brand-blue transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="bg-brand-blue/[0.02] rounded-lg p-5 border border-brand-blue/5">
                  <h3 className="text-sm font-semibold text-brand-blue dark:text-slate-100/70 dark:text-slate-300 mb-4">Document Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <DetailRow label="Reference" value={selectedDoc.keyNumber} mono />
                    <DetailRow label="Type" value={TYPE_META[selectedDoc.type].label} />
                    <DetailRow label="Customer" value={`${selectedDoc.customerCode} — ${selectedDoc.customerName}`} />
                    {selectedDoc.deliveryDate && <DetailRow label="Delivery Date" value={formatDate(selectedDoc.deliveryDate)} />}
                    {selectedDoc.invoicedDate && <DetailRow label="Invoice Date" value={formatDate(selectedDoc.invoicedDate)} />}
                  </div>
                </div>

                <div className="bg-brand-blue/[0.02] rounded-lg p-5 border border-brand-blue/5">
                  <h3 className="text-sm font-semibold text-brand-blue dark:text-slate-100/70 dark:text-slate-300 mb-4">Status</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedDoc.invoiceStampingStatusText && (
                      <Badge className={cn(
                        "gap-1",
                        selectedDoc.isInvoiceStamped
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {selectedDoc.isInvoiceStamped ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {selectedDoc.invoiceStampingStatusText}
                      </Badge>
                    )}
                    {selectedDoc.isReceived !== null && (
                      <Badge className={cn(
                        "gap-1",
                        selectedDoc.isReceived
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      )}>
                        {selectedDoc.isReceived ? "Confirmed by Customer" : "Not Confirmed"}
                      </Badge>
                    )}
                    {selectedDoc.emailCount > 0 && (
                      <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
                        <Mail className="w-3 h-3" /> Emailed {selectedDoc.emailCount}×
                      </Badge>
                    )}
                    {selectedDoc.isReadyToSend && (
                      <Badge className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Ready to Send
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="bg-brand-blue/[0.02] rounded-lg p-5 border border-brand-blue/5">
                  <h3 className="text-sm font-semibold text-brand-blue dark:text-slate-100/70 dark:text-slate-300 mb-4">Document Links</h3>
                  <div className="space-y-3">
                    {selectedDoc.deliveryPrintoutUrl && (
                      <DocumentLink label="Delivery Order PDF" url={selectedDoc.deliveryPrintoutUrl} />
                    )}
                    {selectedDoc.invoicePrintoutUrl ? (
                      <DocumentLink label="Stamped Invoice PDF" url={selectedDoc.invoicePrintoutUrl} />
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-md bg-slate-50/50 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700">
                        <AlertCircle className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-500">No stamped document available</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Email Composer Modal (2-level) */}
      {emailOpen && (
        <DocumentsHubEmailModal
          isOpen={emailOpen}
          onClose={() => setEmailOpen(false)}
          items={emailItems}
        />
      )}
    </div>
  )
}

// ============== Sub-Components ==============

function StatCard({ label, value, color, alert }: {
  label: string
  value: number
  color: "brand-blue" | "emerald" | "slate" | "amber"
  alert?: boolean
}) {
  const accentMap = {
    "brand-blue": "bg-brand-blue/60",
    "emerald": "bg-emerald-500/60",
    "slate": "bg-slate-400/60",
    "amber": "bg-amber-500/60",
  }
  const textMap = {
    "brand-blue": "text-brand-blue dark:text-slate-100",
    "emerald": "text-emerald-600 dark:text-emerald-400",
    "slate": "text-slate-700 dark:text-slate-200",
    "amber": "text-amber-600 dark:text-amber-400",
  }
  return (
    <div className={cn("relative p-4 pl-5 rounded-lg border overflow-hidden", alert ? "border-amber-300/60 dark:border-amber-500/40" : "border-brand-blue/10 dark:border-slate-700/60")}>
      {/* thin left accent — no middle color block */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", alert ? "bg-amber-400" : accentMap[color])} />
      <p className="text-xs font-medium text-brand-blue dark:text-slate-100/50 dark:text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={cn("text-2xl font-bold tracking-tight mt-1.5", textMap[color])}>{value}</p>
    </div>
  )
}

function FilterButton({ active, onClick, label }: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
        active
          ? "bg-white text-brand-blue dark:text-slate-100 shadow-sm dark:bg-slate-800 dark:text-slate-200"
          : "text-brand-blue dark:text-slate-100/60 dark:text-slate-300 hover:text-brand-blue hover:bg-white/50 dark:hover:text-slate-200 dark:hover:bg-slate-800/50"
      )}
    >
      {label}
    </button>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-brand-blue dark:text-slate-100/50 dark:text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={cn("text-sm font-medium text-brand-blue dark:text-slate-100 mt-0.5", mono && "font-mono")}>{value}</p>
    </div>
  )
}

function DocumentLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between p-3 rounded-md bg-white dark:bg-slate-800 border border-brand-blue/10 dark:border-slate-700 hover:border-brand-blue/20 hover:bg-brand-blue/[0.02] transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-brand-blue/10 flex items-center justify-center">
          <FileText className="w-4 h-4 text-brand-blue dark:text-slate-100" />
        </div>
        <span className="text-sm font-medium text-brand-blue dark:text-slate-100 group-hover:text-brand-blue dark:text-slate-100/80 dark:text-slate-200">{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-brand-blue dark:text-slate-100/40 dark:text-slate-400 group-hover:text-brand-blue dark:text-slate-100/60 dark:text-slate-300 transition-colors" />
    </a>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })
}
