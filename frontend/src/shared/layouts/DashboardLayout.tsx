import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  FolderOpen,
  ShieldAlert,
  Settings,
  Sun,
  Moon,
  Ship,
  type LucideIcon,
} from "lucide-react"
import { cn } from "../utils/cn"
import Logo from '../../assets/amtlogo.png';
import { useAuth } from "../contexts/AuthContext"
import { useTheme } from "../hooks/useTheme"

interface DashboardLayoutProps {
  children: React.ReactNode
}

interface MenuItem {
  path: string
  label: string
  requiredPermission: string
  sysAdminOnly?: boolean
  icon: LucideIcon
}

const menuItems: MenuItem[] = [
  { path: "/", label: "Dashboard", requiredPermission: "dashboard:read", icon: LayoutDashboard },
  { path: "/customers", label: "Customers", requiredPermission: "customer:read", icon: Users },
  { path: "/shipping-parameters", label: "Shipping Parameters", requiredPermission: "customer:read", icon: Ship },
  { path: "/deliveries", label: "Deliveries", requiredPermission: "delivery:read", icon: Package },
  { path: "/invoices", label: "Invoices", requiredPermission: "invoice:read", icon: FileText },
  { path: "/documents", label: "Document Hub", requiredPermission: "invoice:read", icon: FolderOpen },
  { path: "/admin/uam", label: "User Management", requiredPermission: "uam:read", sysAdminOnly: true, icon: ShieldAlert },
  { path: "/background-jobs", label: "Background Jobs", requiredPermission: "job:read", icon: Settings },
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
  const permissions = payload["permission"] || []

  return {
    roles: Array.isArray(roles) ? roles : [roles],
    permissions: Array.isArray(permissions) ? permissions : [permissions],
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

  // Filter by permission requirements
  return items.filter((item) => {
    // Sysadmin-only items are hidden for non-sysadmin users
    if (item.sysAdminOnly) return false
    // Check if user has the required permission
    return claims.permissions.includes(item.requiredPermission)
  })
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const { theme, toggleTheme } = useTheme()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  // Close mobile sidebar on navigation
  React.useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // Get filtered menu items
  const visibleMenuItems = filterMenuItems(menuItems)

  // Get user initial for avatar
  const userInitial = user?.fullName
    ? user.fullName.charAt(0).toUpperCase()
    : user?.email.charAt(0).toUpperCase() || "A"

  const userName = user?.fullName || "Admin User"
  const userEmail = user?.email || "admin@amtemeterai.com"

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Mobile overlay - click to close sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-brand-blue/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Fixed to viewport (off-canvas on mobile, static on lg+) */}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 z-40 w-64 h-screen border-r border-brand-blue/5 bg-white dark:bg-slate-900 dark:border-slate-800 flex flex-col transition-transform duration-200 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="p-6">
          <Link to="/" className="block">
            <h1 className="text-lg font-bold text-brand-blue dark:text-slate-100 tracking-tight">
              <img src={Logo} alt="Logo" className="w-24 h-auto" />
            </h1>
          </Link>
        </div>

        {/* Navigation - Scrollable if needed */}
        <nav className="flex-1 overflow-y-auto px-3">
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
                        ? "bg-brand-blue/10 text-brand-blue border-l-2 border-brand-blue dark:bg-brand-blue/30 dark:text-slate-100 dark:border-brand-blue"
                        : "text-brand-blue/70 hover:bg-brand-blue/5 hover:text-brand-blue border-l-2 border-transparent dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    )}
                  >
                    <item.icon className="w-4 h-4 mr-3 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User section - Always visible at bottom */}
        <div className="p-4 border-t border-brand-blue/5 bg-white dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-brand-blue/10 flex items-center justify-center">
              <span className="text-xs font-semibold text-brand-blue dark:text-slate-100">{userInitial}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-brand-blue truncate dark:text-slate-200">{userName}</p>
              <p className="text-xs text-brand-blue/50 truncate dark:text-slate-400">{userEmail}</p>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md text-brand-blue/50 hover:bg-brand-blue/5 hover:text-brand-blue transition-colors dark:text-slate-400 dark:hover:bg-slate-800"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-md text-brand-blue/50 hover:bg-brand-blue/5 hover:text-brand-red transition-colors dark:text-slate-400 dark:hover:bg-slate-800"
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

      {/* Mobile top bar with menu toggle */}
      <div className="lg:hidden sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-white/95 backdrop-blur border-b border-brand-blue/5 dark:bg-slate-900/95 dark:border-slate-800">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-md text-brand-blue/70 hover:bg-brand-blue/5 hover:text-brand-blue transition-colors dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <img src={Logo} alt="Logo" className="w-16 h-auto" />
      </div>

      {/* Main Content - With left margin to account for fixed sidebar */}
      <main className="lg:ml-64 min-h-screen overflow-auto bg-brand-blue/[0.02] dark:bg-slate-950">
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
