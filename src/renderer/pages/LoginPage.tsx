import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, LogIn } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Button, Card, Input } from '../components/ui';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === ',') {
        event.preventDefault();
        navigate('/settings');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username.trim(), password);
      if (result.success) {
        navigate(result.redirectTo ?? '/open-company');
      } else {
        setError(result.error ?? 'Unable to sign in. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-canvas text-content">
      <header className="relative z-10 flex h-12 shrink-0 items-center border-b border-line bg-surface/80 px-4">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded border-2 border-cyber shadow-[0_0_12px_rgba(124,92,252,0.35)]" />
          <span className="font-display text-sm font-bold uppercase tracking-[0.08em]">
            Best-<span className="text-cyber">12</span>
          </span>
        </div>
      </header>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[12%] top-[36%] h-64 w-64 rounded-full bg-cyber/5 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[14%] right-[9%] h-52 w-52 rounded-full bg-cyber/5 blur-3xl"
      />

      <main className="relative z-10 flex flex-1 items-center justify-center p-4 sm:p-6">
        <Card className="w-full max-w-[480px] border-line-strong p-6 sm:p-8">
          <div className="mb-6">
            <div className="mb-4 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.08em]">
              <span className="h-3 w-3 rounded border-2 border-cyber" />
              <span>
                Best-<span className="text-cyber">12</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <LogIn className="h-6 w-6 text-cyber" aria-hidden="true" />
              <h1 className="font-display text-2xl font-bold text-content">Sign in</h1>
            </div>
            <p className="mt-2 text-sm text-content-muted">Enter your credentials to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            {error ? (
              <p
                role="alert"
                className="rounded-cyber border border-cyber-error/50 bg-cyber-error/10 px-3 py-2 text-sm text-cyber-error"
              >
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={loading} className="mt-1 w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
      </main>

      <footer className="relative z-10 border-t border-line bg-surface/80 px-4 py-3 text-center text-content-subtle">
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.05em]">
            <Database className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              Press <kbd className="rounded border border-line-strong bg-surface-high px-1.5 py-0.5">Ctrl+,</kbd>{' '}
              to configure database connection
            </span>
          </div>
          <span className="text-xs text-content-subtle">
            First time? Connect in Settings, then run Setup Tables &amp; Admin
          </span>
          <Button
            type="button"
            variant="secondary"
            allowOffline
            onClick={() => navigate('/settings')}
            className="mt-1 inline-flex items-center gap-2"
          >
            <Database className="h-4 w-4" aria-hidden="true" />
            Database Setup
          </Button>
        </div>
      </footer>
    </div>
  );
}
