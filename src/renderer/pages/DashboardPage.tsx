import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Landmark,
  ListPlus,
  ReceiptIndianRupee,
  RefreshCw,
  Shield,
  ShoppingBag,
  ShoppingCart,
  TicketPlus,
} from 'lucide-react';
import Badge, { roleBadgeColor } from '../components/Badge';
import { PageHeader } from '../components/ui';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { buildNavigation } from '../lib/navigation';
import { isAtLeastRole, ROLE_LABELS } from '../lib/roles';
import { formatAmount, formatTxnDate } from '../lib/transactionDisplay';
import type { DrawRecord, ReportsSummary, TransactionRecord } from '../../shared/types';

function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getTimestamp(transaction: TransactionRecord): number {
  const value = transaction.enteredAt ?? transaction.createdAt;
  return value ? new Date(value).getTime() : 0;
}

function isToday(value: Date): boolean {
  const date = new Date(value);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
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

function PanelState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-3 px-4 py-6 text-center">
      <p className="text-sm text-content-subtle" role={onRetry ? 'alert' : undefined}>{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-cyber border border-line-strong px-3 py-1.5 text-xs font-semibold text-content-muted transition-colors hover:bg-surface-high hover:text-content focus:outline-none focus:ring-2 focus:ring-cyber/30"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </button>
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  const { user, activeCompanyName, activeShift } = useAuth();
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [draws, setDraws] = useState<DrawRecord[]>([]);
  const [drawsLoading, setDrawsLoading] = useState(true);
  const [drawsError, setDrawsError] = useState<string | null>(null);
  const summaryRequestId = useRef(0);
  const transactionsRequestId = useRef(0);
  const drawsRequestId = useRef(0);
  const companyId = user?.activeCompanyId ?? null;
  const canViewMetrics = user ? isAtLeastRole(user.role, 'manager') : false;

  const loadSummary = useCallback(async () => {
    const requestId = ++summaryRequestId.current;
    setSummary(null);
    setSummaryError(null);
    if (!companyId || !activeShift || !canViewMetrics) {
      setSummaryLoading(false);
      return;
    }
    setSummaryLoading(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    try {
      const result = await api.reportsSummary(
        companyId,
        todayStart.toISOString(),
        todayEnd.toISOString(),
      );
      if (requestId !== summaryRequestId.current) return;
      if (result.success) setSummary(result.summary);
      else setSummaryError(result.error);
    } catch {
      if (requestId !== summaryRequestId.current) return;
      setSummaryError('Could not load today’s metrics.');
    } finally {
      if (requestId === summaryRequestId.current) setSummaryLoading(false);
    }
  }, [companyId, activeShift, canViewMetrics]);

  const loadTransactions = useCallback(async () => {
    const requestId = ++transactionsRequestId.current;
    setTransactions([]);
    setTransactionsError(null);
    if (!companyId || !activeShift) {
      setTransactionsLoading(false);
      return;
    }
    setTransactionsLoading(true);
    try {
      const result = await api.transactionsList(companyId);
      if (requestId !== transactionsRequestId.current) return;
      if (result.success) setTransactions(result.transactions);
      else setTransactionsError(result.error);
    } catch {
      if (requestId !== transactionsRequestId.current) return;
      setTransactionsError('Could not load recent transactions.');
    } finally {
      if (requestId === transactionsRequestId.current) setTransactionsLoading(false);
    }
  }, [companyId, activeShift]);

  const loadDraws = useCallback(async () => {
    const requestId = ++drawsRequestId.current;
    setDraws([]);
    setDrawsError(null);
    if (!companyId || !activeShift) {
      setDrawsLoading(false);
      return;
    }
    setDrawsLoading(true);
    try {
      const result = await api.drawsList(companyId);
      if (requestId !== drawsRequestId.current) return;
      if (result.success) setDraws(result.draws);
      else setDrawsError(result.error);
    } catch {
      if (requestId !== drawsRequestId.current) return;
      setDrawsError('Could not load draw status.');
    } finally {
      if (requestId === drawsRequestId.current) setDrawsLoading(false);
    }
  }, [companyId, activeShift]);

  useEffect(() => {
    void loadSummary();
    void loadTransactions();
    void loadDraws();
    return () => {
      summaryRequestId.current += 1;
      transactionsRequestId.current += 1;
      drawsRequestId.current += 1;
    };
  }, [loadSummary, loadTransactions, loadDraws]);

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => getTimestamp(b) - getTimestamp(a)).slice(0, 6),
    [transactions],
  );

  const currentDraw = useMemo(() => {
    const todayDraws = draws.filter((draw) => isToday(draw.drawDate));
    return todayDraws.find((draw) => draw.status === 'open') ?? todayDraws[0] ?? null;
  }, [draws]);

  const quickActions = useMemo(() => {
    if (!user) return [];
    const allowedPaths = new Set(buildNavigation(user.role).transactions.map((item) => item.path));
    return [
      { label: 'New Sale', path: '/transactions/sale-entry', icon: ShoppingCart },
      { label: 'New Purchase', path: '/transactions/purchase-entry', icon: ShoppingBag },
      { label: 'New Booking', path: '/transactions/booking-entry', icon: TicketPlus },
      { label: 'View Draws', path: '/draws', icon: ListPlus },
    ].filter((action) => allowedPaths.has(action.path));
  }, [user]);

  if (!user) {
    return null;
  }

  if (!user.activeCompanyId) {
    return (
      <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center text-center">
        <div className="max-w-xl">
          <Shield className="mx-auto mb-3 h-8 w-8 text-content-subtle" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold text-content">
            Welcome, {user.fullName ?? user.username}
          </h2>
          <p className="mt-1.5 text-xs text-content-muted">
            Select an action from the Admin Panel to get started.
          </p>
        </div>
      </div>
    );
  }

  if (!activeShift) {
    return <Navigate to="/open-shift" replace />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Operations overview"
        title={`Welcome, ${user.fullName ?? user.username}`}
        subtitle={`${activeCompanyName ?? 'No active company'} · Today`}
        actions={<Badge label={ROLE_LABELS[user.role]} color={roleBadgeColor(user.role)} />}
      />

      {canViewMetrics ? (
        <>
          <section aria-label="Today's performance" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Draws Today"
              value={summaryLoading ? '…' : summaryError ? '—' : (summary?.drawsToday ?? 0)}
              accent="bg-cyber-warning"
              icon={<CalendarDays className="h-4 w-4" />}
            />
            <StatCard
              label="Total Sales"
              value={summaryLoading ? '…' : summaryError ? '—' : formatCurrency(summary?.sales ?? 0)}
              accent="bg-cyber-info"
              icon={<ShoppingCart className="h-4 w-4" />}
            />
            <StatCard
              label="Total Purchases"
              value={summaryLoading ? '…' : summaryError ? '—' : formatCurrency(summary?.purchases ?? 0)}
              accent="bg-cyber"
              icon={<ReceiptIndianRupee className="h-4 w-4" />}
            />
            <StatCard
              label="Net"
              value={summaryLoading ? '…' : summaryError ? '—' : formatCurrency(summary?.net ?? 0)}
              accent="bg-cyber-success"
              icon={<Landmark className="h-4 w-4" />}
            />
          </section>

          {summaryError ? (
            <div className="flex items-center justify-between gap-3 rounded-cyber border border-cyber-error/30 bg-cyber-error/10 px-3 py-2 text-xs text-cyber-error" role="alert">
              <span>{summaryError}</span>
              <button type="button" onClick={() => void loadSummary()} className="rounded-cyber px-2 py-1 font-semibold hover:bg-cyber-error/10 focus:outline-none focus:ring-2 focus:ring-cyber-error/30">
                Retry metrics
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(260px,0.8fr)]">
        <section
          aria-label="Recent transactions"
          className="min-w-0 overflow-hidden rounded-cyber-lg border border-line bg-surface-raised"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-content-subtle">Live register</p>
              <h2 className="font-display text-base font-bold text-content">Recent Transactions</h2>
            </div>
            <Link to="/transactions/sale" className="inline-flex items-center gap-1 text-xs font-semibold text-cyber-hover hover:text-content focus:outline-none focus:ring-2 focus:ring-cyber/30">
              View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          {transactionsLoading ? (
            <PanelState message="Loading recent transactions…" />
          ) : transactionsError ? (
            <PanelState message={transactionsError} onRetry={() => void loadTransactions()} />
          ) : recentTransactions.length === 0 ? (
            <PanelState message="No transactions recorded yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-surface-high text-left">
                  <tr className="font-mono text-[10px] uppercase tracking-[0.05em] text-content-subtle">
                    <th className="px-4 py-2.5 font-medium">Memo</th>
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 font-medium">Party</th>
                    <th className="px-4 py-2.5 font-medium">Draw</th>
                    <th className="px-4 py-2.5 font-medium">Entered</th>
                    <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recentTransactions.map((transaction) => (
                    <tr key={transaction.id} className="text-content-muted hover:bg-surface-high">
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-content">{transaction.memoId ?? `#${transaction.id}`}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 capitalize">{transaction.type.replaceAll('_', ' ')}</td>
                      <td className="max-w-44 truncate px-4 py-2.5">{transaction.buyerName ?? transaction.providerName ?? '—'}</td>
                      <td className="max-w-44 truncate px-4 py-2.5">{transaction.drawName ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">{formatTxnDate(transaction.enteredAt ?? transaction.createdAt)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-content">{formatAmount(transaction.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="space-y-4" aria-label="Current operation status">
          <section className="rounded-cyber-lg border border-line bg-surface-raised">
            <div className="border-b border-line px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-content-subtle">Active session</p>
              <h2 className="font-display text-base font-bold text-content">Company & Shift</h2>
            </div>
            <dl className="grid gap-3 p-4 text-sm">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.05em] text-content-subtle">Company</dt>
                <dd className="mt-0.5 font-semibold text-content">{activeCompanyName ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.05em] text-content-subtle">Shift</dt>
                <dd className="mt-0.5 font-semibold text-content">{activeShift.name}</dd>
                <dd className="text-xs text-content-subtle">{activeShift.shiftGroupName}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-cyber-lg border border-line bg-surface-raised">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <Clock3 className="h-4 w-4 text-cyber-hover" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-content">Current Draw</h2>
            </div>
            {drawsLoading ? (
              <PanelState message="Loading draw status…" />
            ) : drawsError ? (
              <PanelState message={drawsError} onRetry={() => void loadDraws()} />
            ) : currentDraw ? (
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-content">{currentDraw.name}</p>
                    <p className="mt-1 text-xs text-content-subtle">
                      {currentDraw.closeTime ? `Closes ${currentDraw.closeTime}` : 'No close time set'}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                    currentDraw.status === 'open'
                      ? 'bg-cyber-success/10 text-cyber-success'
                      : 'bg-surface-high text-content-muted'
                  }`}>
                    {currentDraw.status ?? 'unknown'}
                  </span>
                </div>
              </div>
            ) : (
              <PanelState message="No draw scheduled for today." />
            )}
          </section>
        </aside>
      </div>

      <section className="rounded-cyber-lg border border-line bg-surface-low p-3" aria-label="Quick actions">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map(({ label, path, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className="flex items-center gap-2 rounded-cyber border border-line bg-surface-raised px-3 py-2 text-sm font-semibold text-content-muted transition-colors hover:border-line-strong hover:bg-surface-high hover:text-content focus:outline-none focus:ring-2 focus:ring-cyber/30"
            >
              <Icon className="h-4 w-4 text-cyber-hover" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
