/**
 * Route Permission Mapping
 * Maps client-side routes to their required menu access codes
 */
export const routePermissions: Record<string, string> = {
  '/': 'dashboard',
  '/customers': 'customers',
  '/deliveries': 'deliveries',
  '/invoices': 'invoices',
  '/admin/uam': 'uam',
}

/**
 * Helper to decode JWT payload
 */
function decodeJWT(token: string): any {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${('00' + c.charCodeAt(0).toString(16)).slice(-2)}`)
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return {}
  }
}

/**
 * Get user claims from JWT
 */
export function getUserClaims() {
  const token = localStorage.getItem('auth_token')
  if (!token) return null

  const payload = decodeJWT(token)
  const roles = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || []
  const menus = payload['menu'] || []

  return {
    roles: Array.isArray(roles) ? roles : [roles],
    menus: Array.isArray(menus) ? menus : [menus],
  }
}

/**
 * Check if user has permission to access a route
 */
export function hasRouteAccess(pathname: string): boolean {
  const claims = getUserClaims()
  if (!claims) return false

  // Sysadmin bypass - full access
  if (claims.roles.includes('sysadmin')) {
    return true
  }

  // Check if route has an access code requirement
  const requiredAccess = routePermissions[pathname]
  if (!requiredAccess) {
    // No specific access code required - allow access
    return true
  }

  // Check if user has the required menu permission
  return claims.menus.includes(requiredAccess)
}
