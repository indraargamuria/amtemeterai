import { Link, useLocation } from "react-router-dom"
import { cn } from "../utils/cn"

interface DashboardLayoutProps {
  children: React.ReactNode
}

const menuItems = [
  { path: "/", label: "Dashboard" },
  { path: "/customers", label: "Customers" },
  { path: "/deliveries", label: "Deliveries" },
]

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation()

  return (
    <div className="min-h-screen flex bg-white">
      {/* Sidebar */}
      <aside className="w-64 bg-brand-blue min-h-screen flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <Link to="/" className="block">
            <h1 className="text-xl font-bold text-white tracking-tight">
              AmtemeterAI
            </h1>
            <p className="mt-1 text-xs text-white/60">
              e-Meterai Delivery Management
            </p>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={cn(
                      "flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-brand-red text-white"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
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
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-sm font-semibold text-white">A</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Admin User</p>
              <p className="text-xs text-white/60">admin@amtemeterai.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
