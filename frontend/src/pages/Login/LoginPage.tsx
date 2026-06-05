import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Button } from "../../shared/components/ui/Button"
import { Input } from "../../shared/components/ui/Input"
import { Label } from "../../shared/components/ui/Label"
import Logo from '../../assets/amtlogo.png'
import Landscape from '../../assets/amtlandscape.jpg'
import { useAuth } from "../../shared/contexts/AuthContext"
import { resolveDefaultLandingRoute } from "../../shared/utils/routeResolver"
import { Mail, Lock, AlertCircle, ChevronRight, Eye, EyeOff } from "lucide-react"

export function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  // Get redirect path from location state, or use dynamic resolver
  const getRedirectPath = () => {
    const from = (location.state as any)?.from?.pathname
    if (from && from !== '/login' && from !== '/unauthorized') {
      return from
    }
    // Use dynamic resolver to determine appropriate landing page
    return resolveDefaultLandingRoute()
  }

  // Trigger mount animation
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email || !password) {
      setError("Please enter your email and password")
      return
    }

    setLoading(true)

    try {
      await login(email, password)
      // Navigate to the dynamically resolved landing route
      navigate(getRedirectPath(), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-16 bg-gradient-to-br from-slate-50 to-white">
        <div className="w-full max-w-md">
          {/* Logo with fade-in animation */}
          <div
            className={`mb-12 transition-all duration-700 ease-out ${
              isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
            }`}
            style={{ transitionDelay: '0ms' }}
          >
            <img src={Logo} alt="AMT e-Meterai" className="w-36 h-auto" />
          </div>

          {/* Welcome Text with staggered animation */}
          <div
            className={`mb-10 space-y-2 transition-all duration-700 ease-out ${
              isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
            }`}
            style={{ transitionDelay: '100ms' }}
          >
            <h2 className="text-3xl font-bold text-brand-blue tracking-tight">
              Welcome Back
            </h2>
            <p className="text-base text-slate-500">
              Sign in to access your integration dashboard
            </p>
          </div>

          {/* Error Message with slide-down animation */}
          {error && (
            <div
              className={`mb-6 overflow-hidden transition-all duration-500 ease-out ${
                error ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle className="w-3 h-3 text-red-600" />
                </div>
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Form with staggered animation */}
          <form
            onSubmit={handleSubmit}
            className={`space-y-6 transition-all duration-700 ease-out ${
              isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '200ms' }}
          >
            {/* Email Input with floating label effect */}
            <div className="space-y-2 group">
              <Label
                htmlFor="email"
                className="text-sm font-semibold text-slate-700 transition-colors group-focus-within:text-brand-blue"
              >
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-brand-blue" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="pl-11 h-12 text-sm border-slate-200 rounded-xl focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 transition-all"
                  required
                />
              </div>
            </div>

            {/* Password Input with show/hide toggle */}
            <div className="space-y-2 group">
              <Label
                htmlFor="password"
                className="text-sm font-semibold text-slate-700 transition-colors group-focus-within:text-brand-blue"
              >
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-brand-blue" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="pl-11 pr-11 h-12 text-sm border-slate-200 rounded-xl focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button with loading animation */}
            <Button
              type="submit"
              variant="default"
              size="lg"
              className="w-full h-12 text-sm font-semibold bg-brand-blue hover:bg-brand-blue/90 text-white rounded-xl shadow-lg shadow-brand-blue/20 transition-all duration-200 hover:shadow-xl hover:shadow-brand-blue/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Sign In
                  <ChevronRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          {/* Demo Credentials with subtle animation
          <div
            className={`mt-8 transition-all duration-700 ease-out ${
              isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '300ms' }}
          >
            <details className="group">
              <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors select-none">
                Demo Credentials
              </summary>
              <div className="mt-3 p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Email:</span>
                  <button
                    type="button"
                    onClick={() => setEmail("admin@amtemeterai.com")}
                    className="text-xs font-mono text-brand-blue hover:text-brand-blue/80 transition-colors"
                  >
                    admin@amtemeterai.com
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Password:</span>
                  <button
                    type="button"
                    onClick={() => setPassword("Admin@123")}
                    className="text-xs font-mono text-brand-blue hover:text-brand-blue/80 transition-colors"
                  >
                    Admin@123
                  </button>
                </div>
              </div>
            </details>
          </div> */}

          {/* Footer with copyright */}
          <div
            className={`mt-12 text-center transition-all duration-700 ease-out ${
              isMounted ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ transitionDelay: '400ms' }}
          >
            <p className="text-xs text-slate-400">
              © 2026 AMT e-Meterai. Enterprise Document Automation with SAP & e-Meterai Integration.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Image Background with animation */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden bg-brand-blue">
        {/* Image with subtle zoom animation */}
        <div
          className="absolute inset-0 bg-center bg-cover transition-transform duration-[2000ms] ease-out"
          style={{
            backgroundImage: `url(${Landscape})`,
            transform: isMounted ? 'scale(1)' : 'scale(1.05)'
          }}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/60 via-brand-blue/40 to-transparent" />

        {/* Animated floating elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className={`absolute top-1/4 right-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl transition-all duration-1000 ease-out ${
              isMounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
                }`}
            style={{ transitionDelay: '500ms' }}
          />
          <div
            className={`absolute bottom-1/3 left-1/4 w-48 h-48 bg-brand-red/10 rounded-full blur-3xl transition-all duration-1000 ease-out ${
              isMounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
            }`}
            style={{ transitionDelay: '600ms' }}
          />
        </div>

        {/* Content overlay */}
        <div
          className={`absolute inset-0 flex flex-col justify-end p-16 transition-all duration-1000 ease-out ${
            isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionDelay: '400ms' }}
        >
          <div className="max-w-md space-y-4">
            <h3 className="text-3xl font-bold text-white tracking-tight">
              Enterprise Document Automation with SAP & e-Meterai Integration
            </h3>
            <p className="text-base text-white/80 leading-relaxed">
              Automate billing, digital stamping, warehouse documents, and delivery workflows in one connected platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
