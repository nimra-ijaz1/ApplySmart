import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Plus,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { CsvImportUtility } from '../../components/admin/CsvImportUtility.tsx';
import { Button } from '../../components/ui/button.tsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card.tsx';
import { Dialog } from '../../components/ui/dialog.tsx';
import { Input, Label, Select, Textarea } from '../../components/ui/input.tsx';
import { formatCurrency, formatDate } from '../../lib/utils.ts';

type AdminTab =
  | 'overview'
  | 'catalog'
  | 'import'
  | 'scholarships'
  | 'verification'
  | 'users'
  | 'audit'
  | 'settings';

interface AdminOverview {
  stats: {
    totalUsers: number;
    totalUniversities: number;
    totalProgrammes: number;
    totalScholarships: number;
    totalApplications: number;
    pendingVerificationCount: number;
  };
}

interface UniRecord {
  id: number;
  name: string;
  country: string;
  city: string;
  institutionType: string;
  globalRanking: number | null;
  officialWebsite: string;
  verificationStatus: string;
  lastVerifiedDate: string;
}

interface ProgRecord {
  id: number;
  universityId: number;
  name: string;
  degreeLevel: string;
  subjectArea: string;
  tuitionFee: number;
  currency: string;
  applicationDeadline: string | null;
  intake: string;
  university: { id: number; name: string; country: string };
}

interface SchRecord {
  id: number;
  name: string;
  provider: string;
  country: string;
  fundingType: 'full' | 'partial';
  tuitionCoverage: string;
  applicationDeadline: string | null;
  lastVerifiedDate: string;
}

interface VerificationItem {
  entityType: 'university' | 'programme' | 'scholarship';
  entityId: number;
  title: string;
  subtitle: string;
  sourceUrl: string;
  lastVerifiedDate: string;
  verificationStatus: 'verified' | 'pending_verification' | 'outdated';
  isDemoRecord: boolean;
}

interface UserRecord {
  id: number;
  uid: string;
  email: string;
  fullName: string | null;
  role: 'student' | 'admin' | 'super_admin';
  isActive: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
}

interface AuditLogRecord {
  id: number;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: number | null;
  details: Record<string, unknown>;
  createdAt: string;
}

interface SystemSettingRecord {
  id: number;
  key: string;
  value: Record<string, unknown>;
  updatedAt: string;
}

