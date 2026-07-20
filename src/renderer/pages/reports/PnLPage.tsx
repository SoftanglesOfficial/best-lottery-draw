import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { Button, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
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
    <section className="mb-6 overflow-hidden rounded-cyber-lg border border-line bg-surface-raised">
      <button
        type="button"
        className="flex w-full items-center justify-between bg-surface-high px-4 py-3 text-left font-display font-bold text-content transition-colors hover:bg-surface-highest focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyber/30"
        aria-expanded={open}
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
      const result = await api.reportsPnL(
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
    <div className="print-full-width mx-auto max-w-6xl text-content">
      <div className="mb-4">
        <PageHeader
          eyebrow="Reports"
          title="Profit & Loss"
          subtitle="Sales, purchases, and profit by draw and buyer."
          actions={
            <div className="no-print flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                allowOffline
                className="flex items-center gap-2"
                onClick={() => printReport('Profit & Loss Report')}
                disabled={!report}
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
          }
        />
      </div>

      <div className="no-print mb-6 flex flex-wrap items-end gap-4 rounded-cyber-lg border border-line bg-surface-raised p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Date From *</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Date To *</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
            required
          />
        </label>
        <Button onClick={() => void handleGenerate()} disabled={loading}>
          {loading ? 'Generating…' : 'Generate'}
        </Button>
      </div>

      {!report ? (
        <p className="rounded-cyber border border-dashed border-line-strong bg-surface-low px-4 py-8 text-center text-sm text-content-subtle">Select a date range and click Generate.</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-cyber-lg border border-line bg-surface-raised p-4">
              <p className="text-sm text-content-muted">Gross Sales</p>
              <p className="font-mono text-xl font-bold text-cyber">{formatCurrency(summary!.netSales)}</p>
            </div>
            <div className="rounded-cyber-lg border border-line bg-surface-raised p-4">
              <p className="text-sm text-content-muted">Gross Purchases</p>
              <p className="font-mono text-xl font-bold text-content">{formatCurrency(summary!.netPurchases)}</p>
            </div>
            <div className="rounded-cyber-lg border border-line bg-surface-raised p-4">
              <p className="text-sm text-content-muted">Total PWT Paid</p>
              <p className="font-mono text-xl font-bold text-content">{formatCurrency(summary!.totalPwtReceivable)}</p>
            </div>
            <div className="rounded-cyber-lg border border-cyber/40 bg-cyber/5 p-4">
              <p className="text-sm text-content-muted">Net Profit</p>
              <p className="font-mono text-xl font-bold text-cyber-success">
                {formatCurrency(summary!.grossProfit)}
              </p>
            </div>
          </div>

          <CollapsibleSection title="Company Summary">
            <div className="overflow-x-auto"><table className="min-w-[680px] w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-high text-left text-content-muted">
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2 text-right">Sales</th>
                  <th className="px-3 py-2 text-right">Purchases</th>
                  <th className="px-3 py-2 text-right">PWT</th>
                  <th className="px-3 py-2 text-right">Profit</th>
                  <th className="px-3 py-2 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line text-content-muted">
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
            </table></div>
          </CollapsibleSection>

          <CollapsibleSection title="Draw-wise Breakdown">
            <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-high text-left text-content-muted">
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
                  <tr key={row.drawId} className="border-b border-line text-content-muted">
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
            </table></div>
          </CollapsibleSection>

          <CollapsibleSection title="Top 10 Buyers by Sales">
            <div className="overflow-x-auto"><table className="min-w-[420px] w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-high text-left text-content-muted">
                  <th className="px-3 py-2">Buyer</th>
                  <th className="px-3 py-2 text-right">Sales</th>
                </tr>
              </thead>
              <tbody>
                {report.topBuyers.map((row) => (
                  <tr key={row.buyerId} className="border-b border-line text-content-muted">
                    <td className="px-3 py-2">{row.buyerName}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </CollapsibleSection>
        </>
      )}
    </div>
  );
}
