import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.tsx';

export function PublicHeader() {
  const { firebaseUser } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-6">
        <Link
          to="/"
          className="text-xl font-bold tracking-tight text-[#0F2942] dark:text-white whitespace-nowrap shrink-0 font-display"
        >
          ApplySmart
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <Link to="/features" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0 transition-colors">
            Features
          </Link>
          <Link to="/how-it-works" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0 transition-colors">
            How It Works
          </Link>
          <Link to="/explore" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0 transition-colors">
            Universities
          </Link>
          <Link to="/about" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0 transition-colors">
            About
          </Link>
          <Link to="/contact" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0 transition-colors">
            Contact
          </Link>
        </nav>

        <div className="flex items-center shrink-0">
          <Link
            to={firebaseUser ? '/dashboard' : '/register'}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0F2942] px-4 py-2 text-sm font-medium text-white hover:bg-[#163A5C] dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0 transition-colors"
          >
            {firebaseUser ? 'Open Dashboard' : 'Get Started'}
          </Link>
        </div>
      </div>
    </header>
  );
}
