import { useMemo } from "react"

// import { useAuth } from "../contexts/AuthContext"

const API_URL = import.meta.env.VITE_API_URL

/**
 * Creates a fetch function that automatically includes a JWT token
 * in the Authorization header
 */
export function createAuthenticatedFetch() {
  const token = localStorage.getItem("auth_token")

  return async (url: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    const response = await fetch(`${API_URL}${url}`, {
      ...options,
      headers,
    })
    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      localStorage.removeItem("auth_token")
      localStorage.removeItem("auth_user")
      window.location.href = "/login"
    }
    return response
  }
}

/**
 * Simple authenticated GET request
 */
export async function authGet(url: string) {
  return createAuthenticatedFetch()(url, { method: "GET" })
}

/**
 * Simple authenticated POST request
 */
export async function authPost(url: string, body?: any) {
  return createAuthenticatedFetch()(url, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * Simple authenticated PATCH request
 */
export async function authPatch(url: string, body?: any) {
  return createAuthenticatedFetch()(url, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * Simple authenticated DELETE request
 */
export async function authDelete(url: string) {
  return createAuthenticatedFetch()(url, { method: "DELETE" })
}

/**
 * Hook to get the authenticated fetch function
 * Returns a stable object to prevent infinite re-renders
 */
export function useApi() {
  // Use useMemo to return the same object reference on every render
  return useMemo(() => ({
    get: authGet,
    post: authPost,
    patch: authPatch,
    delete: authDelete,
  }), [])
}

// =========================
// Dashboard API Functions
// =========================

export interface DashboardStats {
  totalDeliveries: number
  pendingDeliveries: number
  receivedDeliveries: number
  pendingInvoice: number
  sapDiscrepancies: number
  rejectionRate: number
  totalInvoices: number
  pendingStamps: number
  stamped: number
  failedStamps: number
  invoiceValueTotal: number
  invoiceValueStamped: number
  activeCustomers: number
}

export interface ChartDataPoint {
  date: string
  count: number
}

export interface DashboardCharts {
  deliveries: ChartDataPoint[]
  invoices: ChartDataPoint[]
}

export type StampStatus = 1 | 2 | 3 | 4

export interface StampBreakdown {
  status: StampStatus
  count: number
  value: number
}

export interface DeliveryMapBucket {
  city: string
  total: number
  received: number
}

/**
 * GET /api/dashboard/stats
 * Returns aggregated KPI data for dashboard
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await authGet("/api/dashboard/stats")
  if (!response.ok) throw new Error("Failed to fetch dashboard stats")
  return await response.json()
}

/**
 * GET /api/dashboard/charts
 * Returns deliveries + invoices grouped by date for last 30 days
 */
export async function getDashboardCharts(): Promise<DashboardCharts> {
  const response = await authGet("/api/dashboard/charts")
  if (!response.ok) throw new Error("Failed to fetch dashboard charts")
  return await response.json()
}

/**
 * GET /api/dashboard/stamp-breakdown
 * Returns invoice count + value grouped by stamping status
 */
export async function getStampBreakdown(): Promise<StampBreakdown[]> {
  const response = await authGet("/api/dashboard/stamp-breakdown")
  if (!response.ok) throw new Error("Failed to fetch stamp breakdown")
  return await response.json()
}

/**
 * GET /api/dashboard/logs
 * Returns latest activity log entries
 */
export async function getDashboardLogs(count: number = 20) {
  const response = await authGet(`/api/dashboard/logs?count=${count}`)
  if (!response.ok) throw new Error("Failed to fetch dashboard logs")
  return await response.json()
}

/**
 * GET /api/dashboard/delivery-map
 * Returns delivery volume grouped by destination city/regency for the heatmap
 */
export async function getDeliveryMap(): Promise<DeliveryMapBucket[]> {
  const response = await authGet("/api/dashboard/delivery-map")
  if (!response.ok) throw new Error("Failed to fetch delivery map")
  return await response.json()
}

// =========================
// Invoice API Functions
// =========================

export interface Invoice {
  invoiceID: number
  invoiceNumber: string
  customerNumber: string
  customerName?: string
  customerEmail?: string
  // Legacy single amount field - kept for backward compatibility
  invoiceAmount: number
  // New dual-currency fields (nett amounts = Base - DownPay)
    amountForeign: number
  amountLocal: number
  baseAmountForeign: number
  baseAmountLocal: number
  downPayAmountForeign: number
  downPayAmountLocal: number
  currency: string
  complianceCategory?: string // "BC", "NonBC", or "OTHER"
  invoicedDate: string
  status: number
  statusText: string
  deliveryHeaderId?: number
  deliveryNumber?: string
  serialNumber?: string
  stampingStatus: number
  stampingStatusText: string
  hasPrintoutDocument: boolean
  unstampedDocumentUrl?: string
  stampedDocumentUrl?: string
  deliveryPrintoutUrl?: string
  createdAt: string
}

/**
 * GET /api/invoices
 * Returns all invoices
 */
export async function getInvoices(): Promise<Invoice[]> {
  const response = await authGet("/api/invoices")
  if (!response.ok) throw new Error("Failed to fetch invoices")
  return await response.json()
}

export interface StampQuota {
  saldo: number
  notstamp: number
  status: string
  message: string
}

/**
 * GET /api/invoices/stamp-quota
 * Returns remaining e-Meterai stamp quota from Peruri (backend-cached 30s)
 */
export async function getStampQuota(): Promise<StampQuota> {
  const response = await authGet("/api/invoices/stamp-quota")
  if (!response.ok) throw new Error("Failed to fetch stamp quota")
  return await response.json()
}

/**
 * GET /api/invoices/{id}
 * Returns a specific invoice
 */
export async function getInvoiceById(id: number): Promise<Invoice> {
  const response = await authGet(`/api/invoices/${id}`)
  if (!response.ok) throw new Error("Failed to fetch invoice")
  return await response.json()
}

/**
 * POST /api/invoices
 * Creates a new invoice
 */
export async function createInvoice(data: {
  invoiceNumber: string
  customerNumber: string
  invoiceAmount: number
  invoicedDate: string
  deliveryHeaderId?: number
}): Promise<Invoice> {
  const response = await authPost("/api/invoices", data)
  if (!response.ok) throw new Error("Failed to create invoice")
  return await response.json()
}

/**
 * POST /api/invoices/{id}/upload-printout
 * Uploads an invoice printout document
 */
export async function uploadInvoicePrintout(
  id: number,
  file: File
): Promise<{ documentId: number; fileName: string; storageKey: string; downloadUrl: string }> {
  const token = localStorage.getItem("auth_token")
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/${id}/upload-printout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  if (!response.ok) throw new Error("Failed to upload printout")
  return await response.json()
}

/**
 * POST /api/invoices/{id}/stamp
 * Triggers e-Meterai stamping for an invoice
 */
export async function stampInvoice(id: number): Promise<{
  invoiceId: number
  invoiceNumber: string
  serialNumber: string
  status: string
  stampedDocumentUrl: string
}> {
  const response = await authPost(`/api/invoices/${id}/stamp`)
  if (!response.ok) throw new Error("Failed to stamp invoice")
  return await response.json()
}

/**
 * POST /api/deliveries/{id}/upload-printout
 * Uploads a delivery printout document
 */
export async function uploadDeliveryPrintout(
  id: number,
  file: File
): Promise<{ documentId: number; fileName: string; storageKey: string; downloadUrl: string }> {
  const token = localStorage.getItem("auth_token")
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/deliveries/${id}/upload-printout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  if (!response.ok) throw new Error("Failed to upload printout")
  return await response.json()
}

// =========================
// Background Jobs API Functions
// =========================

export interface BackgroundJob {
  id: number
  jobKey: string
  displayName: string
  description: string | null
  intervalMinutes: number
  isEnabled: boolean
  lastExecutedAt: string | null
  lastExecutionStatus: string | null
  lastExecutionError: string | null
  isRunning: boolean
  currentRunStartedAt: string | null
}

export interface BackgroundJobExecutionLog {
  id: number
  startedAt: string
  finishedAt: string | null
  status: string
  durationMs: number | null
  details: string | null
  errorMessage: string | null
}

// =========================
// Document Hub API (v2)
// =========================

export type DocumentHubItemType = "delivery-with-invoice" | "delivery-only" | "standalone-invoice"

export interface DocumentHubItem {
  type: DocumentHubItemType
  id: number
  keyNumber: string
  deliveryNumber: string | null
  invoiceNumber: string | null
  customerCode: string
  customerName: string
  customerEmail: string | null
  invoicedDate: string | null
  deliveryDate: string | null
  isReceived: boolean | null
  isInvoiceStamped: boolean
  invoiceStampingStatusText: string | null
  isReadyToSend: boolean
  emailCount: number
  lastSentAt: string | null
  deliveryPrintoutUrl: string | null
  invoicePrintoutUrl: string | null
}

export interface DocumentHubGroup {
  customerCode: string
  customerName: string
  customerEmail: string | null
  items: DocumentHubItem[]
}

/**
 * GET /api/deliveries/documents-hub
 * Returns all billable documents grouped by customer for the Document Hub.
 */
export async function getDocumentsHub(): Promise<DocumentHubGroup[]> {
  const response = await authGet("/api/deliveries/documents-hub")
  if (!response.ok) throw new Error("Failed to fetch document hub")
  return await response.json()
}

/**
 * GET /api/background-jobs
 */
export async function getBackgroundJobs(): Promise<BackgroundJob[]> {
  const response = await authGet("/api/background-jobs")
  if (!response.ok) throw new Error("Failed to fetch background jobs")
  return await response.json()
}

/**
 * PATCH /api/background-jobs/{key}
 */
export async function updateBackgroundJob(
  jobKey: string,
  changes: { isEnabled?: boolean; intervalMinutes?: number }
): Promise<BackgroundJob> {
  const response = await authPatch(`/api/background-jobs/${jobKey}`, changes)
  if (!response.ok) throw new Error("Failed to update background job")
  return await response.json()
}

/**
 * POST /api/background-jobs/{key}/run-now
 */
export async function runBackgroundJobNow(jobKey: string): Promise<{ message: string; jobKey: string }> {
  const response = await authPost(`/api/background-jobs/${jobKey}/run-now`)
  if (!response.ok) throw new Error("Failed to trigger background job run")
  return await response.json()
}

/**
 * GET /api/background-jobs/{key}/logs
 */
export async function getBackgroundJobLogs(jobKey: string, page = 1, pageSize = 50): Promise<BackgroundJobExecutionLog[]> {
  const response = await authGet(`/api/background-jobs/${jobKey}/logs?page=${page}&pageSize=${pageSize}`)
  if (!response.ok) throw new Error("Failed to fetch background job logs")
  return await response.json()
}
