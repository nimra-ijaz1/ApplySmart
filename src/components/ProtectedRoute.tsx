import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';

export function ProtectedRoute({
  requireRoles,
  skipOnboardingCheck = false,
}: {
  requireRoles?: Array<'student' | 'admin' | 'super_admin'>;
  skipOnboardingCheck?: boolean;
}) {
  const { firebaseUser, dbUser, loading, authError, logout, refreshProfile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-sm text-slate-500 dark:text-slate-400">Loading your workspace...</div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!dbUser) {
    if (authError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
          <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-6 text-center space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-[#0F2942] dark:text-white">Account Access Unavailable</h2>
            <p className="text-sm text-red-600 dark:text-red-400">{authError}</p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => refreshProfile()}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => logout()}
                className="rounded-lg bg-[#0F2942] px-4 py-2 text-xs font-medium text-white hover:bg-[#163A5C] dark:bg-blue-600 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-sm text-slate-500 dark:text-slate-400">Verifying account permissions...</div>
      </div>
    );
  }

  if (requireRoles && !requireRoles.includes(dbUser.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (
    !skipOnboardingCheck &&
    !dbUser.onboardingCompleted &&
    location.pathname !== '/onboarding'
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
