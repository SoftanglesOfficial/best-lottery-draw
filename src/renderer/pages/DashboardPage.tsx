import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, Landmark, ReceiptIndianRupee, ShoppingCart } from 'lucide-react';
import Badge, { roleBadgeColor } from '../components/Badge';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { ROLE_LABELS } from '../lib/roles';
import type { ReportsSummary } from '../../shared/types';
import { Button } from '../components/ui';

function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string | number;
  accent: string;
  icon: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-cyber-lg border border-line bg-surface-raised p-4">
      <span className={`absolute inset-x-0 top-0 h-0.5 ${accent}`} aria-hidden="true" />
      <div className="mb-5 flex items-center justify-between">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-content-subtle">
          {label}
        </p>
        <span className="text-content-subtle" aria-hidden="true">{icon}</span>
      </div>
      <p className="font-display text-2xl font-bold tabular-nums text-content">{value}</p>
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
    <div className="space-y-4">
      <section className="rounded-cyber-lg border border-line bg-surface-low px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-cyber-hover">
              Operations overview
            </p>
            <h1 className="truncate font-display text-2xl font-bold text-content">
              Welcome, {user.fullName ?? user.username}
            </h1>
            <p className="mt-1 text-sm text-content-subtle">
              {activeCompanyName ?? 'No active company'} · Today
            </p>
          </div>
          <Badge label={ROLE_LABELS[user.role]} color={roleBadgeColor(user.role)} />
        </div>
      </section>

      <section aria-label="Today's performance" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Draws Today"
          value={loading ? '…' : (summary?.drawsToday ?? 0)}
          accent="bg-cyber-warning"
          icon={<CalendarDays className="h-4 w-4" />}
        />
        <StatCard
          label="Total Sales"
          value={loading ? '…' : formatCurrency(summary?.sales ?? 0)}
          accent="bg-cyber-info"
          icon={<ShoppingCart className="h-4 w-4" />}
        />
        <StatCard
          label="Total Purchases"
          value={loading ? '…' : formatCurrency(summary?.purchases ?? 0)}
          accent="bg-cyber"
          icon={<ReceiptIndianRupee className="h-4 w-4" />}
        />
        <StatCard
          label="Net"
          value={loading ? '…' : formatCurrency(summary?.net ?? 0)}
          accent="bg-cyber-success"
          icon={<Landmark className="h-4 w-4" />}
        />
      </section>

      <section className="rounded-cyber-lg border border-line bg-surface-raised">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-content-subtle">
              Workflow
            </p>
            <h2 className="font-display text-base font-bold text-content">Quick Actions</h2>
          </div>
          <ArrowUpRight className="h-4 w-4 text-cyber-hover" aria-hidden="true" />
        </div>
        <div className="grid gap-2 p-4 sm:grid-cols-3">
          <Link to="/transactions/sale-entry" className="block">
            <Button type="button" className="w-full">
              New Sale Entry
            </Button>
          </Link>
          <Link to="/transactions/purchase-entry" className="block">
            <Button type="button" variant="secondary" className="w-full">
              New Purchase Entry
            </Button>
          </Link>
          <Link to="/draws" className="block">
            <Button type="button" variant="secondary" className="w-full">
              View Draws
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
