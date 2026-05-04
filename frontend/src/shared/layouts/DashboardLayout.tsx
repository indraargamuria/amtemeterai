import { Link, useLocation } from "react-router-dom"
import { cn } from "../utils/cn"
import Logo from '../../assets/amtlogo.png';

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
      {/* Sidebar - Light Theme */}
      <aside className="w-64 bg-white min-h-screen flex flex-col border-r border-brand-blue/5">
        {/* Logo */}
        <div className="p-6">
          <Link to="/" className="block">
            <h1 className="text-lg font-bold text-brand-blue tracking-tight">
              {/* AmtemeterAI  */}
              <img src={Logo} alt="Logo"  className="w-24 h-auto" />
            </h1>
            {/* <p className="mt-1 text-xs text-brand-blue/50">
              e-Meterai Delivery Management
            </p> */}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3">
          <ul className="space-y-0.5">
            {menuItems.map((item) => {
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
              <span className="text-xs font-semibold text-brand-blue">A</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-brand-blue truncate">Admin User</p>
              <p className="text-xs text-brand-blue/50 truncate">
                admin@amtemeterai.com
              </p>
            </div>
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
