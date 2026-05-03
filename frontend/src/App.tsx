import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { LoginPage } from "./pages/Login"
import { DashboardPage } from "./pages/Dashboard"
import { CustomersPage } from "./pages/Customers"
import { DeliveriesPage } from "./pages/Deliveries"
import { DashboardLayout } from "./shared/layouts"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <DashboardLayout>
              <DashboardPage />
            </DashboardLayout>
          }
        />
        <Route
          path="/customers"
          element={
            <DashboardLayout>
              <CustomersPage />
            </DashboardLayout>
          }
        />
        <Route
          path="/deliveries"
          element={
            <DashboardLayout>
              <DeliveriesPage />
            </DashboardLayout>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
