import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database } from 'lucide-react';
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
    } catch {
      setError('Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="flex flex-1 items-center justify-center p-4">
        <Card title="Sign in" className="w-full max-w-md">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
              <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
      </div>

      <footer className="border-t border-gray-300 px-4 py-3 text-center text-sm text-gray-500">
        <div className="flex flex-col items-center justify-center gap-1">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span>Press Ctrl+, to configure database connection</span>
          </div>
          <span className="text-xs text-gray-400">
            First time? Connect in Settings, then run Setup Tables &amp; Admin
          </span>
          <Button
            type="button"
            variant="secondary"
            allowOffline
            onClick={() => navigate('/settings')}
            className="mt-2 inline-flex items-center gap-2"
          >
            <Database className="h-4 w-4" />
            Database Setup
          </Button>
        </div>
      </footer>
    </div>
  );
}
