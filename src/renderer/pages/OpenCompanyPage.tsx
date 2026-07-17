import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import type { CompanySummary } from '../../shared/types';
import { Button, Card } from '../components/ui';
import { InlineSpinner } from '../components/LoadingSpinner';

export default function OpenCompanyPage() {
  const navigate = useNavigate();
  const { user, setActiveCompany } = useAuth();
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }
    const currentUser = user;

    let cancelled = false;

    async function loadCompanies() {
      setLoading(true);
      setError('');

      try {
        const result = await api.userGetCompanies(currentUser.id);
        if (cancelled) {
          return;
        }

        if (!result.success) {
          setError(result.error);
          return;
        }

        setCompanies(result.companies);

      } catch {
        if (!cancelled) {
          setError('Failed to load companies. Restart the app and try again.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCompanies();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleCompanySelect = async (companyId: number) => {
    if (!user || selecting) {
      return;
    }

    setSelecting(true);
    setSelectedCompanyId(companyId);
    setError('');

    try {
      const result = await api.userSetActiveCompany(user.id, companyId);
      if (result.success) {
        setActiveCompany(result.user, result.companyName);
        navigate('/open-shift', { replace: true });
        return;
      }
      setError(result.error);
    } catch {
      setError('Failed to open company. Please try again.');
    } finally {
      setSelecting(false);
      setSelectedCompanyId(null);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas p-4 text-content sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyber/5 blur-3xl"
      />
      <div className="relative w-full max-w-[640px]">
        <Card className="border-line-strong p-6 sm:p-10">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-7 w-7 text-cyber" aria-hidden="true" />
              <h1 className="font-display text-2xl font-bold text-content sm:text-[28px]">
                Open Company
              </h1>
            </div>
            <p className="mt-3 text-base text-content-muted">Select a company to open:</p>
            <div className="mt-6 grid grid-cols-3 gap-2" aria-hidden="true">
              <span className="h-1.5 rounded-full bg-cyber" />
              <span className="h-1.5 rounded-full bg-line" />
              <span className="h-1.5 rounded-full bg-line" />
            </div>
          </div>

          {loading || selecting ? (
            <p
              className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.05em] text-content-subtle"
              aria-live="polite"
            >
              <InlineSpinner />
              {selecting ? 'Opening company…' : 'Loading companies…'}
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="mb-4 rounded-cyber border border-cyber-error/50 bg-cyber-error/10 px-3 py-2 text-sm text-cyber-error"
            >
              {error}
            </p>
          ) : null}

          {!loading && !selecting && companies.length === 0 ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-cyber border border-line bg-surface-low p-4 text-content-muted">
                <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-cyber" aria-hidden="true" />
                <p>
                  No companies found. Go to Settings, connect to PostgreSQL, and click{' '}
                  <strong className="text-content">Setup Tables &amp; Admin</strong> to create a
                  default company.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                allowOffline
                onClick={() => navigate('/settings')}
              >
                Open Settings
              </Button>
            </div>
          ) : null}

          {!loading && !selecting && companies.length > 0 ? (
            <div className="flex flex-col gap-3">
              {companies.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  aria-pressed={selectedCompanyId === company.id}
                  onClick={() => handleCompanySelect(company.id)}
                  className="group flex min-h-16 w-full items-center gap-4 rounded-cyber-lg border border-line-strong bg-surface-high px-5 py-4 text-left transition-colors hover:border-cyber hover:bg-cyber-soft focus-visible:border-cyber focus-visible:ring-2 focus-visible:ring-cyber/40"
                >
                  <Building2
                    className="h-5 w-5 shrink-0 text-cyber group-hover:text-cyber-hover"
                    aria-hidden="true"
                  />
                  <p className="min-w-0 flex-1 truncate text-base font-medium text-content">
                    {company.name}
                  </p>
                  {company.status ? (
                    <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-content-subtle">
                      {company.status}
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
