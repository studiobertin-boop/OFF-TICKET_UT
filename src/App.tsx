import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/theme'
import { AuthProvider } from '@/hooks/useAuth'
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
import { Templates } from '@/pages/Templates'
import { TemplateEditor } from '@/pages/TemplateEditor'
import { TemplateWizard } from '@/pages/TemplateWizard'
import { CIVASummary } from '@/pages/CIVASummary'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Requests />
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
                path="/admin/deletion-archives"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <DeletionArchives />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/templates"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Templates />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/templates/new"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <TemplateEditor />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/templates/wizard"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <TemplateWizard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/templates/wizard/:id"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <TemplateWizard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/templates/:id"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <TemplateEditor />
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
