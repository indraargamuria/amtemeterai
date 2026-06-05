import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Badge } from "../../shared/components/ui/Badge"
import { Card, CardContent } from "../../shared/components/ui/Card"
import { Input } from "../../shared/components/ui/Input"
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
import { useAuth } from "../../shared/contexts/AuthContext"

interface DeliveryHeader {
  deliveryId: number
  deliveryNumber: string
  deliveryDate: string
  deliveryRemarks: string | null
  customerCode: string
  customerName: string
  received: boolean
  invoiced: boolean
  plant?: string | null
  type?: number | null
  status?: number | null
  salesPersonName?: string | null
  salesPersonEmail?: string | null
  cityRegency?: string | null
  district?: string | null
  province?: string | null
  photosCount?: number
  // 🚀 ADDED: Cancellation Tracking Fields
  isCanceled?: boolean
  cancelReason?: string | null
  // NEW: Printout document tracking
  hasPrintoutDocument?: boolean
}

type SortField = "deliveryDate" | "deliveryNumber" | "status"
type SortOrder = "asc" | "desc"
type ComplianceFilter = "all" | "bc" | "nonbc"
// 🚀 EXTENDED: Filter state to capture delivery pipeline exclusions
type PipelineFilter = "all" | "active" | "canceled"

const ITEMS_PER_PAGE = 10