export function AdminDashboardPage() {
  const { dbUser } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = dbUser?.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [uniModalOpen, setUniModalOpen] = useState(false);
  const [progModalOpen, setProgModalOpen] = useState(false);
  const [schModalOpen, setSchModalOpen] = useState(false);
  const [verificationFilter, setVerificationFilter] = useState<string>('all');

  const today = new Date().toISOString().slice(0, 10);

  // Forms state
  const [uniForm, setUniForm] = useState({
    name: '',
    country: '',
    city: '',
    officialWebsite: '',
    description: '',
    institutionType: 'Public' as 'Public' | 'Private',
    globalRanking: '',
    contactEmail: '',
    sourceUrl: '',
    lastVerifiedDate: today,
  });

  const [progForm, setProgForm] = useState({
    universityId: '',
    name: '',
    degreeLevel: "Master's" as "Bachelor's" | "Master's" | 'PhD',
    subjectArea: '',
    description: '',
    duration: '2 years',
    studyLanguage: 'English',
    tuitionFee: '0',
    currency: 'EUR',
    tuitionFeeUsdApprox: '0',
    applicationFee: '0',
    applicationDeadline: '',
    intake: 'Fall 2026',
    scholarshipAvailability: true,
    officialProgrammeUrl: '',
    sourceUrl: '',
    lastVerifiedDate: today,
    minCgpa: '3.0',
    cgpaScale: '4.0',
    requiredDegreeBackground: "4-year Bachelor's degree in a related discipline",
    acceptedDegreeFields: 'Computer Science, Software Engineering',
    ieltsOverall: '6.5',
    ieltsListening: '6.0',
    ieltsReading: '6.0',
    ieltsWriting: '6.0',
    ieltsSpeaking: '6.0',
    toeflMin: '88',
    requiredDocuments: 'Academic Transcripts, Degree Certificate, CV, Statement of Purpose, 2 Recommendation Letters',
  });

  const [schForm, setSchForm] = useState({
    name: '',
    provider: '',
    country: '',
    fundingType: 'full' as 'full' | 'partial',
    fundingPercentage: '100',
    tuitionCoverage: '100% Tuition Waiver',
    monthlyStipend: '',
    travelAllowance: '',
    accommodationCoverage: '',
    eligibilityRequirements: '',
    applicationOpeningDate: '',
    applicationDeadline: '',
    officialUrl: '',
    sourceUrl: '',
    lastVerifiedDate: today,
    eligibleNationalities: 'Pakistan, All Developing Countries',
    eligibleDegreeLevels: "Master's, PhD",
  });

  const [aiModelConfig, setAiModelConfig] = useState({
    maxContextMessages: 12,
    strictGroundingMode: true,
    defaultTargetCountry: 'Germany',
  });

  // Queries
  const { data: overview } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => apiFetch<AdminOverview>('/api/admin/overview'),
  });

  const { data: unisData } = useQuery({
    queryKey: ['admin-universities'],
    queryFn: () => apiFetch<{ items: UniRecord[] }>('/api/universities?limit=100'),
  });

  const { data: progsData } = useQuery({
    queryKey: ['admin-programmes'],
    queryFn: () => apiFetch<{ items: ProgRecord[] }>('/api/programmes'),
  });

  const { data: schsData } = useQuery({
    queryKey: ['admin-scholarships'],
    queryFn: () => apiFetch<{ items: SchRecord[] }>('/api/scholarships'),
  });

  const { data: verifData } = useQuery({
    queryKey: ['admin-verification'],
    queryFn: () => apiFetch<{ items: VerificationItem[] }>('/api/admin/verification'),
    enabled: activeTab === 'verification',
  });

  const { data: usersData } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiFetch<{ items: UserRecord[] }>('/api/admin/users'),
    enabled: activeTab === 'users',
  });

  const { data: auditData } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => apiFetch<{ items: AuditLogRecord[] }>('/api/admin/audit-logs'),
    enabled: activeTab === 'audit' && isSuperAdmin,
  });

  const { data: settingsData } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => apiFetch<{ items: SystemSettingRecord[] }>('/api/admin/settings'),
    enabled: activeTab === 'settings' && isSuperAdmin,
  });

  // Mutations
  const invalidateCatalog = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    queryClient.invalidateQueries({ queryKey: ['admin-universities'] });
    queryClient.invalidateQueries({ queryKey: ['admin-programmes'] });
    queryClient.invalidateQueries({ queryKey: ['admin-scholarships'] });
    queryClient.invalidateQueries({ queryKey: ['admin-verification'] });
    queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    queryClient.invalidateQueries({ queryKey: ['public-stats'] });
  };

  const createUniMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/admin/universities', {
        method: 'POST',
        body: JSON.stringify({
          ...uniForm,
          globalRanking: uniForm.globalRanking ? Number(uniForm.globalRanking) : null,
          contactEmail: uniForm.contactEmail || null,
          sourceUrl: uniForm.sourceUrl || uniForm.officialWebsite,
        }),
      }),
    onSuccess: () => {
      invalidateCatalog();
      setUniModalOpen(false);
      toast.success('University added to catalog.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteUniMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/universities/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateCatalog();
      toast.success('University removed.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createProgMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/admin/programmes', {
        method: 'POST',
        body: JSON.stringify({
          universityId: Number(progForm.universityId),
          name: progForm.name,
          degreeLevel: progForm.degreeLevel,
          subjectArea: progForm.subjectArea,
          description: progForm.description,
          duration: progForm.duration,
          studyLanguage: progForm.studyLanguage,
          tuitionFee: Number(progForm.tuitionFee || 0),
          currency: progForm.currency,
          tuitionFeeUsdApprox: Number(progForm.tuitionFeeUsdApprox || 0),
          applicationFee: Number(progForm.applicationFee || 0),
          applicationDeadline: progForm.applicationDeadline || null,
          intake: progForm.intake,
          scholarshipAvailability: progForm.scholarshipAvailability,
          officialProgrammeUrl: progForm.officialProgrammeUrl,
          sourceUrl: progForm.sourceUrl || progForm.officialProgrammeUrl,
          lastVerifiedDate: progForm.lastVerifiedDate,
          minCgpa: progForm.minCgpa ? Number(progForm.minCgpa) : null,
          cgpaScale: progForm.cgpaScale ? Number(progForm.cgpaScale) : 4.0,
          requiredDegreeBackground: progForm.requiredDegreeBackground,
          acceptedDegreeFields: progForm.acceptedDegreeFields
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          ieltsOverall: progForm.ieltsOverall ? Number(progForm.ieltsOverall) : null,
          ieltsListening: progForm.ieltsListening ? Number(progForm.ieltsListening) : null,
          ieltsReading: progForm.ieltsReading ? Number(progForm.ieltsReading) : null,
          ieltsWriting: progForm.ieltsWriting ? Number(progForm.ieltsWriting) : null,
          ieltsSpeaking: progForm.ieltsSpeaking ? Number(progForm.ieltsSpeaking) : null,
          toeflMin: progForm.toeflMin ? Number(progForm.toeflMin) : null,
          requiredDocuments: progForm.requiredDocuments
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: () => {
      invalidateCatalog();
      setProgModalOpen(false);
      toast.success('Programme and entry requirements created.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteProgMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/programmes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateCatalog();
      toast.success('Programme deleted.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createSchMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/admin/scholarships', {
        method: 'POST',
        body: JSON.stringify({
          name: schForm.name,
          provider: schForm.provider,
          country: schForm.country,
          fundingType: schForm.fundingType,
          fundingPercentage: schForm.fundingPercentage ? Number(schForm.fundingPercentage) : null,
          tuitionCoverage: schForm.tuitionCoverage,
          monthlyStipend: schForm.monthlyStipend || null,
          travelAllowance: schForm.travelAllowance || null,
          accommodationCoverage: schForm.accommodationCoverage || null,
          eligibilityRequirements: schForm.eligibilityRequirements,
          applicationOpeningDate: schForm.applicationOpeningDate || null,
          applicationDeadline: schForm.applicationDeadline || null,
          officialUrl: schForm.officialUrl,
          sourceUrl: schForm.sourceUrl || schForm.officialUrl,
          lastVerifiedDate: schForm.lastVerifiedDate,
          eligibleNationalities: schForm.eligibleNationalities
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          eligibleDegreeLevels: schForm.eligibleDegreeLevels
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: () => {
      invalidateCatalog();
      setSchModalOpen(false);
      toast.success('Scholarship added.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteSchMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/scholarships/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateCatalog();
      toast.success('Scholarship deleted.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const verifyMutation = useMutation({
    mutationFn: (payload: {
      entityType: string;
      entityId: number;
      verificationStatus: 'verified' | 'pending_verification' | 'outdated';
    }) =>
      apiFetch(`/api/admin/verification/${payload.entityType}/${payload.entityId}`, {
        method: 'PUT',
        body: JSON.stringify({
          verificationStatus: payload.verificationStatus,
          lastVerifiedDate: today,
        }),
      }),
    onSuccess: () => {
      invalidateCatalog();
      toast.success('Verification status updated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateUserMutation = useMutation({
    mutationFn: (payload: { id: number; role?: UserRecord['role']; isActive?: boolean }) =>
      apiFetch(`/api/admin/users/${payload.id}`, {
        method: 'PUT',
        body: JSON.stringify({ role: payload.role, isActive: payload.isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast.success('User permissions updated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          key: 'ai_assistant_config',
          value: aiModelConfig,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast.success('Platform settings saved.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const tabs: Array<{ id: AdminTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'catalog', label: 'Universities & Programmes' },
    { id: 'import', label: 'CSV Bulk Import' },
    { id: 'scholarships', label: 'Scholarships' },
    { id: 'verification', label: 'Verification Queue' },
    { id: 'users', label: 'Users & Roles' },
    ...(isSuperAdmin ? [{ id: 'audit' as AdminTab, label: 'Audit Logs' }] : []),
    ...(isSuperAdmin ? [{ id: 'settings' as AdminTab, label: 'System Settings' }] : []),
  ];

  const verificationItems = (verifData?.items ?? []).filter((item) =>
    verificationFilter === 'all' ? true : item.verificationStatus === verificationFilter
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2942] dark:text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <span>Administration Console</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Signed in as {dbUser?.email} · Access Tier:{' '}
            <span className="font-medium text-slate-900 dark:text-slate-200">
              {isSuperAdmin ? 'Super Administrator' : 'Administrator'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setActiveTab('import')}>
            <Upload className="h-4 w-4" />
            <span>Import CSV</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setUniModalOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>Add University</span>
          </Button>
          <Button size="sm" onClick={() => setProgModalOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>Add Programme</span>
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              activeTab === tab.id
                ? 'bg-[#0F2942] text-white dark:bg-blue-600'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Users', value: overview?.stats.totalUsers ?? 0 },
              { label: 'Universities', value: overview?.stats.totalUniversities ?? 0 },
              { label: 'Programmes', value: overview?.stats.totalProgrammes ?? 0 },
              { label: 'Scholarships', value: overview?.stats.totalScholarships ?? 0 },
              { label: 'Applications', value: overview?.stats.totalApplications ?? 0 },
              {
                label: 'Pending Verification',
                value: overview?.stats.pendingVerificationCount ?? 0,
              },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="pt-5">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {kpi.label}
                  </p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-[#0F2942] dark:text-white mt-2">
                    {kpi.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Catalog Governance</CardTitle>
                <CardDescription>
                  Maintain verified admissions rules, official source URLs, and deadlines.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <p>
                  Every university, programme, and scholarship record carries a source URL and
                  last-verified date so students never rely on unverified claims.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setActiveTab('verification')}>
                    Open Verification Queue
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSchModalOpen(true)}>
                    Add Scholarship
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Access &amp; Compliance</CardTitle>
                <CardDescription>
                  Role-based access control and administrative audit trail.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <p>
                  All catalog writes, verification status changes, and permission updates are
                  recorded in the immutable audit log.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setActiveTab('users')}>
                    Manage Users
                  </Button>
                  {isSuperAdmin && (
                    <Button size="sm" variant="outline" onClick={() => setActiveTab('audit')}>
                      Inspect Audit Logs
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* UNIVERSITIES & PROGRAMMES TAB */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Universities ({unisData?.items.length ?? 0})</CardTitle>
                <CardDescription>Partner and indexed international institutions</CardDescription>
              </div>
              <Button size="sm" onClick={() => setUniModalOpen(true)}>
                <Plus className="h-4 w-4" />
                <span>Add University</span>
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                  <tr>
                    <th className="py-2.5 pr-4">University</th>
                    <th className="py-2.5 pr-4">Location</th>
                    <th className="py-2.5 pr-4">Type</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4">Verified</th>
                    <th className="py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(unisData?.items ?? []).map((uni) => (
                    <tr key={uni.id}>
                      <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-white">
                        {uni.name}
                      </td>
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                        {uni.city}, {uni.country}
                      </td>
                      <td className="py-3 pr-4">{uni.institutionType}</td>
                      <td className="py-3 pr-4 capitalize text-xs">
                        {uni.verificationStatus.replace('_', ' ')}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">{uni.lastVerifiedDate}</td>
                      <td className="py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteUniMutation.mutate(uni.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Degree Programmes ({progsData?.items.length ?? 0})</CardTitle>
                <CardDescription>Tuition, deadlines, and entry rule records</CardDescription>
              </div>
              <Button size="sm" onClick={() => setProgModalOpen(true)}>
                <Plus className="h-4 w-4" />
                <span>Add Programme</span>
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                  <tr>
                    <th className="py-2.5 pr-4">Programme</th>
                    <th className="py-2.5 pr-4">University</th>
                    <th className="py-2.5 pr-4">Level</th>
                    <th className="py-2.5 pr-4">Tuition</th>
                    <th className="py-2.5 pr-4">Deadline</th>
                    <th className="py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(progsData?.items ?? []).map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 pr-4 font-semibold">{p.name}</td>
                      <td className="py-3 pr-4 text-xs text-slate-600 dark:text-slate-300">
                        {p.university?.name}
                      </td>
                      <td className="py-3 pr-4 text-xs">{p.degreeLevel}</td>
                      <td className="py-3 pr-4 font-mono text-xs tabular-nums">
                        {formatCurrency(p.tuitionFee, p.currency)}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">
                        {p.applicationDeadline || 'Rolling'}
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteProgMutation.mutate(p.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CSV BULK IMPORT TAB */}
      {activeTab === 'import' && (
        <CsvImportUtility
          onImportSuccess={invalidateCatalog}
          onNavigateTab={(tab) => setActiveTab(tab)}
        />
      )}

      {/* SCHOLARSHIPS TAB */}
      {activeTab === 'scholarships' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Scholarships ({schsData?.items.length ?? 0})</CardTitle>
              <CardDescription>Government, foundation, and university funding programmes</CardDescription>
            </div>
            <Button size="sm" onClick={() => setSchModalOpen(true)}>
              <Plus className="h-4 w-4" />
              <span>Add Scholarship</span>
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <tr>
                  <th className="py-2.5 pr-4">Scholarship</th>
                  <th className="py-2.5 pr-4">Provider</th>
                  <th className="py-2.5 pr-4">Country</th>
                  <th className="py-2.5 pr-4">Funding</th>
                  <th className="py-2.5 pr-4">Deadline</th>
                  <th className="py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(schsData?.items ?? []).map((sch) => (
                  <tr key={sch.id}>
                    <td className="py-3 pr-4 font-semibold">{sch.name}</td>
                    <td className="py-3 pr-4 text-xs text-slate-600 dark:text-slate-300">
                      {sch.provider}
                    </td>
                    <td className="py-3 pr-4 text-xs">{sch.country}</td>
                    <td className="py-3 pr-4 text-xs capitalize">{sch.fundingType}</td>
                    <td className="py-3 pr-4 font-mono text-xs">
                      {sch.applicationDeadline || 'See portal'}
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteSchMutation.mutate(sch.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* VERIFICATION QUEUE TAB */}
      {activeTab === 'verification' && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle>Data Verification Queue</CardTitle>
              <CardDescription>
                Review source URLs and update verification timestamps across all catalog records.
              </CardDescription>
            </div>
            <Select
              className="w-48"
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="pending_verification">Pending Verification</option>
              <option value="verified">Verified</option>
              <option value="outdated">Outdated</option>
            </Select>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <tr>
                  <th className="py-2.5 pr-4">Record</th>
                  <th className="py-2.5 pr-4">Type</th>
                  <th className="py-2.5 pr-4">Last Verified</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {verificationItems.map((item) => (
                  <tr key={`${item.entityType}-${item.entityId}`}>
                    <td className="py-3 pr-4">
                      <p className="font-semibold">{item.title}</p>
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-700 hover:underline dark:text-blue-400"
                      >
                        {item.sourceUrl}
                      </a>
                    </td>
                    <td className="py-3 pr-4 capitalize text-xs">{item.entityType}</td>
                    <td className="py-3 pr-4 font-mono text-xs">{item.lastVerifiedDate}</td>
                    <td className="py-3 pr-4 capitalize text-xs">
                      {item.verificationStatus.replace('_', ' ')}
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            verifyMutation.mutate({
                              entityType: item.entityType,
                              entityId: item.entityId,
                              verificationStatus: 'verified',
                            })
                          }
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Verify</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            verifyMutation.mutate({
                              entityType: item.entityType,
                              entityId: item.entityId,
                              verificationStatus: 'outdated',
                            })
                          }
                        >
                          Flag Outdated
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* USERS & ROLES TAB */}
      {activeTab === 'users' && (
        <Card>
          <CardHeader>
            <CardTitle>User Accounts &amp; Role Control</CardTitle>
            <CardDescription>
              {isSuperAdmin
                ? 'Super Administrators can promote accounts and toggle account status.'
                : 'Administrators can view accounts and manage active status. Role assignment requires Super Admin.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <tr>
                  <th className="py-2.5 pr-4">User</th>
                  <th className="py-2.5 pr-4">Role</th>
                  <th className="py-2.5 pr-4">Onboarding</th>
                  <th className="py-2.5 pr-4">Account Status</th>
                  <th className="py-2.5 text-right">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(usersData?.items ?? []).map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 pr-4">
                      <p className="font-semibold">{u.fullName || 'Unnamed Account'}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="py-3 pr-4">
                      {isSuperAdmin ? (
                        <Select
                          className="h-8 text-xs w-40"
                          value={u.role}
                          onChange={(e) =>
                            updateUserMutation.mutate({
                              id: u.id,
                              role: e.target.value as UserRecord['role'],
                            })
                          }
                        >
                          <option value="student">Student</option>
                          <option value="admin">Administrator</option>
                          <option value="super_admin">Super Admin</option>
                        </Select>
                      ) : (
                        <span className="capitalize text-xs font-medium">
                          {u.role.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      {u.onboardingCompleted ? 'Completed' : 'Pending'}
                    </td>
                    <td className="py-3 pr-4">
                      <Button
                        size="sm"
                        variant={u.isActive ? 'outline' : 'destructive'}
                        onClick={() =>
                          updateUserMutation.mutate({ id: u.id, isActive: !u.isActive })
                        }
                      >
                        {u.isActive ? 'Active' : 'Suspended'}
                      </Button>
                    </td>
                    <td className="py-3 text-right text-xs text-slate-500">
                      {formatDate(u.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* AUDIT LOGS TAB (SUPER ADMIN ONLY) */}
      {activeTab === 'audit' && isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Administrative Audit Logs</CardTitle>
            <CardDescription>Last 100 catalog, verification, and RBAC actions</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Timestamp</th>
                  <th className="py-2 pr-4">Actor</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Target</th>
                  <th className="py-2">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(auditData?.items ?? []).map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 pr-4 font-mono whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="py-2.5 pr-4">{log.actorEmail}</td>
                    <td className="py-2.5 pr-4 font-semibold">{log.action}</td>
                    <td className="py-2.5 pr-4">
                      {log.entityType}
                      {log.entityId ? ` #${log.entityId}` : ''}
                    </td>
                    <td className="py-2.5 font-mono text-slate-500">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* SYSTEM SETTINGS TAB (SUPER ADMIN ONLY) */}
      {activeTab === 'settings' && isSuperAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>AI &amp; Platform Behaviour Settings</CardTitle>
              <CardDescription>
                Server-side AI grounding policy and student workspace defaults (API keys are
                managed exclusively via server environment secrets).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Max Conversation Context Turns</Label>
                <Input
                  type="number"
                  value={aiModelConfig.maxContextMessages}
                  onChange={(e) =>
                    setAiModelConfig({
                      ...aiModelConfig,
                      maxContextMessages: Number(e.target.value) || 12,
                    })
                  }
                />
              </div>
              <div>
                <Label>Default Target Study Destination</Label>
                <Input
                  value={aiModelConfig.defaultTargetCountry}
                  onChange={(e) =>
                    setAiModelConfig({ ...aiModelConfig, defaultTargetCountry: e.target.value })
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={aiModelConfig.strictGroundingMode}
                  onChange={(e) =>
                    setAiModelConfig({ ...aiModelConfig, strictGroundingMode: e.target.checked })
                  }
                />
                <span>Enforce strict database grounding for AI Assistant responses</span>
              </label>
              <Button
                onClick={() => saveSettingsMutation.mutate()}
                disabled={saveSettingsMutation.isPending}
              >
                {saveSettingsMutation.isPending ? 'Saving...' : 'Save Configuration'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stored System Settings</CardTitle>
              <CardDescription>Persisted configuration keys in PostgreSQL</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {(settingsData?.items ?? []).length === 0 ? (
                <p className="text-slate-500">No custom setting overrides saved yet.</p>
              ) : (
                (settingsData?.items ?? []).map((row) => (
                  <div
                    key={row.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"
                  >
                    <p className="font-semibold text-slate-900 dark:text-white">{row.key}</p>
                    <pre className="mt-1 font-mono text-slate-500 overflow-x-auto">
                      {JSON.stringify(row.value, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ADD UNIVERSITY DIALOG */}
      <Dialog
        open={uniModalOpen}
        onClose={() => setUniModalOpen(false)}
        title="Add University"
        maxWidth="max-w-2xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="sm:col-span-2">
            <Label>University Name</Label>
            <Input
              value={uniForm.name}
              onChange={(e) => setUniForm({ ...uniForm, name: e.target.value })}
              placeholder="e.g., RWTH Aachen University"
            />
          </div>
          <div>
            <Label>Country</Label>
            <Input
              value={uniForm.country}
              onChange={(e) => setUniForm({ ...uniForm, country: e.target.value })}
              placeholder="Germany"
            />
          </div>
          <div>
            <Label>City</Label>
            <Input
              value={uniForm.city}
              onChange={(e) => setUniForm({ ...uniForm, city: e.target.value })}
              placeholder="Aachen"
            />
          </div>
          <div>
            <Label>Official Website URL</Label>
            <Input
              value={uniForm.officialWebsite}
              onChange={(e) => setUniForm({ ...uniForm, officialWebsite: e.target.value })}
              placeholder="https://www.rwth-aachen.de"
            />
          </div>
          <div>
            <Label>Source Verification URL</Label>
            <Input
              value={uniForm.sourceUrl}
              onChange={(e) => setUniForm({ ...uniForm, sourceUrl: e.target.value })}
              placeholder="https://www.rwth-aachen.de/admissions"
            />
          </div>
          <div>
            <Label>Institution Type</Label>
            <Select
              value={uniForm.institutionType}
              onChange={(e) =>
                setUniForm({
                  ...uniForm,
                  institutionType: e.target.value as 'Public' | 'Private',
                })
              }
            >
              <option value="Public">Public</option>
              <option value="Private">Private</option>
            </Select>
          </div>
          <div>
            <Label>Global Ranking (optional)</Label>
            <Input
              type="number"
              value={uniForm.globalRanking}
              onChange={(e) => setUniForm({ ...uniForm, globalRanking: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={uniForm.description}
              onChange={(e) => setUniForm({ ...uniForm, description: e.target.value })}
              placeholder="Concise institutional summary..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={() => setUniModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => createUniMutation.mutate()} disabled={createUniMutation.isPending}>
            Save University
          </Button>
        </div>
      </Dialog>

      {/* ADD PROGRAMME DIALOG */}
      <Dialog
        open={progModalOpen}
        onClose={() => setProgModalOpen(false)}
        title="Add Degree Programme & Entry Rules"
        maxWidth="max-w-3xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="sm:col-span-2">
            <Label>University</Label>
            <Select
              value={progForm.universityId}
              onChange={(e) => setProgForm({ ...progForm, universityId: e.target.value })}
            >
              <option value="">Select university...</option>
              {(unisData?.items ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.country})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Programme Name</Label>
            <Input
              value={progForm.name}
              onChange={(e) => setProgForm({ ...progForm, name: e.target.value })}
              placeholder="MSc Data Science"
            />
          </div>
          <div>
            <Label>Degree Level</Label>
            <Select
              value={progForm.degreeLevel}
              onChange={(e) =>
                setProgForm({
                  ...progForm,
                  degreeLevel: e.target.value as "Bachelor's" | "Master's" | 'PhD',
                })
              }
            >
              <option value="Bachelor's">Bachelor's</option>
              <option value="Master's">Master's</option>
              <option value="PhD">PhD</option>
            </Select>
          </div>
          <div>
            <Label>Subject Area</Label>
            <Input
              value={progForm.subjectArea}
              onChange={(e) => setProgForm({ ...progForm, subjectArea: e.target.value })}
              placeholder="Computer Science"
            />
          </div>
          <div>
            <Label>Duration &amp; Intake</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={progForm.duration}
                onChange={(e) => setProgForm({ ...progForm, duration: e.target.value })}
                placeholder="2 years"
              />
              <Input
                value={progForm.intake}
                onChange={(e) => setProgForm({ ...progForm, intake: e.target.value })}
                placeholder="Fall 2026"
              />
            </div>
          </div>
          <div>
            <Label>Tuition Fee &amp; Currency</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                value={progForm.tuitionFee}
                onChange={(e) => setProgForm({ ...progForm, tuitionFee: e.target.value })}
              />
              <Input
                value={progForm.currency}
                onChange={(e) => setProgForm({ ...progForm, currency: e.target.value })}
                placeholder="EUR"
              />
            </div>
          </div>
          <div>
            <Label>Approx Tuition USD &amp; Deadline</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                value={progForm.tuitionFeeUsdApprox}
                onChange={(e) =>
                  setProgForm({ ...progForm, tuitionFeeUsdApprox: e.target.value })
                }
              />
              <Input
                type="date"
                value={progForm.applicationDeadline}
                onChange={(e) =>
                  setProgForm({ ...progForm, applicationDeadline: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <Label>Min CGPA &amp; Scale</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={progForm.minCgpa}
                onChange={(e) => setProgForm({ ...progForm, minCgpa: e.target.value })}
              />
              <Input
                value={progForm.cgpaScale}
                onChange={(e) => setProgForm({ ...progForm, cgpaScale: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>IELTS Overall &amp; TOEFL Min</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={progForm.ieltsOverall}
                onChange={(e) => setProgForm({ ...progForm, ieltsOverall: e.target.value })}
              />
              <Input
                value={progForm.toeflMin}
                onChange={(e) => setProgForm({ ...progForm, toeflMin: e.target.value })}
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label>Official Programme URL</Label>
            <Input
              value={progForm.officialProgrammeUrl}
              onChange={(e) => setProgForm({ ...progForm, officialProgrammeUrl: e.target.value })}
              placeholder="https://university.edu/programmes/msc-cs"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Required Degree Background</Label>
            <Input
              value={progForm.requiredDegreeBackground}
              onChange={(e) =>
                setProgForm({ ...progForm, requiredDegreeBackground: e.target.value })
              }
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={progForm.description}
              onChange={(e) => setProgForm({ ...progForm, description: e.target.value })}
              placeholder="Curriculum focus, research tracks, and admissions notes..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={() => setProgModalOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createProgMutation.mutate()}
            disabled={!progForm.universityId || createProgMutation.isPending}
          >
            Create Programme
          </Button>
        </div>
      </Dialog>

      {/* ADD SCHOLARSHIP DIALOG */}
      <Dialog
        open={schModalOpen}
        onClose={() => setSchModalOpen(false)}
        title="Add Scholarship"
        maxWidth="max-w-2xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="sm:col-span-2">
            <Label>Scholarship Name</Label>
            <Input
              value={schForm.name}
              onChange={(e) => setSchForm({ ...schForm, name: e.target.value })}
              placeholder="Commonwealth Master's Scholarship"
            />
          </div>
          <div>
            <Label>Provider</Label>
            <Input
              value={schForm.provider}
              onChange={(e) => setSchForm({ ...schForm, provider: e.target.value })}
              placeholder="CSC UK"
            />
          </div>
          <div>
            <Label>Country</Label>
            <Input
              value={schForm.country}
              onChange={(e) => setSchForm({ ...schForm, country: e.target.value })}
              placeholder="United Kingdom"
            />
          </div>
          <div>
            <Label>Funding Type</Label>
            <Select
              value={schForm.fundingType}
              onChange={(e) =>
                setSchForm({ ...schForm, fundingType: e.target.value as 'full' | 'partial' })
              }
            >
              <option value="full">Full Funding</option>
              <option value="partial">Partial Funding</option>
            </Select>
          </div>
          <div>
            <Label>Application Deadline</Label>
            <Input
              type="date"
              value={schForm.applicationDeadline}
              onChange={(e) => setSchForm({ ...schForm, applicationDeadline: e.target.value })}
            />
          </div>
          <div>
            <Label>Tuition Coverage</Label>
            <Input
              value={schForm.tuitionCoverage}
              onChange={(e) => setSchForm({ ...schForm, tuitionCoverage: e.target.value })}
            />
          </div>
          <div>
            <Label>Monthly Stipend</Label>
            <Input
              value={schForm.monthlyStipend}
              onChange={(e) => setSchForm({ ...schForm, monthlyStipend: e.target.value })}
              placeholder="£1,378 / month"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Official URL</Label>
            <Input
              value={schForm.officialUrl}
              onChange={(e) => setSchForm({ ...schForm, officialUrl: e.target.value })}
              placeholder="https://cscuk.fcdo.gov.uk"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Eligibility Requirements</Label>
            <Textarea
              value={schForm.eligibilityRequirements}
              onChange={(e) =>
                setSchForm({ ...schForm, eligibilityRequirements: e.target.value })
              }
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={() => setSchModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => createSchMutation.mutate()} disabled={createSchMutation.isPending}>
            Save Scholarship
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
