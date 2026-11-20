import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, ExternalLink, FileCheck2, HelpCircle, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { Button } from '../../components/ui/button.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { Input, Label, Select } from '../../components/ui/input.tsx';
import { formatDate } from '../../lib/utils.ts';

interface CheckResponse {
  checkId: number;
  programme: { id: number; name: string; degreeLevel: string };
  university: { id: number; name: string; country: string };
  evaluation: {
    overallStatus: string;
    summaryLabel: string;
    disclaimer: string;
    criteria: Array<{
      key: string;
      label: string;
      studentValue: string;
      requiredValue: string;
      status: 'pass' | 'fail' | 'manual_verification' | 'missing_info';
      reason: string;
      sourceUrl: string;
      lastVerifiedDate: string;
    }>;
  };
  documentCheck?: {
    overallStatus: 'all_ready' | 'action_required';
    totalRequired: number;
    readyCount: number;
    expiredCount: number;
    missingCount: number;
    readinessPercentage: number;
    items: Array<{
      requiredDocument: string;
      suggestedCategory: string;
      status: 'ready' | 'expired' | 'missing';
      matchedDocuments: Array<{
        id: number;
        title: string;
        category: string;
        fileName: string;
        expirationDate: string | null;
        isExpired: boolean;
      }>;
      reason: string;
    }>;
  };
  aiExplanation: string | null;
  aiConfigured: boolean;
  aiNotice?: string;
}

