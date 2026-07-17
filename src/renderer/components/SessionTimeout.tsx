import { useCallback, useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import Modal from './Modal';
import { Button } from './ui';
import { useAuth } from '../lib/auth';

const TIMEOUT_MS = 30 * 60 * 1000;

export default function SessionTimeout() {
  const { user, logout } = useAuth();
  const [expired, setExpired] = useState(false);

  const resetTimer = useCallback(() => {
    if (!user) return;
    setExpired(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let timer = window.setTimeout(() => setExpired(true), TIMEOUT_MS);

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'] as const;
    const onActivity = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setExpired(true), TIMEOUT_MS);
    };

    for (const event of events) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    return () => {
      window.clearTimeout(timer);
      for (const event of events) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, [user, resetTimer]);

  if (!expired || !user) return null;

  return (
    <Modal title="Session Expired" onClose={() => setExpired(false)}>
      <div className="mb-5 flex items-start gap-3 rounded-cyber border border-cyber-warning/40 bg-cyber-warning/10 p-4">
        <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-cyber-warning" aria-hidden="true" />
        <p className="text-sm text-content-muted">
          Your session has expired due to inactivity. Please login again.
        </p>
      </div>
      <Button type="button" className="w-full" onClick={logout}>
        Login Again
      </Button>
    </Modal>
  );
}
