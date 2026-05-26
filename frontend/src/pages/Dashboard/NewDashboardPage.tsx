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
  pendingStamps?: number
  sapDiscrepancies?: number
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
        return "bg-emerald-500"
      case "Warning":
        return "bg-brand-red"
      case "Info":
      default:
        return "bg-brand-blue/60"
    }
  }

  // Helper mapping function to resolve and clear unformatted log lines
  const resolveLogTitle = (log: ActivityLog) => {
    // If we have a true explicit domain type, handle it first
    if (log.eventType === "CustomerSync" || log.message.toLowerCase().includes("customer sync")) {
      return "ERP Customer Sync"
    }
    
    // If reference ID is corrupted or contains a blank fallback character, strip it cleanly
    if (!log.referenceID || log.referenceID.trim() === "-") {
      return "System Update"
    }

    return log.referenceID
  }

  return (
    <div className="space-y-6">
      {/* Premium Dashboard Header layout with live infrastructure status indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-brand-blue/5 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-brand-blue tracking-tight">Dashboard</h1>
          <p className="text-sm text-brand-blue/60">Real-time logistics matrix and automation tracking</p>
        </div>
        
        {/* Connection pipeline node visualization badge */}
        <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-700 bg-emerald-500/5 border border-emerald-500/10 px-3 py-1 rounded-full w-fit">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          ERP Connectivity Link Active
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="p-12 text-center text-brand-blue/50">Querying database engine records...</CardContent></Card>
      ) : error ? (
        <Card><CardContent className="p-12 text-center text-brand-red/60">{error}</CardContent></Card>
      ) : (
        <>
          {/* Main KPI metric grids */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <MetricCard title="Uninvoiced Deliveries" value={stats?.pendingInvoice ?? 0} subtitle="Awaiting billing sync" />
            <MetricCard title="Pending e-Meterai Stamps" value={stats?.pendingStamps ?? 0} subtitle="Awaiting digital stamping" isAlert={(stats?.pendingStamps ?? 0) > 0} />
            <MetricCard title="SAP Ledger Discrepancies" value={stats?.sapDiscrepancies ?? 0} subtitle="Sync variance detection" isAlert={(stats?.sapDiscrepancies ?? 0) > 0} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel: Delivery Chart Engine with subtle details */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-brand-blue/70 uppercase tracking-wider">Delivery Trends</h2>
              <Card className="shadow-none">
                <CardContent className="p-6 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartsData} margin={{ top: 10, right: 5, left: -35, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1d2351" stopOpacity={0.12}/>
                          <stop offset="95%" stopColor="#1d2351" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      {/* Clean minimalist styling helper ticks */}
                      <XAxis 
                        dataKey="date" 
                        stroke="#1d2351" 
                        opacity={0.2} 
                        style={{ fontSize: '10px', fontFamily: 'monospace' }} 
                        dy={8}
                      />
                      <YAxis 
                        stroke="#1d2351" 
                        opacity={0.2} 
                        style={{ fontSize: '10px', fontFamily: 'monospace' }} 
                      />
                      <Tooltip 
                        contentStyle={{ 
                          background: '#fff', 
                          border: '1px solid rgba(29,35,81,0.08)', 
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: '#1d2351'
                        }} 
                      />
                      <Area type="monotone" dataKey="count" stroke="#1d2351" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel: Clean Activity Feed Component without trailing hyphens */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-brand-blue/70 uppercase tracking-wider">Recent Activity</h2>
              <Card className="shadow-none overflow-hidden">
                <CardContent className="p-0 max-h-64 overflow-y-auto">
                  {logs.length > 0 ? (
                    <div className="divide-y divide-brand-blue/5">
                      {logs.map((log) => (
                        <div key={log.logID} className="flex items-center justify-between p-4 hover:bg-brand-blue/1 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-1.5 h-1.5 rounded-full ${getSeverityColor(log.severity)} shrink-0`} />
                            <div>
                              <p className="text-sm font-semibold text-brand-blue">
                                {resolveLogTitle(log)}
                              </p>
                              <p className="text-xs text-brand-blue/60 mt-0.5">{log.message}</p>
                            </div>
                          </div>
                          <span className="text-xs text-brand-blue/40 font-mono pl-2 whitespace-nowrap">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="p-8 text-center text-sm text-brand-blue/40">No records found on recent communication logs.</p>
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
    <Card className="shadow-none">
      <CardContent className="p-6">
        <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">{title}</p>
        <p className={`text-3xl font-bold tracking-tight mt-1.5 ${isAlert ? 'text-brand-red' : 'text-brand-blue'}`}>{value}</p>
        <p className="text-xs text-brand-blue/40 mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  )
}