import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, ArrowRight, CheckCircle2, Clock, FileWarning } from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { Button } from '../../components/ui/button.tsx';
import { formatCurrency, formatDate } from '../../lib/utils.ts';

interface DashboardData {
  stats: {
    shortlistedCount: number;
    inProgressCount: number;
    submittedCount: number;
    upcomingDeadlinesCount: number;
    eligibleProgrammesCount: number;
  };
  recentlyViewed: Array<{ id: number; name: string; country: string; city: string }>;
  recommendedProgrammes: Array<{
    programme: {
      id: number;
      name: string;
      degreeLevel: string;
      tuitionFee: number;
      currency: string;
      applicationDeadline: string | null;
    };
    university: { id: number; name: string; country: string };
    eligibilityStatus: string;
    eligibilityLabel: string;
  }>;
  upcomingDeadlines: Array<{ id: string; title: string; date: string; category: string }>;
  scholarships: Array<{
    id: number;
    name: string;
    country: string;
    fundingType: string;
    applicationDeadline: string | null;
  }>;
  statusChart: Array<{ status: string; count: number }>;
  missingDocuments: string[];
  recentActivity: Array<{ id: string; type: string; description: string; timestamp: string }>;
}

export function DashboardPage() {
  const { dbUser, profile } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => apiFetch<DashboardData>('/api/dashboard'),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white animate-pulse dark:border-slate-800 dark:bg-slate-900" />
          ))}
        </div>
        <div className="h-72 rounded-xl border border-slate-200 bg-white animate-pulse dark:border-slate-800 dark:bg-slate-900" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-red-600">
          Unable to load dashboard analytics. Please try refreshing.
        </CardContent>
      </Card>
    );
  }

  const statCards = [
    { label: 'Shortlisted Items', value: data.stats.shortlistedCount, link: '/shortlist' },
    { label: 'In Progress', value: data.stats.inProgressCount, link: '/applications' },
    { label: 'Submitted', value: data.stats.submittedCount, link: '/applications' },
    { label: 'Upcoming Deadlines', value: data.stats.upcomingDeadlinesCount, link: '/calendar' },
    { label: 'Eligible Programmes', value: data.stats.eligibleProgrammesCount, link: '/eligibility' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F2942] dark:text-white">
            Welcome back, {profile?.fullName || dbUser?.fullName || 'Applicant'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {profile?.desiredDegreeLevel
              ? `Targeting ${profile.desiredDegreeLevel} programmes · Preferred intake ${profile.preferredIntake || 'Upcoming'}`
              : 'Complete your academic profile to unlock personalized eligibility matches.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/profile">
            <Button variant="outline" size="sm">Edit Profile</Button>
          </Link>
          <Link to="/universities">
            <Button size="sm">Find Universities</Button>
          </Link>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((s) => (
          <Link
            key={s.label}
            to={s.link}
            className="rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-600/50 transition-colors dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{s.label}</p>
            <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-[#0F2942] dark:text-white">
              {s.value}
            </p>
          </Link>
        ))}
      </div>

      {/* Application Progress Chart & AI/Profile Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Application Progress by Status</CardTitle>
            <CardDescription>Live distribution across your tracked applications</CardDescription>
          </CardHeader>
          <CardContent>
            {data.statusChart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No applications tracked yet. Explore universities to start your first application.
                </p>
                <Link to="/universities" className="mt-4">
                  <Button size="sm" variant="outline">Browse Universities</Button>
                </Link>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.statusChart} margin={{ top: 8, right: 16, left: -12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#1E40AF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Next Actions &amp; AI Guidance</CardTitle>
            <CardDescription>Prioritized from your profile, deadlines, and missing files</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2.5 text-sm">
              {(!profile?.cgpa || !profile?.ieltsOverall) && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Complete CGPA and IELTS bands</p>
                    <p className="text-xs opacity-90 mt-0.5">
                      Required for deterministic eligibility matching across programmes.
                    </p>
                  </div>
                </div>
              )}

              {data.missingDocuments.length > 0 && (
                <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    <FileWarning className="h-4 w-4 text-amber-600" />
                    <span>Missing Core Documents ({data.missingDocuments.length})</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {data.missingDocuments.join(' · ')}
                  </p>
                  <Link to="/documents" className="mt-2 inline-block text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
                    Upload in Document Manager →
                  </Link>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Ask the AI Study Abroad Assistant
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Generate a tailored document checklist or ask about Chevening, DAAD, or programme cutoffs.
                </p>
                <Link to="/assistant" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
                  <span>Open AI Assistant</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommended Programmes + Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recommended Programmes</CardTitle>
              <CardDescription>Ranked using your degree preferences and eligibility evaluation</CardDescription>
            </div>
            <Link to="/universities" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {data.recommendedProgrammes.map((item) => (
                <div key={item.programme.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <Link
                      to={`/programmes/${item.programme.id}`}
                      className="text-sm font-semibold text-slate-900 hover:text-blue-700 dark:text-slate-100 dark:hover:text-blue-400"
                    >
                      {item.programme.name}
                    </Link>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.university.name} · {item.university.country} · {formatCurrency(item.programme.tuitionFee, item.programme.currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium ${
                        item.eligibilityStatus === 'meets_requirements'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : item.eligibilityStatus === 'does_not_meet'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {item.eligibilityStatus === 'meets_requirements' ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                      <span>{item.eligibilityLabel}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming Deadlines</CardTitle>
              <CardDescription>Application dates &amp; personal reminders</CardDescription>
            </div>
            <Link to="/calendar" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
              Calendar
            </Link>
          </CardHeader>
          <CardContent>
            {data.upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                No upcoming reminders yet. Add custom reminders or start an application to track deadlines.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.upcomingDeadlines.map((d) => (
                  <div key={d.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="truncate font-medium">{d.title}</span>
                    </div>
                    <span className="font-mono text-xs tabular-nums text-slate-500 shrink-0">
                      {formatDate(d.date)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scholarships, Recently Viewed & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Scholarship Opportunities</CardTitle>
            <Link to="/scholarships" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
              Explore
            </Link>
          </CardHeader>
          <CardContent className="divide-y divide-slate-200 dark:divide-slate-800">
            {data.scholarships.map((s) => (
              <Link
                key={s.id}
                to={`/scholarships/${s.id}`}
                className="block py-2.5 hover:opacity-80"
              >
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{s.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {s.country} · {s.fundingType === 'full' ? 'Full Funding' : 'Partial Funding'} · Due {s.applicationDeadline || 'See official site'}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently Viewed Universities</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentlyViewed.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Universities you inspect will appear here for quick access.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.recentlyViewed.map((u) => (
                  <Link
                    key={u.id}
                    to={`/universities/${u.id}`}
                    className="block py-2.5 hover:opacity-80"
                  >
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{u.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {u.city}, {u.country}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Your shortlist saves, document uploads, and application updates appear here.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.recentActivity.map((act) => (
                  <div key={act.id} className="py-2.5">
                    <p className="text-sm text-slate-800 dark:text-slate-200">{act.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(act.timestamp)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
