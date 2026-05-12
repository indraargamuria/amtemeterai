// import { useAuth } from "../contexts/AuthContext"

const API_URL = import.meta.env.VITE_API_URL

/**
 * Creates a fetch function that automatically includes the JWT token
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
 */
export function useApi() {
  return {
    get: authGet,
    post: authPost,
    patch: authPatch,
    delete: authDelete,
    fetch: createAuthenticatedFetch(),
  }
}
