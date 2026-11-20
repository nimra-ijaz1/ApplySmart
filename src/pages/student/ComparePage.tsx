import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ExternalLink, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { Button } from '../../components/ui/button.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { Select } from '../../components/ui/input.tsx';
import { formatCurrency } from '../../lib/utils.ts';

interface ProgItem {
  id: number;
  name: string;
  degreeLevel: string;
  duration: string;
  tuitionFee: number;
  currency: string;
  applicationFee: number;
  applicationDeadline: string | null;
  scholarshipAvailability: boolean;
  officialProgrammeUrl: string;
  university: { id: number; name: string; country: string };
  requirements: { minCgpa: string | null; cgpaScale: string | null; ieltsOverall: string | null } | null;
}

export function ComparePage() {
  const { compareIds, toggleCompareProgramme, clearCompare } = useAuth();
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['all-programmes-compare'],
    queryFn: () => apiFetch<{ items: ProgItem[] }>('/api/programmes'),
  });

  const compareMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ aiConfigured: boolean; comparison: string | null; error?: string }>(
        '/api/ai/compare-programmes',
        {
          method: 'POST',
          body: JSON.stringify({ programmeIds: compareIds }),
        }
      ),
    onSuccess: (res) => {
      if (res.comparison) setAiSummary(res.comparison);
      else if (res.error) toast.error(res.error);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const allProgs = data?.items ?? [];
  const selectedProgs = allProgs.filter((p) => compareIds.includes(p.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2942] dark:text-white">
            Compare Programmes (Up to 4)
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Side-by-side matrix highlighting tuition, entry cutoffs, deadlines, and scholarships.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedProgs.length >= 2 && (
            <Button size="sm" onClick={() => compareMutation.mutate()} disabled={compareMutation.isPending}>
              <Sparkles className="h-4 w-4" />
              <span>{compareMutation.isPending ? 'Analyzing...' : 'AI Key Differences'}</span>
            </Button>
          )}
          {selectedProgs.length > 0 && (
            <Button size="sm" variant="outline" onClick={clearCompare}>
              Clear All
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-col sm:flex-row items-center gap-3">
          <Select
            value=""
            onChange={(e) => {
              if (e.target.value) toggleCompareProgramme(Number(e.target.value));
            }}
            disabled={compareIds.length >= 4}
          >
            <option value="">
              {compareIds.length >= 4 ? 'Maximum 4 programmes selected' : 'Add a programme to compare...'}
            </option>
            {allProgs
              .filter((p) => !compareIds.includes(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.university.name} — {p.name} ({p.degreeLevel})
                </option>
              ))}
          </Select>
          <Link to="/universities" className="shrink-0">
            <Button variant="outline">Browse Universities</Button>
          </Link>
        </CardContent>
      </Card>

      {aiSummary && (
        <Card>
          <CardHeader><CardTitle className="text-base">AI Programme Comparison Summary</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300">
            {aiSummary}
          </CardContent>
        </Card>
      )}

      {selectedProgs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-500">
            Select at least two programmes above or from the University Finder to compare them side-by-side.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 pr-4 text-xs text-slate-500 w-44">Field</th>
                  {selectedProgs.map((p) => (
                    <th key={p.id} className="py-3 pr-4 min-w-[200px]">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link to={`/programmes/${p.id}`} className="font-bold text-[#0F2942] hover:underline dark:text-white">
                            {p.name}
                          </Link>
                          <p className="text-xs font-normal text-slate-500 mt-0.5">{p.university.name}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleCompareProgramme(p.id)}
                          className="text-slate-400 hover:text-red-600"
                          aria-label="Remove from comparison"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr>
                  <td className="py-3 pr-4 font-medium">Country</td>
                  {selectedProgs.map((p) => <td key={p.id} className="py-3 pr-4">{p.university.country}</td>)}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Degree Level</td>
                  {selectedProgs.map((p) => <td key={p.id} className="py-3 pr-4">{p.degreeLevel}</td>)}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Duration</td>
                  {selectedProgs.map((p) => <td key={p.id} className="py-3 pr-4">{p.duration}</td>)}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Annual / Total Tuition</td>
                  {selectedProgs.map((p) => (
                    <td key={p.id} className="py-3 pr-4 font-mono tabular-nums font-semibold">
                      {formatCurrency(p.tuitionFee, p.currency)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Application Fee</td>
                  {selectedProgs.map((p) => (
                    <td key={p.id} className="py-3 pr-4 font-mono tabular-nums">
                      {formatCurrency(p.applicationFee, p.currency)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Minimum CGPA</td>
                  {selectedProgs.map((p) => (
                    <td key={p.id} className="py-3 pr-4 font-mono tabular-nums">
                      {p.requirements?.minCgpa ? `${p.requirements.minCgpa} / ${p.requirements.cgpaScale}` : 'See reqs'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">IELTS Overall</td>
                  {selectedProgs.map((p) => (
                    <td key={p.id} className="py-3 pr-4 font-mono tabular-nums">
                      {p.requirements?.ieltsOverall ?? 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Application Deadline</td>
                  {selectedProgs.map((p) => (
                    <td key={p.id} className="py-3 pr-4 font-mono tabular-nums">
                      {p.applicationDeadline || 'Rolling'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Scholarships Listed</td>
                  {selectedProgs.map((p) => (
                    <td key={p.id} className="py-3 pr-4">{p.scholarshipAvailability ? 'Available' : 'Limited / Self'}</td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Official Link</td>
                  {selectedProgs.map((p) => (
                    <td key={p.id} className="py-3 pr-4">
                      <a
                        href={p.officialProgrammeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline dark:text-blue-400"
                      >
                        <span>Programme Page</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
