import { useState } from "react"
import { Button } from "../../shared/components/ui/Button"
import { Input } from "../../shared/components/ui/Input"
import { Label } from "../../shared/components/ui/Label"

export function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Login attempt:", { email, password })
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-12">
            <h1 className="text-3xl font-bold text-brand-blue tracking-tight">
              AmtemeterAI
            </h1>
            <p className="mt-1 text-sm text-brand-blue/60">
              e-Meterai Delivery Management
            </p>
          </div>

          {/* Welcome Text */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-brand-blue mb-2">
              Welcome Back
            </h2>
            <p className="text-brand-blue/70">
              Sign in to access your account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-brand-blue">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-brand-blue placeholder:text-brand-blue/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-brand-blue">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-brand-blue placeholder:text-brand-blue/30"
              />
            </div>

            <Button
              type="submit"
              variant="default"
              size="lg"
              className="w-full"
            >
              Sign In
            </Button>
          </form>
        </div>
      </div>

      {/* Right Side - Image */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-blue to-brand-blue/80">
          {/* Abstract logistics-themed pattern */}
          <svg
            className="absolute inset-0 w-full h-full opacity-10"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <pattern
                id="logistics-pattern"
                patternUnits="userSpaceOnUse"
                width="20"
                height="20"
                patternTransform="rotate(45)"
              >
                <rect
                  width="2"
                  height="2"
                  fill="#FFFFFF"
                  fillOpacity="0.5"
                />
              </pattern>
            </defs>
            <rect
              width="100"
              height="100"
              fill="url(#logistics-pattern)"
            />
          </svg>
        </div>
        {/* Decorative circle */}
        <div className="absolute bottom-20 right-20 w-64 h-64 rounded-full border-4 border-white/20" />
        <div className="absolute top-32 right-32 w-32 h-32 rounded-full bg-brand-red/10" />
      </div>
    </div>
  )
}
