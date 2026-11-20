import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api.ts';
import { Button } from '../../components/ui/button.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { formatCurrency } from '../../lib/utils.ts';

interface ShortlistItem {
  id: number;
  itemType: 'university' | 'programme' | 'scholarship';
  university: { id: number; name: string; country: string; city: string } | null;
  programme: { id: number; name: string; degreeLevel: string; tuitionFee: number; currency: string } | null;
  scholarship: { id: number; name: string; provider: string; country: string; applicationDeadline: string | null } | null;
  createdAt: string;
}

export function ShortlistPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['shortlist'],
    queryFn: () => apiFetch<{ items: ShortlistItem[] }>('/api/shortlist'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/shortlist/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shortlist'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      toast.success('Removed from shortlist.');
    },
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2942] dark:text-white">My Shortlist</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Your saved universities, programmes, and scholarship opportunities.
          </p>
        </div>
        <Link to="/universities">
          <Button size="sm" variant="outline">Browse More</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="h-48 rounded-xl border border-slate-200 bg-white animate-pulse dark:border-slate-800 dark:bg-slate-900" />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You haven’t shortlisted any universities, programmes, or scholarships yet.
            </p>
            <div className="flex justify-center gap-3">
              <Link to="/universities"><Button size="sm">Find Universities</Button></Link>
              <Link to="/scholarships"><Button size="sm" variant="outline">Browse Scholarships</Button></Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400 capitalize">
                      {item.itemType}
                    </p>
                    <CardTitle className="mt-1 text-base">
                      {item.programme?.name || item.university?.name || item.scholarship?.name}
                    </CardTitle>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMutation.mutate(item.id)}
                    aria-label="Remove from shortlist"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
                {item.programme && (
                  <p>
                    {item.university?.name} · {item.programme.degreeLevel} ·{' '}
                    <span className="font-mono">{formatCurrency(item.programme.tuitionFee, item.programme.currency)}</span>
                  </p>
                )}
                {item.itemType === 'university' && item.university && (
                  <p>{item.university.city}, {item.university.country}</p>
                )}
                {item.scholarship && (
                  <p>{item.scholarship.provider} · {item.scholarship.country} · Due {item.scholarship.applicationDeadline || 'See portal'}</p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  {item.programme && (
                    <>
                      <Link to={`/programmes/${item.programme.id}`}><Button size="sm" variant="outline">Details</Button></Link>
                      <Link to={`/eligibility?programmeId=${item.programme.id}`}><Button size="sm">Check Eligibility</Button></Link>
                    </>
                  )}
                  {item.itemType === 'university' && item.university && (
                    <Link to={`/universities/${item.university.id}`}><Button size="sm" variant="outline">View University</Button></Link>
                  )}
                  {item.scholarship && (
                    <Link to={`/scholarships/${item.scholarship.id}`}><Button size="sm" variant="outline">View Scholarship</Button></Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
