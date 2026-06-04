import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import { getUserClaims } from "../utils/routePermissions"

interface RootRouteGuardProps {
  children: React.ReactNode
}

/**
 * RootRouteGuard - Protects the root dashboard route (/)
 * Redirects users without dashboard:read permission to their first available route
 *
 * Priority for users without dashboard access:
 * 1. delivery:read -> /deliveries
 * 2. customer:read -> /customers
 * 3. invoice:read -> /invoices
 * 4. No permissions -> /unauthorized
 */
export function RootRouteGuard({ children }: RootRouteGuardProps) {
  const [shouldRedirect, setShouldRedirect] = useState<string | null>(null)

  useEffect(() => {
    const claims = getUserClaims()

    if (!claims) {
      // No token - let ProtectedRoute handle it
      setShouldRedirect(null)
      return
    }

    // Sysadmin always has dashboard access
    if (claims.roles.includes('sysadmin')) {
      setShouldRedirect(null)
      return
    }

    // Check if user has dashboard permission
    if (!claims.permissions.includes('dashboard:read')) {
      // User doesn't have dashboard access - redirect to first available route
      if (claims.permissions.includes('delivery:read')) {
        setShouldRedirect('/deliveries')
      } else if (claims.permissions.includes('customer:read')) {
        setShouldRedirect('/customers')
      } else if (claims.permissions.includes('invoice:read')) {
        setShouldRedirect('/invoices')
      } else {
        // No valid permissions - redirect to unauthorized
        setShouldRedirect('/unauthorized')
      }
    } else {
      // User has dashboard access - allow through
      setShouldRedirect(null)
    }
  }, [])

  if (shouldRedirect) {
    return <Navigate to={shouldRedirect} replace />
  }

  return <>{children}</>
}
