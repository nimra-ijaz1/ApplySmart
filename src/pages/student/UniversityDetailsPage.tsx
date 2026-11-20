import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, CheckCircle2, ExternalLink, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { Button } from '../../components/ui/button.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { formatCurrency } from '../../lib/utils.ts';

interface UniversityDetailsResponse {
  university: {
    id: number;
    name: string;
    country: string;
    city: string;
    officialWebsite: string;
    description: string;
    institutionType: string;
    globalRanking: number | null;
    contactEmail: string | null;
    sourceUrl: string;
    lastVerifiedDate: string;
    verificationStatus: string;
    isDemoRecord: boolean;
  };
  programmes: Array<{
    id: number;
    name: string;
    degreeLevel: string;
    subjectArea: string;
    description: string;
    duration: string;
    studyLanguage: string;
    tuitionFee: number;
    currency: string;
    applicationFee: number;
    applicationOpeningDate: string | null;
    applicationDeadline: string | null;
    intake: string;
    scholarshipAvailability: boolean;
    officialProgrammeUrl: string;
    sourceUrl: string;
    lastVerifiedDate: string;
    requirements: {
      minCgpa: string | null;
      cgpaScale: string | null;
      minPercentage: string | null;
      requiredDegreeBackground: string;
      ieltsOverall: string | null;
      ieltsListening: string | null;
      ieltsReading: string | null;
      ieltsWriting: string | null;
      ieltsSpeaking: string | null;
      toeflMin: number | null;
      requiredDocuments: string[];
      gpaConversionNote: string | null;
      additionalConditions: string | null;
    } | null;
  }>;
}

const TABS = [
  'Overview',
  'Programmes',
  'Admission Requirements',
  'Tuition Fees',
  'Scholarships',
  'Application Deadlines',
  'Required Documents',
  'Official Links',
] as const;

