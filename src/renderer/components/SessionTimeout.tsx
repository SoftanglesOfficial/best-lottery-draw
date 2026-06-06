import { useCallback, useEffect, useState } from 'react';
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
    <Modal title="Session Expired"   onClose={() => setExpired(false)}>
      <p className="mb-4 text-sm text-gray-600">
        Your session has expired due to inactivity. Please login again.
      </p>
      <Button type="button" className="w-full" onClick={logout}>
        Login Again
      </Button>
    </Modal>
  );
}
