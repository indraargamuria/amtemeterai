import { useState, useEffect } from "react"
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

const ITEMS_PER_PAGE = 10


export function CustomersPage() {
  const [currentPage, setCurrentPage] = useState(1)

  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await fetch("http://localhost:5296/api/customers")
        const data = await res.json()
        setCustomers(data)
      } catch (err) {
        console.error("Failed to fetch customers", err)
      } finally {
        setLoading(false)
      }
    }

    fetchCustomers()
  }, [])
  const totalPages = Math.ceil(customers.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const currentCustomers = dummyCustomers.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  )

  const handleSyncCustomers = () => {
    console.log("Sync customers clicked")
  }

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
        <Button onClick={handleSyncCustomers}>Sync Customers</Button>
      </div>

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
              <TableHead className="font-medium text-brand-blue/50 uppercase text-xs tracking-wider">
                Address
              </TableHead>  
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.customerId}>
                <TableCell className="font-medium text-brand-blue">
                  {customer.customerCode}
                </TableCell>
                <TableCell>{customer.customerName}</TableCell>
                <TableCell className="text-brand-blue/70">{customer.customerEmail}</TableCell>
                <TableCell className="text-brand-blue/70">-</TableCell>
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
