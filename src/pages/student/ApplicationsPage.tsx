import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Paperclip, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api.ts';
import { Button } from '../../components/ui/button.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { Dialog } from '../../components/ui/dialog.tsx';
import { Input, Label, Select, Textarea } from '../../components/ui/input.tsx';
import { formatCurrency, formatDate } from '../../lib/utils.ts';

const STATUSES = [
  'Interested',
  'Researching',
  'Preparing Documents',
  'Ready to Apply',
  'Submitted',
  'Under Review',
  'Interview',
  'Accepted',
  'Rejected',
  'Withdrawn',
];

const KANBAN_COLUMNS = [
  'Interested',
  'Researching',
  'Preparing Documents',
  'Ready to Apply',
  'Submitted',
  'Under Review',
  'Interview',
  'Accepted',
  'Rejected',
  'Withdrawn',
];

interface ApplicationItem {
  id: number;
  status: string;
  applicationDeadline: string | null;
  applicationFee: number | null;
  currency: string | null;
  submissionDate: string | null;
  portalUrl: string | null;
  notes: string | null;
  updatedAt: string;
  university: { id: number; name: string; country: string } | null;
  programme: { id: number; name: string; degreeLevel: string } | null;
  attachedDocuments: Array<{ id: number; title: string; category: string }>;
}

