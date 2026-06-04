import { createContext, useContext, useState, useEffect } from "react"
import type { ReactNode } from "react"

interface User {
  id: string
  email: string
  fullName?: string
  roles?: string[]
  permissions?: string[]
  plants?: string[]
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = "auth_token"
const USER_KEY = "auth_user"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session on mount
    const storedToken = localStorage.getItem(TOKEN_KEY)
    const storedUser = localStorage.getItem(USER_KEY)

    if (storedToken && storedUser) {
      try {
        setToken(storedToken)
        const parsedUser = JSON.parse(storedUser)

        // If stored user doesn't have claims, decode from token
        if (!parsedUser.roles || !parsedUser.permissions || !parsedUser.plants) {
          const payload = decodeJWT(storedToken)
          const roles = payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || []
          const permissions = payload["permission"] || []
          const plants = payload["plant"] || []

          parsedUser.roles = Array.isArray(roles) ? roles : [roles]
          parsedUser.permissions = Array.isArray(permissions) ? permissions : [permissions]
          parsedUser.plants = Array.isArray(plants) ? plants : [plants]

          // Update stored user with claims
          localStorage.setItem(USER_KEY, JSON.stringify(parsedUser))
        }

        setUser(parsedUser)
      } catch {
        // Invalid stored user, clear everything
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
      }
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const API_URL = import.meta.env.VITE_API_URL

    const response = await fetch(`${API_URL}/api/account/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Login failed")
    }

    const data = await response.json()

    // Decode JWT to get user claims
    const payload = decodeJWT(data.token)
    const roles = payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || []
    const permissions = payload["permission"] || []
    const plants = payload["plant"] || []

    const userData: User = {
      id: payload.nameid,
      email: data.email,
      fullName: data.fullName,
      roles: Array.isArray(roles) ? roles : [roles],
      permissions: Array.isArray(permissions) ? permissions : [permissions],
      plants: Array.isArray(plants) ? plants : [plants],
    }

    // Store in state and localStorage
    setToken(data.token)
    setUser(userData)
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(userData))
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  const value: AuthContextType = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!token && !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// Helper to decode JWT payload
function decodeJWT(token: string): any {
  try {
    const base64Url = token.split(".")[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
        .join("") 
    )
    return JSON.parse(jsonPayload)
  } catch {
    return {}
  }
}
