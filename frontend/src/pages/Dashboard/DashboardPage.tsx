import { useState, useEffect } from "react"
import { Card, CardContent } from "../../shared/components/ui/Card"
import {
  getDashboardStats,
  getDashboardCharts,
  getStampBreakdown,
  getDashboardLogs,
  getStampQuota,
  getDeliveryMap,
  type DashboardStats,
  type DashboardCharts,
  type StampBreakdown,
  type StampQuota,
  type DeliveryMapBucket
} from "../../shared/utils/api"
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Legend
} from "recharts"

interface ActivityLog {
  logID: number
  timestamp: string
  eventType: string
  referenceID: string
  message: string
  severity: string
}

const STAMP_STATUS_LABELS: Record<number, string> = {
  1: "Not Stamped",
  2: "Pending",
  3: "Stamped",
  4: "Failed"
}

const STAMP_STATUS_COLORS: Record<number, string> = {
  1: "#94a3b8",
  2: "#f59e0b",
  3: "#10b981",
  4: "#ef4444"
}

function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value)
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [chartsData, setChartsData] = useState<DashboardCharts | null>(null)
  const [stampBreakdown, setStampBreakdown] = useState<StampBreakdown[]>([])
  const [stampQuota, setStampQuota] = useState<StampQuota | null>(null)
  const [stampQuotaError, setStampQuotaError] = useState(false)
  const [deliveryMap, setDeliveryMap] = useState<DeliveryMapBucket[]>([])
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        setError(null)

        const [statsRes, chartsRes, stampRes, mapRes] = await Promise.all([
          getDashboardStats(),
          getDashboardCharts(),
          getStampBreakdown(),
          getDeliveryMap()
        ])

        setStats(statsRes)
        setChartsData(chartsRes)
        setStampBreakdown(stampRes)
        setDeliveryMap(mapRes)
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err)
        setError("Failed to load dashboard data. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const logsRes = await getDashboardLogs(20)
        setLogs(logsRes)
      } catch (err) {
        console.error("Failed to fetch activity logs:", err)
      }
    }

    fetchLogs()
  }, [])

  // Stamp quota: fetch on load + poll every 60s (backend caches Peruri call 30s)
  useEffect(() => {
    const fetchStampQuota = async () => {
      try {
        setStampQuota(await getStampQuota())
        setStampQuotaError(false)
      } catch (err) {
        console.error("Failed to fetch stamp quota:", err)
        setStampQuotaError(true)
      }
    }
    fetchStampQuota()
    const id = setInterval(fetchStampQuota, 60_000)
    return () => clearInterval(id)
  }, [])

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)

    if (diffHours > 24) {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    } else if (diffHours > 0) {
      return `${diffHours}h ago`
    } else if (diffMins > 0) {
      return `${diffMins}m ago`
    } else {
      return "Just now"
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "Success":
        return "bg-emerald-500"
      case "Warning":
        return "bg-brand-red"
      case "Info":
      default:
        return "bg-brand-blue/60"
    }
  }

  const resolveLogTitle = (log: ActivityLog) => {
    if (log.eventType === "CustomerSync" || log.message.toLowerCase().includes("customer sync")) {
      return "ERP Customer Sync"
    }

    if (!log.referenceID || log.referenceID.trim() === "-") {
      return "System Update"
    }

    return log.referenceID
  }

  // Merge delivery + invoice series by date for the dual-line chart
  const mergedChartData = (() => {
    if (!chartsData) return []
    const map = new Map<string, { date: string; deliveries: number; invoices: number }>()
    for (const d of chartsData.deliveries) {
      const entry = map.get(d.date) ?? { date: d.date, deliveries: 0, invoices: 0 }
      entry.deliveries = d.count
      map.set(d.date, entry)
    }
    for (const i of chartsData.invoices) {
      const entry = map.get(i.date) ?? { date: i.date, deliveries: 0, invoices: 0 }
      entry.invoices = i.count
      map.set(i.date, entry)
    }
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({ date: e.date, deliveries: e.deliveries, invoices: e.invoices }))
  })()

  const donutData = stampBreakdown.map((s) => ({
    name: STAMP_STATUS_LABELS[s.status] ?? `Status ${s.status}`,
    value: s.count,
    color: STAMP_STATUS_COLORS[s.status] ?? "#94a3b8"
  }))

  const totalStampValue = stampBreakdown.reduce((acc, s) => acc + s.value, 0)

  const heatmapMax = Math.max(1, ...deliveryMap.map((b) => b.total))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-brand-blue/5 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-brand-blue dark:text-slate-100 tracking-tight">Dashboard</h1>
          <p className="text-sm text-brand-blue dark:text-slate-100/60 dark:text-slate-300">Real-time logistics matrix and automation tracking</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-3 py-1 rounded-full w-fit">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          ERP Connectivity Link Active
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="p-12 text-center text-brand-blue dark:text-slate-100/50 dark:text-slate-400">Querying database engine records...</CardContent></Card>
      ) : error ? (
        <Card><CardContent className="p-12 text-center text-brand-red/60">{error}</CardContent></Card>
      ) : (
        <>
          {/* KPI grid — 8 cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard title="Total Deliveries" value={stats?.totalDeliveries ?? 0} subtitle={`${stats?.receivedDeliveries ?? 0} received · ${stats?.pendingDeliveries ?? 0} pending`} icon="📦" />
            <MetricCard title="Uninvoiced Deliveries" value={stats?.pendingInvoice ?? 0} subtitle="Received, awaiting billing sync" isAlert={(stats?.pendingInvoice ?? 0) > 0} icon="🧾" />
            <MetricCard title="Pending e-Meterai Stamps" value={stats?.pendingStamps ?? 0} subtitle={`${stats?.stamped ?? 0} stamped · ${stats?.failedStamps ?? 0} failed`} isAlert={(stats?.pendingStamps ?? 0) > 0} icon="🏷️" />
            <MetricCard title="Stamp Quota" value={stampQuotaError ? "—" : stampQuota ? stampQuota.saldo : "…"} subtitle={stampQuotaError ? "Unavailable — retrying" : stampQuota ? `${stampQuota.saldo - (stats?.pendingStamps ?? 0)} after pending` : "Loading..."} isAlert={stampQuota !== null && stampQuota.saldo <= (stats?.pendingStamps ?? 0)} icon="🏷️" />
            <MetricCard title="Failed Stamps" value={stats?.failedStamps ?? 0} subtitle="Require attention" isAlert={(stats?.failedStamps ?? 0) > 0} icon="⚠️" />
            <MetricCard title="Invoice Value (Stamped)" value={formatIDR(stats?.invoiceValueStamped ?? 0)} subtitle={`of ${formatIDR(stats?.invoiceValueTotal ?? 0)} total`} icon="💰" />
            <MetricCard title="Rejection Rate" value={`${stats?.rejectionRate ?? 0}%`} subtitle="of delivered quantity" isAlert={(stats?.rejectionRate ?? 0) > 5} icon="📉" />
            <MetricCard title="Active Customers" value={stats?.activeCustomers ?? 0} subtitle="distinct customers" icon="🏢" />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Delivery + Invoice trend */}
            <div className="lg:col-span-2 space-y-3">
              <h2 className="text-sm font-semibold text-brand-blue dark:text-slate-100/70 dark:text-slate-400 uppercase tracking-wider">Delivery & Invoice Trends</h2>
              <Card className="shadow-none">
                <CardContent className="p-6 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mergedChartData} margin={{ top: 10, right: 5, left: -35, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorDeliveries" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--chart-ink)" stopOpacity={0.12}/>
                          <stop offset="95%" stopColor="var(--chart-ink)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorInvoices" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.12}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="var(--chart-ink)" opacity={0.2} style={{ fontSize: '10px', fontFamily: 'monospace' }} dy={8} />
                      <YAxis stroke="var(--chart-ink)" opacity={0.2} style={{ fontSize: '10px', fontFamily: 'monospace' }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--chart-tooltip-bg)',
                          border: '1px solid var(--chart-tooltip-border)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: 'var(--chart-tooltip-color)'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Area type="monotone" dataKey="deliveries" name="Deliveries" stroke="var(--chart-ink)" strokeWidth={2} fillOpacity={1} fill="url(#colorDeliveries)" />
                      <Area type="monotone" dataKey="invoices" name="Invoices" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorInvoices)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Stamping status donut */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-brand-blue dark:text-slate-100/70 dark:text-slate-400 uppercase tracking-wider">Stamping Status</h2>
              <Card className="shadow-none">
                <CardContent className="p-6 h-72 flex flex-col">
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius="55%"
                          outerRadius="80%"
                          paddingAngle={2}
                          stroke="none"
                        >
                          {donutData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: 'var(--chart-tooltip-bg)',
                            border: '1px solid var(--chart-tooltip-border)',
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: 'var(--chart-tooltip-color)'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2">
                    {donutData.map((d) => (
                      <div key={d.name} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1.5 text-brand-blue dark:text-slate-100/70 dark:text-slate-400">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                          {d.name}
                        </span>
                        <span className="font-semibold text-brand-blue dark:text-slate-100">{d.value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-brand-blue dark:text-slate-100/40 dark:text-slate-400 mt-2">
                    {formatIDR(totalStampValue)} total invoice value
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Delivery heatmap by destination */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-brand-blue dark:text-slate-100/70 dark:text-slate-400 uppercase tracking-wider">
                Delivery Heatmap by Destination
              </h2>
              <span className="text-[11px] text-brand-blue dark:text-slate-100/40 dark:text-slate-400">
                volume · received vs pending
              </span>
            </div>
            <Card className="shadow-none">
              <CardContent className="p-6">
                {deliveryMap.length === 0 ? (
                  <p className="text-sm text-brand-blue dark:text-slate-100/40 dark:text-slate-400 text-center py-6">
                    No delivery location data yet.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                      {deliveryMap.slice(0, 12).map((bucket) => {
                        const intensity = heatmapMax > 0 ? bucket.total / heatmapMax : 0
                        const bg = bucket.city === "Unknown"
                          ? "bg-slate-100 dark:bg-slate-800/60"
                          : `rgba(37, 99, 235, ${0.06 + intensity * 0.85})`
                        return (
                          <div
                            key={bucket.city}
                            className="rounded-lg border border-brand-blue/10 dark:border-slate-700 p-3 transition-transform hover:-translate-y-0.5"
                            style={{ background: bg }}
                            title={`${bucket.city}: ${bucket.total} deliveries (${bucket.received} received)`}
                          >
                            <p className="text-xs font-semibold text-brand-blue dark:text-slate-200 truncate">
                              {bucket.city}
                            </p>
                            <p className="text-2xl font-bold text-brand-blue dark:text-slate-100 mt-1">
                              {bucket.total}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-[11px]">
                              <span className="text-emerald-700 dark:text-emerald-400">✓ {bucket.received}</span>
                              <span className="text-slate-500 dark:text-slate-400">· {bucket.total - bucket.received} pending</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {/* Legend */}
                    <div className="flex items-center gap-2 mt-4 text-[11px] text-brand-blue dark:text-slate-100/50 dark:text-slate-400">
                      <span>Low</span>
                      <div className="flex-1 max-w-[200px] h-2 rounded-full" style={{ background: "linear-gradient(to right, rgba(37,99,235,0.08), rgba(37,99,235,0.9))" }} />
                      <span>High</span>
                      <span className="ml-auto flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-slate-200 dark:bg-slate-700 inline-block" /> Unknown location
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent activity */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-brand-blue dark:text-slate-100/70 dark:text-slate-400 uppercase tracking-wider">Recent Activity</h2>
            <Card className="shadow-none overflow-hidden">
              <CardContent className="p-0 max-h-64 overflow-y-auto">
                {logs.length > 0 ? (
                  <div className="divide-y divide-brand-blue/5">
                    {logs.map((log) => (
                      <div key={log.logID} className="flex items-center justify-between p-4 hover:bg-brand-blue/1 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-1.5 h-1.5 rounded-full ${getSeverityColor(log.severity)} shrink-0`} />
                          <div>
                            <p className="text-sm font-semibold text-brand-blue dark:text-slate-100">
                              {resolveLogTitle(log)}
                            </p>
                            <p className="text-xs text-brand-blue dark:text-slate-100/60 dark:text-slate-300 mt-0.5">{log.message}</p>
                          </div>
                        </div>
                        <span className="text-xs text-brand-blue dark:text-slate-100/40 dark:text-slate-400 font-mono pl-2 whitespace-nowrap">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-8 text-center text-sm text-brand-blue dark:text-slate-100/40 dark:text-slate-400">No records found on recent communication logs.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function MetricCard({ title, value, subtitle, isAlert, icon }: { title: string, value: string | number, subtitle: string, isAlert?: boolean, icon?: string }) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-brand-blue dark:text-slate-100/50 dark:text-slate-400 uppercase tracking-wider">{title}</p>
          {icon && <span className="text-base opacity-60">{icon}</span>}
        </div>
        <p className={`text-2xl font-bold tracking-tight mt-1 ${isAlert ? 'text-brand-red' : 'text-brand-blue dark:text-slate-100'}`}>{value}</p>
        <p className="text-xs text-brand-blue dark:text-slate-100/40 dark:text-slate-400 mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  )
}