export function ApplicationsPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProgId, setSelectedProgId] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: () => apiFetch<{ items: ApplicationItem[] }>('/api/applications'),
  });

  const { data: progList } = useQuery({
    queryKey: ['all-programmes-select'],
    queryFn: () =>
      apiFetch<{ items: Array<{ id: number; universityId: number; name: string; university: { name: string } }> }>(
        '/api/programmes'
      ),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const prog = progList?.items.find((p) => String(p.id) === selectedProgId);
      if (!prog) throw new Error('Select a programme.');
      return apiFetch('/api/applications', {
        method: 'POST',
        body: JSON.stringify({ universityId: prog.universityId, programmeId: prog.id }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      setCreateOpen(false);
      setSelectedProgId('');
      toast.success('Application added.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/api/applications/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      toast.success('Application status updated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/applications/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      setDeleteTargetId(null);
      toast.success('Application removed.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const apps = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2942] dark:text-white">My Applications</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage every application stage from initial research through offer acceptance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                viewMode === 'kanban' ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Kanban Board
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                viewMode === 'list' ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Table View
            </button>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>New Application</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse dark:border-slate-800 dark:bg-slate-900" />
      ) : apps.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-sm text-slate-500">No applications created yet.</p>
            <Button size="sm" onClick={() => setCreateOpen(true)}>Create First Application</Button>
          </CardContent>
        </Card>
      ) : viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((col) => {
            const colApps = apps.filter((a) => a.status === col);
            return (
              <div
                key={col}
                className="w-72 shrink-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/50"
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{col}</span>
                  <span className="font-mono text-xs tabular-nums text-slate-500">{colApps.length}</span>
                </div>

                <div className="space-y-3">
                  {colApps.map((app) => (
                    <div
                      key={app.id}
                      className="rounded-lg border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 space-y-2.5"
                    >
                      <Link
                        to={`/applications/${app.id}`}
                        className="block text-sm font-semibold text-[#0F2942] hover:underline dark:text-white"
                      >
                        {app.programme?.name}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {app.university?.name} · {app.university?.country}
                      </p>
                      <p className="text-xs font-mono text-slate-500">
                        Due: {app.applicationDeadline || 'Rolling'} · {app.attachedDocuments.length} docs
                      </p>

                      <Select
                        className="h-8 text-xs"
                        value={app.status}
                        onChange={(e) => updateStatusMutation.mutate({ id: app.id, status: e.target.value })}
                      >
                        {STATUSES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <tr>
                  <th className="py-2.5 pr-4">University &amp; Programme</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 pr-4">Deadline</th>
                  <th className="py-2.5 pr-4">Fee</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {apps.map((app) => (
                  <tr key={app.id}>
                    <td className="py-3 pr-4">
                      <Link to={`/applications/${app.id}`} className="font-semibold hover:underline">
                        {app.programme?.name}
                      </Link>
                      <p className="text-xs text-slate-500">{app.university?.name}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <Select
                        className="h-8 text-xs w-44"
                        value={app.status}
                        onChange={(e) => updateStatusMutation.mutate({ id: app.id, status: e.target.value })}
                      >
                        {STATUSES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs tabular-nums">{app.applicationDeadline || 'Rolling'}</td>
                    <td className="py-3 pr-4 font-mono text-xs tabular-nums">
                      {formatCurrency(app.applicationFee, app.currency || 'USD')}
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link to={`/applications/${app.id}`}>
                          <Button size="sm" variant="outline">Manage</Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Delete application"
                          onClick={() => setDeleteTargetId(app.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
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

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Track New Application">
        <div className="space-y-4">
          <div>
            <Label>Select Programme</Label>
            <Select value={selectedProgId} onChange={(e) => setSelectedProgId(e.target.value)}>
              <option value="">Choose a university programme...</option>
              {(progList?.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.university.name} — {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={!selectedProgId || createMutation.isPending} onClick={() => createMutation.mutate()}>
              Create Application
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        title="Delete Application?"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            This will remove the application tracker record and its status history. Uploaded documents in your vault will remain untouched.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTargetId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTargetId !== null && deleteMutation.mutate(deleteTargetId)}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Application'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export function ApplicationDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['application-detail', id],
    queryFn: () =>
      apiFetch<{
        application: ApplicationItem;
        university: { name: string; country: string } | null;
        programme: { name: string; degreeLevel: string } | null;
        history: Array<{ id: number; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string }>;
        attachedDocuments: Array<{ id: number; title: string; category: string }>;
      }>(`/api/applications/${id}`),
  });

  const { data: allDocs } = useQuery({
    queryKey: ['documents'],
    queryFn: () => apiFetch<{ items: Array<{ id: number; title: string; category: string }> }>('/api/documents'),
  });

  const [form, setForm] = useState<{
    status: string;
    applicationDeadline: string;
    submissionDate: string;
    portalUrl: string;
    notes: string;
  } | null>(null);

  useEffect(() => {
    if (data?.application) {
      setForm({
        status: data.application.status || 'Interested',
        applicationDeadline: data.application.applicationDeadline || '',
        submissionDate: data.application.submissionDate || '',
        portalUrl: data.application.portalUrl || '',
        notes: data.application.notes || '',
      });
    } else {
      setForm(null);
    }
  }, [id, data?.application]);

  const currentForm = form || {
    status: data?.application.status || 'Interested',
    applicationDeadline: data?.application.applicationDeadline || '',
    submissionDate: data?.application.submissionDate || '',
    portalUrl: data?.application.portalUrl || '',
    notes: data?.application.notes || '',
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/applications/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: currentForm.status,
          applicationDeadline: currentForm.applicationDeadline || null,
          submissionDate: currentForm.submissionDate || null,
          portalUrl: currentForm.portalUrl || null,
          notes: currentForm.notes || null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      toast.success('Application updated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const attachMutation = useMutation({
    mutationFn: (documentId: number) =>
      apiFetch(`/api/applications/${id}/documents`, {
        method: 'POST',
        body: JSON.stringify({ documentId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application-detail', id] });
      toast.success('Document attached.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const detachMutation = useMutation({
    mutationFn: (docId: number) =>
      apiFetch(`/api/applications/${id}/documents/${docId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application-detail', id] });
      toast.success('Document detached.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteDetailMutation = useMutation({
    mutationFn: () => apiFetch(`/api/applications/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      toast.success('Application deleted.');
      navigate('/applications');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !data) {
    return <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse dark:border-slate-800 dark:bg-slate-900" />;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Link to="/applications" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
            ← Back to Applications
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-[#0F2942] dark:text-white">
            {data.programme?.name}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {data.university?.name} · {data.university?.country} · {data.programme?.degreeLevel}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setConfirmDeleteOpen(true)} className="text-red-600 hover:text-red-700">
          <Trash2 className="h-4 w-4" />
          <span>Delete Application</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7">
          <CardHeader><CardTitle>Application Details &amp; Notes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Current Status</Label>
                <Select
                  value={currentForm.status}
                  onChange={(e) => setForm({ ...currentForm, status: e.target.value })}
                >
                  {STATUSES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Application Deadline</Label>
                <Input
                  type="date"
                  value={currentForm.applicationDeadline}
                  onChange={(e) => setForm({ ...currentForm, applicationDeadline: e.target.value })}
                />
              </div>
              <div>
                <Label>Submission Date</Label>
                <Input
                  type="date"
                  value={currentForm.submissionDate}
                  onChange={(e) => setForm({ ...currentForm, submissionDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Application Portal URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={currentForm.portalUrl}
                    onChange={(e) => setForm({ ...currentForm, portalUrl: e.target.value })}
                    placeholder="https://portal.university.edu"
                  />
                  {currentForm.portalUrl && (
                    <a href={currentForm.portalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center px-2">
                      <ExternalLink className="h-4 w-4 text-blue-700" />
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div>
              <Label>Personal Notes</Label>
              <Textarea
                value={currentForm.notes}
                onChange={(e) => setForm({ ...currentForm, notes: e.target.value })}
                placeholder="Track referee confirmations, portal login IDs, or scholarship essays..."
              />
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save Application Details'}
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attached Documents</CardTitle>
              <CardDescription>Link files from your Document Manager</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.attachedDocuments.length === 0 ? (
                <p className="text-xs text-slate-500">No documents attached yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.attachedDocuments.map((doc) => (
                    <div key={doc.id} className="py-2 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-medium">
                        <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                        {doc.title} ({doc.category})
                      </span>
                      <button
                        type="button"
                        onClick={() => detachMutation.mutate(doc.id)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {(allDocs?.items ?? []).length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) attachMutation.mutate(Number(e.target.value));
                    }}
                  >
                    <option value="">Attach an uploaded document...</option>
                    {allDocs!.items.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} ({d.category})
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Status History</CardTitle></CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              {data.history.map((h) => (
                <div key={h.id} className="border-b border-slate-100 dark:border-slate-800 pb-2 last:border-0">
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    {h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : `Created as ${h.toStatus}`}
                  </p>
                  {h.note && <p className="text-slate-500 mt-0.5">{h.note}</p>}
                  <p className="text-slate-400 mt-0.5">{formatDate(h.createdAt)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Delete Application?"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            This will permanently delete this application and its status timeline.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteDetailMutation.isPending}
              onClick={() => deleteDetailMutation.mutate()}
            >
              {deleteDetailMutation.isPending ? 'Deleting...' : 'Delete Application'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
