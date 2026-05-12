import { useState, useEffect } from "react"
import { Button } from "../../shared/components/ui/Button"
import { Card, CardContent  } from "../../shared/components/ui/Card"
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
}

export function CustomersPage() {

  const [sortField, setSortField] = useState<string>("customerCode")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  setSortField("customerCode")
  setSortDirection("asc")
  const api = useApi()

  const fetchCustomers = async () => {
    try {
      const res = await api.get("/api/customers")
      if (!res.ok) {
        throw new Error("Failed to fetch customers")
      }
      const data = await res.json()
      setCustomers(data)
    } catch (err) {
      console.error("Failed to fetch customers", err)
    }
  }

  useEffect(() => {
    const loadCustomers = async () => {
      setLoading(true)
      await fetchCustomers()
      setLoading(false)
    }

    loadCustomers()
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
      setSyncMessage(data.message || `Sync completed: ${data.total} customers processed`)
      await fetchCustomers()
    } catch (err) {
      console.error("Failed to sync customers", err)
      setSyncMessage("Failed to sync customers. Please try again.")
    } finally {
      setSyncing(false)
    }
  }

  const sortedCustomers = [...customers].sort((a, b) => {
    const aValue = a[sortField as keyof typeof a]
    const bValue = b[sortField as keyof typeof b]

    // handle null/undefined
    const aSafe = aValue ?? ""
    const bSafe = bValue ?? ""

    if (aSafe < bSafe) return sortDirection === "asc" ? -1 : 1
    if (aSafe > bSafe) return sortDirection === "asc" ? 1 : -1
    return 0
  })
  const totalPages = Math.ceil(customers.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const currentCustomers = sortedCustomers.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  )

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-brand-blue tracking-tight">
            Customers
          </h1>
          <p className="text-sm text-brand-blue/60">
            Manage your customer database and sync data
          </p>
        </div>
        <Button
          onClick={handleSyncCustomers}
          disabled={syncing}
        >
          {syncing ? "Syncing..." : "Sync Customers"}
        </Button>
      </div>

      {/* Sync Message */}
      {syncMessage && (
        <Card className={`border ${syncMessage.includes("failed") ? "border-brand-red/20" : "border-brand-blue/20"}`}>
          <CardContent className="py-4">
            <p className={`text-sm ${syncMessage.includes("failed") ? "text-brand-red" : "text-brand-blue/80"}`}>
              {syncMessage}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Customers Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                Customer Code
              </TableHead>
              <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                Customer Name
              </TableHead>
              <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                Email
              </TableHead>
              {/* <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                Address
              </TableHead> */}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-brand-blue/60 py-8"
                >
                  Loading customers...
                </TableCell>
              </TableRow>
            ) : sortedCustomers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-brand-blue/60 py-8"
                >
                  No customers found. Click "Sync Customers" to load data.
                </TableCell>
              </TableRow>
            ) : (
              currentCustomers.map((customer) => (
                <TableRow key={customer.customerId}>
                  <TableCell className="font-medium text-brand-blue">
                    {customer.customerCode}
                  </TableCell>
                  <TableCell>{customer.customerName}</TableCell>
                  <TableCell className="text-brand-blue/70">
                    {customer.customerEmail || "-"}
                  </TableCell>
                  {/* <TableCell className="text-brand-blue/70">-</TableCell> */}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  )
}