export function DeliveriesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [currentPage, setCurrentPage] = useState(1)
  const [deliveries, setDeliveries] = useState<DeliveryHeader[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("deliveryDate")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")
  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilter>("all")
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>("active") // Defaults to hiding noise from cancelled rows
  const [showDiscrepancyOnly, setShowDiscrepancyOnly] = useState(false)
  // const [_uploading, setUploading] = useState<number | null>(null)
  // const [fileInput, _setFileInput] = useState<HTMLInputElement | null>(null)

  const api = useApi()

  // Get user's assigned plants and sysadmin status
  const assignedPlants: string[] = user?.plants || []
  const isSysAdmin = user?.roles?.includes('sysadmin') || false

  // const handleFileUpload = async (deliveryId: number) => {
  //   const file = fileInput?.files?.[0]
  //   if (!file) return

  //   try {
  //     setUploading(deliveryId)
  //     await uploadDeliveryPrintout(deliveryId, file)
  //     // Refresh data
  //     fetchDeliveries()
  //   } catch (err) {
  //     console.error("Failed to upload printout:", err)
  //     alert("Failed to upload printout. Please try again.")
  //   } finally {
  //     setUploading(null)
  //     if (fileInput) fileInput.value = ""
  //   }
  // }

  const fetchDeliveries = async () => {
    try {
      setLoading(true)
      const res = await api.get("/api/deliveries")
      if (!res.ok) {
        throw new Error("Failed to fetch deliveries")
      }
      const data: DeliveryHeader[] = await res.json()
      setDeliveries(data)
    } catch (err) {
      console.error("Failed to fetch deliveries", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDeliveries()
  }, [])

  const handleRowClick = (deliveryId: number) => {
    navigate(`/deliveries/${deliveryId}`)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("desc")
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null
    return sortOrder === "asc" ? "↑" : "↓"
  }

  // 🚀 ROLE FILTER CHECK: Derive warehouse context status directly from Auth profile claims context
  const isWarehouse = useMemo(() => {
    return user?.roles?.includes('warehouse') || false
  }, [user])

  const filteredAndSortedDeliveries = useMemo(() => {
    let filtered = [...deliveries]

    // 🚀 NEW: Plant-Level Security Filter (apply before other filters for efficiency)
    // Sysadmin bypass: show all plants
    // Standard operators: only show deliveries matching their assigned plants
    if (!isSysAdmin && assignedPlants.length > 0) {
      filtered = filtered.filter((d) => {
        // Only include deliveries where plant matches one of the user's assigned plants
        // If delivery has no plant assigned, exclude it for security
        if (!d.plant) return false
        return assignedPlants.includes(d.plant)
      })
    } else if (!isSysAdmin && assignedPlants.length === 0) {
      // Non-sysadmin user with no plants assigned - show nothing for security
      filtered = []
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (d) =>
          d.deliveryNumber.toLowerCase().includes(query) ||
          (!isWarehouse && d.customerName.toLowerCase().includes(query)) ||
          (!isWarehouse && d.customerCode.toLowerCase().includes(query)) ||
          (d.salesPersonName?.toLowerCase().includes(query) ?? false) ||
          (d.cancelReason?.toLowerCase().includes(query) ?? false)
      )
    }

    // Apply compliance filter
    if (complianceFilter !== "all") {
      filtered = filtered.filter((d) => {
        if (complianceFilter === "bc") return d.type === 1
        if (complianceFilter === "nonbc") return d.type === 2
        return true
      })
    }

    // Apply pipeline status filter
    if (pipelineFilter === "active") {
      filtered = filtered.filter((d) => !d.isCanceled)
    } else if (pipelineFilter === "canceled") {
      filtered = filtered.filter((d) => d.isCanceled)
    }

    // Apply discrepancy filter
    if (showDiscrepancyOnly) {
      filtered = filtered.filter((d) => d.status === 2 && !d.isCanceled)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case "deliveryDate":
          comparison = new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime()
          break
        case "deliveryNumber":
          comparison = a.deliveryNumber.localeCompare(b.deliveryNumber)
          break
        case "status":
          // Push cancellation tracking downstream behind operational problems
          const weightA = a.isCanceled ? 3 : (a.status === 2 ? 0 : 1)
          const weightB = b.isCanceled ? 3 : (b.status === 2 ? 0 : 1)
          comparison = weightA - weightB
          break
      }

      return sortOrder === "asc" ? comparison : -comparison
    })

    return filtered
  }, [deliveries, searchQuery, sortField, sortOrder, complianceFilter, pipelineFilter, showDiscrepancyOnly, assignedPlants, isSysAdmin, isWarehouse])

  const totalPages = Math.ceil(filteredAndSortedDeliveries.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const currentDeliveries = filteredAndSortedDeliveries.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, sortField, sortOrder, complianceFilter, pipelineFilter, showDiscrepancyOnly])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getComplianceBadge = (type: number | null | undefined) => {
    if (type === 1) {
      return <Badge variant="bc">BC Compliance</Badge>
    }
    if (type === 2) {
      return <Badge variant="nonbc">Non-BC</Badge>
    }
    return <Badge variant="outline">-</Badge>
  }

  const getFulfillmentBadge = (status: number | null | undefined, received: boolean, isCanceled?: boolean) => {
    // 🚀 ADDED: Intercept badge execution if cancellation takes state machine priority
    if (isCanceled) {
      return (
        <Badge className="bg-rose-50 text-rose-700 border-rose-200">
          <span className="mr-1">✕</span>Void / Cancelled
        </Badge>
      )
    }
    if (!received) {
      return (
        <Badge variant="info" className="text-brand-blue/70 border-brand-blue/10">
          Pending Delivery
        </Badge>
      )
    }
    if (status === 2) {
      return (
        <Badge variant="warning" className="text-amber-700 border-amber/20">
          <span className="mr-1">⚠</span>Partial / Discrepancy
        </Badge>
      )
    }
    return (
      <Badge variant="success" className="text-emerald-700 border-emerald/20">
        <span className="mr-1">✓</span>Fully Received
      </Badge>
    )
  }

  const getInvoicedBadge = (invoiced: boolean, isCanceled?: boolean) => {
    if (isCanceled) return null // Hide invoicing metadata if shipment is dead void
    if (invoiced) {
      return (
        <Badge variant="outline" className="border-brand-blue/30 text-brand-blue/70">
          Invoiced
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="border-dashed border-slate-300 text-slate-400">
        Uninvoiced
      </Badge>
    )
  }

  const getRoutingString = (cityRegency: string | null | undefined, district: string | null | undefined) => {
    const parts: string[] = []
    if (district) parts.push(`Kec. ${district}`)
    if (cityRegency) parts.push(cityRegency)
    return parts.length > 0 ? parts.join(", ") : "-"
  }

  const getDestinationOwner = (plant: string | null | undefined, salesPersonName: string | null | undefined) => {
    const parts: string[] = []
    if (plant) parts.push(plant)
    if (salesPersonName) parts.push(salesPersonName)
    return parts.length > 0 ? parts.join(" (") + (salesPersonName ? ")" : "") : "-"
  }

  const getPhotoIndicator = (count: number | undefined, isCanceled?: boolean) => {
    if (isCanceled) return <span className="text-xs text-slate-300">-</span>
    if (!count || count === 0) {
      return (
        <div className="flex items-center gap-1.5 text-brand-blue/30 justify-center">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs">-</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1.5 text-brand-blue/80 justify-center">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-xs font-medium">{count}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-brand-blue tracking-tight">
          Deliveries
        </h1>
        <p className="text-sm text-brand-blue/60">
          Track and manage all delivery operations
        </p>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Box */}
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
                  placeholder={isWarehouse ? "Search by delivery number, salesperson, or cancellation reason..." : "Search by delivery number, customer, salesperson, or cancellation reason..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-brand-blue/5"
                />
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap gap-3 items-center">
              {/* Compliance Type Selector */}
              <div className="flex items-center gap-2 bg-brand-blue/5 rounded-lg px-3 py-2">
                <span className="text-xs text-brand-blue/60 whitespace-nowrap">Type:</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setComplianceFilter("all")}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      complianceFilter === "all"
                        ? "bg-brand-blue text-white"
                        : "text-brand-blue/70 hover:bg-brand-blue/10"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setComplianceFilter("bc")}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      complianceFilter === "bc"
                        ? "bg-emerald-600 text-white"
                        : "text-brand-blue/70 hover:bg-brand-blue/10"
                    }`}
                  >
                    BC
                  </button>
                  <button
                    onClick={() => setComplianceFilter("nonbc")}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      complianceFilter === "nonbc"
                        ? "bg-slate-500 text-white"
                        : "text-brand-blue/70 hover:bg-brand-blue/10"
                    }`}
                  >
                    Non-BC
                  </button>
                </div>
              </div>

              {/* 🚀 ADDED: Pipeline Exception Filtering Segment */}
              <div className="flex items-center gap-2 bg-brand-blue/5 rounded-lg px-3 py-2">
                <span className="text-xs text-brand-blue/60 whitespace-nowrap">Status:</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPipelineFilter("active")}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      pipelineFilter === "active"
                        ? "bg-brand-blue text-white"
                        : "text-brand-blue/70 hover:bg-brand-blue/10"
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setPipelineFilter("canceled")}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      pipelineFilter === "canceled"
                        ? "bg-rose-600 text-white"
                        : "text-brand-blue/70 hover:bg-brand-blue/10"
                    }`}
                  >
                    Canceled
                  </button>
                  <button
                    onClick={() => setPipelineFilter("all")}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      pipelineFilter === "all"
                        ? "bg-slate-600 text-white"
                        : "text-brand-blue/70 hover:bg-brand-blue/10"
                    }`}
                  >
                    All
                  </button>
                </div>
              </div>

              {/* Discrepancy Filter */}
              <label className="flex items-center gap-2 cursor-pointer bg-brand-blue/5 rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={showDiscrepancyOnly}
                  onChange={(e) => setShowDiscrepancyOnly(e.target.checked)}
                  disabled={pipelineFilter === "canceled"}
                  className="w-4 h-4 rounded border-brand-blue/20 text-brand-blue focus:ring-brand-red/50 disabled:opacity-50"
                />
                <span className={`text-xs text-brand-blue/70 whitespace-nowrap ${pipelineFilter === "canceled" ? "opacity-50" : ""}`}>
                  Discrepancies Only
                </span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deliveries Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider cursor-pointer hover:text-brand-blue/70 transition-colors"
                onClick={() => handleSort("deliveryDate")}
              >
                Delivery / Date {getSortIcon("deliveryDate")}
              </TableHead>
              
              {/* 🚀 CONDITIONAL HEADER: Drop Customer column dynamically if the warehouse role matches */}
              {!isWarehouse && (
                <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                  Customer
                </TableHead>
              )}

              <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                Compliance
              </TableHead>
              <TableHead
                className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider cursor-pointer hover:text-brand-blue/70 transition-colors"
                onClick={() => handleSort("status")}
              >
                Status {getSortIcon("status")}
              </TableHead>
              <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider text-center">
                Proof
              </TableHead>
              <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                Drop Location
              </TableHead>
              <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                Account Owner
              </TableHead>
              {/* <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                Actions
              </TableHead> */}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={isWarehouse ? 7 : 8} className="text-center text-brand-blue/60 py-12">
                  Loading deliveries...
                </TableCell>
              </TableRow>
            ) : filteredAndSortedDeliveries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isWarehouse ? 7 : 8} className="text-center text-brand-blue/60 py-12">
                  {deliveries.length === 0
                    ? "No deliveries found"
                    : "No deliveries match your filter criteria"}
                </TableCell>
              </TableRow>
            ) : (
              currentDeliveries.map((delivery) => (
                <TableRow
                  key={delivery.deliveryId}
                  className={`cursor-pointer transition-colors ${
                    delivery.isCanceled 
                      ? "bg-slate-50/60 opacity-75 hover:bg-slate-100/50" 
                      : "hover:bg-brand-blue/[0.02]"
                  }`}
                  onClick={() => handleRowClick(delivery.deliveryId)}
                >
                  {/* Combined Delivery Column */}
                  <TableCell className="py-4">
                    <div className="space-y-0.5">
                      <p className={`text-sm font-semibold ${delivery.isCanceled ? "text-slate-500 line-through decoration-slate-400" : "text-brand-blue"}`}>
                        {delivery.deliveryNumber}
                      </p>
                      <p className="text-xs text-brand-blue/40">
                        {formatDate(delivery.deliveryDate)}
                      </p>
                    </div>
                  </TableCell>

                  {/* 🚀 CONDITIONAL ROW DATA: Complete truncation of Customer metrics for warehouse handlers */}
                  {!isWarehouse && (
                    <TableCell className="py-4">
                      {delivery.customerCode && delivery.customerName ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="badge" className={`font-normal ${delivery.isCanceled ? "text-slate-400 bg-slate-100" : "text-brand-blue/70"}`}>
                            {delivery.customerCode}
                          </Badge>
                          <span className={`text-sm ${delivery.isCanceled ? "text-slate-500" : "text-brand-blue/80"}`}>
                            {delivery.customerName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-brand-blue/40 italic">Confidential</span>
                      )}
                    </TableCell>
                  )}

                  {/* Compliance Type Column */}
                  <TableCell className="py-4">
                    {getComplianceBadge(delivery.type)}
                  </TableCell>

                  {/* Fulfillment State Column with Invoiced Badge / Cancel Reason */}
                  <TableCell className="py-4">
                    <div className="flex flex-col gap-1.5">
                      {getFulfillmentBadge(delivery.status, delivery.received, delivery.isCanceled)}
                      {delivery.isCanceled ? (
                        <p className="text-[11px] font-medium text-rose-600/80 max-w-[180px] truncate" title={delivery.cancelReason || "No custom reason specified"}>
                          Reason: {delivery.cancelReason || "System/Manual Void"}
                        </p>
                      ) : (
                        getInvoicedBadge(delivery.invoiced, delivery.isCanceled)
                      )}
                    </div>
                  </TableCell>

                  {/* Proof Tracker Column */}
                  <TableCell className="py-4 text-center">
                    {getPhotoIndicator(delivery.photosCount, delivery.isCanceled)}
                  </TableCell>

                  {/* Geographical Routing Zone Column */}
                  <TableCell className="py-4">
                    <p className={`text-sm ${delivery.isCanceled ? "text-slate-400" : "text-brand-blue/70"}`}>
                      {getRoutingString(delivery.cityRegency, delivery.district)}
                    </p>
                  </TableCell>

                  {/* Destination Owner Column */}
                  <TableCell className="py-4">
                    <p className={`text-sm ${delivery.isCanceled ? "text-slate-400" : "text-brand-blue/70"}`}>
                      {getDestinationOwner(delivery.plant, delivery.salesPersonName)}
                    </p>
                  </TableCell>

                  {/* Actions Column */}
                  {/* <TableCell className="py-4">
                    {delivery.isCanceled ? (
                      <span className="text-xs text-slate-400">-</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          ref={(el) => {
                            if (el && fileInput === null) setFileInput(el)
                          }}
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={() => handleFileUpload(delivery.deliveryId)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            fileInput?.click()
                          }}
                          disabled={uploading === delivery.deliveryId || delivery.invoiced}
                        >
                          {uploading === delivery.deliveryId ? "Uploading..." : delivery.hasPrintoutDocument ? "Reupload" : "Upload Printout"}
                        </Button>
                      </div>
                    )}
                  </TableCell> */}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Results Summary & Pagination */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-sm text-brand-blue/50">
          Showing {currentDeliveries.length} of {filteredAndSortedDeliveries.length} deliveries
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