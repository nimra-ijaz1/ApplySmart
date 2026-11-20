import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, ExternalLink, GitCompare, Search } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { Button } from '../../components/ui/button.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { Input, Select } from '../../components/ui/input.tsx';
import { formatCurrency } from '../../lib/utils.ts';

interface UniversityItem {
  id: number;
  name: string;
  country: string;
  city: string;
  officialWebsite: string;
  description: string;
  institutionType: string;
  globalRanking: number | null;
  lastVerifiedDate: string;
  isDemoRecord: boolean;
  programmes: Array<{
    id: number;
    name: string;
    degreeLevel: string;
    subjectArea: string;
    tuitionFee: number;
    currency: string;
    applicationDeadline: string | null;
    intake: string;
    scholarshipAvailability: boolean;
    requirements: {
      minCgpa: string | null;
      cgpaScale: string | null;
      ieltsOverall: string | null;
    } | null;
  }>;
}

export function UniversitiesPage() {
  const { compareIds, toggleCompareProgramme } = useAuth();
  const queryClient = useQueryClient();

  const [q, setQ] = useState('');
  const [country, setCountry] = useState('');
  const [institutionType, setInstitutionType] = useState('');
  const [degreeLevel, setDegreeLevel] = useState('');
  const [subject, setSubject] = useState('');
  const [maxTuitionUsd, setMaxTuitionUsd] = useState('');
  const [maxCgpa, setMaxCgpa] = useState('');
  const [maxIelts, setMaxIelts] = useState('');
  const [scholarshipOnly, setScholarshipOnly] = useState(false);
  const [intake, setIntake] = useState('');
  const [sort, setSort] = useState('ranking');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: [
      'universities',
      q,
      country,
      institutionType,
      degreeLevel,
      subject,
      maxTuitionUsd,
      maxCgpa,
      maxIelts,
      scholarshipOnly,
      intake,
      sort,
      page,
    ],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '8', sort });
      if (q) params.set('q', q);
      if (country) params.set('country', country);
      if (institutionType) params.set('institutionType', institutionType);
      if (degreeLevel) params.set('degreeLevel', degreeLevel);
      if (subject) params.set('subject', subject);
      if (maxTuitionUsd) params.set('maxTuitionUsd', maxTuitionUsd);
      if (maxCgpa) params.set('maxCgpa', maxCgpa);
      if (maxIelts) params.set('maxIelts', maxIelts);
      if (scholarshipOnly) params.set('scholarshipOnly', 'true');
      if (intake) params.set('intake', intake);

      return apiFetch<{
        items: UniversityItem[];
        total: number;
        page: number;
        totalPages: number;
        facets: { countries: string[]; subjects: string[] };
      }>(`/api/universities?${params.toString()}`);
    },
  });

  const shortlistMutation = useMutation({
    mutationFn: (payload: { itemType: 'university' | 'programme'; universityId?: number; programmeId?: number }) =>
      apiFetch<{ alreadySaved?: boolean }>('/api/shortlist', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['shortlist'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      toast.success(res.alreadySaved ? 'Already in your shortlist.' : 'Saved to your shortlist.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetFilters = () => {
    setQ('');
    setCountry('');
    setInstitutionType('');
    setDegreeLevel('');
    setSubject('');
    setMaxTuitionUsd('');
    setMaxCgpa('');
    setMaxIelts('');
    setScholarshipOnly(false);
    setIntake('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2942] dark:text-white">
            Find Universities &amp; Programmes
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Search verified institutions, compare up to 4 programmes, or save to your shortlist.
          </p>
        </div>
        {compareIds.length > 0 && (
          <Link to="/compare">
            <Button variant="primary" size="sm">
              <GitCompare className="h-4 w-4" />
              <span>Compare Selected ({compareIds.length}/4)</span>
            </Button>
          </Link>
        )}
      </div>

      {/* Filters Panel */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
              <Input
                className="pl-9"
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                placeholder="Search university, city, subject, or programme..."
              />
            </div>
            <Select value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }}>
              <option value="">All Countries</option>
              {(data?.facets.countries ?? []).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
            <Select value={degreeLevel} onChange={(e) => { setDegreeLevel(e.target.value); setPage(1); }}>
              <option value="">All Degree Levels</option>
              <option value="Bachelor's">Bachelor's</option>
              <option value="Master's">Master's</option>
              <option value="PhD">PhD</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Select value={subject} onChange={(e) => { setSubject(e.target.value); setPage(1); }}>
              <option value="">All Subjects</option>
              {(data?.facets.subjects ?? []).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <Select value={institutionType} onChange={(e) => { setInstitutionType(e.target.value); setPage(1); }}>
              <option value="">Public &amp; Private</option>
              <option value="Public">Public</option>
              <option value="Private">Private</option>
            </Select>
            <Input
              type="number"
              value={maxTuitionUsd}
              onChange={(e) => { setMaxTuitionUsd(e.target.value); setPage(1); }}
              placeholder="Max Tuition (USD)"
            />
            <Input
              type="number"
              step="0.1"
              value={maxCgpa}
              onChange={(e) => { setMaxCgpa(e.target.value); setPage(1); }}
              placeholder="Max Min-CGPA (e.g. 3.5)"
            />
            <Input
              type="number"
              step="0.5"
              value={maxIelts}
              onChange={(e) => { setMaxIelts(e.target.value); setPage(1); }}
              placeholder="Max IELTS (e.g. 6.5)"
            />
            <Input
              value={intake}
              onChange={(e) => { setIntake(e.target.value); setPage(1); }}
              placeholder="Intake (e.g. Fall)"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={scholarshipOnly}
                onChange={(e) => { setScholarshipOnly(e.target.checked); setPage(1); }}
                className="rounded border-slate-300"
              />
              <span>Scholarship availability only</span>
            </label>

            <div className="flex items-center gap-3">
              <Select
                className="w-44"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="ranking">Sort: Global Ranking</option>
                <option value="tuition_asc">Sort: Lowest Tuition</option>
                <option value="name">Sort: Alphabetical</option>
              </Select>
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-xl border border-slate-200 bg-white animate-pulse dark:border-slate-800 dark:bg-slate-900" />
          ))}
        </div>
      ) : (data?.items ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No universities matched your current filters.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data!.items.map((uni) => (
            <Card key={uni.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <Link
                      to={`/universities/${uni.id}`}
                      className="text-lg font-bold text-[#0F2942] hover:text-blue-700 dark:text-white dark:hover:text-blue-400"
                    >
                      {uni.name}
                    </Link>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {uni.city}, {uni.country} · {uni.institutionType}
                      {uni.globalRanking ? ` · Global Rank #${uni.globalRanking}` : ''}
                      {uni.isDemoRecord ? ' · Reference Dataset' : ''} · Verified {uni.lastVerifiedDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => shortlistMutation.mutate({ itemType: 'university', universityId: uni.id })}
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                      <span>Save University</span>
                    </Button>
                    <Link to={`/universities/${uni.id}`}>
                      <Button size="sm">View Details</Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                  {uni.description}
                </p>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 pt-2">
                  {uni.programmes.map((prog) => {
                    const isCompared = compareIds.includes(prog.id);
                    return (
                      <div key={prog.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            to={`/programmes/${prog.id}`}
                            className="text-sm font-semibold text-slate-900 hover:text-blue-700 dark:text-slate-100 dark:hover:text-blue-400"
                          >
                            {prog.name}
                          </Link>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {prog.degreeLevel} · {prog.subjectArea} · Min CGPA {prog.requirements?.minCgpa ?? 'N/A'} · IELTS {prog.requirements?.ieltsOverall ?? 'N/A'} · Deadline {prog.applicationDeadline || 'Rolling'}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <span className="font-mono text-xs font-medium tabular-nums text-slate-700 dark:text-slate-300 mr-2">
                            {formatCurrency(prog.tuitionFee, prog.currency)}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant={isCompared ? 'primary' : 'outline'}
                            onClick={() => toggleCompareProgramme(prog.id)}
                          >
                            {isCompared ? 'In Compare' : 'Compare'}
                          </Button>
                          <Link to={`/eligibility?programmeId=${prog.id}`}>
                            <Button size="sm" variant="secondary">Check Eligibility</Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {data!.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Showing page {data!.page} of {data!.totalPages} ({data!.total} universities)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data!.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
