import { useState } from "react"
import { Button } from "../../shared/components/ui/Button"
import { Input } from "../../shared/components/ui/Input"
import { Label } from "../../shared/components/ui/Label"
import Logo from '../../assets/amtlogo.png';
import Landscape from '../../assets/amtlandscape.jpg';
import { Link, useLocation } from "react-router-dom"

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
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-brand-blue/[0.02]">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-10">
            <h1 className="text-xl font-bold text-brand-blue tracking-tight">
              {/* OpexNOW */}
              <img src={Logo} alt="Logo"  className="w-32 h-auto" />
            </h1>
            {/* <p className="mt-1.5 text-xs text-brand-blue/50">
              OpexNOW
            </p> */}
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
                className="text-brand-blue placeholder:text-brand-blue/30"
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
                className="text-brand-blue placeholder:text-brand-blue/30"
              />
            </div>

            <Link to="/" >
              <Button
                type="submit"
                variant="default"
                size="lg"
                className="w-full mt-6"
              >
                Sign In
              </Button>
            </Link>
          </form>
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
