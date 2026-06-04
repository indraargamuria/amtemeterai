/**
 * Route Permission Mapping
 * Maps client-side routes to their required permission keys
 */
export const routePermissions: Record<string, string> = {
  '/': 'dashboard:read',
  '/dashboard': 'dashboard:read',
  '/customers': 'customer:read',
  '/deliveries': 'delivery:read',
  '/invoices': 'invoice:read',
  '/admin/uam': 'uam:read',
}

/**
 * Routes that require sysadmin role
 */
export const sysAdminOnlyRoutes = new Set(['/admin/uam'])

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
 * Returns roles and permissions (granular permission keys)
 */
export function getUserClaims() {
  const token = localStorage.getItem('auth_token')
  if (!token) return null

  const payload = decodeJWT(token)
  const roles = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || []
  const permissions = payload['permission'] || []
  const menus = payload['menu'] || []

  return {
    roles: Array.isArray(roles) ? roles : [roles],
    permissions: Array.isArray(permissions) ? permissions : [permissions],
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

  // Check if this is a sysadmin-only route
  if (sysAdminOnlyRoutes.has(pathname)) {
    return claims.roles.includes('sysadmin')
  }

  // Check if route has a permission requirement
  const requiredPermission = routePermissions[pathname]
  if (!requiredPermission) {
    // No specific permission required - allow access
    return true
  }

  // Check if user has the required permission
  return claims.permissions.includes(requiredPermission)
}
