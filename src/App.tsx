import React, { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { queryClient } from './lib/react-query'
import EmployeeLoginPortal from './components/EmployeeLoginPortal'
import ResetPassword from './components/ResetPassword'
import ProtectedRoute from './components/auth/ProtectedRoute'
import MainLayout from './layouts/MainLayout'
import { FloatingInstallButton } from './components/pwa/FloatingInstallButton'
import { OrientationLock } from './components/pwa/OrientationLock'
import { ToastProvider } from './components/ui/toast'
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
const UploadPdf = lazy(() => import('./pages/UploadPdf'))

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
const ContactsRowActionsLayer = lazy(() => import('./features/contacts/components/ContactsRowActionsLayer'))

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

// Modern SaaS page loader — skeleton UI with shimmer
const PageLoader = () => (
  <div className="min-h-screen bg-white">
    {/* Subtle top progress bar */}
    <div className="fixed top-0 left-0 right-0 z-50 h-[2px] bg-gray-100 overflow-hidden">
      <div
        className="h-full bg-[#003d5b]/70 rounded-r-full"
        style={{
          animation: 'progressSlide 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        }}
      />
    </div>

    {/* Content skeleton mimicking real page layout */}
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 md:pt-16">
      {/* Page header skeleton */}
      <div className="mb-8">
        <div className="h-7 w-40 bg-gray-100 rounded-md skeleton-shimmer" />
        <div className="h-4 w-64 bg-gray-50 rounded-md mt-3 skeleton-shimmer" style={{ animationDelay: '0.08s' }} />
      </div>

      {/* Action bar skeleton */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-9 w-28 bg-gray-100 rounded-lg skeleton-shimmer" style={{ animationDelay: '0.12s' }} />
        <div className="h-9 w-9 bg-gray-50 rounded-lg skeleton-shimmer" style={{ animationDelay: '0.16s' }} />
        <div className="flex-1" />
        <div className="h-9 w-48 bg-gray-50 rounded-lg skeleton-shimmer" style={{ animationDelay: '0.2s' }} />
      </div>

      {/* Table / card skeleton */}
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-4 px-5 py-3.5 bg-gray-50/60 border-b border-gray-100">
          {[96, 140, 120, 80, 100].map((w, i) => (
            <div key={i} className="h-3 bg-gray-200/60 rounded skeleton-shimmer" style={{ width: w, animationDelay: `${0.04 * i}s` }} />
          ))}
        </div>
        {/* Table rows */}
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <div
            key={row}
            className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 last:border-b-0"
          >
            <div className="h-3.5 bg-gray-100 rounded skeleton-shimmer" style={{ width: 88, animationDelay: `${0.24 + row * 0.06}s` }} />
            <div className="h-3.5 bg-gray-50 rounded skeleton-shimmer" style={{ width: 148, animationDelay: `${0.28 + row * 0.06}s` }} />
            <div className="h-3.5 bg-gray-50 rounded skeleton-shimmer" style={{ width: 112, animationDelay: `${0.32 + row * 0.06}s` }} />
            <div className="h-3.5 bg-gray-50 rounded skeleton-shimmer" style={{ width: 72, animationDelay: `${0.36 + row * 0.06}s` }} />
            <div className="flex-1" />
            <div className="h-6 w-16 bg-gray-50 rounded-full skeleton-shimmer" style={{ animationDelay: `${0.4 + row * 0.06}s` }} />
          </div>
        ))}
      </div>
    </div>

    <style>{`
      @keyframes progressSlide {
        0% { width: 0%; margin-left: 0%; }
        50% { width: 60%; margin-left: 20%; }
        100% { width: 0%; margin-left: 100%; }
      }
      .skeleton-shimmer {
        position: relative;
        overflow: hidden;
      }
      .skeleton-shimmer::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255, 255, 255, 0.6) 50%,
          transparent 100%
        );
        animation: shimmer 1.8s ease-in-out infinite;
        animation-delay: inherit;
      }
      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
    `}</style>
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
        if (href.startsWith('/requests') || href.startsWith('/estimates') || href.startsWith('/invoices')) {
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
          <ToastProvider>
          <Router>
            <RoutePrefetcher />
            {/* <OfflineBanner /> */}
            <>
              <div className="safe-top-painter" />
              <div className="app-content">
                {/* <RouteErrorBoundary> */}
                  <Suspense fallback={<PageLoader />}>
                    <OrientationLock />
                    <FloatingInstallButton />
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
                path="/reset-password"
                element={
                  <ProtectedRoute requireAuth={false}>
                    <ResetPassword />
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
                path="/estimates"
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
                path="/estimates/new"
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
                path="/estimates/:id/edit"
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
                path="/estimates/preview"
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
                path="/estimates/:id"
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
              <Route
                path="/upload-pdf"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <UploadPdf />
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
            </>
          </Router>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    // </ChunkErrorBoundary>
  )
}

export default App
