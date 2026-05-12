import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./shared/contexts/AuthContext"
import { ProtectedRoute } from "./shared/components/ProtectedRoute"
import { LoginPage } from "./pages/Login"
import { DashboardPage } from "./pages/Dashboard"
import { CustomersPage } from "./pages/Customers"
import { DeliveriesPage, DeliveryDetailPage } from "./pages/Deliveries"
import { DeliveryReceivePage } from "./pages/Public"
import { DashboardLayout } from "./shared/layouts"

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
      } />
      <Route path="/receive/:token" element={<DeliveryReceivePage />} />

      {/* Protected Routes - require authentication */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <DashboardPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <CustomersPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/deliveries"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <DeliveriesPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/deliveries/:deliveryId"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <DeliveryDetailPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Catch all - redirect to home if authenticated, login if not */}
      <Route path="*" element={
        <Navigate to={isAuthenticated ? "/" : "/login"} replace />
      } />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
