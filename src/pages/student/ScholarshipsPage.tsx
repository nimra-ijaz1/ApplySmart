import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, ExternalLink, GitCompare, Search } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api.ts';
import { Button } from '../../components/ui/button.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { Dialog } from '../../components/ui/dialog.tsx';
import { Input, Select } from '../../components/ui/input.tsx';

interface ScholarshipItem {
  id: number;
  name: string;
  provider: string;
  country: string;
  fundingType: 'full' | 'partial';
  fundingPercentage: number | null;
  tuitionCoverage: string;
  monthlyStipend: string | null;
  travelAllowance: string | null;
  accommodationCoverage: string | null;
  eligibilityRequirements: string;
  requiredDocuments: string[];
  applicationOpeningDate: string | null;
  applicationDeadline: string | null;
  officialUrl: string;
  sourceUrl: string;
  lastVerifiedDate: string;
  isDemoRecord: boolean;
  eligibility: {
    eligibleNationalities: string[];
    eligibleDegreeLevels: string[];
    minCgpa: string | null;
    cgpaScale?: string | null;
    minIelts: string | null;
    notes: string | null;
  } | null;
}

export function ScholarshipsPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('');
  const [degreeLevel, setDegreeLevel] = useState('');
  const [fundingType, setFundingType] = useState('');
  const [nationality, setNationality] = useState('');
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['scholarships', q, country, degreeLevel, fundingType, nationality],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (country) params.set('country', country);
      if (degreeLevel) params.set('degreeLevel', degreeLevel);
      if (fundingType) params.set('fundingType', fundingType);
      if (nationality) params.set('nationality', nationality);
      return apiFetch<{
        items: ScholarshipItem[];
        total: number;
        facets?: { countries: string[] };
      }>(`/api/scholarships?${params.toString()}`);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ alreadySaved?: boolean }>(`/api/scholarships/${id}/save`, { method: 'POST' }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['shortlist'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      toast.success(res.alreadySaved ? 'Scholarship is already in your shortlist.' : 'Scholarship saved to shortlist.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleCompare = (id: number) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? prev : [...prev, id]
    );
  };

  const items = data?.items ?? [];
  const compareItems = items.filter((s) => compareIds.includes(s.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2942] dark:text-white">Scholarship Finder</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Verified government, foundation, and university scholarships with official deadlines and stipend details.
          </p>
        </div>
        {compareIds.length >= 2 && (
          <Button size="sm" onClick={() => setCompareOpen(true)}>
            <GitCompare className="h-4 w-4" />
            <span>Compare Scholarships ({compareIds.length})</span>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
            <Input
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Chevening, DAAD, Fulbright..."
            />
          </div>
          <Select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">All Countries</option>
            {(data?.facets?.countries ?? [
              'United Kingdom',
              'Germany',
              'United States',
              'Switzerland',
              'European Union',
            ]).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Select value={degreeLevel} onChange={(e) => setDegreeLevel(e.target.value)}>
            <option value="">All Degree Levels</option>
            <option value="Bachelor's">Bachelor's</option>
            <option value="Master's">Master's</option>
            <option value="PhD">PhD</option>
          </Select>
          <div className="flex gap-2">
            <Select value={fundingType} onChange={(e) => setFundingType(e.target.value)}>
              <option value="">All Funding</option>
              <option value="full">Full Funding</option>
              <option value="partial">Partial Funding</option>
            </Select>
            <Select value={nationality} onChange={(e) => setNationality(e.target.value)}>
              <option value="">Any Nationality</option>
              <option value="Pakistan">Pakistan Eligible</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="h-48 rounded-xl border border-slate-200 bg-white animate-pulse dark:border-slate-800 dark:bg-slate-900" />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-500">
            No scholarships matched your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {items.map((sch) => {
            const selected = compareIds.includes(sch.id);
            return (
              <Card key={sch.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        to={`/scholarships/${sch.id}`}
                        className="text-lg font-bold text-[#0F2942] hover:underline dark:text-white"
                      >
                        {sch.name}
                      </Link>
                      <CardDescription className="mt-1">
                        {sch.provider} · {sch.country} · {sch.fundingType === 'full' ? 'Full Funding' : 'Partial Funding'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-slate-700 dark:text-slate-300">
                    <strong>Coverage:</strong> {sch.tuitionCoverage}
                    {sch.monthlyStipend ? ` · Stipend: ${sch.monthlyStipend}` : ''}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {sch.eligibilityRequirements}
                  </p>
                  <p className="text-xs font-mono text-slate-500">
                    Deadline: {sch.applicationDeadline || 'See official portal'} · Verified {sch.lastVerifiedDate}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <Link to={`/scholarships/${sch.id}`}>
                      <Button size="sm">View Details</Button>
                    </Link>
                    <Button size="sm" variant="outline" onClick={() => saveMutation.mutate(sch.id)}>
                      <Bookmark className="h-3.5 w-3.5" />
                      <span>Save</span>
                    </Button>
                    <Button
                      size="sm"
                      variant={selected ? 'primary' : 'ghost'}
                      onClick={() => toggleCompare(sch.id)}
                    >
                      {selected ? 'Comparing' : 'Compare'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Compare Scholarships"
        maxWidth="max-w-4xl"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <tr>
                <th className="py-2 pr-4">Field</th>
                {compareItems.map((s) => (
                  <th key={s.id} className="py-2 pr-4 font-semibold text-slate-900 dark:text-white">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="py-2.5 pr-4 font-medium">Country</td>
                {compareItems.map((s) => <td key={s.id} className="py-2.5 pr-4">{s.country}</td>)}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-medium">Tuition Coverage</td>
                {compareItems.map((s) => <td key={s.id} className="py-2.5 pr-4">{s.tuitionCoverage}</td>)}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-medium">Monthly Stipend</td>
                {compareItems.map((s) => <td key={s.id} className="py-2.5 pr-4">{s.monthlyStipend || 'N/A'}</td>)}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-medium">Travel Allowance</td>
                {compareItems.map((s) => <td key={s.id} className="py-2.5 pr-4">{s.travelAllowance || 'N/A'}</td>)}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-medium">Deadline</td>
                {compareItems.map((s) => <td key={s.id} className="py-2.5 pr-4 font-mono">{s.applicationDeadline || 'N/A'}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </Dialog>
    </div>
  );
}

export function ScholarshipDetailsPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['scholarship-detail', id],
    queryFn: () =>
      apiFetch<{ scholarship: ScholarshipItem; eligibility: ScholarshipItem['eligibility'] }>(
        `/api/scholarships/${id}`
      ),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ alreadySaved?: boolean }>(`/api/scholarships/${id}/save`, { method: 'POST' }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['shortlist'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      toast.success(res.alreadySaved ? 'Scholarship is already in your shortlist.' : 'Scholarship saved.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !data) {
    return <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse dark:border-slate-800 dark:bg-slate-900" />;
  }

  const { scholarship, eligibility } = data;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link to="/scholarships" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
          ← Back to Scholarships
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-[#0F2942] dark:text-white">{scholarship.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {scholarship.provider} · {scholarship.country} · Verified {scholarship.lastVerifiedDate}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => saveMutation.mutate()}>Save Scholarship</Button>
        <a href={scholarship.officialUrl} target="_blank" rel="noreferrer">
          <Button variant="outline">
            <span>Official Scholarship Portal</span>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Funding &amp; Benefits</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <p><strong>Funding Type:</strong> {scholarship.fundingType === 'full' ? 'Full Funding' : 'Partial Funding'}</p>
            <p><strong>Tuition Coverage:</strong> {scholarship.tuitionCoverage}</p>
            <p><strong>Monthly Stipend:</strong> {scholarship.monthlyStipend || 'Not specified'}</p>
            <p><strong>Travel Allowance:</strong> {scholarship.travelAllowance || 'Not specified'}</p>
            <p><strong>Accommodation:</strong> {scholarship.accommodationCoverage || 'Not specified'}</p>
            <p><strong>Opening Date:</strong> <span className="font-mono">{scholarship.applicationOpeningDate || 'See portal'}</span></p>
            <p><strong>Deadline:</strong> <span className="font-mono">{scholarship.applicationDeadline || 'See portal'}</span></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Eligibility &amp; Required Documents</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-slate-700 dark:text-slate-300">{scholarship.eligibilityRequirements}</p>
            {eligibility && (
              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                <p><strong>Eligible Nationalities:</strong> {(eligibility.eligibleNationalities || []).join(', ')}</p>
                <p><strong>Eligible Degrees:</strong> {(eligibility.eligibleDegreeLevels || []).join(', ')}</p>
                {eligibility.minCgpa && <p><strong>Min CGPA:</strong> {eligibility.minCgpa} / {eligibility.cgpaScale}</p>}
                {eligibility.notes && <p><strong>Notes:</strong> {eligibility.notes}</p>}
              </div>
            )}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold mb-1.5">Required Documents</p>
              <ul className="list-disc pl-5 text-xs space-y-1 text-slate-600 dark:text-slate-400">
                {(scholarship.requiredDocuments || []).map((doc) => (
                  <li key={doc}>{doc}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
