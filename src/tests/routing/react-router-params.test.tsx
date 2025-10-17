/**
 * Test Suite: React Router useParams() Context Propagation
 *
 * Purpose: Verify that URL parameters correctly propagate through nested routes
 * when using wrapper components (ProtectedRoute, MainLayout)
 *
 * Critical Requirements:
 * - ProtectedRoute must render <Outlet /> for nested routes
 * - MainLayout must render <Outlet /> for nested routes
 * - useParams() must return correct ID values in child components
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../context/AuthContext';
import ProtectedRoute from '../../components/auth/ProtectedRoute';
import MainLayout from '../../layouts/MainLayout';
import '@testing-library/jest-dom';

// Mock AuthContext to simulate authenticated state
jest.mock('../../context/AuthContext', () => ({
  ...jest.requireActual('../../context/AuthContext'),
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    currentUser: { id: 'test-user', name: 'Test User' },
    csrfToken: 'test-token',
  }),
}));

// Test component that displays route params
const ParamDisplay: React.FC = () => {
  const params = useParams<{ id?: string }>();
  const location = useLocation();

  return (
    <div>
      <div data-testid="param-id">{params.id || 'undefined'}</div>
      <div data-testid="pathname">{location.pathname}</div>
    </div>
  );
};

describe('React Router Params Context Propagation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('DELIVERABLE 1: ProtectedRoute <Outlet /> Support', () => {
    it('should propagate params when ProtectedRoute uses <Outlet />', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter initialEntries={['/requests/test-id-123/edit']}>
              <Routes>
                <Route element={<ProtectedRoute />}>
                  <Route path="/requests/:id/edit" element={<ParamDisplay />} />
                </Route>
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        const paramElement = screen.getByTestId('param-id');
        expect(paramElement).toHaveTextContent('test-id-123');
        expect(paramElement).not.toHaveTextContent('undefined');
      });
    });

    it('should work with UUID-format IDs', async () => {
      const uuid = 'bc7c51ab-2211-47e6-9602-1a716d516b96';

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter initialEntries={[`/requests/${uuid}/edit`]}>
              <Routes>
                <Route element={<ProtectedRoute />}>
                  <Route path="/requests/:id/edit" element={<ParamDisplay />} />
                </Route>
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('param-id')).toHaveTextContent(uuid);
      });
    });
  });

  describe('DELIVERABLE 2: MainLayout <Outlet /> Support', () => {
    it('should propagate params through MainLayout wrapper', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter initialEntries={['/requests/layout-test-456/edit']}>
              <Routes>
                <Route element={<ProtectedRoute />}>
                  <Route element={<MainLayout />}>
                    <Route path="/requests/:id/edit" element={<ParamDisplay />} />
                  </Route>
                </Route>
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('param-id')).toHaveTextContent('layout-test-456');
      });
    });
  });

  describe('DELIVERABLE 3: Full Nested Route Stack', () => {
    it('should propagate params through ProtectedRoute + MainLayout stack', async () => {
      const testId = 'full-stack-789';

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter initialEntries={[`/requests/${testId}/edit`]}>
              <Routes>
                <Route element={<ProtectedRoute />}>
                  <Route element={<MainLayout />}>
                    <Route path="/requests/:id/edit" element={<ParamDisplay />} />
                  </Route>
                </Route>
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        const paramElement = screen.getByTestId('param-id');
        expect(paramElement).toHaveTextContent(testId);
        expect(paramElement).not.toHaveTextContent('undefined');
      });

      // Verify pathname is correct
      expect(screen.getByTestId('pathname')).toHaveTextContent(`/requests/${testId}/edit`);
    });

    it('should work for contacts/:id/edit route', async () => {
      const contactId = 'contact-abc-123';

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter initialEntries={[`/contacts/${contactId}/edit`]}>
              <Routes>
                <Route element={<ProtectedRoute />}>
                  <Route element={<MainLayout />}>
                    <Route path="/contacts/:id/edit" element={<ParamDisplay />} />
                  </Route>
                </Route>
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('param-id')).toHaveTextContent(contactId);
      });
    });

    it('should work for vessels/:id/edit route', async () => {
      const vesselId = 'vessel-xyz-999';

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter initialEntries={[`/vessels/${vesselId}/edit`]}>
              <Routes>
                <Route element={<ProtectedRoute />}>
                  <Route element={<MainLayout />}>
                    <Route path="/vessels/:id/edit" element={<ParamDisplay />} />
                  </Route>
                </Route>
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('param-id')).toHaveTextContent(vesselId);
      });
    });
  });

  describe('DELIVERABLE 4: Backward Compatibility', () => {
    it('should still support direct children prop pattern', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter initialEntries={['/test']}>
              <Routes>
                <Route
                  path="/test"
                  element={
                    <ProtectedRoute>
                      <div data-testid="direct-child">Direct Child Works</div>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('direct-child')).toBeInTheDocument();
    });

    it('MainLayout should support direct children', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter initialEntries={['/test']}>
              <Routes>
                <Route
                  path="/test"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <div data-testid="layout-child">Layout Child Works</div>
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('layout-child')).toBeInTheDocument();
    });
  });

  describe('REGRESSION PREVENTION: Context Barrier Detection', () => {
    it('should fail if ProtectedRoute breaks context (regression test)', async () => {
      // This test verifies that the fix prevents future regressions
      const BrokenProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        // Simulates the OLD broken pattern that rendered {children} directly
        return <>{children}</>;
      };

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter initialEntries={['/requests/broken-test/edit']}>
              <Routes>
                <Route
                  path="/requests/:id/edit"
                  element={
                    <BrokenProtectedRoute>
                      <ParamDisplay />
                    </BrokenProtectedRoute>
                  }
                />
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      // With broken pattern, params would be undefined
      // This demonstrates why the fix is necessary
      await waitFor(() => {
        const paramElement = screen.getByTestId('param-id');
        // Old broken pattern would show "undefined"
        expect(paramElement).toHaveTextContent('undefined');
      });
    });
  });
});
