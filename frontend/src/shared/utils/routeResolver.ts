/**
 * Dynamic Landing Route Resolver
 * Determines the appropriate landing route based on user's JWT claims
 */

import { getUserClaims } from './routePermissions'

export interface DecodedUserToken {
  roles: string[]
  permissions: string[]
}

/**
 * Route priority list for determining landing page (when not using dashboard)
 * Ordered by preference - first match wins
 * Note: dashboard is not included here as it's the default route at '/'
 */
const routePriorityList: Array<{ permission: string; path: string }> = [
  { permission: 'customer:read', path: '/customers' },
  { permission: 'invoice:read', path: '/invoices' },
  { permission: 'delivery:read', path: '/deliveries' },
]

/**
 * Evaluates user permissions and resolves the top available landing route
 *
 * Logic:
 * 1. Sysadmin users -> redirect to UAM admin
 * 2. Users with dashboard permission -> stay on dashboard ('/')
 * 3. Other users -> first available route from priority list based on permissions
 * 4. No permissions -> unauthorized page
 */
export function resolveDefaultLandingRoute(): string {
  const claims = getUserClaims()

  if (!claims) {
    // No token found - should go to login
    return '/login'
  }

  // 1. System administrators always default to the UAM admin hub
  if (claims.roles.includes('sysadmin')) {
    return '/admin/uam'
  }

  // 2. If user has dashboard permission, use dashboard as landing
  if (claims.permissions.includes('dashboard:read')) {
    return '/'
  }

  // 3. Find the first route matching the user's active permissions
  const targetRoute = routePriorityList.find((route) =>
    claims.permissions.includes(route.permission)
  )

  // 4. Return the matched route or unauthorized if no permissions
  return targetRoute ? targetRoute.path : '/unauthorized'
}

/**
 * Check if the current path is the root dashboard path that needs redirecting
 */
export function isRootDashboardPath(pathname: string): boolean {
  const normalizedPath = pathname.replace(/\/$/, '') // Strip trailing slashes
  return normalizedPath === '' || normalizedPath === '/dashboard'
}
