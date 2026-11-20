import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { ThemeProvider } from './contexts/ThemeContext.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { AppShell } from './components/layout/AppShell.tsx';

// Public Pages
import { LandingPage } from './pages/LandingPage.tsx';
import {
  AboutPage,
  ContactPage,
  FeaturesPage,
  HowItWorksPage,
  PublicExplorePage,
} from './pages/PublicInfoPages.tsx';
import { ForgotPasswordPage, LoginPage, RegisterPage } from './pages/AuthPages.tsx';

// Student Pages
import { OnboardingPage } from './pages/student/OnboardingPage.tsx';
import { DashboardPage } from './pages/student/DashboardPage.tsx';
import { ProfilePage } from './pages/student/ProfilePage.tsx';
import { UniversitiesPage } from './pages/student/UniversitiesPage.tsx';
import {
  ProgrammeDetailsPage,
  UniversityDetailsPage,
} from './pages/student/UniversityDetailsPage.tsx';
import { ShortlistPage } from './pages/student/ShortlistPage.tsx';
import { EligibilityCheckerPage } from './pages/student/EligibilityCheckerPage.tsx';
import {
  ScholarshipDetailsPage,
  ScholarshipsPage,
} from './pages/student/ScholarshipsPage.tsx';
import {
  ApplicationDetailsPage,
  ApplicationsPage,
} from './pages/student/ApplicationsPage.tsx';
import { DocumentsPage } from './pages/student/DocumentsPage.tsx';
import { CalendarPage } from './pages/student/CalendarPage.tsx';
import { AssistantPage } from './pages/student/AssistantPage.tsx';
import { ComparePage } from './pages/student/ComparePage.tsx';
import { SettingsPage } from './pages/student/SettingsPage.tsx';

// Admin Console
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Marketing & Discovery */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/explore" element={<PublicExplorePage />} />

              {/* Authentication */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />

              {/* Student Onboarding Wizard */}
              <Route element={<ProtectedRoute skipOnboardingCheck />}>
                <Route path="/onboarding" element={<OnboardingPage />} />
              </Route>

              {/* Protected Student Workspace */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/universities" element={<UniversitiesPage />} />
                  <Route path="/universities/:id" element={<UniversityDetailsPage />} />
                  <Route path="/programmes/:id" element={<ProgrammeDetailsPage />} />
                  <Route path="/shortlist" element={<ShortlistPage />} />
                  <Route path="/eligibility" element={<EligibilityCheckerPage />} />
                  <Route path="/scholarships" element={<ScholarshipsPage />} />
                  <Route path="/scholarships/:id" element={<ScholarshipDetailsPage />} />
                  <Route path="/applications" element={<ApplicationsPage />} />
                  <Route path="/applications/:id" element={<ApplicationDetailsPage />} />
                  <Route path="/documents" element={<DocumentsPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/assistant" element={<AssistantPage />} />
                  <Route path="/compare" element={<ComparePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>

              {/* Admin & Super Admin Console */}
              <Route element={<ProtectedRoute requireRoles={['admin', 'super_admin']} />}>
                <Route element={<AppShell />}>
                  <Route path="/admin" element={<AdminDashboardPage />} />
                </Route>
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
