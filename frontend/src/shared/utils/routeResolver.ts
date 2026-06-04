/**
 * Dynamic Landing Route Resolver
 * Determines the appropriate landing route based on user's JWT claims
 */

import { getUserClaims } from './routePermissions'

export interface DecodedUserToken {
  roles: string[]
  menus: string[]
}

/**
 * Route priority list for determining landing page (when not using dashboard)
 * Ordered by preference - first match wins
 * Note: dashboard is not included here as it's the default route at '/'
 */
const routePriorityList: Array<{ accessCode: string; path: string }> = [
  { accessCode: 'customers', path: '/customers' },
  { accessCode: 'invoices', path: '/invoices' },
  { accessCode: 'deliveries', path: '/deliveries' },
]

/**
 * Evaluates user permissions and resolves the top available landing route
 *
 * Logic:
 * 1. Sysadmin users -> redirect to UAM admin
 * 2. Users with dashboard access -> stay on dashboard ('/')
 * 3. Other users -> first available route from priority list based on menu claims
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
  if (claims.menus.includes('dashboard')) {
    return '/'
  }

  // 3. Find the first route matching the user's active menu claims
  const targetRoute = routePriorityList.find((route) =>
    claims.menus.includes(route.accessCode)
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
