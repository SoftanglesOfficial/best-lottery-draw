import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/ui';
import { reportsPnL } from '../../lib/api';
import { printReport } from '../../lib/exportPdf';
import { canViewPnL } from '../../lib/roles';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useAuth } from '../../lib/auth';
import type { PnLReport } from '../../../shared/types';

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString();
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function marginPercent(profit: number, sales: number) {
  if (sales === 0) return '0.0%';
  return `${((profit / sales) * 100).toFixed(1)}%`;
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mb-6 rounded border border-gray-200">
      <button
        type="button"
        className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left font-medium"
        onClick={() => setOpen((value) => !value)}
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open ? <div className="p-4">{children}</div> : null}
    </section>
  );
}

export default function PnLPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();

  const today = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  }, []);

  const [dateFrom, setDateFrom] = useState(toDateInputValue(monthStart));
  const [dateTo, setDateTo] = useState(toDateInputValue(today));
  const [report, setReport] = useState<PnLReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && !canViewPnL(user.role)) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleGenerate = useCallback(async () => {
    if (companyId == null || !dateFrom || !dateTo) {
      showToast('Date range is required.', 'error');
      return;
    }
    setLoading(true);
    try {
      const result = await reportsPnL(
        companyId,
        new Date(dateFrom).toISOString(),
        new Date(`${dateTo}T23:59:59.999`).toISOString(),
      );
      if (result.success) {
        setReport(result.report);
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to generate P&L report.', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, dateFrom, dateTo, showToast]);

  if (!user || !canViewPnL(user.role)) return null;

  const summary = report?.summary;

  return (
    <div className="print-full-width mx-auto max-w-6xl bg-white">
      <div className="no-print mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Profit & Loss</h1>
        <button
          type="button"
          className="flex items-center gap-1 rounded border px-3 py-1 text-sm"
          onClick={() => printReport('Profit & Loss Report')}
          disabled={!report}
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>

      <div className="no-print mb-6 flex flex-wrap items-end gap-4 border-b bg-gray-50 p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Date From *</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Date To *</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
            required
          />
        </label>
        <Button onClick={() => void handleGenerate()} disabled={loading}>
          {loading ? 'Generating…' : 'Generate'}
        </Button>
      </div>

      {!report ? (
        <p className="text-sm text-gray-500">Select a date range and click Generate.</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded border p-4">
              <p className="text-sm text-gray-500">Gross Sales</p>
              <p className="text-xl font-bold">{formatCurrency(summary!.netSales)}</p>
            </div>
            <div className="rounded border p-4">
              <p className="text-sm text-gray-500">Gross Purchases</p>
              <p className="text-xl font-bold">{formatCurrency(summary!.netPurchases)}</p>
            </div>
            <div className="rounded border p-4">
              <p className="text-sm text-gray-500">Total PWT Paid</p>
              <p className="text-xl font-bold">{formatCurrency(summary!.totalPwtReceivable)}</p>
            </div>
            <div className="rounded border p-4">
              <p className="text-sm text-gray-500">Net Profit</p>
              <p className="text-xl font-bold text-indigo-700">
                {formatCurrency(summary!.grossProfit)}
              </p>
            </div>
          </div>

          <CollapsibleSection title="Company Summary">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2 text-right">Sales</th>
                  <th className="px-3 py-2 text-right">Purchases</th>
                  <th className="px-3 py-2 text-right">PWT</th>
                  <th className="px-3 py-2 text-right">Profit</th>
                  <th className="px-3 py-2 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-3 py-2">Current Company</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(summary!.netSales)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(summary!.netPurchases)}</td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(summary!.totalPwtReceivable)}
                  </td>
                  <td className="px-3 py-2 text-right">{formatCurrency(summary!.grossProfit)}</td>
                  <td className="px-3 py-2 text-right">
                    {marginPercent(summary!.grossProfit, summary!.netSales)}
                  </td>
                </tr>
              </tbody>
            </table>
          </CollapsibleSection>

          <CollapsibleSection title="Draw-wise Breakdown">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-3 py-2">Draw</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Sales</th>
                  <th className="px-3 py-2 text-right">Purchases</th>
                  <th className="px-3 py-2 text-right">PWT</th>
                  <th className="px-3 py-2 text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {report.drawBreakdown.map((row) => (
                  <tr key={row.drawId} className="border-b">
                    <td className="px-3 py-2">{row.drawName}</td>
                    <td className="px-3 py-2">{formatDate(row.drawDate)}</td>
                    <td className="px-3 py-2">{row.itemName ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.sales)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.purchases)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.pwt)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CollapsibleSection>

          <CollapsibleSection title="Top 10 Buyers by Sales">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-3 py-2">Buyer</th>
                  <th className="px-3 py-2 text-right">Sales</th>
                </tr>
              </thead>
              <tbody>
                {report.topBuyers.map((row) => (
                  <tr key={row.buyerId} className="border-b">
                    <td className="px-3 py-2">{row.buyerName}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CollapsibleSection>
        </>
      )}
    </div>
  );
}
