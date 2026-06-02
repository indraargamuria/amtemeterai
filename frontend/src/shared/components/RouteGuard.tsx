import { useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { hasRouteAccess } from "../utils/routePermissions"

interface RouteGuardProps {
  children: React.ReactNode
}

/**
 * Routes that should bypass route guard validation
 */
const publicRoutes = ['/unauthorized', '/login']

/**
 * RouteGuard - Protects routes by checking user permissions
 * Intercepts route changes and validates menu claims before allowing access
 *
 * Excludes root paths from strict validation to allow the dynamic
 * redirect resolver to determine the appropriate landing page.
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const currentPath = location.pathname.replace(/\/$/, "") // Strip trailing slashes

  // Skip validation for public routes
  if (publicRoutes.includes(currentPath)) {
    return <>{children}</>
  }

  useEffect(() => {
    // Check if user has access to current route
    if (!hasRouteAccess(currentPath)) {
      // Redirect to unauthorized page
      navigate('/unauthorized', { replace: true })
    }
  }, [currentPath, navigate])

  // Check access on mount
  if (!hasRouteAccess(currentPath)) {
    return null // Will redirect in useEffect
  }

  return <>{children}</>
}
