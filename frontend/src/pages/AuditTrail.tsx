import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "../shared/components/ui/Card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../shared/components/ui/Table"
import { Pagination } from "../shared/components/ui/Pagination"
import { Button } from "../shared/components/ui/Button"
import {
  getAuditLogs,
  getAuditFacets,
  type AuditLogEntry,
} from "../shared/utils/api"

function formatDateTime(value: string): string {
  const d = new Date(value)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleString()
}

function actionBadgeClass(action: string): string {
  switch (action) {
    case "Created":
      return "bg-green-100 text-green-800"
    case "Updated":
      return "bg-blue-100 text-blue-800"
    case "Deleted":
      return "bg-red-100 text-red-800"
    default:
      return "bg-gray-100 text-gray-600"
  }
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "∅"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

const PAGE_SIZE = 25

export function AuditTrailPage() {
  const [data, setData] = useState<AuditLogEntry[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [entity, setEntity] = useState("")
  const [user, setUser] = useState("")
  const [action, setAction] = useState("")
  const [entityId, setEntityId] = useState("")
  const [facets, setFacets] = useState<{ entities: string[]; users: string[] }>({ entities: [], users: [] })

  // Expanded row detail
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await getAuditLogs({
        page,
        pageSize: PAGE_SIZE,
        entity: entity || undefined,
        entityId: entityId || undefined,
        user: user || undefined,
        action: action || undefined,
      })
      setData(result.items)
      setTotalCount(result.totalCount)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Failed to load audit trail")
    } finally {
      setLoading(false)
    }
  }, [page, entity, user, action, entityId])

  useEffect(() => {
    getAuditFacets()
      .then(setFacets)
      .catch(() => {}) // non-blocking
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Audit Trail</h1>
        <span className="text-sm text-gray-500">{totalCount} entries</span>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Entity</label>
              <select
                value={entity}
                onChange={(e) => { setEntity(e.target.value); setPage(1) }}
                className="border rounded p-1.5 text-sm w-full"
              >
                <option value="">All entities</option>
                {facets.entities.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">User</label>
              <select
                value={user}
                onChange={(e) => { setUser(e.target.value); setPage(1) }}
                className="border rounded p-1.5 text-sm w-full"
              >
                <option value="">All users</option>
                {facets.users.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Action</label>
              <select
                value={action}
                onChange={(e) => { setAction(e.target.value); setPage(1) }}
                className="border rounded p-1.5 text-sm w-full"
              >
                <option value="">All actions</option>
                <option value="Created">Created</option>
                <option value="Updated">Updated</option>
                <option value="Deleted">Deleted</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Record ID contains</label>
              <input
                value={entityId}
                onChange={(e) => { setEntityId(e.target.value); setPage(1) }}
                placeholder="e.g. delivery number"
                className="border rounded p-1.5 text-sm w-full"
              />
            </div>
          </div>
          {(entity || user || action || entityId) !== "" && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => { setEntity(""); setUser(""); setAction(""); setEntityId(""); setPage(1) }}
            >
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Error / loading */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{error}</div>
      )}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-gray-500">No audit entries found for the current filters.</p>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Record ID</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Changes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((log) => {
                    const fieldCount = log.changedFields ? Object.keys(log.changedFields).length : 0
                    const isExpanded = expandedId === log.auditID
                    return (
                      <>
                        <TableRow
                          key={log.auditID}
                          className={isExpanded ? "bg-muted/40" : "cursor-pointer"}
                          onClick={() => setExpandedId(isExpanded ? null : log.auditID)}
                        >
                          <TableCell className="whitespace-nowrap text-sm">{formatDateTime(log.timestamp)}</TableCell>
                          <TableCell className="text-sm">{log.userName}</TableCell>
                          <TableCell className="text-sm">{log.entityName}</TableCell>
                          <TableCell className="font-mono text-xs">{log.entityId}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionBadgeClass(log.action)}`}>
                              {log.action}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {fieldCount > 0 ? `${fieldCount} field${fieldCount > 1 ? "s" : ""}` : "—"}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${log.auditID}-detail`}>
                            <TableCell colSpan={6} className="bg-slate-50 px-6 py-4">
                              <div className="space-y-2">
                                <div className="flex gap-4 text-xs text-gray-500">
                                  <span>IP: {log.ipAddress ?? "—"}</span>
                                  <span>UTC: {log.timestamp}</span>
                                </div>
                                {!log.changedFields || Object.keys(log.changedFields).length === 0 ? (
                                  <p className="text-xs text-gray-500">No field-level changes recorded.</p>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-left text-gray-500 border-b">
                                        <th className="py-1 pr-4 font-medium">Field</th>
                                        <th className="py-1 pr-4 font-medium">From</th>
                                        <th className="py-1 font-medium">To</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {Object.entries(log.changedFields).map(([field, change]) => (
                                        <tr key={field} className="border-b last:border-b-0">
                                          <td className="py-1 pr-4 font-mono">{field}</td>
                                          <td className="py-1 pr-4 max-w-[280px] truncate" title={formatValue(change.from)}>
                                            {formatValue(change.from)}
                                          </td>
                                          <td className="py-1 max-w-[280px] truncate" title={formatValue(change.to)}>
                                            {formatValue(change.to)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  )
}
