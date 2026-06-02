import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { resolveDefaultLandingRoute } from "../../shared/utils/routeResolver"
import { useAuth } from "../../shared/contexts/AuthContext"

/**
 * Dashboard Redirect Page
 * Handles root route (/) redirection based on user permissions
 *
 * This component:
 * 1. Checks if user is authenticated
 * 2. Resolves the appropriate landing route based on their menu claims
 * 3. Redirects to the determined route
 *
 * This prevents the routing deadlock where non-sysadmin users
 * would get stuck on unauthorized screens when navigating to root.
 */
export function DashboardRedirectPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) {
      // Not authenticated - redirect to login
      navigate("/login", { replace: true })
      return
    }

    // Authenticated - resolve and redirect to appropriate landing page
    const landingRoute = resolveDefaultLandingRoute()
    navigate(landingRoute, { replace: true })
  }, [navigate, isAuthenticated])

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-brand-blue/[0.02] flex items-center justify-center">
      <div className="text-center">
        <svg className="animate-spin h-8 w-8 text-brand-blue mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="mt-4 text-sm text-brand-blue/60">Redirecting...</p>
      </div>
    </div>
  )
}
