import { Link, useLocation, useNavigate } from "react-router-dom"
import { cn } from "../utils/cn"
import Logo from '../../assets/amtlogo.png';
import { useAuth } from "../contexts/AuthContext"

interface DashboardLayoutProps {
  children: React.ReactNode
}

interface MenuItem {
  path: string
  label: string
  accessCode?: string
}

const menuItems: MenuItem[] = [
  { path: "/", label: "Dashboard", accessCode: "dashboard" },
  { path: "/customers", label: "Customers", accessCode: "customers" },
  { path: "/deliveries", label: "Deliveries", accessCode: "deliveries" },
  // { path: "/invoices", label: "Invoices", accessCode: "invoices" },
  { path: "/admin/uam", label: "User Management", accessCode: "uam" },
]

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

// Helper to get user claims from JWT
function getUserClaims() {
  const token = localStorage.getItem("auth_token")
  if (!token) return null

  const payload = decodeJWT(token)
  const roles = payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || []
  const menus = payload["menu"] || []

  return {
    roles: Array.isArray(roles) ? roles : [roles],
    menus: Array.isArray(menus) ? menus : [menus],
  }
}

// Filter menu items based on user permissions
function filterMenuItems(items: MenuItem[]): MenuItem[] {
  const claims = getUserClaims()
  if (!claims) return []

  // Sysadmin bypass - show all menus
  if (claims.roles.includes("sysadmin")) {
    return items
  }

  // Filter by menu access codes
  return items.filter((item) => {
    // Items without accessCode are always shown
    if (!item.accessCode) return true
    // Check if user has this menu permission
    return claims.menus.includes(item.accessCode)
  })
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  // Get filtered menu items
  const visibleMenuItems = filterMenuItems(menuItems)

  // Get user initial for avatar
  const userInitial = user?.fullName
    ? user.fullName.charAt(0).toUpperCase()
    : user?.email.charAt(0).toUpperCase() || "A"

  const userName = user?.fullName || "Admin User"
  const userEmail = user?.email || "admin@amtemeterai.com"

  return (
    <div className="min-h-screen flex bg-white">
      {/* Sidebar - Light Theme */}
      <aside className="w-64 bg-white min-h-screen flex flex-col border-r border-brand-blue/5">
        {/* Logo */}
        <div className="p-6">
          <Link to="/" className="block">
            <h1 className="text-lg font-bold text-brand-blue tracking-tight">
              <img src={Logo} alt="Logo" className="w-24 h-auto" />
            </h1>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3">
          <ul className="space-y-0.5">
            {visibleMenuItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={cn(
                      "flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all",
                      isActive
                        ? "bg-brand-blue/10 text-brand-blue border-l-2 border-brand-blue"
                        : "text-brand-blue/70 hover:bg-brand-blue/5 hover:text-brand-blue border-l-2 border-transparent"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-brand-blue/5">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-brand-blue/10 flex items-center justify-center">
              <span className="text-xs font-semibold text-brand-blue">{userInitial}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-brand-blue truncate">{userName}</p>
              <p className="text-xs text-brand-blue/50 truncate">{userEmail}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-md text-brand-blue/50 hover:bg-brand-blue/5 hover:text-brand-red transition-colors"
              title="Sign out"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-brand-blue/[0.02]">
        <div className="p-8 max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
