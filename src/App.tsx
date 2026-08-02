import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useTheme } from '@mui/material'
import { ThemeProvider } from '@/theme'
import { radii } from '@/theme/tokens'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { Requests } from '@/pages/Requests'
import { RequestDetail } from '@/pages/RequestDetail'
import { NewRequest } from '@/pages/NewRequest'
import { TechnicalDetails } from '@/pages/TechnicalDetails'
import { DeletionArchives } from '@/pages/DeletionArchives'
import NotificationSettings from '@/pages/NotificationSettings'
import AdminRequestTypes from '@/pages/admin/AdminRequestTypes'
import AdminUsers from '@/pages/admin/AdminUsers'
import CustomersManagement from '@/pages/admin/CustomersManagement'
import ManufacturersManagement from '@/pages/ManufacturersManagement'
import InstallersManagement from '@/pages/InstallersManagement'
import EquipmentCatalogManagement from '@/pages/EquipmentCatalogManagement'
import { CIVASummary } from '@/pages/CIVASummary'
import BillingReport from '@/pages/BillingReport'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
})

// Vista iniziale per la rotta "/":
// - admin: dashboard DM329
// - altri ruoli: lista richieste
function HomeRoute() {
  const { user } = useAuth()
  if (user?.role === 'admin') {
    return <Navigate to="/dashboard?tab=dm329" replace />
  }
  return <Requests />
}

// react-hot-toast non legge il tema MUI: lo iniettiamo qui via toastOptions,
// così i toast seguono il mode light/dark e i token dell'app.
function ThemedToaster() {
  const theme = useTheme()
  const surface = theme.palette.background.paper

  return (
    <Toaster
      position="bottom-right"
      gutter={12}
      toastOptions={{
        duration: 4000,
        style: {
          background: surface,
          color: theme.palette.text.primary,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: radii.paper,
          boxShadow: theme.shadows[6],
          fontFamily: theme.typography.fontFamily,
          fontSize: '0.875rem',
          maxWidth: 460,
        },
        success: {
          duration: 3000,
          iconTheme: { primary: theme.palette.success.main, secondary: surface },
        },
        error: {
          duration: 6000,
          iconTheme: { primary: theme.palette.error.main, secondary: surface },
        },
        loading: {
          iconTheme: { primary: theme.palette.primary.main, secondary: surface },
        },
      }}
    />
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ThemedToaster />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <HomeRoute />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'tecnico', 'userdm329']}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/requests"
                element={
                  <ProtectedRoute>
                    <Requests />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/requests/new"
                element={
                  <ProtectedRoute>
                    <NewRequest />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/requests/:id"
                element={
                  <ProtectedRoute>
                    <RequestDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/requests/:id/technical-details"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'userdm329', 'tecnicoDM329']}>
                    <TechnicalDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/requests/:id/civa-summary"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'userdm329']}>
                    <CIVASummary />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notification-settings"
                element={
                  <ProtectedRoute>
                    <NotificationSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/request-types"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminRequestTypes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminUsers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/customers"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <CustomersManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/manufacturers"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ManufacturersManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/installers"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <InstallersManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/equipment-catalog"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'userdm329']}>
                    <EquipmentCatalogManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/deletion-archives"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <DeletionArchives />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports/billing"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <BillingReport />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
