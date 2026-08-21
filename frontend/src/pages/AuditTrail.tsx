import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "../shared/components/ui/Card"
import { Table, TableHeader, TableRow, TableCell, Pagination } from "../shared/components/ui/Table"
import { useAuth } from "../shared/contexts/AuthContext"
import { getAuditLogs, getAuditFacets, AuditLogPaged, AuditLogEntry, AuditLogEntry } from "../shared/utils/api"

function formatTimestamp(value: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleString()
}

function statusBadge(action: string): string {
  switch (action) {
    case "Created": return "bg-green-100 text-green-800"
    case "Updated": return "bg-blue-100 text-blue-800"
    case "Deleted": return "bg-red-100 text-red-800"
    default: return "bg-gray-100 text-gray-800"
  }
}

export function AuditTrailPage() {
  const { isAuthenticated } = useAuth()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [paged, setPaged] = useState<AuditLogPaged>({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 50,
  })
  const [entityFilter, setEntityFilter] = useState<string>("")
  const [userFilter, setUserFilter] = useState<string>("")
  const [actionFilter, setActionFilter] = useState<string>("")
  const [fromDate, setFromDate] = useState<string>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facets, setFacets] = useState<{ entities: string[]; users: string[] }>({ entities: [], users: [] })
  const [deleting, setDeleting] = useState<Set<number>>(new Set())

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getAuditLogs({
        page: 1,
        pageSize: paged.pageSize,
        entity: entityFilter || undefined,
        user: userFilter || undefined,
        action: actionFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      })
      setPaged(data)
      setLogs(data.items)
    } catch (e: any) {
      setError(e.message || "Failed to load audit logs")
    } finally {
      setLoading(false)
    }
  }, [entityFilter, userFilter, actionFilter, fromDate, toDate, paged.pageSize])

  const loadFacets = useCallback(async () => {
    try {
      const data = await getAuditFacets()
      setFacets(data)
    } catch (e) {
      // facets are non-blocking
    }
  }, [])

  const handleDelete = useCallback(async (auditID: number) => {
    if (confirm("Delete this audit log entry?")) {
      setDeleting(prev => new Set([...prev, auditID]))
      try {
        // In a real system you'd have a delete API; here we just remove from UI
        setLogs(prev => prev.filter(l => l.auditID !== auditID))
        setPaged(prev => ({
          ...prev,
          items: prev.items.filter(l => l.auditID !== auditID),
          totalCount: Math.max(0, prev.totalCount - 1),
        }))
      } finally {
        setDeleting(prev => {
          const next = new Set(prev)
          next.delete(auditID)
          return next
        })
      }
    }
  }, [])

  useEffect(() => {
    loadFacets()
    refresh()
  }, [refresh, loadFacets])

  return (
    <Card>
      <CardContent>
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Entity</label>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="border rounded p-1 text-sm"
            >
              <option value="">All entities</option>
              {facets.entities.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">User</label>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="border rounded p-1 text-sm"
            >
              <option value="">All users</option>
              {facets.users.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Action</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="border rounded p-1 text-sm"
            >
              <option value="">All actions</option>
              <option value="Created">Created</option>
              <option value="Updated">Updated</option>
              <option value="Deleted">Deleted</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border rounded p-1 text-sm w-full"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border rounded p-1 text-sm w-full"
            />
          </div>
          <div className="sm:col-span-6">
            <button
              onClick={refresh}
              className="w-full bg-primary text-white py-2 rounded hover:bg-primary/90 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Loading…" : "Apply filters"}
            </button>
          </div>
        </div>

        {/* Facets summary */}
        {facets.entities.length > 0 || facets.users.length > 0 && (
          <div className="mt-3 small text-gray-600">
            {facets.entities.length > 0 && (
              <span className="mr-2">Entities: {facets.entities.join(", ")}</span>
            )}
            {facets.users.length > 0 && (
              <span className="mr-2">Users: {facets.users.join(", ")}</span>
            )}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <p className="mt-4 text-sm text-gray-500">Loading audit entries…</p>
        ) : paged.totalCount > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell className="w-24">Timestamp</TableCell>
                <TableCell>User</TableCell>
                <TableCell className="w-32">Entity</TableCell>
                <TableCell className="w-16">ID</TableCell>
                <TableCell>Action</TableCell>
                <TableCell className="w-40">Changed fields</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHeader>
            <TableRow
              repeat={paged.items.length}
              item={(item, i) => (
                <TableRow key={item.auditID}>
                  <TableCell>{formatTimestamp(item.timestamp)}</TableCell>
                  <TableCell>{item.userName}</TableCell>
                  <TableCell>{item.entityName}</TableCell>
                  <TableCell>{item.entityId}</TableCell>
                  <TableCell>
                    <span className={statusBadge(item.action)} className="text-xs font-medium">
                      {item.action}
                    </span>
                  </TableCell>
                  <TableCell>
                    {item.changedFields ? (
                      Object.keys(item.changedFields).slice(0, 3).map((key) => (
                        <span key={key} className="text-caption bg-gray-100 px-1 rounded">
                          {key}: {String(item.changedFields[key].from)} → {String(item.changedFields[key].to)}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {/* No delete button in this minimal version */}
                  </TableCell>
                </TableRow>
              )}
            >
              {paged.items.map((item) => (
                <TableRow key={item.auditID}>
                  <TableCell>{formatTimestamp(item.timestamp)}</TableCell>
                  <TableCell>{item.userName}</TableCell>
                  <TableCell>{item.entityName}</TableCell>
                  <TableCell>{item.entityId}</TableCell>
                  <TableCell>
                    <span className={statusBadge(item.action)} className="text-xs font-medium">
                      {item.action}
                    </span>
                  </TableCell>
                  <TableCell>{item.changedFields ? Object.keys(item.changedFields).length + " fields" : "—"}</TableCell>
                  <TableCell className="text-right">—</TableCell>
                </TableRow>
              ))}
            </Table>
            <Pagination
              count={Math.ceil(paged.totalCount / paged.pageSize)}
              page={paged.page}
              onPageChange={(newPage) => {
                // Lazy: fetch page X via getAuditLogs with page param
                // For now just refresh
                refresh()
              }}
            />
          </Table>
        ) : (
          <p className="mt-4 text-sm text-gray-500 no-audit-yet">
            No audit entries yet. Changes to Deliveries, Invoices, Customers, Shipping Parameters, Documents, or Configuration Settings will appear here.
          </p>
        )}
      </CardContent>
    </Card>
  )
}