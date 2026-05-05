import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Badge } from "../../shared/components/ui/Badge"
import { Card } from "../../shared/components/ui/Card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../shared/components/ui/Table"
import { Pagination } from "../../shared/components/ui/Pagination"

interface DeliveryHeader {
  deliveryId: number
  deliveryNumber: string
  deliveryDate: string
  deliveryRemarks: string | null
  customerCode: string
  customerName: string
  received: boolean
  invoiced: boolean
}

const ITEMS_PER_PAGE = 10

const API_URL = import.meta.env.VITE_API_URL

export function DeliveriesPage() {
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState(1)
  const [deliveries, setDeliveries] = useState<DeliveryHeader[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDeliveries = async () => {
      try {
        const res = await fetch(`${API_URL}/api/deliveries`)
        const data = await res.json()
        setDeliveries(data)
      } catch (err) {
        console.error("Failed to fetch deliveries", err)
      } finally {
        setLoading(false)
      }
    }

    fetchDeliveries()
  }, [])

  const handleRowClick = (deliveryId: number) => {
    navigate(`/deliveries/${deliveryId}`)
  }

  const totalPages = Math.ceil(deliveries.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const currentDeliveries = deliveries.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  )

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-brand-blue tracking-tight">
          Deliveries
        </h1>
        <p className="text-sm text-brand-blue/60">
          Track and manage all delivery operations
        </p>
      </div>

      {/* Deliveries Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                Delivery Number
              </TableHead>
              <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                Customer Code
              </TableHead>
              <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                Customer Name
              </TableHead>
              <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                Date
              </TableHead>
              <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                Remarks
              </TableHead>
              <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                Received
              </TableHead>
              <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                Invoiced
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-brand-blue/60 py-8"
                >
                  Loading deliveries...
                </TableCell>
              </TableRow>
            ) : deliveries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-brand-blue/60 py-8"
                >
                  No deliveries found
                </TableCell>
              </TableRow>
            ) : (
              currentDeliveries.map((delivery) => (
                <TableRow
                  key={delivery.deliveryId}
                  className="cursor-pointer hover:bg-brand-blue/[0.02]"
                  onClick={() => handleRowClick(delivery.deliveryId)}
                >
                  <TableCell className="font-medium text-brand-blue">
                    {delivery.deliveryNumber}
                  </TableCell>
                  <TableCell className="text-brand-blue/70">
                    {delivery.customerCode}
                  </TableCell>
                  <TableCell>{delivery.customerName}</TableCell>
                  <TableCell className="text-brand-blue/70">
                    {formatDate(delivery.deliveryDate)}
                  </TableCell>
                  <TableCell className="text-brand-blue/70">
                    {delivery.deliveryRemarks || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={delivery.received ? "default" : "accent"}>
                      {delivery.received ? "Received" : "Not Received"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={delivery.invoiced ? "default" : "outline"}
                    >
                      {delivery.invoiced ? "Invoiced" : "Not Invoiced"}
                    </Badge>
                  </TableCell>
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
