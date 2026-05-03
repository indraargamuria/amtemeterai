import { useState } from "react"
import { Button } from "../../shared/components/ui/Button"
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

interface Customer {
  code: string
  name: string
  email: string
  address: string
}

const dummyCustomers: Customer[] = [
  {
    code: "CUST001",
    name: "PT Maju Jaya Logistics",
    email: "contact@majujaya.co.id",
    address: "Jl. Industri No. 123, Jakarta",
  },
  {
    code: "CUST002",
    name: "CV Berkah Abadi",
    email: "info@berkahabadi.com",
    address: "Jl. Raya Bogor KM 45, Depok",
  },
  {
    code: "CUST003",
    name: "PT Global Shipping",
    email: "ops@globalshipping.id",
    address: "Jl. Tanjung Priok No. 88, Jakarta Utara",
  },
  {
    code: "CUST004",
    name: "UD Sejahtera Transport",
    email: "admin@sejahteratransport.com",
    address: "Jl. Ahmad Yani No. 234, Bekasi",
  },
  {
    code: "CUST005",
    name: "PT Fast Forward Cargo",
    email: "cs@fastforwardcargo.co.id",
    address: "Jl. Pemuda No. 56, Surabaya",
  },
  {
    code: "CUST006",
    name: "CV Mitra Logistik",
    email: "mitra@logistikmitra.com",
    address: "Jl. Gatot Subroto No. 78, Bandung",
  },
  {
    code: "CUST007",
    name: "PT Sinar Sumber Rejeki",
    email: "sinar@ssr.co.id",
    address: "Jl. Sudirman No. 12, Medan",
  },
  {
    code: "CUST008",
    name: "UD Rahmat Transport",
    email: "rahmat@transport.com",
    address: "Jl. Diponegoro No. 45, Semarang",
  },
]

const ITEMS_PER_PAGE = 5

export function CustomersPage() {
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.ceil(dummyCustomers.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const currentCustomers = dummyCustomers.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  )

  const handleSyncCustomers = () => {
    console.log("Sync customers clicked")
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-blue">Customers</h1>
          <p className="mt-1 text-sm text-brand-blue/60">
            Manage your customer database
          </p>
        </div>
        <Button onClick={handleSyncCustomers}>Sync Customers</Button>
      </div>

      {/* Customers Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer Code</TableHead>
              <TableHead>Customer Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentCustomers.map((customer) => (
              <TableRow key={customer.code}>
                <TableCell className="font-medium">
                  {customer.code}
                </TableCell>
                <TableCell>{customer.name}</TableCell>
                <TableCell>{customer.email}</TableCell>
                <TableCell>{customer.address}</TableCell>
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
