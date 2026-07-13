import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import type { CompanySummary } from '../../shared/types';
import { Button, Card } from '../components/ui';

export default function OpenCompanyPage() {
  const navigate = useNavigate();
  const { user, activeCompanyName, setActiveCompany } = useAuth();
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    async function loadCompanies() {
      setLoading(true);
      setError('');

      try {
        if (user!.activeCompanyId) {
          if (activeCompanyName) {
            navigate('/dashboard', { replace: true });
            return;
          }
          const selected = await api.userSetActiveCompany(user!.id, user!.activeCompanyId);
          if (cancelled) {
            return;
          }
          if (selected.success) {
            setActiveCompany(selected.user, selected.companyName);
            navigate('/dashboard', { replace: true });
            return;
          }
          setError(selected.error ?? 'Failed to open company.');
          return;
        }

        const result = await api.userGetCompanies(user!.id);
        if (cancelled) {
          return;
        }

        if (!result.success) {
          setError(result.error);
          return;
        }

        setCompanies(result.companies);

        if (result.companies.length === 1) {
          setSelecting(true);
          const selected = await api.userSetActiveCompany(user!.id, result.companies[0].id);
          if (cancelled) {
            return;
          }

          if (selected.success) {
            setActiveCompany(selected.user, selected.companyName);
            navigate('/dashboard', { replace: true });
            return;
          }

          setError(selected.error);
          setSelecting(false);
        }
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
  }, [user, activeCompanyName, navigate, setActiveCompany]);

  const handleCompanySelect = async (companyId: number) => {
    if (!user || selecting) {
      return;
    }

    setSelecting(true);
    setError('');

    try {
      const result = await api.userSetActiveCompany(user.id, companyId);
      if (result.success) {
        setActiveCompany(result.user, result.companyName);
        navigate('/dashboard', { replace: true });
        return;
      }
      setError(result.error);
    } catch {
      setError('Failed to open company. Please try again.');
    } finally {
      setSelecting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl">
        <Card title="Open Company">
          {loading || selecting ? (
            <p className="text-sm text-gray-500">
              {selecting ? 'Opening company…' : 'Loading companies…'}
            </p>
          ) : null}

          {error ? (
            <p className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {!loading && !selecting && companies.length === 0 ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 text-gray-600">
                <Building2 className="h-5 w-5 shrink-0" />
                <p>
                  No companies found. Go to Settings, connect to PostgreSQL, and click{' '}
                  <strong>Setup Tables &amp; Admin</strong> to create a default company.
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={() => navigate('/settings')}>
                Open Settings
              </Button>
            </div>
          ) : null}

          {!loading && !selecting && companies.length > 1 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {companies.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => handleCompanySelect(company.id)}
                  className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-indigo-600 hover:bg-indigo-50"
                >
                  <p className="font-medium text-gray-900">{company.name}</p>
                  {company.status ? (
                    <p className="mt-1 text-xs capitalize text-gray-500">{company.status}</p>
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
