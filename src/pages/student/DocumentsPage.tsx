import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, downloadProtectedFile } from '../../lib/api.ts';
import { Button } from '../../components/ui/button.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { Input, Label, Select, Textarea } from '../../components/ui/input.tsx';
import { formatDate } from '../../lib/utils.ts';

const CATEGORIES = [
  'Passport',
  'CV / Resume',
  'Academic transcripts',
  'Degree certificate',
  'IELTS certificate',
  'TOEFL certificate',
  'Recommendation letters',
  'Statement of Purpose',
  'Motivation letter',
  'Research proposal',
  'Other documents',
];

interface DocumentRecord {
  id: number;
  category: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  description: string | null;
  expirationDate: string | null;
  uploadedAt: string;
}

interface DocumentCheckItem {
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
}

interface DocumentReadinessResult {
  overallStatus: 'all_ready' | 'action_required';
  totalRequired: number;
  readyCount: number;
  expiredCount: number;
  missingCount: number;
  readinessPercentage: number;
  items: DocumentCheckItem[];
}

interface ChecklistResponse {
  mode: 'single' | 'tracked';
  hasTrackedProgrammes: boolean;
  overallSummary: DocumentReadinessResult;
  programmeChecks: Array<{
    programme: {
      id: number;
      name: string;
      degreeLevel: string;
      applicationDeadline: string | null;
    };
    university: { id: number; name: string; country: string } | null;
    sourceUrl: string;
    lastVerifiedDate: string;
    documentCheck: DocumentReadinessResult;
  }>;
}