export function UniversityDetailsPage() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Overview');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['university-details', id],
    queryFn: () => apiFetch<UniversityDetailsResponse>(`/api/universities/${id}`),
  });

  const shortlistMutation = useMutation({
    mutationFn: (payload: { itemType: 'university' | 'programme'; universityId?: number; programmeId?: number }) =>
      apiFetch<{ alreadySaved?: boolean }>('/api/shortlist', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['shortlist'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      toast.success(res.alreadySaved ? 'Already in your shortlist.' : 'Added to shortlist.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const startAppMutation = useMutation({
    mutationFn: (payload: { universityId: number; programmeId: number }) =>
      apiFetch('/api/applications', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success('Application created in tracker.');
      navigate('/applications');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !data) {
    return <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse dark:border-slate-800 dark:bg-slate-900" />;
  }

  const { university, programmes } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <Link to="/universities" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
            ← Back to Universities
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-[#0F2942] dark:text-white">
            {university.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {university.city}, {university.country} · {university.institutionType}
            {university.globalRanking ? ` · Global Rank #${university.globalRanking}` : ''}
            · Verified {university.lastVerifiedDate}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => shortlistMutation.mutate({ itemType: 'university', universityId: university.id })}
          >
            <Bookmark className="h-4 w-4" />
            <span>Shortlist University</span>
          </Button>
          <a href={university.officialWebsite} target="_blank" rel="noreferrer">
            <Button>
              <span>Official Website</span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </div>

      {/* 8 Structured Sections Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              activeTab === tab
                ? 'bg-[#0F2942] text-white dark:bg-blue-600'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <Card>
          <CardHeader>
            <CardTitle>Institutional Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            <p>{university.description}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-xs text-slate-500">Classification</p>
                <p className="font-semibold mt-0.5">{university.institutionType} University</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Admissions Contact</p>
                <p className="font-semibold mt-0.5">{university.contactEmail || 'See official portal'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Verification Status</p>
                <p className="font-semibold mt-0.5 capitalize">{university.verificationStatus.replace('_', ' ')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'Programmes' && (
        <div className="space-y-4">
          {programmes.map((p) => (
            <Card key={p.id}>
              <CardContent className="pt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <Link to={`/programmes/${p.id}`} className="text-lg font-semibold text-[#0F2942] hover:underline dark:text-white">
                    {p.name}
                  </Link>
                  <p className="text-xs text-slate-500 mt-1">
                    {p.degreeLevel} · {p.subjectArea} · {p.duration} · {p.studyLanguage}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{p.description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Link to={`/eligibility?programmeId=${p.id}`}>
                    <Button size="sm" variant="primary">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Check Eligibility</span>
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startAppMutation.mutate({ universityId: university.id, programmeId: p.id })}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Track Application</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => shortlistMutation.mutate({ itemType: 'programme', universityId: university.id, programmeId: p.id })}
                  >
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'Admission Requirements' && (
        <div className="space-y-4">
          {programmes.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="text-base">{p.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p><strong>Degree Background:</strong> {p.requirements?.requiredDegreeBackground}</p>
                <p>
                  <strong>Minimum Grade:</strong>{' '}
                  {p.requirements?.minCgpa ? `${p.requirements.minCgpa} / ${p.requirements.cgpaScale}` : `${p.requirements?.minPercentage}%`}
                </p>
                <p>
                  <strong>English Requirement:</strong>{' '}
                  IELTS {p.requirements?.ieltsOverall ?? 'N/A'}
                  {p.requirements?.ieltsWriting ? ` (L:${p.requirements.ieltsListening} R:${p.requirements.ieltsReading} W:${p.requirements.ieltsWriting} S:${p.requirements.ieltsSpeaking})` : ''}
                  {p.requirements?.toeflMin ? ` · TOEFL ${p.requirements.toeflMin}` : ''}
                </p>
                {p.requirements?.gpaConversionNote && (
                  <p className="text-xs text-slate-500">Note: {p.requirements.gpaConversionNote}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'Tuition Fees' && (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <tr>
                  <th className="py-2">Programme</th>
                  <th className="py-2">Tuition Fee</th>
                  <th className="py-2">Application Fee</th>
                  <th className="py-2">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {programmes.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 font-medium">{p.name}</td>
                    <td className="py-3 font-mono tabular-nums">{formatCurrency(p.tuitionFee, p.currency)}</td>
                    <td className="py-3 font-mono tabular-nums">{formatCurrency(p.applicationFee, p.currency)}</td>
                    <td className="py-3">{p.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'Scholarships' && (
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm">
            <p className="text-slate-600 dark:text-slate-400">
              {programmes.filter((p) => p.scholarshipAvailability).length} of {programmes.length} listed programmes at {university.name} report institutional or national scholarship pathways.
            </p>
            <Link to="/scholarships">
              <Button size="sm" variant="outline">Browse Verified Scholarships in {university.country}</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {activeTab === 'Application Deadlines' && (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <tr>
                  <th className="py-2">Programme</th>
                  <th className="py-2">Intake</th>
                  <th className="py-2">Opening Date</th>
                  <th className="py-2">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {programmes.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 font-medium">{p.name}</td>
                    <td className="py-3">{p.intake}</td>
                    <td className="py-3 font-mono tabular-nums">{p.applicationOpeningDate || 'See portal'}</td>
                    <td className="py-3 font-mono tabular-nums font-medium">{p.applicationDeadline || 'Rolling'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'Required Documents' && (
        <div className="space-y-4">
          {programmes.map((p) => (
            <Card key={p.id}>
              <CardHeader><CardTitle className="text-base">{p.name}</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 text-sm space-y-1 text-slate-700 dark:text-slate-300">
                  {(p.requirements?.requiredDocuments ?? []).map((doc) => (
                    <li key={doc}>{doc}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'Official Links' && (
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm">
            <p>
              <strong>Official University Portal:</strong>{' '}
              <a href={university.officialWebsite} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline dark:text-blue-400">
                {university.officialWebsite}
              </a>
            </p>
            <p>
              <strong>Verification Source URL:</strong>{' '}
              <a href={university.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline dark:text-blue-400">
                {university.sourceUrl}
              </a>
            </p>
            {programmes.map((p) => (
              <p key={p.id}>
                <strong>{p.name}:</strong>{' '}
                <a href={p.officialProgrammeUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline dark:text-blue-400">
                  {p.officialProgrammeUrl}
                </a>
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function ProgrammeDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { compareIds, toggleCompareProgramme } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['programme-details', id],
    queryFn: () => apiFetch<{ programme: any; university: any; requirements: any }>(`/api/programmes/${id}`),
  });

  const createAppMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/applications', {
        method: 'POST',
        body: JSON.stringify({ universityId: data!.university.id, programmeId: data!.programme.id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success('Application added to tracker.');
      navigate('/applications');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !data) {
    return <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse dark:border-slate-800 dark:bg-slate-900" />;
  }

  const { programme, university, requirements } = data;
  const inCompare = compareIds.includes(programme.id);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link to={`/universities/${university.id}`} className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
          ← {university.name}
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-[#0F2942] dark:text-white">{programme.name}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {university.name} · {university.country} · {programme.degreeLevel} · {programme.duration} · Verified {programme.lastVerifiedDate}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link to={`/eligibility?programmeId=${programme.id}`}>
          <Button>Check My Eligibility</Button>
        </Link>
        <Button variant="outline" onClick={() => createAppMutation.mutate()}>
          Track Application
        </Button>
        <Button variant={inCompare ? 'primary' : 'outline'} onClick={() => toggleCompareProgramme(programme.id)}>
          {inCompare ? 'Added to Compare' : 'Add to Compare'}
        </Button>
        <a href={programme.officialProgrammeUrl} target="_blank" rel="noreferrer">
          <Button variant="ghost">
            <span>Official Page</span>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Programme Overview &amp; Fees</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-slate-700 dark:text-slate-300">{programme.description}</p>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <p><strong>Tuition Fee:</strong> <span className="font-mono">{formatCurrency(programme.tuitionFee, programme.currency)}</span></p>
              <p><strong>Application Fee:</strong> <span className="font-mono">{formatCurrency(programme.applicationFee, programme.currency)}</span></p>
              <p><strong>Intake:</strong> {programme.intake}</p>
              <p><strong>Application Deadline:</strong> <span className="font-mono">{programme.applicationDeadline || 'Rolling'}</span></p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Verified Entry Requirements</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <p><strong>Required Background:</strong> {requirements?.requiredDegreeBackground}</p>
            <p><strong>Minimum CGPA:</strong> <span className="font-mono">{requirements?.minCgpa ? `${requirements.minCgpa}/${requirements.cgpaScale}` : `${requirements?.minPercentage}%`}</span></p>
            <p><strong>IELTS Overall:</strong> <span className="font-mono">{requirements?.ieltsOverall ?? 'N/A'}</span></p>
            {requirements?.ieltsWriting && (
              <p className="text-xs text-slate-500">
                Module Minimums — Listening: {requirements.ieltsListening}, Reading: {requirements.ieltsReading}, Writing: {requirements.ieltsWriting}, Speaking: {requirements.ieltsSpeaking}
              </p>
            )}
            <p><strong>TOEFL Minimum:</strong> <span className="font-mono">{requirements?.toeflMin ?? 'N/A'}</span></p>
            {requirements?.prerequisiteSubjects?.length > 0 && (
              <p><strong>Prerequisites:</strong> {requirements.prerequisiteSubjects.join(', ')}</p>
            )}
            <p className="text-xs text-slate-400 pt-2">
              Source: <a href={requirements?.sourceUrl} target="_blank" rel="noreferrer" className="underline">{requirements?.sourceUrl}</a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
