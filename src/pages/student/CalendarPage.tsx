import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api.ts';
import { Button } from '../../components/ui/button.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { Dialog } from '../../components/ui/dialog.tsx';
import { Input, Label, Select, Textarea } from '../../components/ui/input.tsx';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'application_opening', label: 'Application Openings' },
  { value: 'application_deadline', label: 'Application Deadlines' },
  { value: 'scholarship_deadline', label: 'Scholarship Deadlines' },
  { value: 'ielts_test', label: 'IELTS Test Dates' },
  { value: 'document_submission', label: 'Document Submissions' },
  { value: 'personal', label: 'Personal Reminders' },
];

interface Reminder {
  id: number;
  title: string;
  category: string;
  dueDate: string;
  notes: string | null;
  isCompleted: boolean;
  emailNotification: boolean;
}

interface SystemDeadline {
  id: string;
  title: string;
  category: string;
  dueDate: string;
  sourceUrl: string;
}

export function CalendarPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [addOpen, setAddOpen] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<number | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('personal');
  const [newDate, setNewDate] = useState(todayIso);
  const [newNotes, setNewNotes] = useState('');
  const [newEmailNotify, setNewEmailNotify] = useState(false);

  const resetDialog = () => {
    setAddOpen(false);
    setEditingReminderId(null);
    setNewTitle('');
    setNewCategory('personal');
    setNewDate(todayIso);
    setNewNotes('');
    setNewEmailNotify(false);
  };

  const openEditDialog = (r: Reminder) => {
    setEditingReminderId(r.id);
    setNewTitle(r.title);
    setNewCategory(r.category);
    setNewDate(r.dueDate);
    setNewNotes(r.notes || '');
    setNewEmailNotify(Boolean(r.emailNotification));
    setAddOpen(true);
  };

  const { data } = useQuery({
    queryKey: ['reminders'],
    queryFn: () =>
      apiFetch<{ reminders: Reminder[]; systemDeadlines: SystemDeadline[] }>('/api/reminders'),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: newTitle,
        category: newCategory,
        dueDate: newDate,
        notes: newNotes || null,
        emailNotification: newEmailNotify,
      };
      if (editingReminderId !== null) {
        return apiFetch(`/api/reminders/${editingReminderId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      }
      return apiFetch('/api/reminders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      toast.success(editingReminderId !== null ? 'Reminder updated.' : 'Reminder added.');
      resetDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isCompleted }: { id: number; isCompleted: boolean }) =>
      apiFetch(`/api/reminders/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isCompleted }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/reminders/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      toast.success('Reminder deleted.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const combinedEvents = useMemo(() => {
    const userItems = (data?.reminders ?? []).map((r) => ({
      id: `u-${r.id}`,
      rawId: r.id,
      rawReminder: r,
      title: r.title,
      category: r.category,
      dueDate: r.dueDate,
      isCompleted: r.isCompleted,
      isSystem: false,
    }));
    const sysItems = (data?.systemDeadlines ?? []).map((s) => ({
      id: s.id,
      rawId: null as number | null,
      rawReminder: null as Reminder | null,
      title: s.title,
      category: s.category,
      dueDate: s.dueDate,
      isCompleted: false,
      isSystem: true,
    }));
    return [...userItems, ...sysItems]
      .filter((ev) => (!categoryFilter ? true : ev.category === categoryFilter))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [data, categoryFilter]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDayOfWeek = new Date(year, month, 1).getDay();

  const calendarCells = useMemo(() => {
    if (viewMode === 'week') {
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay());
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
      });
    }

    const cells: Array<Date | null> = [];
    for (let i = 0; i < startDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [viewMode, currentDate, startDayOfWeek, daysInMonth, year, month]);

  const shiftPeriod = (dir: -1 | 1) => {
    if (viewMode === 'week') {
      const next = new Date(currentDate);
      next.setDate(currentDate.getDate() + dir * 7);
      setCurrentDate(next);
    } else {
      setCurrentDate(new Date(year, month + dir, 1));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2942] dark:text-white">Deadline Calendar</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            University application openings, scholarship cutoffs, IELTS test dates, and personal reminders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select className="w-48" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                viewMode === 'month' ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                viewMode === 'week' ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Weekly
            </button>
          </div>
          <Button
            size="sm"
            onClick={() => {
              resetDialog();
              setAddOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            <span>Add Reminder</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>{monthName}</CardTitle>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const now = new Date();
                  setCurrentDate(
                    viewMode === 'week'
                      ? now
                      : new Date(now.getFullYear(), now.getMonth(), 1)
                  );
                }}
              >
                Today
              </Button>
              <Button size="icon" variant="outline" aria-label="Previous period" onClick={() => shiftPeriod(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" aria-label="Next period" onClick={() => shiftPeriod(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {calendarCells.map((dateObj, idx) => {
                if (!dateObj) {
                  return <div key={`empty-${idx}`} className="min-h-[84px] rounded-lg bg-slate-50/50 dark:bg-slate-950/30" />;
                }
                const iso = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                const dayEvents = combinedEvents.filter((e) => e.dueDate === iso);

                return (
                  <div
                    key={iso}
                    className="min-h-[84px] rounded-lg border border-slate-200 p-1.5 text-left dark:border-slate-800"
                  >
                    <p className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {dateObj.getDate()}
                    </p>
                    <div className="mt-1 space-y-1">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          title={ev.title}
                          className={`truncate rounded px-1 py-0.5 text-[10px] font-medium ${
                            ev.isSystem
                              ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                              : ev.isCompleted
                                ? 'bg-slate-100 text-slate-400 line-through dark:bg-slate-800'
                                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                          }`}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <p className="text-[10px] text-slate-400">+{dayEvents.length - 2} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Upcoming Deadlines &amp; Tasks</CardTitle>
            <CardDescription>Click checkmark to complete personal reminders</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[540px] overflow-y-auto">
            {combinedEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5 last:border-0 dark:border-slate-800"
              >
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${ev.isCompleted ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                    {ev.title}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                    {ev.dueDate} · {ev.category.replace('_', ' ')}
                  </p>
                </div>
                {!ev.isSystem && ev.rawId !== null && ev.rawReminder && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleMutation.mutate({ id: ev.rawId!, isCompleted: !ev.isCompleted })}
                      className={`rounded p-1 ${ev.isCompleted ? 'text-emerald-600' : 'text-slate-400 hover:text-emerald-600'}`}
                      aria-label="Toggle completed"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditDialog(ev.rawReminder!)}
                      className="rounded p-1 text-slate-400 hover:text-blue-600"
                      aria-label="Edit reminder"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(ev.rawId!)}
                      className="rounded p-1 text-slate-400 hover:text-red-600"
                      aria-label="Delete reminder"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={addOpen}
        onClose={resetDialog}
        title={editingReminderId !== null ? 'Edit Reminder' : 'Add Custom Reminder'}
      >
        <div className="space-y-4">
          <div>
            <Label>Reminder Title</Label>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Submit IELTS Score to TUM Portal" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                {CATEGORIES.filter((c) => c.value !== '').map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notes (Optional)</Label>
            <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={newEmailNotify}
              onChange={(e) => setNewEmailNotify(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>Opt-in for email reminder (requires configured SMTP provider)</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetDialog}>Cancel</Button>
            <Button disabled={!newTitle.trim() || !newDate || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {editingReminderId !== null ? 'Update Reminder' : 'Save Reminder'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
