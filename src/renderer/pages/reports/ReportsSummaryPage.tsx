import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Table, { type TableColumn } from '../../components/Table';
import { useToast } from '../../components/Toast';
import { Button, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import type { ReportsDashboardData, TransactionRecord } from '../../../shared/types';

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatTime(value: Date | string | null | undefined) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString();
}

export default function ReportsSummaryPage() {
  const allowed = useRoleGuard(['admin', 'owner', 'manager']);
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();

  const today = useMemo(() => new Date(), []);
  const [dateFrom, setDateFrom] = useState(toDateInputValue(today));
  const [dateTo, setDateTo] = useState(toDateInputValue(today));
  const [data, setData] = useState<ReportsDashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (companyId == null) return;
    setLoading(true);
    try {
      const result = await api.reportsDashboard(
        companyId,
        new Date(dateFrom).toISOString(),
        new Date(`${dateTo}T23:59:59.999`).toISOString(),
      );
      if (result.success) {
        setData(result.data);
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to load report summary.', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, dateFrom, dateTo, showToast]);

  useEffect(() => {
    if (allowed && companyId != null) void loadDashboard();
  }, [allowed, companyId, loadDashboard]);

  const txnColumns: TableColumn<TransactionRecord>[] = [
    {
      key: 'type',
      header: 'Type',
      render: (row) => row.type.replace('_', ' '),
    },
    {
      key: 'party',
      header: 'Buyer/Provider',
      render: (row) => row.buyerName ?? row.providerName ?? '—',
    },
    {
      key: 'draw',
      header: 'Draw',
      render: (row) => row.drawName ?? '—',
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => formatCurrency(Number(row.amount ?? 0)),
    },
    {
      key: 'time',
      header: 'Time',
      render: (row) => formatTime(row.enteredAt),
    },
  ];

  if (!allowed) return null;

  const summary = data?.summary;

  return (
    <div className="print-full-width mx-auto max-w-6xl text-content">
      <div className="mb-4">
        <PageHeader
          eyebrow="Reports"
          title="Reports Summary"
          subtitle="Dashboard overview of sales, purchases, and recent activity."
        />
      </div>

      <div className="no-print mb-6 flex flex-wrap items-end gap-4 rounded-cyber-lg border border-line bg-surface-raised p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Date From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Date To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
          />
        </label>
        <Button onClick={() => void loadDashboard()} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-cyber-lg border border-line bg-surface-raised p-4 shadow-sm">
          <p className="font-mono text-2xl font-bold text-cyber">{loading ? '…' : formatCurrency(summary?.sales ?? 0)}</p>
          <p className="mt-1 text-sm text-content-muted">Gross Sales</p>
        </div>
        <div className="rounded-cyber-lg border border-line bg-surface-raised p-4 shadow-sm">
          <p className="font-mono text-2xl font-bold text-content">
            {loading ? '…' : formatCurrency(summary?.purchases ?? 0)}
          </p>
          <p className="mt-1 text-sm text-content-muted">Net Purchases</p>
        </div>
        <div className="rounded-cyber-lg border border-line bg-surface-raised p-4 shadow-sm">
          <p className="font-mono text-2xl font-bold text-content">{loading ? '…' : formatCurrency(summary?.pwt ?? 0)}</p>
          <p className="mt-1 text-sm text-content-muted">PWT</p>
        </div>
        <div className="rounded-cyber-lg border border-line bg-surface-raised p-4 shadow-sm">
          <p className="font-mono text-2xl font-bold text-cyber-success">{loading ? '…' : formatCurrency(summary?.net ?? 0)}</p>
          <p className="mt-1 text-sm text-content-muted">Net Profit</p>
        </div>
        <div className="rounded-cyber-lg border border-line bg-surface-raised p-4 shadow-sm">
          <p className="font-mono text-2xl font-bold text-content">{loading ? '…' : (summary?.transactionCount ?? 0)}</p>
          <p className="mt-1 text-sm text-content-muted">Transactions</p>
        </div>
      </div>

      <div className="mb-6 rounded-cyber-lg border border-line bg-surface-raised p-4">
        <h2 className="mb-4 font-display text-sm font-bold text-content">Last 7 Days — Sales vs Purchases</h2>
        {data?.chartData ? (
          <div className="report-chart">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.chartData}>
                <CartesianGrid stroke="#29344d" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#a9b4c8" tick={{ fill: '#a9b4c8' }} />
                <YAxis stroke="#a9b4c8" tick={{ fill: '#a9b4c8' }} />
                <Tooltip
                  contentStyle={{ background: '#121a2b', border: '1px solid #3b4966', borderRadius: 6 }}
                  labelStyle={{ color: '#f2f6ff' }}
                  itemStyle={{ color: '#dce5f5' }}
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <Legend />
                <Bar className="report-chart-sales" dataKey="sales" fill="#22d3ee" name="Sales" />
                <Bar className="report-chart-purchases" dataKey="purchases" fill="#8b5cf6" name="Purchases" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-content-subtle">No chart data.</p>
        )}
      </div>

      <div>
        <h2 className="mb-3 font-display text-sm font-bold text-content">Recent Transactions</h2>
        {loading ? (
          <p className="text-sm text-content-subtle">Loading…</p>
        ) : (
          <Table
            columns={txnColumns}
            data={data?.recentTransactions ?? []}
            rowKey={(row) => row.id}
            density="normal"
          />
        )}
      </div>
    </div>
  );
}
