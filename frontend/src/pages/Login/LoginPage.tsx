import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Button } from "../../shared/components/ui/Button"
import { Input } from "../../shared/components/ui/Input"
import { Label } from "../../shared/components/ui/Label"
import Logo from '../../assets/amtlogo.png';
import Landscape from '../../assets/amtlandscape.jpg';
import { useAuth } from "../../shared/contexts/AuthContext"

export function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  // Get the redirect path from location state, default to '/'
  const from = (location.state as any)?.from?.pathname || "/"

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
      // Navigate to the page they tried to visit, or home
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-brand-blue/[0.02]">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-10">
            <h1 className="text-xl font-bold text-brand-blue tracking-tight">
              <img src={Logo} alt="Logo" className="w-32 h-auto" />
            </h1>
          </div>

          {/* Welcome Text */}
          <div className="mb-8 space-y-1">
            <h2 className="text-2xl font-semibold text-brand-blue tracking-tight">
              Welcome Back
            </h2>
            <p className="text-sm text-brand-blue/60">
              Sign in to access your account
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 rounded-md bg-brand-red/10 border border-brand-red/20">
              <p className="text-sm text-brand-red">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-sm font-medium text-brand-blue/70"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="text-brand-blue placeholder:text-brand-blue/30"
                required
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm font-medium text-brand-blue/70"
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="text-brand-blue placeholder:text-brand-blue/30"
                required
              />
            </div>

            <Button
              type="submit"
              variant="default"
              size="lg"
              className="w-full mt-6"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {/* Demo Credentials Hint */}
          <div className="mt-6 p-4 rounded-md bg-brand-blue/5 border border-brand-blue/10">
            <p className="text-xs text-brand-blue/50 font-medium mb-2">
              Demo Credentials:
            </p>
            <p className="text-xs text-brand-blue/60">
              Email: admin@amtemeterai.com
            </p>
            <p className="text-xs text-brand-blue/60">
              Password: Admin@123
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Image Background */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden bg-brand-blue">
        <div
          className="absolute inset-0 bg-center bg-cover"
          style={{ backgroundImage: `url(${Landscape})` }}
        />

        {/* Optional dark overlay for readability */}
        <div className="absolute inset-0 bg-black/20" />
      </div>
    </div>
  )
}
