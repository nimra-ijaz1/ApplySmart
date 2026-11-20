import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { apiFetch } from '../../lib/api.ts';
import { Button } from '../../components/ui/button.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { Dialog } from '../../components/ui/dialog.tsx';

export function SettingsPage() {
  const { dbUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await apiFetch('/api/account', { method: 'DELETE' });
      await logout();
      toast.success('Your account and personal records have been deleted.');
      navigate('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to delete account.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0F2942] dark:text-white">Account Settings</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Manage appearance, privacy preferences, and account data.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose Light or Dark theme for your workspace</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button
            type="button"
            variant={theme === 'light' ? 'default' : 'outline'}
            onClick={() => setTheme('light')}
          >
            Light Mode
          </Button>
          <Button
            type="button"
            variant={theme === 'dark' ? 'default' : 'outline'}
            onClick={() => setTheme('dark')}
          >
            Dark Mode
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>Signed-in Email:</strong> {dbUser?.email}</p>
          <p><strong>Role:</strong> {dbUser?.role}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-red-700 dark:text-red-400">Delete Account &amp; Personal Data</CardTitle>
          <CardDescription>
            Permanently remove your student profile, uploaded documents, applications, and chat history from PostgreSQL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
            Delete My Data
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Confirm Permanent Data Deletion"
        description="This immediately deletes your ApplySmart profile, uploaded files, and application records."
      >
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Yes, Delete Everything'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
