import { useState, useEffect, useCallback, type ReactNode } from "react"
import { Card, CardContent } from "../../shared/components/ui/Card"
import { Button } from "../../shared/components/ui/Button"
import { Badge } from "../../shared/components/ui/Badge"
import {
  getBackgroundJobs,
  updateBackgroundJob,
  runBackgroundJobNow,
  getBackgroundJobLogs,
  type BackgroundJob,
  type BackgroundJobExecutionLog,
} from "../../shared/utils/api"

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleString()
}


function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message || fallback
  return fallback
}

function statusBadge(status: string | null): ReactNode {
  switch (status) {
    case "Success":
      return <Badge className="bg-green-100 text-green-800">Success</Badge>
    case "Skipped":
      return <Badge className="bg-yellow-100 text-yellow-800">Skipped</Badge>
    case "Failed":
      return <Badge className="bg-red-100 text-red-800">Failed</Badge>
    case "Running":
      return <Badge className="bg-blue-100 text-blue-800">Running</Badge>
    default:
      return <Badge className="bg-gray-100 text-gray-600">Never run</Badge>
  }
}

export function BackgroundJobsPage() {
  const [jobs, setJobs] = useState<BackgroundJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  // Logs drawer state
  const [logsJob, setLogsJob] = useState<BackgroundJob | null>(null)
  const [logs, setLogs] = useState<BackgroundJobExecutionLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const data = await getBackgroundJobs()
      setJobs(data)
      setError(null)
    } catch (e) {
      setError(errorMessage(e, "Failed to load background jobs"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(refresh, 0)
    const timer = setInterval(refresh, 15000)
    return () => {
      clearTimeout(t)
      clearInterval(timer)
    }
  }, [refresh])

  const handleToggle = async (job: BackgroundJob, enabled: boolean) => {
    setBusyKey(job.jobKey)
    try {
      await updateBackgroundJob(job.jobKey, { isEnabled: enabled })
      await refresh()
    } catch (e) {
      setError(errorMessage(e, "Failed to update job"))
    } finally {
      setBusyKey(null)
    }
  }

  const handleInterval = async (job: BackgroundJob, minutes: number) => {
    if (!minutes || minutes < 1 || minutes > 10080) {
      setError("Interval must be between 1 and 10080 minutes")
      return
    }
    setBusyKey(job.jobKey)
    try {
      await updateBackgroundJob(job.jobKey, { intervalMinutes: minutes })
      await refresh()
    } catch (e) {
      setError(errorMessage(e, "Failed to update interval"))
    } finally {
      setBusyKey(null)
    }
  }

  const handleRunNow = async (job: BackgroundJob) => {
    setBusyKey(job.jobKey)
    try {
      const result = await runBackgroundJobNow(job.jobKey)
      setError(null)
      // The run lands on the next cycle; refresh shortly to show it
      setTimeout(refresh, 4000)
      return result
    } catch (e) {
      setError(errorMessage(e, "Failed to trigger run"))
    } finally {
      setBusyKey(null)
    }
  }

  const openLogs = async (job: BackgroundJob) => {
    setLogsJob(job)
    setLogsLoading(true)
    setLogs([])
    try {
      const data = await getBackgroundJobLogs(job.jobKey)
      setLogs(data)
    } catch (e) {
      setError(errorMessage(e, "Failed to fetch logs"))
    } finally {
      setLogsLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Background Jobs</h1>
          <p className="text-sm text-gray-500">
            Manage scheduled background jobs: enable/disable, change intervals, trigger runs, and inspect execution history.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 py-12 text-center">Loading jobs...</div>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <Card key={job.jobKey}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{job.displayName}</h3>
                      {statusBadge(job.lastExecutionStatus)}
                      {job.isRunning && (
                        <Badge className="bg-blue-100 text-blue-800 animate-pulse">Running now</Badge>
                      )}
                    </div>
                    {job.description && (
                      <p className="text-sm text-gray-500 mt-1">{job.description}</p>
                    )}
                    <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-gray-600">
                      <span>
                        <span className="font-medium">Interval:</span> {job.intervalMinutes} min
                      </span>
                      <span>
                        <span className="font-medium">Last run:</span> {formatDateTime(job.lastExecutedAt)}
                      </span>
                      {job.lastExecutionError && (
                        <span className="text-red-600 text-xs break-all">
                          <span className="font-medium">Error:</span> {job.lastExecutionError}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {/* Enable/disable toggle */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {job.isEnabled ? "Enabled" : "Disabled"}
                      </span>
                      <button
                        role="switch"
                        aria-checked={job.isEnabled}
                        disabled={busyKey === job.jobKey}
                        onClick={() => handleToggle(job, !job.isEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          job.isEnabled ? "bg-green-500" : "bg-gray-300"
                        } ${busyKey === job.jobKey ? "opacity-50" : ""}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform dark:bg-slate-200 ${
                            job.isEnabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Interval editor */}
                      <IntervalEditor
                        value={job.intervalMinutes}
                        disabled={busyKey === job.jobKey}
                        onChange={(minutes) => handleInterval(job, minutes)}
                      />
                      {/* Run now */}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyKey === job.jobKey}
                        onClick={() => handleRunNow(job)}
                      >
                        Run now
                      </Button>
                      {/* Logs */}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={logsLoading}
                        onClick={() => openLogs(job)}
                      >
                        Logs
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Logs drawer */}
      {logsJob && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="h-full w-full max-w-2xl bg-white shadow-xl flex flex-col dark:bg-slate-900 dark:border dark:border-slate-800">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">{logsJob.displayName} — Execution Logs</h2>
                <p className="text-xs text-gray-500">
                  Job key: <code>{logsJob.jobKey}</code> · newest first
                </p>
              </div>
              <Button variant="ghost" onClick={() => setLogsJob(null)}>✕</Button>
            </div>

            <div className="flex-1 overflow-auto p-5 space-y-3">
              {logsLoading ? (
                <div className="text-gray-500 text-center py-10">Loading logs...</div>
              ) : logs.length === 0 ? (
                <div className="text-gray-500 text-center py-10">
                  No execution history yet. Runs will appear here once the job executes.
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-md border border-gray-200 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      {statusBadge(log.status)}
                      <span className="text-xs text-gray-500">
                        {formatDateTime(log.startedAt)}
                      </span>
                      {log.durationMs != null && (
                        <span className="text-xs text-gray-500">
                          {(log.durationMs / 1000).toFixed(2)}s
                        </span>
                      )}
                      {log.finishedAt && (
                        <span className="text-xs text-gray-400 ml-auto">
                          finished {formatDateTime(log.finishedAt)}
                        </span>
                      )}
                    </div>
                    {log.details && <p className="mt-1 text-gray-700">{log.details}</p>}
                    {log.errorMessage && (
                      <p className="mt-1 text-red-600 text-xs break-all">{log.errorMessage}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function IntervalEditor({
  value,
  disabled,
  onChange,
}: {
  value: number
  disabled?: boolean
  onChange: (minutes: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const current = draft ?? String(value)

  const commit = () => {
    const parsed = parseInt(current, 10)
    if (!isNaN(parsed) && parsed >= 1) {
      onChange(parsed)
    }
    setEditing(false)
    setDraft(null)
  }

  if (!editing) {
    return (
      <button
        title="Change interval (minutes)"
        disabled={disabled}
        onClick={() => setEditing(true)}
        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {value} min
      </button>
    )
  }

  return (
    <span className="flex items-center gap-1">
      <input
        type="number"
        min={1}
        value={current}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") {
            setEditing(false)
            setDraft(null)
          }
        }}
        onBlur={commit}
        autoFocus
        className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
      />
      <span className="text-xs text-gray-500">min</span>
    </span>
  )
}
