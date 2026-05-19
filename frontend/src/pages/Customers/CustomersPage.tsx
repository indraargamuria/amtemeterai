import { useState, useEffect, useMemo } from "react"
import { Badge } from "../../shared/components/ui/Badge"
import { Card, CardContent } from "../../shared/components/ui/Card"
import { Input } from "../../shared/components/ui/Input"
import { Button } from "../../shared/components/ui/Button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../shared/components/ui/Table"
import { Pagination } from "../../shared/components/ui/Pagination"
import { useApi } from "../../shared/utils/api"

const ITEMS_PER_PAGE = 10

interface Customer {
  customerId: number
  customerCode: string
  customerName: string
  customerEmail: string | null
  customerPin: string | null // 🚀 Added to match backend contract mapping
}

type SortField = "customerCode" | "customerName" | "customerEmail" | "customerPin"
type SortOrder = "asc" | "desc"

export function CustomersPage() {
  // Sorting & Filtering States (Aligned with DeliveriesPage patterns)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("customerCode")
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")
  
  // Data States
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const api = useApi()

  const fetchCustomers = async () => {
    try {
      const res = await api.get("/api/customers")
      if (!res.ok) {
        throw new Error("Failed to fetch customers")
      }
      const data: Customer[] = await res.json()
      setCustomers(data)
    } catch (err) {
      console.error("Failed to fetch customers", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  const handleSyncCustomers = async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await api.post("/api/customers/sync")
      if (!res.ok) {
        throw new Error("Sync failed")
      }
      const data = await res.json()
      setSyncMessage(data.message || `Sync completed: ${data.total || data.inserted + data.updated} records processed.`)
      await fetchCustomers()
    } catch (err) {
      console.error("Failed to sync customers", err)
      setSyncMessage("Failed to sync customers. Please try again.")
    } finally {
      setSyncing(false)
    }
  }

  // Handle Sort Toggle (Matches DeliveriesPage.tsx logic)
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("asc")
    }
  }

  // Aligned styling for sort icons
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null
    return sortOrder === "asc" ? "↑" : "↓"
  }

  // Calculate Insights Metrics Matched to UI Card density
  const metrics = useMemo(() => {
    const total = customers.length
    const missingEmails = customers.filter(c => !c.customerEmail).length
    const uniqueDomains = new Set(
      customers
        .map(c => c.customerEmail?.split("@")[1])
        .filter(Boolean)
    ).size

    return { total, missingEmails, uniqueDomains }
  }, [customers])

  // Local optimization engine filtering and sorting data arrays
  const filteredAndSortedCustomers = useMemo(() => {
    let filtered = [...customers]

    // 1. Search Query execution matching text values (Including the PIN lookup)
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (c) =>
          c.customerCode.toLowerCase().includes(query) ||
          c.customerName.toLowerCase().includes(query) ||
          (c.customerEmail?.toLowerCase().includes(query) ?? false) ||
          (c.customerPin?.toLowerCase().includes(query) ?? false) // 🚀 Allows search by PIN
      )
    }

    // 2. Sort execution matching directions
    filtered.sort((a, b) => {
      const aValue = a[sortField] ?? ""
      const bValue = b[sortField] ?? ""

      const comparison = aValue.localeCompare(bValue)
      return sortOrder === "asc" ? comparison : -comparison
    })

    return filtered
  }, [customers, searchQuery, sortField, sortOrder])

  // Pagination boundaries calculations
  const totalPages = Math.ceil(filteredAndSortedCustomers.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const currentCustomers = filteredAndSortedCustomers.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  )

  // Reset to page 1 when search filters shift
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  return (
    <div className="space-y-6">
      {/* Aligned Page Header layout */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-brand-blue tracking-tight">
            Customers
          </h1>
          <p className="text-sm text-brand-blue/60">
            Track and manage synced customer master directory listings
          </p>
        </div>
        <Button
          onClick={handleSyncCustomers}
          disabled={syncing}
          className="sm:w-auto w-full"
        >
          {syncing ? "Syncing..." : "Sync Customers"}
        </Button>
      </div>

      {/* Overview Analytics Matrix using Deliveries styles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-slate-100">
          <CardContent className="p-4 flex flex-col justify-center">
            <span className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">Total Customers</span>
            <span className="text-2xl font-semibold text-brand-blue mt-1">{loading ? "..." : metrics.total}</span>
          </CardContent>
        </Card>
        <Card className="border border-slate-100">
          <CardContent className="p-4 flex flex-col justify-center">
            <span className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">Verified Domains</span>
            <span className="text-2xl font-semibold text-brand-blue mt-1">{loading ? "..." : metrics.uniqueDomains}</span>
          </CardContent>
        </Card>
        <Card className="border border-slate-100">
          <CardContent className="p-4 flex flex-col justify-center">
            <span className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">Missing Communications</span>
            <span className="text-2xl font-semibold text-amber-600 mt-1">{loading ? "..." : metrics.missingEmails}</span>
          </CardContent>
        </Card>
      </div>

      {/* Channel Sync Alert Messages banner */}
      {syncMessage && (
        <Card className={`border ${syncMessage.includes("failed") ? "border-brand-red/20 bg-brand-red/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <p className={`text-sm ${syncMessage.includes("failed") ? "text-brand-red font-medium" : "text-emerald-700 font-medium"}`}>
              {syncMessage}
            </p>
            <button onClick={() => setSyncMessage(null)} className="text-xs text-slate-400 hover:text-slate-600 font-medium">Dismiss</button>
          </CardContent>
        </Card>
      )}

      {/* Filter Toolbar using the identical styling of DeliveriesPage */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-blue/40"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <Input
                  placeholder="Search by name, code, email domain, or PIN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-brand-blue/5"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customers High Density Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider cursor-pointer hover:text-brand-blue/70 transition-colors"
                onClick={() => handleSort("customerCode")}
              >
                Customer Code {getSortIcon("customerCode")}
              </TableHead>
              <TableHead
                className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider cursor-pointer hover:text-brand-blue/70 transition-colors"
                onClick={() => handleSort("customerName")}
              >
                Customer Name {getSortIcon("customerName")}
              </TableHead>
              <TableHead
                className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider cursor-pointer hover:text-brand-blue/70 transition-colors"
                onClick={() => handleSort("customerEmail")}
              >
                Email Address {getSortIcon("customerEmail")}
              </TableHead>
              {/* 🚀 New Customer PIN Column */}
              <TableHead
                className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider cursor-pointer hover:text-brand-blue/70 transition-colors"
                onClick={() => handleSort("customerPin")}
              >
                System PIN {getSortIcon("customerPin")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-brand-blue/60 py-12">
                  Loading customers...
                </TableCell>
              </TableRow>
            ) : filteredAndSortedCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-brand-blue/60 py-12">
                  {customers.length === 0
                    ? "No customers found"
                    : "No customers match your filter criteria"}
                </TableCell>
              </TableRow>
            ) : (
              currentCustomers.map((customer) => (
                <TableRow
                  key={customer.customerId}
                  className="hover:bg-brand-blue/[0.02] transition-colors"
                >
                  {/* Customer Code Column matching DeliveriesPage badge pattern */}
                  <TableCell className="py-4">
                    <Badge variant="badge" className="text-brand-blue/70 font-normal">
                      {customer.customerCode}
                    </Badge>
                  </TableCell>

                  {/* Customer Name Column */}
                  <TableCell className="py-4 font-semibold text-brand-blue">
                    {customer.customerName}
                  </TableCell>

                  {/* Customer Email Address Layout with empty fallbacks */}
                  <TableCell className="py-4">
                    {customer.customerEmail ? (
                      <span className="text-sm text-brand-blue/70">
                        {customer.customerEmail}
                      </span>
                    ) : (
                      <Badge variant="outline" className="border-dashed border-slate-300 text-slate-400">
                        No Email Configured
                      </Badge>
                    )}
                  </TableCell>

                  {/* 🚀 New Customer PIN Layout with styled fallbacks */}
                  <TableCell className="py-4 font-mono text-xs">
                    {customer.customerPin ? (
                      <span className="bg-slate-100/80 px-2 py-1 rounded text-slate-600 border border-slate-200/40">
                        {customer.customerPin}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic font-light">Unassigned</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Results Summary & Pagination Alignment */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-sm text-brand-blue/50">
          Showing {currentCustomers.length} of {filteredAndSortedCustomers.length} customers
        </p>
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </div>
  )
}