import { useState } from "react"
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

interface Delivery {
  code: string
  customerName: string
  status: "OnGoing" | "Delivered" | "Pending"
  date: string
}

const dummyDeliveries: Delivery[] = [
  {
    code: "DLV1001",
    customerName: "PT Maju Jaya Logistics",
    status: "OnGoing",
    date: "2025-05-03",
  },
  {
    code: "DLV1002",
    customerName: "CV Berkah Abadi",
    status: "Delivered",
    date: "2025-05-02",
  },
  {
    code: "DLV1003",
    customerName: "PT Global Shipping",
    status: "Pending",
    date: "2025-05-02",
  },
  {
    code: "DLV1004",
    customerName: "UD Sejahtera Transport",
    status: "OnGoing",
    date: "2025-05-01",
  },
  {
    code: "DLV1005",
    customerName: "PT Fast Forward Cargo",
    status: "Delivered",
    date: "2025-04-30",
  },
  {
    code: "DLV1006",
    customerName: "CV Mitra Logistik",
    status: "Pending",
    date: "2025-04-30",
  },
  {
    code: "DLV1007",
    customerName: "PT Sinar Sumber Rejeki",
    status: "Delivered",
    date: "2025-04-29",
  },
]

const ITEMS_PER_PAGE = 5

const getStatusVariant = (status: Delivery["status"]) => {
  switch (status) {
    case "OnGoing":
      return "default"
    case "Delivered":
      return "default"
    case "Pending":
      return "accent"
    default:
      return "default"
  }
}

export function DeliveriesPage() {
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.ceil(dummyDeliveries.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const currentDeliveries = dummyDeliveries.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  )

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
                Delivery Code
              </TableHead>
              <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                Customer Name
              </TableHead>
              <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                Status
              </TableHead>
              <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                Date
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentDeliveries.map((delivery) => (
              <TableRow key={delivery.code}>
                <TableCell className="font-medium text-brand-blue">
                  {delivery.code}
                </TableCell>
                <TableCell>{delivery.customerName}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(delivery.status)}>
                    {delivery.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-brand-blue/70">{delivery.date}</TableCell>
              </TableRow>
            ))}
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