export function DocumentsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filterCat, setFilterCat] = useState('');
  const [selectedChecklistProgId, setSelectedChecklistProgId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [title, setTitle] = useState(searchParams.get('title') || '');
  const [category, setCategory] = useState(
    CATEGORIES.includes(searchParams.get('category') || '')
      ? searchParams.get('category')!
      : 'Academic transcripts'
  );
  const [description, setDescription] = useState('');
  const [expirationDate, setExpirationDate] = useState('');

  useEffect(() => {
    const paramCat = searchParams.get('category');
    const paramTitle = searchParams.get('title');
    if (paramCat && CATEGORIES.includes(paramCat)) {
      setCategory(paramCat);
    }
    if (paramTitle) {
      setTitle(paramTitle);
    }
  }, [searchParams]);

  // AI Document Assistant state
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiRawText, setAiRawText] = useState('');
  const [aiResult, setAiResult] = useState<{
    fileName: string;
    aiConfigured: boolean;
    analysis: {
      universityName?: string;
      programmeName?: string;
      minimumGpa?: string;
      languageRequirements?: string;
      applicationDeadlines?: string[];
      requiredDocuments?: string[];
      importantConditions?: string[];
      summary?: string;
      disclaimer?: string;
    } | null;
    error?: string;
  } | null>(null);
  const [confirmedExtraction, setConfirmedExtraction] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['documents', filterCat],
    queryFn: () => {
      const qs = filterCat ? `?category=${encodeURIComponent(filterCat)}` : '';
      return apiFetch<{ items: DocumentRecord[] }>(`/api/documents${qs}`);
    },
  });

  const { data: progList } = useQuery({
    queryKey: ['all-programmes-select'],
    queryFn: () =>
      apiFetch<{ items: Array<{ id: number; name: string; degreeLevel: string; university: { name: string } }> }>(
        '/api/programmes'
      ),
  });

  const { data: checklistData, isLoading: checklistLoading } = useQuery({
    queryKey: ['document-checklist', selectedChecklistProgId],
    queryFn: () => {
      const qs = selectedChecklistProgId
        ? `?programmeId=${encodeURIComponent(selectedChecklistProgId)}`
        : '';
      return apiFetch<ChecklistResponse>(`/api/documents/checklist${qs}`);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error('Select a file first.');
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('title', title || uploadFile.name);
      fd.append('category', category);
      if (description) fd.append('description', description);
      if (expirationDate) fd.append('expirationDate', expirationDate);
      return apiFetch('/api/documents/upload', { method: 'POST', body: fd });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-checklist'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTitle('');
      setDescription('');
      setExpirationDate('');
      toast.success('Document uploaded securely.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-checklist'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      toast.success('Document deleted.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDownload = async (doc: DocumentRecord) => {
    try {
      await downloadProtectedFile(`/api/documents/${doc.id}/download`, doc.fileName);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to download document.');
    }
  };

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      setConfirmedExtraction(false);
      if (aiFile) {
        const fd = new FormData();
        fd.append('file', aiFile);
        return apiFetch<typeof aiResult>('/api/ai/analyze-document', { method: 'POST', body: fd });
      }
      if (aiRawText.trim()) {
        return apiFetch<typeof aiResult>('/api/ai/analyze-document', {
          method: 'POST',
          body: JSON.stringify({ rawText: aiRawText }),
        });
      }
      throw new Error('Upload a PDF/text file or paste admission requirement text.');
    },
    onSuccess: (res) => {
      setAiResult(res);
      if (res?.error) toast.error(res.error);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const prefillUploadFromChecklist = (item: DocumentCheckItem) => {
    setCategory(CATEGORIES.includes(item.suggestedCategory) ? item.suggestedCategory : 'Other documents');
    setTitle(item.requiredDocument);
    toast.info(`Upload form pre-filled for "${item.requiredDocument}". Select your file below.`);
  };

  const docs = data?.items ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0F2942] dark:text-white">
          Document Manager &amp; Readiness Checker
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Check which documents each university programme requires, upload verified copies privately, or extract requirements from admission PDFs.
        </p>
      </div>

      {/* Required Documents Checker */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                <span>Required Documents Checker</span>
              </CardTitle>
              <CardDescription>
                {selectedChecklistProgId
                  ? 'Checking verified document requirements for your selected programme.'
                  : checklistData?.hasTrackedProgrammes
                    ? 'Aggregated across your shortlisted and applied programmes.'
                    : 'No programmes shortlisted yet — showing core international application documents. Select any programme to inspect its exact list.'}
              </CardDescription>
            </div>

            <div className="w-full lg:w-80">
              <Select
                value={selectedChecklistProgId}
                onChange={(e) => setSelectedChecklistProgId(e.target.value)}
              >
                <option value="">All My Tracked / Shortlisted Programmes</option>
                {(progList?.items ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.university.name} — {p.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {checklistLoading || !checklistData ? (
            <div className="h-32 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5">
                  <p className="text-xs text-slate-500">Required Documents</p>
                  <p className="text-xl font-bold font-mono tabular-nums text-[#0F2942] dark:text-white mt-1">
                    {checklistData.overallSummary.totalRequired}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5">
                  <p className="text-xs text-slate-500">Ready in Vault</p>
                  <p className="text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
                    {checklistData.overallSummary.readyCount}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5">
                  <p className="text-xs text-slate-500">Missing</p>
                  <p className="text-xl font-bold font-mono tabular-nums text-red-600 dark:text-red-400 mt-1">
                    {checklistData.overallSummary.missingCount}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5">
                  <p className="text-xs text-slate-500">Readiness Score</p>
                  <p className="text-xl font-bold font-mono tabular-nums text-[#0F2942] dark:text-white mt-1">
                    {checklistData.overallSummary.readinessPercentage}%
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Required Document</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Vault Match / Expected Category</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {checklistData.overallSummary.items.map((item) => (
                      <tr key={item.requiredDocument}>
                        <td className="py-3 pr-4">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {item.requiredDocument}
                          </p>
                          <p className="text-xs text-slate-500">{item.reason}</p>
                        </td>
                        <td className="py-3 pr-4 text-xs font-medium whitespace-nowrap">
                          {item.status === 'ready' ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Ready
                            </span>
                          ) : item.status === 'expired' ? (
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
                          {item.matchedDocuments[0]
                            ? `${item.matchedDocuments[0].title} (${item.matchedDocuments[0].fileName})`
                            : item.suggestedCategory}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          {item.status !== 'ready' ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => prefillUploadFromChecklist(item)}
                            >
                              <Upload className="h-3.5 w-3.5" />
                              <span>Prepare Upload</span>
                            </Button>
                          ) : (
                            <span className="text-xs text-emerald-700 dark:text-emerald-400">
                              Covered
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {checklistData.programmeChecks.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Verified Official Sources Checked
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {checklistData.programmeChecks.map((pc) => (
                      <div
                        key={pc.programme.id}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">
                            {pc.university?.name} — {pc.programme.name}
                          </p>
                          <p className="text-slate-500 mt-0.5">
                            {pc.documentCheck.readyCount}/{pc.documentCheck.totalRequired} documents ready · Verified {pc.lastVerifiedDate}
                          </p>
                        </div>
                        <a
                          href={pc.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 hover:underline dark:text-blue-400 shrink-0 inline-flex items-center gap-1"
                        >
                          <span>Source</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upload Form */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Upload Personal Document</CardTitle>
            <CardDescription>PDF, DOCX, TXT, PNG, or JPG up to 5 MB</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Document Category</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Document Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="BS Software Engineering Transcript"
              />
            </div>
            <div>
              <Label>File</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.docx,.png,.jpg,.jpeg"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Expiration Date (Optional)</Label>
                <Input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
              </div>
              <div>
                <Label>Description (Optional)</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="HEC attested" />
              </div>
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={!uploadFile || uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
            >
              <Upload className="h-4 w-4" />
              <span>{uploadMutation.isPending ? 'Uploading...' : 'Upload Document'}</span>
            </Button>
          </CardContent>
        </Card>

        {/* AI Document Assistant */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-700 dark:text-blue-400" />
              <span>AI Admission Requirement PDF Extractor</span>
            </CardTitle>
            <CardDescription>
              Upload a university admission brochure PDF or paste requirement text to extract GPA, IELTS, deadlines, and document checklists for confirmation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Admission Requirement PDF / Text File</Label>
                <Input
                  type="file"
                  accept=".pdf,.txt,.md"
                  onChange={(e) => setAiFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  className="w-full"
                  disabled={analyzeMutation.isPending || (!aiFile && !aiRawText.trim())}
                  onClick={() => analyzeMutation.mutate()}
                >
                  {analyzeMutation.isPending ? 'Extracting...' : 'Extract Requirements'}
                </Button>
              </div>
            </div>
            <div>
              <Label>Or paste admission webpage text directly</Label>
              <Textarea
                rows={3}
                value={aiRawText}
                onChange={(e) => setAiRawText(e.target.value)}
                placeholder="Paste official admission requirements text here..."
              />
            </div>

            {aiResult?.analysis && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2.5 text-xs dark:border-slate-800 dark:bg-slate-950">
                <p className="font-semibold text-sm text-[#0F2942] dark:text-white">
                  Extracted Information (Requires Confirmation)
                </p>
                {aiResult.analysis.summary && <p className="text-slate-600 dark:text-slate-400">{aiResult.analysis.summary}</p>}
                <p><strong>University / Programme:</strong> {aiResult.analysis.universityName || 'N/A'} — {aiResult.analysis.programmeName || 'N/A'}</p>
                <p><strong>Minimum GPA:</strong> {aiResult.analysis.minimumGpa || 'Not explicitly stated'}</p>
                <p><strong>Language Requirements:</strong> {aiResult.analysis.languageRequirements || 'Not explicitly stated'}</p>
                <p><strong>Deadlines:</strong> {(aiResult.analysis.applicationDeadlines || []).join(' · ') || 'None detected'}</p>
                <p><strong>Required Documents:</strong> {(aiResult.analysis.requiredDocuments || []).join(', ') || 'None detected'}</p>
                {(aiResult.analysis.importantConditions || []).length > 0 && (
                  <p><strong>Conditions:</strong> {aiResult.analysis.importantConditions!.join(' | ')}</p>
                )}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <span className="text-amber-700 dark:text-amber-400">
                    Never treat AI-extracted text as verified university data until confirmed against the official site.
                  </span>
                  <Button
                    size="sm"
                    variant={confirmedExtraction ? 'secondary' : 'outline'}
                    onClick={() => {
                      setConfirmedExtraction(true);
                      toast.success('Marked as reviewed by you.');
                    }}
                  >
                    {confirmedExtraction ? 'Confirmed' : 'Confirm Details'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Uploaded Document Vault */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle>My Private Document Vault ({docs.length})</CardTitle>
            <CardDescription>Only accessible by your authenticated account</CardDescription>
          </div>
          <Select className="w-56" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-32 animate-pulse bg-slate-100 rounded-lg dark:bg-slate-800" />
          ) : docs.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No documents uploaded yet. Upload your transcripts, IELTS certificate, or CV above.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {docs.map((doc) => (
                <div key={doc.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{doc.title}</p>
                      <p className="text-xs text-slate-500">
                        {doc.category} · {doc.fileName} · {(doc.fileSize / 1024).toFixed(1)} KB · Uploaded {formatDate(doc.uploadedAt)}
                        {doc.expirationDate ? ` · Expires ${doc.expirationDate}` : ''}
                      </p>
                      {doc.description && <p className="text-xs text-slate-400 mt-0.5">{doc.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(doc.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
