import { useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { hasRouteAccess } from "../utils/routePermissions"

interface RouteGuardProps {
  children: React.ReactNode
}

/**
 * RouteGuard - Protects routes by checking user permissions
 * Intercepts route changes and validates menu claims before allowing access
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Check if user has access to current route
    if (!hasRouteAccess(location.pathname)) {
      // Redirect to unauthorized page
      navigate('/unauthorized', { replace: true })
    }
  }, [location.pathname, navigate])

  // Check access on mount
  if (!hasRouteAccess(location.pathname)) {
    return null // Will redirect in useEffect
  }

  return <>{children}</>
}