export function EligibilityCheckerPage() {
  const [searchParams] = useSearchParams();
  const initialProgId = searchParams.get('programmeId') || '';
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [selectedProgId, setSelectedProgId] = useState(initialProgId);
  const [useWhatIf, setUseWhatIf] = useState(false);
  const [whatIf, setWhatIf] = useState({
    cgpa: profile?.cgpa || '',
    cgpaScale: profile?.cgpaScale || '4.00',
    degreeField: profile?.degreeField || '',
    ieltsOverall: profile?.ieltsOverall || '',
    ieltsListening: profile?.ieltsListening || '',
    ieltsReading: profile?.ieltsReading || '',
    ieltsWriting: profile?.ieltsWriting || '',
    ieltsSpeaking: profile?.ieltsSpeaking || '',
  });
  const [result, setResult] = useState<CheckResponse | null>(null);

  useEffect(() => {
    if (profile && !useWhatIf) {
      setWhatIf({
        cgpa: profile.cgpa || '',
        cgpaScale: profile.cgpaScale || '4.00',
        degreeField: profile.degreeField || '',
        ieltsOverall: profile.ieltsOverall || '',
        ieltsListening: profile.ieltsListening || '',
        ieltsReading: profile.ieltsReading || '',
        ieltsWriting: profile.ieltsWriting || '',
        ieltsSpeaking: profile.ieltsSpeaking || '',
      });
    }
  }, [profile, useWhatIf]);

  const { data: progList } = useQuery({
    queryKey: ['all-programmes-select'],
    queryFn: () =>
      apiFetch<{ items: Array<{ id: number; name: string; degreeLevel: string; university: { name: string; country: string } }> }>(
        '/api/programmes'
      ),
  });

  const { data: historyData } = useQuery({
    queryKey: ['eligibility-history'],
    queryFn: () =>
      apiFetch<{
        items: Array<{
          id: number;
          overallStatus: string;
          createdAt: string;
          programme: { id: number; name: string } | null;
          university: { name: string } | null;
        }>;
      }>('/api/eligibility/history'),
  });

  const checkMutation = useMutation({
    mutationFn: () =>
      apiFetch<CheckResponse>('/api/eligibility/check', {
        method: 'POST',
        body: JSON.stringify({
          programmeId: Number(selectedProgId),
          includeAiExplanation: true,
          overrideProfile: useWhatIf
            ? {
                cgpa: whatIf.cgpa ? Number(whatIf.cgpa) : null,
                cgpaScale: whatIf.cgpaScale ? Number(whatIf.cgpaScale) : null,
                degreeField: whatIf.degreeField || null,
                ieltsOverall: whatIf.ieltsOverall ? Number(whatIf.ieltsOverall) : null,
                ieltsListening: whatIf.ieltsListening ? Number(whatIf.ieltsListening) : null,
                ieltsReading: whatIf.ieltsReading ? Number(whatIf.ieltsReading) : null,
                ieltsWriting: whatIf.ieltsWriting ? Number(whatIf.ieltsWriting) : null,
                ieltsSpeaking: whatIf.ieltsSpeaking ? Number(whatIf.ieltsSpeaking) : null,
              }
            : undefined,
        }),
      }),
    onSuccess: (res) => {
      setResult(res);
      queryClient.invalidateQueries({ queryKey: ['eligibility-history'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (initialProgId) {
      setSelectedProgId(initialProgId);
      setResult(null);
    }
  }, [initialProgId]);

  const renderStatusBadge = (status: string) => {
    if (status === 'pass' || status === 'meets_requirements') {
      return (
        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          <span>{status === 'pass' ? 'Passed' : 'Meets listed requirements'}</span>
        </span>
      );
    }
    if (status === 'fail' || status === 'does_not_meet') {
      return (
        <span className="inline-flex items-center gap-1.5 font-medium text-red-600 dark:text-red-400">
          <XCircle className="h-4 w-4" />
          <span>{status === 'fail' ? 'Did not meet' : 'Does not meet listed requirements'}</span>
        </span>
      );
    }
    if (status === 'manual_verification' || status === 'needs_manual_verification') {
      return (
        <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-4 w-4" />
          <span>Needs manual verification</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
        <HelpCircle className="h-4 w-4" />
        <span>Insufficient information</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F2942] dark:text-white">
          AI &amp; Deterministic Eligibility Checker
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Deterministic backend rules check CGPA scales, individual IELTS bands, degree backgrounds, and test validity dates.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Programme to Evaluate</CardTitle>
          <CardDescription>
            Using your saved profile ({profile?.cgpa ? `CGPA ${profile.cgpa}/${profile.cgpaScale}` : 'CGPA missing'} · {profile?.ieltsOverall ? `IELTS ${profile.ieltsOverall}` : 'IELTS missing'} · {profile?.degreeField || 'Degree field missing'})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select
              value={selectedProgId}
              onChange={(e) => setSelectedProgId(e.target.value)}
              className="flex-1"
            >
              <option value="">Select a university programme...</option>
              {(progList?.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.university.name} — {p.name} ({p.degreeLevel})
                </option>
              ))}
            </Select>
            <Button
              type="button"
              disabled={!selectedProgId || checkMutation.isPending}
              onClick={() => checkMutation.mutate()}
            >
              {checkMutation.isPending ? 'Evaluating...' : 'Check Eligibility'}
            </Button>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={useWhatIf}
              onChange={(e) => setUseWhatIf(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>Test temporary "What-If" academic / IELTS values for this check</span>
          </label>

          {useWhatIf && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <Label>CGPA</Label>
                <Input type="number" step="0.01" value={whatIf.cgpa} onChange={(e) => setWhatIf({ ...whatIf, cgpa: e.target.value })} />
              </div>
              <div>
                <Label>Scale</Label>
                <Input type="number" step="0.01" value={whatIf.cgpaScale} onChange={(e) => setWhatIf({ ...whatIf, cgpaScale: e.target.value })} />
              </div>
              <div>
                <Label>Degree Field</Label>
                <Input value={whatIf.degreeField} onChange={(e) => setWhatIf({ ...whatIf, degreeField: e.target.value })} />
              </div>
              <div>
                <Label>IELTS Overall</Label>
                <Input type="number" step="0.5" value={whatIf.ieltsOverall} onChange={(e) => setWhatIf({ ...whatIf, ieltsOverall: e.target.value })} />
              </div>
              <div>
                <Label>Listening</Label>
                <Input type="number" step="0.5" value={whatIf.ieltsListening} onChange={(e) => setWhatIf({ ...whatIf, ieltsListening: e.target.value })} />
              </div>
              <div>
                <Label>Reading</Label>
                <Input type="number" step="0.5" value={whatIf.ieltsReading} onChange={(e) => setWhatIf({ ...whatIf, ieltsReading: e.target.value })} />
              </div>
              <div>
                <Label>Writing</Label>
                <Input type="number" step="0.5" value={whatIf.ieltsWriting} onChange={(e) => setWhatIf({ ...whatIf, ieltsWriting: e.target.value })} />
              </div>
              <div>
                <Label>Speaking</Label>
                <Input type="number" step="0.5" value={whatIf.ieltsSpeaking} onChange={(e) => setWhatIf({ ...whatIf, ieltsSpeaking: e.target.value })} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle>{result.university.name} — {result.programme.name}</CardTitle>
                  <CardDescription>{result.programme.degreeLevel} · {result.university.country}</CardDescription>
                </div>
                <div className="text-sm">{renderStatusBadge(result.evaluation.overallStatus)}</div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                    <tr>
                      <th className="py-2.5 pr-4">Criterion</th>
                      <th className="py-2.5 pr-4">Your Profile</th>
                      <th className="py-2.5 pr-4">Required</th>
                      <th className="py-2.5 pr-4">Outcome</th>
                      <th className="py-2.5">Details &amp; Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {result.evaluation.criteria.map((c) => (
                      <tr key={c.key} className="align-top">
                        <td className="py-3 pr-4 font-medium whitespace-nowrap">{c.label}</td>
                        <td className="py-3 pr-4 font-mono text-xs tabular-nums">{c.studentValue}</td>
                        <td className="py-3 pr-4 font-mono text-xs tabular-nums">{c.requiredValue}</td>
                        <td className="py-3 pr-4 text-xs whitespace-nowrap">{renderStatusBadge(c.status)}</td>
                        <td className="py-3 text-xs text-slate-600 dark:text-slate-400">
                          <p>{c.reason}</p>
                          <a
                            href={c.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-700 hover:underline dark:text-blue-400 mt-1"
                          >
                            <span>Official source (verified {c.lastVerifiedDate})</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <strong>Important Notice:</strong> {result.evaluation.disclaimer}
              </div>

              {result.aiExplanation ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-5 dark:border-blue-900/40 dark:bg-blue-950/20">
                  <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2">
                    AI Plain-English Explanation
                  </p>
                  <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {result.aiExplanation}
                  </div>
                </div>
              ) : result.aiNotice ? (
                <p className="text-xs text-slate-500">{result.aiNotice}</p>
              ) : null}
            </CardContent>
          </Card>

          {result.documentCheck && (
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileCheck2 className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                      <span>Required Documents Check</span>
                    </CardTitle>
                    <CardDescription>
                      Cross-checked {result.documentCheck.totalRequired} required document(s) against your Document Vault
                    </CardDescription>
                  </div>
                  <div className="text-xs font-mono tabular-nums font-semibold text-[#0F2942] dark:text-white">
                    {result.documentCheck.readyCount}/{result.documentCheck.totalRequired} Ready ({result.documentCheck.readinessPercentage}%)
                  </div>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {result.documentCheck.items.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No document checklist listed for this programme. Check the official portal.
                  </p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                      <tr>
                        <th className="py-2 pr-4">Required Document</th>
                        <th className="py-2 pr-4">Vault Status</th>
                        <th className="py-2 pr-4">Matched File</th>
                        <th className="py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {result.documentCheck.items.map((docItem) => (
                        <tr key={docItem.requiredDocument}>
                          <td className="py-3 pr-4">
                            <p className="font-medium text-slate-900 dark:text-white">
                              {docItem.requiredDocument}
                            </p>
                            <p className="text-xs text-slate-500">{docItem.reason}</p>
                          </td>
                          <td className="py-3 pr-4 text-xs whitespace-nowrap font-medium">
                            {docItem.status === 'ready' ? (
                              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Ready
                              </span>
                            ) : docItem.status === 'expired' ? (
                              <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                                <AlertCircle className="h-3.5 w-3.5" />
                                Expired
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400">
                                <XCircle className="h-3.5 w-3.5" />
                                Missing
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-xs text-slate-600 dark:text-slate-300">
                            {docItem.matchedDocuments[0]
                              ? `${docItem.matchedDocuments[0].title} (${docItem.matchedDocuments[0].fileName})`
                              : `Category: ${docItem.suggestedCategory}`}
                          </td>
                          <td className="py-3 text-right whitespace-nowrap">
                            {docItem.status !== 'ready' ? (
                              <Link
                                to={`/documents?category=${encodeURIComponent(docItem.suggestedCategory)}&title=${encodeURIComponent(docItem.requiredDocument)}`}
                              >
                                <Button size="sm" variant="outline">
                                  <Upload className="h-3.5 w-3.5" />
                                  <span>Upload</span>
                                </Button>
                              </Link>
                            ) : (
                              <Link to="/documents" className="text-xs text-blue-700 hover:underline dark:text-blue-400">
                                View Vault
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Eligibility Check History */}
      {(historyData?.items ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Eligibility Checks</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100 dark:divide-slate-800">
            {historyData!.items.slice(0, 8).map((item) => (
              <div key={item.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                <div>
                  <Link
                    to={item.programme ? `/programmes/${item.programme.id}` : '#'}
                    className="font-medium hover:underline"
                  >
                    {item.university?.name} — {item.programme?.name}
                  </Link>
                  <p className="text-xs text-slate-400">{formatDate(item.createdAt)}</p>
                </div>
                <div className="text-xs">{renderStatusBadge(item.overallStatus)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
