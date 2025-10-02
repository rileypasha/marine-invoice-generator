import React, { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { queryClient } from './lib/react-query'
import EmployeeLoginPortal from './components/EmployeeLoginPortal'
import ProtectedRoute from './components/auth/ProtectedRoute'
import MainLayout from './layouts/MainLayout'
// import { InstallPrompt } from './components/pwa/InstallPrompt'
// import { ChunkErrorBoundary, RouteErrorBoundary } from './components/ErrorBoundary'
// import { initPerformanceMonitoring } from './utils/performance-monitoring'
import { useRequestsRowActionsStore } from './features/requests/state/rowActions.store'
import { useRowActionsStore as useVesselsRowActionsStore } from './features/vessels/state/rowActions.store'
import { useContactsRowActionsStore } from './features/contacts/state/rowActions.store'
// import { OfflineBanner } from './components/OfflineBanner'
// import { hydrateFromCache } from './utils/offline-plugin'

// Initialize performance monitoring
// if (typeof window !== 'undefined') {
//   initPerformanceMonitoring({
//     enableLogging: import.meta.env.DEV,
//     reportToAnalytics: !import.meta.env.DEV,
//     samplingRate: 0.1, // Report 10% of users
//   })
// }

// Lazy load heavy page components with prefetching
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'))
const Customers = lazy(() => import('./pages/Customers'))
const Vessels = lazy(() => import('./pages/Vessels'))
const CreateInvoice = lazy(() => import('./pages/CreateInvoice'))
const CreateCustomer = lazy(() => import('./pages/CreateCustomer'))
const CreateVessel = lazy(() => import('./pages/CreateVessel'))
const InvoiceView = lazy(() => import('./pages/InvoiceView'))
const Settings = lazy(() => import('./pages/Settings'))

// Prefetch critical routes (most commonly accessed)
const prefetchRoute = (importFn: () => Promise<any>) => {
  importFn().catch((error) => {
    console.warn('Route prefetch failed:', error)
  })
}

// Prefetch most common routes after initial load
if (typeof window !== 'undefined') {
  // Wait for initial page load, then prefetch
  window.addEventListener('load', () => {
    setTimeout(() => {
      // Prefetch critical routes that users frequently visit
      prefetchRoute(() => import('./pages/InvoicesPage'))
      prefetchRoute(() => import('./pages/Customers'))
    }, 2000) // Delay 2s to not interfere with initial page load
  })
}

// Conditionally lazy load row action layers - only when first opened
const RowActionsLayer = lazy(() => import('./features/vessels/components/RowActionsLayer'))
const RequestsRowActionsLayer = lazy(() => import('./features/requests/components/RowActionsLayer'))
const ContactsRowActionsLayer = lazy(() => import('./features/contacts/components/RowActionsLayer'))

// Wrappers to defer loading until actually opened
const ConditionalRequestsRowActions = () => {
  const { open } = useRequestsRowActionsStore()
  return open ? <RequestsRowActionsLayer /> : null
}

const ConditionalVesselsRowActions = () => {
  const { open } = useVesselsRowActionsStore()
  return open ? <RowActionsLayer /> : null
}

const ConditionalContactsRowActions = () => {
  const { open } = useContactsRowActionsStore()
  return open ? <ContactsRowActionsLayer /> : null
}

// Enhanced loading fallback with skeleton
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto mb-4"></div>
      <p className="text-sm text-gray-600">Loading...</p>
    </div>
  </div>
)

const RedirectCustomerEdit = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/contacts/${id}/edit`} replace />;
};

/**
 * Route Prefetcher - prefetches routes on hover/touchstart
 */
function RoutePrefetcher() {
  const location = useLocation()

  useEffect(() => {
    const handleLinkHover = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')

      if (link && link.getAttribute('href')) {
        const href = link.getAttribute('href')!

        // Prefetch route based on href
        if (href.startsWith('/requests') || href.startsWith('/invoices')) {
          prefetchRoute(() => import('./pages/InvoicesPage'))
        } else if (href.startsWith('/contacts') || href.startsWith('/customers')) {
          prefetchRoute(() => import('./pages/Customers'))
        } else if (href.startsWith('/vessels')) {
          prefetchRoute(() => import('./pages/Vessels'))
        }
      }
    }

    // Add hover and touchstart listeners for prefetching
    document.addEventListener('mouseover', handleLinkHover, { passive: true })
    document.addEventListener('touchstart', handleLinkHover, { passive: true })

    return () => {
      document.removeEventListener('mouseover', handleLinkHover)
      document.removeEventListener('touchstart', handleLinkHover)
    }
  }, [location])

  return null
}

function App() {
  const handleLogin = (credentials: { email: string; password: string }) => {
    console.log('Login attempted with:', credentials)
  }

  // Hydrate from cache on mount
  // useEffect(() => {
  //   hydrateFromCache(queryClient).then((stats) => {
  //     console.log('Cache hydrated:', stats)
  //   })
  // }, [])

  return (
    // <ChunkErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <RoutePrefetcher />
            {/* <OfflineBanner /> */}
            <div className="App">
              {/* <RouteErrorBoundary> */}
                <Suspense fallback={<PageLoader />}>
                  {/* <InstallPrompt /> */}
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
                      <ConditionalRequestsRowActions />
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
                      <ConditionalContactsRowActions />
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
                      <ConditionalVesselsRowActions />
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
                </Suspense>
              {/* </RouteErrorBoundary> */}
            </div>
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    // </ChunkErrorBoundary>
  )
}

export default App