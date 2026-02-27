import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  requireAuth?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true
}) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        {/* Top progress bar */}
        <div className="fixed top-0 left-0 right-0 z-50 h-[2px] bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-[#003d5b]/70 rounded-r-full"
            style={{ animation: 'authBarSlide 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
          />
        </div>
        {/* Skeleton content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 md:pt-16">
          <div className="mb-8">
            <div className="h-7 w-40 bg-gray-100 rounded-md auth-shimmer" />
            <div className="h-4 w-64 bg-gray-50 rounded-md mt-3 auth-shimmer" />
          </div>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-9 w-28 bg-gray-100 rounded-lg auth-shimmer" />
            <div className="h-9 w-9 bg-gray-50 rounded-lg auth-shimmer" />
            <div className="flex-1" />
            <div className="h-9 w-48 bg-gray-50 rounded-lg auth-shimmer" />
          </div>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-3.5 bg-gray-50/60 border-b border-gray-100">
              {[96, 140, 120, 80, 100].map((w, i) => (
                <div key={i} className="h-3 bg-gray-200/60 rounded auth-shimmer" style={{ width: w }} />
              ))}
            </div>
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 last:border-b-0">
                <div className="h-3.5 rounded bg-gray-100 auth-shimmer" style={{ width: 88 }} />
                <div className="h-3.5 rounded bg-gray-50 auth-shimmer" style={{ width: 148 }} />
                <div className="h-3.5 rounded bg-gray-50 auth-shimmer" style={{ width: 112 }} />
                <div className="h-3.5 rounded bg-gray-50 auth-shimmer" style={{ width: 72 }} />
                <div className="flex-1" />
                <div className="h-6 w-16 bg-gray-50 rounded-full auth-shimmer" />
              </div>
            ))}
          </div>
        </div>
        <style>{`
          @keyframes authBarSlide {
            0% { width: 0%; margin-left: 0%; }
            50% { width: 60%; margin-left: 20%; }
            100% { width: 0%; margin-left: 100%; }
          }
          .auth-shimmer {
            position: relative;
            overflow: hidden;
          }
          .auth-shimmer::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%);
            animation: authShimmer 1.8s ease-in-out infinite;
          }
          @keyframes authShimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!requireAuth && isAuthenticated) {
    return <Navigate to="/requests/new" replace />;
  }

  // Support both nested routes (via Outlet) and direct children
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
