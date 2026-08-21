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

interface ShippingParameter {
  id: number
  country: string
  region: string | null
  shipMode: string
  isDefault: boolean
  leadTimeDays: number
}

type SortField = "country" | "region" | "shipMode" | "leadTimeDays"
type SortOrder = "asc" | "desc"

export function ShippingParametersPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("country")
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")

  const [parameters, setParameters] = useState<ShippingParameter[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const api = useApi()

  const fetchParameters = async () => {
    try {
      const res = await api.get("/api/shipping-parameters")
      if (!res.ok) {
        throw new Error("Failed to fetch shipping parameters")
      }
      const data: ShippingParameter[] = await res.json()
      setParameters(data)
    } catch (err) {
      console.error("Failed to fetch shipping parameters", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchParameters()
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await api.post("/api/shipping-parameters/sync")
      if (!res.ok) {
        throw new Error("Sync failed")
      }
      const data = await res.json()
      setSyncMessage(data.message || `Sync completed: ${data.total} records processed.`)
      await fetchParameters()
    } catch (err) {
      console.error("Failed to sync shipping parameters", err)
      setSyncMessage("Failed to sync shipping parameters. Please try again.")
    } finally {
      setSyncing(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("asc")
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null
    return sortOrder === "asc" ? "↑" : "↓"
  }

  const metrics = useMemo(() => {
    const total = parameters.length
    const countries = new Set(parameters.map(p => p.country)).size
    const shipModes = new Set(parameters.filter(p => !p.isDefault).map(p => p.shipMode)).size

    return { total, countries, shipModes }
  }, [parameters])

  const filteredAndSorted = useMemo(() => {
    let filtered = [...parameters]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.country.toLowerCase().includes(query) ||
          (p.region?.toLowerCase().includes(query) ?? false) ||
          p.shipMode.toLowerCase().includes(query)
      )
    }

    filtered.sort((a, b) => {
      const aValue = a[sortField] ?? ""
      const bValue = b[sortField] ?? ""

      const comparison =
        typeof aValue === "number" && typeof bValue === "number"
          ? aValue - bValue
          : String(aValue).localeCompare(String(bValue))
      return sortOrder === "asc" ? comparison : -comparison
    })

    return filtered
  }, [parameters, searchQuery, sortField, sortOrder])

  const totalPages = Math.ceil(filteredAndSorted.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const currentRows = filteredAndSorted.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-brand-blue dark:text-slate-100 tracking-tight">
            Shipping Parameters
          </h1>
          <p className="text-sm text-brand-blue dark:text-slate-100/60 dark:text-slate-300">
            Lead time master data by country, region, and ship mode
          </p>
        </div>
        <Button
          onClick={handleSync}
          disabled={syncing}
          className="sm:w-auto w-full"
        >
          {syncing ? "Syncing..." : "Sync Parameters"}
        </Button>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-slate-100 dark:border-slate-800">
          <CardContent className="p-4 flex flex-col justify-center">
            <span className="text-xs font-medium text-brand-blue dark:text-slate-100/50 dark:text-slate-400 uppercase tracking-wider">Total Rows</span>
            <span className="text-2xl font-semibold text-brand-blue dark:text-slate-100 mt-1">{loading ? "..." : metrics.total}</span>
          </CardContent>
        </Card>
        <Card className="border border-slate-100 dark:border-slate-800">
          <CardContent className="p-4 flex flex-col justify-center">
            <span className="text-xs font-medium text-brand-blue dark:text-slate-100/50 dark:text-slate-400 uppercase tracking-wider">Countries</span>
            <span className="text-2xl font-semibold text-brand-blue dark:text-slate-100 mt-1">{loading ? "..." : metrics.countries}</span>
          </CardContent>
        </Card>
        <Card className="border border-slate-100 dark:border-slate-800">
          <CardContent className="p-4 flex flex-col justify-center">
            <span className="text-xs font-medium text-brand-blue dark:text-slate-100/50 dark:text-slate-400 uppercase tracking-wider">Ship Modes</span>
            <span className="text-2xl font-semibold text-brand-blue dark:text-slate-100 mt-1">{loading ? "..." : metrics.shipModes}</span>
          </CardContent>
        </Card>
      </div>

      {/* Sync Message Banner */}
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

      {/* Search Toolbar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-blue dark:text-slate-100/40 dark:text-slate-400"
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
                  placeholder="Search by country, region, or ship mode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-brand-blue/5"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parameters Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="font-medium text-brand-blue dark:text-slate-100/50 dark:text-slate-400 uppercase text-xs tracking-wider cursor-pointer hover:text-brand-blue dark:text-slate-100/70 dark:text-slate-300 transition-colors"
                onClick={() => handleSort("country")}
              >
                Country {getSortIcon("country")}
              </TableHead>
              <TableHead
                className="font-medium text-brand-blue dark:text-slate-100/50 dark:text-slate-400 uppercase text-xs tracking-wider cursor-pointer hover:text-brand-blue dark:text-slate-100/70 dark:text-slate-300 transition-colors"
                onClick={() => handleSort("region")}
              >
                Region {getSortIcon("region")}
              </TableHead>
              <TableHead
                className="font-medium text-brand-blue dark:text-slate-100/50 dark:text-slate-400 uppercase text-xs tracking-wider cursor-pointer hover:text-brand-blue dark:text-slate-100/70 dark:text-slate-300 transition-colors"
                onClick={() => handleSort("shipMode")}
              >
                Ship Mode {getSortIcon("shipMode")}
              </TableHead>
              <TableHead
                className="font-medium text-brand-blue dark:text-slate-100/50 dark:text-slate-400 uppercase text-xs tracking-wider cursor-pointer hover:text-brand-blue dark:text-slate-100/70 dark:text-slate-300 transition-colors text-right"
                onClick={() => handleSort("leadTimeDays")}
              >
                Lead Time {getSortIcon("leadTimeDays")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-brand-blue dark:text-slate-100/60 dark:text-slate-300 py-12">
                  Loading shipping parameters...
                </TableCell>
              </TableRow>
            ) : filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-brand-blue dark:text-slate-100/60 dark:text-slate-300 py-12">
                  {parameters.length === 0
                    ? "No shipping parameters found. Run a sync first."
                    : "No rows match your filter criteria"}
                </TableCell>
              </TableRow>
            ) : (
              currentRows.map((row) => (
                <TableRow
                  key={row.id}
                  className="hover:bg-brand-blue/[0.02] transition-colors"
                >
                  {/* Country */}
                  <TableCell className="py-4">
                    <Badge variant="badge" className="text-brand-blue dark:text-slate-100/70 dark:text-slate-300 font-normal">
                      {row.country}
                    </Badge>
                  </TableCell>

                  {/* Region */}
                  <TableCell className="py-4">
                    {row.region ? (
                      <span className="text-sm text-brand-blue dark:text-slate-100/70 dark:text-slate-300 bg-brand-blue/5 px-2 py-1 rounded">
                        {row.region}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Ship Mode */}
                  <TableCell className="py-4">
                    {row.isDefault ? (
                      <Badge variant="outline" className="border-dashed border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400">
                        Default (no ship mode)
                      </Badge>
                    ) : (
                      <span className="text-sm font-semibold text-brand-blue dark:text-slate-100">
                        {row.shipMode}
                      </span>
                    )}
                  </TableCell>

                  {/* Lead Time */}
                  <TableCell className="py-4 text-right">
                    <span className="inline-flex items-center gap-1">
                      <span className="text-sm font-semibold text-brand-blue dark:text-slate-100">
                        {row.leadTimeDays}
                      </span>
                      <span className="text-xs text-brand-blue dark:text-slate-100/50 dark:text-slate-400">days</span>
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Results Summary & Pagination */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-sm text-brand-blue dark:text-slate-100/50 dark:text-slate-400">
          Showing {currentRows.length} of {filteredAndSorted.length} parameters
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
