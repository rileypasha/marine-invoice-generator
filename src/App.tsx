import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import EmployeeLoginPortal from './components/EmployeeLoginPortal'
import ProtectedRoute from './components/auth/ProtectedRoute'
import MainLayout from './layouts/MainLayout'
import InvoicesPage from './pages/InvoicesPage'
import Customers from './pages/Customers'
import Vessels from './pages/Vessels'
import CreateInvoice from './pages/CreateInvoice'
import CreateCustomer from './pages/CreateCustomer'
import CreateVessel from './pages/CreateVessel'
import InvoiceView from './pages/InvoiceView'
import Settings from './pages/Settings'
import RowActionsLayer from './features/vessels/components/RowActionsLayer'
import RequestsRowActionsLayer from './features/requests/components/RowActionsLayer'
import ContactsRowActionsLayer from './features/contacts/components/RowActionsLayer'

const RedirectCustomerEdit = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/contacts/${id}/edit`} replace />;
};

function App() {
  const handleLogin = (credentials: { email: string; password: string }) => {
    console.log('Login attempted with:', credentials)
  }

  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute requireAuth={false}>
                  <EmployeeLoginPortal
                    onLogin={handleLogin}
                    isLoading={false}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <InvoicesPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/contacts"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Customers />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/vessels"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Vessels />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests/new"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <CreateInvoice />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/contacts/create"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <CreateCustomer />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/contacts/:id/edit"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <CreateCustomer />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/vessels/create"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <CreateVessel />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/vessels/:id/edit"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <CreateVessel />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests/:id/edit"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <CreateInvoice />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests/preview"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <InvoiceView />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests/:id"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <InvoiceView />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Settings />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            {/* Redirect old URLs to new ones */}
            <Route path="/invoices" element={<Navigate to="/requests" replace />} />
            <Route path="/invoices/create" element={<Navigate to="/requests/new" replace />} />
            <Route path="/invoices/:id" element={<Navigate to="/requests/:id" replace />} />
            <Route path="/invoices/:id/edit" element={<Navigate to="/requests/:id/edit" replace />} />
            <Route path="/invoices/preview" element={<Navigate to="/requests/preview" replace />} />
            <Route path="/customers" element={<Navigate to="/contacts" replace />} />
            <Route path="/customers/create" element={<Navigate to="/contacts/create" replace />} />
            <Route path="/clients" element={<Navigate to="/contacts" replace />} />
            <Route path="/clients/create" element={<Navigate to="/contacts/create" replace />} />
            <Route path="/clients/:id/edit" element={<RedirectCustomerEdit />} />
            <Route path="/customers/:id/edit" element={<RedirectCustomerEdit />} />
          </Routes>
          <RowActionsLayer />
          <RequestsRowActionsLayer />
          <ContactsRowActionsLayer />
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App