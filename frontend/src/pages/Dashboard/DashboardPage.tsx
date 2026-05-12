import { useState, useEffect } from "react"
import { Card, CardContent } from "../../shared/components/ui/Card"
import { getDashboardStats, getDashboardCharts, getDashboardLogs } from "../../shared/utils/api"
import {
  AreaChart,
  Area,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer
} from "recharts"

// Types for API responses
interface DashboardStats {
  totalDeliveries: number
  pendingDeliveries: number
  pendingInvoice: number
  rejectionRate: number
}

interface ChartDataPoint {
  date: string
  count: number
}

interface ActivityLog {
  logID: number
  timestamp: string
  eventType: string
  referenceID: string
  message: string
  severity: string
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [chartsData, setChartsData] = useState<ChartDataPoint[]>([])
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        setError(null)

        const [statsRes, chartsRes] = await Promise.all([
          getDashboardStats(),
          getDashboardCharts()
        ])

        setStats(statsRes)
        setChartsData(chartsRes)
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
      case "Info":
        return "bg-brand-blue/70"
      case "Warning":
        return "bg-brand-red"
      default:
        return "bg-brand-blue/30"
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-brand-blue tracking-tight">Dashboard</h1>
        <p className="text-sm text-brand-blue/60">Real-time delivery metrics and activity tracking</p>
      </div>

      {loading ? (
        <Card><CardContent className="p-12 text-center text-brand-blue/50">Loading...</CardContent></Card>
      ) : error ? (
        <Card><CardContent className="p-12 text-center text-brand-red/60">{error}</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <MetricCard title="Total Deliveries" value={stats?.totalDeliveries ?? 0} subtitle="Active deliveries" />
            <MetricCard title="Pending Invoice" value={stats?.pendingInvoice ?? 0} subtitle="Unprocessed" />
            <MetricCard title="Rejection Rate" value={`${stats?.rejectionRate ?? 0}%`} subtitle="Efficiency metric" isAlert={stats?.rejectionRate! > 5} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-brand-blue tracking-tight">Delivery Trends</h2>
              <Card>
                <CardContent className="p-6 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartsData}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1d2351" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#1d2351" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Tooltip />
                      <Area type="monotone" dataKey="count" stroke="#1d2351" fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-brand-blue tracking-tight">Recent Activity</h2>
              <Card>
                <CardContent className="p-0 max-h-64 overflow-y-auto">
                  {logs.length > 0 ? (
                    <div className="divide-y divide-brand-blue/5">
                      {logs.map((log) => (
                        <div key={log.logID} className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${getSeverityColor(log.severity)}`} />
                            <div>
                              <p className="text-sm font-medium text-brand-blue">{log.referenceID || "System"}</p>
                              <p className="text-xs text-brand-blue/50">{log.message}</p>
                            </div>
                          </div>
                          <span className="text-xs text-brand-blue/30">{formatTimestamp(log.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="p-8 text-center text-sm text-brand-blue/40">No recent activity</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MetricCard({ title, value, subtitle, isAlert }: { title: string, value: string | number, subtitle: string, isAlert?: boolean }) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">{title}</p>
        <p className={`text-3xl font-bold tracking-tight mt-1 ${isAlert ? 'text-brand-red' : 'text-brand-blue'}`}>{value}</p>
        <p className="text-sm text-brand-blue/60 mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  )
}