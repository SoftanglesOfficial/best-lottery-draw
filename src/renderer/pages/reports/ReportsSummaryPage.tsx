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
import { Button } from '../../components/ui';
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
    <div className="print-full-width mx-auto max-w-6xl bg-white">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Reports Summary</h1>

      <div className="no-print mb-6 flex flex-wrap items-end gap-4 border-b bg-gray-50 p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Date From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Date To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <Button onClick={() => void loadDashboard()} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded border p-4">
          <p className="text-2xl font-bold">{loading ? '…' : formatCurrency(summary?.sales ?? 0)}</p>
          <p className="text-sm text-gray-500">Gross Sales</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-2xl font-bold">
            {loading ? '…' : formatCurrency(summary?.purchases ?? 0)}
          </p>
          <p className="text-sm text-gray-500">Net Purchases</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-2xl font-bold">{loading ? '…' : formatCurrency(summary?.pwt ?? 0)}</p>
          <p className="text-sm text-gray-500">PWT</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-2xl font-bold">{loading ? '…' : formatCurrency(summary?.net ?? 0)}</p>
          <p className="text-sm text-gray-500">Net Profit</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-2xl font-bold">{loading ? '…' : (summary?.transactionCount ?? 0)}</p>
          <p className="text-sm text-gray-500">Transactions</p>
        </div>
      </div>

      <div className="mb-6 rounded border p-4">
        <h2 className="mb-4 text-sm font-medium text-gray-700">Last 7 Days — Sales vs Purchases</h2>
        {data?.chartData ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Bar dataKey="sales" fill="#4f46e5" name="Sales" />
              <Bar dataKey="purchases" fill="#9ca3af" name="Purchases" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-500">No chart data.</p>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-gray-700">Recent Transactions</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <Table
            columns={txnColumns}
            data={data?.recentTransactions ?? []}
            rowKey={(row) => row.id}
          />
        )}
      </div>
    </div>
  );
}
