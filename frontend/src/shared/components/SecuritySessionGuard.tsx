import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"

const TOKEN_KEY = "auth_token"
const POLLING_INTERVAL = 60000 // 60 seconds

interface AuthResponseDto {
  token: string
  email: string
  fullName: string
}

/**
 * SecuritySessionGuard - Periodically polls /api/account/me to check for token updates
 * - Updates stored token if a new one is received
 * - Redirects to login on 401 Unauthorized
 * - Ensures security stamp changes are reflected within 60 seconds
 */
export function SecuritySessionGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem(TOKEN_KEY)
      if (!token) {
        return
      }

      try {
        const API_URL = import.meta.env.VITE_API_URL
        const response = await fetch(`${API_URL}/api/account/me`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.status === 401) {
          // Security stamp changed - session revoked
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem("auth_user")
          logout()
          navigate("/login")
          return
        }

        if (response.ok) {
          const data: AuthResponseDto = await response.json()
          // Update token if a new one was issued
          if (data.token && data.token !== token) {
            localStorage.setItem(TOKEN_KEY, data.token)
          }
        }
      } catch (error) {
        // Silently fail on network errors - will retry on next interval
        console.error("Session check failed:", error)
      }
    }

    // Initial check on mount
    checkSession()

    // Set up polling interval
    pollingRef.current = setInterval(checkSession, POLLING_INTERVAL)

    // Cleanup on unmount
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [navigate, logout])

  return <>{children}</>
}
