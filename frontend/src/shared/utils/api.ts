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

/**
 * GET /api/dashboard/stats
 * Returns aggregated KPI data for dashboard
 */
export async function getDashboardStats() {
  const response = await authGet("/api/dashboard/stats")
  if (!response.ok) throw new Error("Failed to fetch dashboard stats")
  return await response.json()
}

/**
 * GET /api/dashboard/charts
 * Returns data grouped by date for last 30 days
 */
export async function getDashboardCharts() {
  const response = await authGet("/api/dashboard/charts")
  if (!response.ok) throw new Error("Failed to fetch dashboard charts")
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

// =========================
// Invoice API Functions
// =========================

export interface Invoice {
  invoiceID: number
  invoiceNumber: string
  customerNumber: string
  customerName?: string
  // Legacy single amount field - kept for backward compatibility
  invoiceAmount: number
  // New dual-currency fields
  amountForeign: number
  amountLocal: number
  currency: string
  complianceCategory?: string // "BC" or "NonBC"
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
