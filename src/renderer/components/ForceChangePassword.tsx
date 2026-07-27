import { FormEvent, useState } from 'react';
import { KeyRound } from 'lucide-react';
import Modal from './Modal';
import { Button, Input } from './ui';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { useToast } from './Toast';

/** Blocks the app until the default seed password is replaced. */
export default function ForceChangePassword() {
  const { user, mustChangePassword, clearMustChangePassword, logout } = useAuth();
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('admin123');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  if (!mustChangePassword || !user) return null;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirm) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await api.authChangePassword(user.id, currentPassword, newPassword);
      if (!result.success) {
        showToast(result.error ?? 'Failed to change password', 'error');
        return;
      }
      clearMustChangePassword();
      showToast('Password updated.', 'success');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Change default password" onClose={() => void logout()}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex items-start gap-3 rounded-cyber border border-cyber-warning/40 bg-cyber-warning/10 p-4">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-cyber-warning" aria-hidden="true" />
          <p className="text-sm text-content-muted">
            You signed in with the default seed password. Choose a new password before continuing.
            Closing this dialog logs you out.
          </p>
        </div>
        <Input
          label="Current password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <Input
          label="New password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
        <Input
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    </Modal>
  );
}
