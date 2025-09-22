import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import EmployeeLoginPortal from './components/EmployeeLoginPortal'
import ProtectedRoute from './components/auth/ProtectedRoute'
import MainLayout from './layouts/MainLayout'
import Dashboard from './pages/Dashboard'
import InvoicesPage from './pages/InvoicesPage'
import Customers from './pages/Customers'
import Vessels from './pages/Vessels'
import CreateInvoice from './pages/CreateInvoice'
import CreateCustomer from './pages/CreateCustomer'
import CreateVessel from './pages/CreateVessel'
import InvoiceView from './pages/InvoiceView'

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
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Dashboard />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <InvoicesPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
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
              path="/invoices/create"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <CreateInvoice />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/create"
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
              path="/invoices/:id/edit"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <CreateInvoice />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices/:id"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <InvoiceView />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App