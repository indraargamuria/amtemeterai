import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./shared/contexts/AuthContext"
import { ProtectedRoute } from "./shared/components/ProtectedRoute"
import { RouteGuard } from "./shared/components/RouteGuard"
import { LoginPage } from "./pages/Login"
import { DashboardPage } from "./pages/Dashboard"
import { CustomersPage } from "./pages/Customers"
import { DeliveriesPage, DeliveryDetailPage } from "./pages/Deliveries"
import { DeliveryReceivePage } from "./pages/Public"
import { InvoicesPage } from "./pages/Invoices"
import { UserAccessManagementPage } from "./pages/UserAccessManagement"
import { UnauthorizedPage } from "./pages/Unauthorized"
import { DashboardLayout } from "./shared/layouts"
import { SecuritySessionGuard } from "./shared/components/SecuritySessionGuard"

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
      } />
      <Route path="/receive/:token" element={<DeliveryReceivePage />} />

      {/* Unauthorized Page */}
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Dashboard Route - Protected with permission check */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RouteGuard>
              <DashboardLayout>
                <DashboardPage />
              </DashboardLayout>
            </RouteGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <RouteGuard>
              <DashboardLayout>
                <DashboardPage />
              </DashboardLayout>
            </RouteGuard>
          </ProtectedRoute>
        }
      />

      {/* Other Protected Routes - require authentication + permission check */}
      <Route
        path="/customers"
        element={
          <ProtectedRoute>
            <RouteGuard>
              <DashboardLayout>
                <CustomersPage />
              </DashboardLayout>
            </RouteGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/deliveries"
        element={
          <ProtectedRoute>
            <RouteGuard>
              <DashboardLayout>
                <DeliveriesPage />
              </DashboardLayout>
            </RouteGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/deliveries/:deliveryId"
        element={
          <ProtectedRoute>
            <RouteGuard>
              <DashboardLayout>
                <DeliveryDetailPage />
              </DashboardLayout>
            </RouteGuard>
          </ProtectedRoute>
        }
      />
      {/* <Route
        path="/invoices"
        element={
          <ProtectedRoute>
            <RouteGuard>
              <DashboardLayout>
                <InvoicesPage />
              </DashboardLayout>
            </RouteGuard>
          </ProtectedRoute>
        }
      /> */}
      <Route
        path="/admin/uam"
        element={
          <ProtectedRoute>
            <RouteGuard>
              <DashboardLayout>
                <UserAccessManagementPage />
              </DashboardLayout>
            </RouteGuard>
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
        <SecuritySessionGuard>
          <AppRoutes />
        </SecuritySessionGuard>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
