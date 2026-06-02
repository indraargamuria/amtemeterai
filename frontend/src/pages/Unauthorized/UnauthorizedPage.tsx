import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "../../shared/components/ui/Card"
import { Button } from "../../shared/components/ui/Button"

export function UnauthorizedPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-brand-blue/[0.02] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          {/* Error Icon */}
          <div className="w-16 h-16 rounded-full bg-brand-red/10 flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-brand-red"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-semibold text-brand-blue mb-2">
            Access Denied
          </h1>
          <p className="text-brand-blue/60 mb-6">
            You don't have permission to access this page. Please contact your
            administrator if you believe this is an error.
          </p>

          <Button onClick={() => navigate('/')} className="min-w-[140px]">
            Return to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
