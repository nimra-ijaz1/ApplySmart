import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  Bookmark,
  Bot,
  Calendar,
  CheckCircle2,
  FileText,
  GitCompare,
  GraduationCap,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { cn } from '../../lib/utils.ts';

const STUDENT_NAV = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/universities', label: 'Find Universities', icon: GraduationCap },
  { to: '/shortlist', label: 'My Shortlist', icon: Bookmark },
  { to: '/eligibility', label: 'Eligibility Checker', icon: CheckCircle2 },
  { to: '/scholarships', label: 'Scholarships', icon: Award },
  { to: '/applications', label: 'My Applications', icon: Kanban },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/calendar', label: 'Deadline Calendar', icon: Calendar },
  { to: '/assistant', label: 'AI Assistant', icon: Bot },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Overview',
  '/universities': 'Find Universities',
  '/shortlist': 'My Shortlist',
  '/eligibility': 'Eligibility Checker',
  '/scholarships': 'Scholarships',
  '/applications': 'My Applications',
  '/documents': 'Documents',
  '/calendar': 'Deadline Calendar',
  '/assistant': 'AI Assistant',
  '/settings': 'Settings',
  '/profile': 'Student Profile',
  '/compare': 'Compare Programmes',
  '/admin': 'Admin Console',
};

export function AppShell() {
  const { dbUser, logout, compareIds } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const basePath = '/' + location.pathname.split('/')[1];
  const currentTitle = ROUTE_LABELS[basePath] || 'Workspace';
  const isAdmin = dbUser?.role === 'admin' || dbUser?.role === 'super_admin';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      <div>
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800">
          <Link
            to="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="text-lg font-bold tracking-tight text-[#0F2942] dark:text-white font-display"
          >
            ApplySmart
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="p-3 space-y-1">
          {STUDENT_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                    isActive
                      ? 'bg-[#0F2942] text-white dark:bg-blue-600 dark:text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
            <NavLink
              to="/compare"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-[#0F2942] text-white dark:bg-blue-600'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                )
              }
            >
              <span className="flex items-center gap-3">
                <GitCompare className="h-4 w-4 shrink-0" />
                <span>Compare Programmes</span>
              </span>
              {compareIds.length > 0 && (
                <span className="font-mono text-xs tabular-nums opacity-80">{compareIds.length}/4</span>
              )}
            </NavLink>

            <NavLink
              to="/profile"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-[#0F2942] text-white dark:bg-blue-600'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                )
              }
            >
              <User className="h-4 w-4 shrink-0" />
              <span>My Profile</span>
            </NavLink>

            {isAdmin && (
              <NavLink
                to="/admin"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                    isActive
                      ? 'bg-indigo-700 text-white'
                      : 'text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/60'
                  )
                }
              >
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>Admin Console</span>
              </NavLink>
            )}
          </div>
        </nav>
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="mb-3 px-1">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
            {dbUser?.fullName || 'Student Applicant'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {dbUser?.email}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 h-full">{sidebarContent}</div>
          <div
            className="flex-1 bg-slate-950/50"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="lg:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 truncate">
              <span className="hidden sm:inline">ApplySmart</span>
              <span className="hidden sm:inline" aria-hidden="true">/</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {currentTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/eligibility"
              className="hidden sm:inline-flex h-9 items-center rounded-lg bg-[#0F2942] px-3.5 text-xs font-medium text-white hover:bg-[#163A5C] dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap"
            >
              Check Eligibility
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-[1360px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
