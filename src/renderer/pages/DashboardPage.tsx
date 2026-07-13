import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FullPageLoading } from '../components/LoadingSpinner';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { ROLE_BADGE_CLASSES, ROLE_LABELS } from '../lib/roles';
import type { ReportsSummary } from '../../shared/types';
import { Button } from '../components/ui';

function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user, activeCompanyName } = useAuth();
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.activeCompanyId) {
      setLoading(false);
      return;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    api.reportsSummary(
      user.activeCompanyId,
      todayStart.toISOString(),
      todayEnd.toISOString(),
    )
      .then((result) => {
        if (result.success) {
          setSummary(result.summary);
        }
      })
      .finally(() => setLoading(false));
  }, [user?.activeCompanyId]);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Welcome, {user.fullName ?? user.username}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {activeCompanyName ?? 'No active company'}
            </p>
          </div>
          <span
            className={`rounded px-2 py-1 text-xs font-medium ${ROLE_BADGE_CLASSES[user.role]}`}
          >
            {ROLE_LABELS[user.role]}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Draws Today"
          value={loading ? '…' : (summary?.drawsToday ?? 0)}
        />
        <StatCard
          label="Total Sales"
          value={loading ? '…' : formatCurrency(summary?.sales ?? 0)}
        />
        <StatCard
          label="Total Purchases"
          value={loading ? '…' : formatCurrency(summary?.purchases ?? 0)}
        />
        <StatCard
          label="Net"
          value={loading ? '…' : formatCurrency(summary?.net ?? 0)}
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-700">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/transactions/sale-entry">
            <Button type="button">New Sale Entry</Button>
          </Link>
          <Link to="/transactions/purchase-entry">
            <Button type="button" variant="secondary">
              New Purchase Entry
            </Button>
          </Link>
          <Link to="/draws">
            <Button type="button" variant="secondary">
              View Draws
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
