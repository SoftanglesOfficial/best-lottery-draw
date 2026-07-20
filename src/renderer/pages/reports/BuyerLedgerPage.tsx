import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Printer } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { Button, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { downloadCsv } from '../../lib/exportCsv';
import { printReport } from '../../lib/exportPdf';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import type { BuyerLedgerRow, BuyerRecord } from '../../../shared/types';

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

function balanceClass(value: number) {
  if (value > 0) return 'text-cyber-success';
  if (value < 0) return 'text-cyber-error';
  return 'text-content';
}

export default function BuyerLedgerPage() {
  const allowed = useRoleGuard(['admin', 'owner', 'manager']);
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();

  const today = useMemo(() => new Date(), []);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(toDateInputValue(today));
  const [buyerId, setBuyerId] = useState<number | ''>('');
  const [buyers, setBuyers] = useState<BuyerRecord[]>([]);
  const [rows, setRows] = useState<BuyerLedgerRow[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    if (!allowed || companyId == null) return;
    api.buyersList(companyId)
      .then((result) => {
        if (result.success) setBuyers(result.buyers);
      })
      .catch(() => undefined);
  }, [allowed, companyId]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          totalSale: acc.totalSale + row.totalSale,
          totalSaleReturn: acc.totalSaleReturn + row.totalSaleReturn,
          netSale: acc.netSale + row.netSale,
          totalPwt: acc.totalPwt + row.totalPwt,
          balance: acc.balance + row.balance,
        }),
        { totalSale: 0, totalSaleReturn: 0, netSale: 0, totalPwt: 0, balance: 0 },
      ),
    [rows],
  );

  const handleGenerate = useCallback(async () => {
    if (companyId == null) return;
    setLoading(true);
    try {
      const fromIso = dateFrom ? new Date(dateFrom).toISOString() : undefined;
      const toIso = dateTo ? new Date(`${dateTo}T23:59:59.999`).toISOString() : undefined;
      const result = await api.ledgerList(
        companyId,
        fromIso,
        toIso,
        buyerId === '' ? undefined : buyerId,
      );
      if (result.success) {
        setRows(result.ledger.buyers);
        setGenerated(true);
        setExpandedId(null);
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to generate report.', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, dateFrom, dateTo, buyerId, showToast]);

  const handleExportCsv = () => {
    downloadCsv(
      'buyer-ledger.csv',
      ['Buyer Name', 'Group', 'Total Sale', 'Sale Return', 'Net Sale', 'PWT', 'Balance Receivable'],
      rows.map((row) => [
        row.buyerName,
        row.groupName ?? '',
        formatCurrency(row.totalSale),
        formatCurrency(row.totalSaleReturn),
        formatCurrency(row.netSale),
        formatCurrency(row.totalPwt),
        formatCurrency(row.balance),
      ]),
    );
  };

  if (!allowed) return null;

  return (
    <div className="print-full-width mx-auto max-w-6xl text-content">
      <div className="mb-4">
        <PageHeader
          eyebrow="Reports"
          title="Buyer Ledger"
          subtitle="Buyer balances and draw breakdown."
          actions={
            <div className="no-print flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                allowOffline
                className="flex items-center gap-2"
                onClick={() => printReport('Buyer Ledger')}
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex items-center gap-2"
                onClick={handleExportCsv}
                disabled={!generated}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          }
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
        <label className="flex min-w-[200px] flex-col gap-1 text-sm">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Buyer</span>
          <select
            value={buyerId}
            onChange={(event) =>
              setBuyerId(event.target.value ? Number(event.target.value) : '')
            }
            className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
          >
            <option value="">All buyers</option>
            {buyers.map((buyer) => (
              <option key={buyer.id} value={buyer.id}>
                {buyer.name}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={() => void handleGenerate()} disabled={loading}>
          {loading ? 'Generating…' : 'Generate Report'}
        </Button>
      </div>

      {!generated ? (
        <p className="rounded-cyber border border-dashed border-line-strong bg-surface-low px-4 py-8 text-center text-sm text-content-subtle">Set filters and click Generate Report.</p>
      ) : (
        <div className="overflow-x-auto rounded-cyber-lg border border-line">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-high text-left font-mono text-xs uppercase tracking-wider text-content-muted">
                <th className="px-3 py-2" />
                <th className="px-3 py-2">Buyer Name</th>
                <th className="px-3 py-2">Group</th>
                <th className="px-3 py-2 text-right">Total Sale</th>
                <th className="px-3 py-2 text-right">Sale Return</th>
                <th className="px-3 py-2 text-right">Net Sale</th>
                <th className="px-3 py-2 text-right">PWT</th>
                <th className="px-3 py-2 text-right">Balance Receivable</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.buyerId}>
                  <tr
                    className="cursor-pointer border-b border-line text-content-muted transition-colors hover:bg-surface-high hover:text-content"
                    onClick={() =>
                      setExpandedId((current) => (current === row.buyerId ? null : row.buyerId))
                    }
                  >
                    <td className="px-3 py-2">
                      {expandedId === row.buyerId ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">{row.buyerName}</td>
                    <td className="px-3 py-2">{row.groupName ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.totalSale)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.totalSaleReturn)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.netSale)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.totalPwt)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${balanceClass(row.balance)}`}>
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                  {expandedId === row.buyerId ? (
                    <tr key={`${row.buyerId}-detail`}>
                      <td colSpan={8} className="bg-surface-low px-6 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left font-mono uppercase tracking-wide text-content-subtle">
                              <th className="pb-2 pr-4">Draw Name</th>
                              <th className="pb-2 pr-4">Date</th>
                              <th className="pb-2 pr-4 text-right">Sold</th>
                              <th className="pb-2 pr-4 text-right">Returned</th>
                              <th className="pb-2 pr-4 text-right">Net</th>
                              <th className="pb-2 pr-4 text-right">PWT</th>
                              <th className="pb-2 text-right">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.drawBreakdown.map((draw) => (
                              <tr key={draw.drawId} className="border-t border-line text-content-muted">
                                <td className="py-1 pr-4">{draw.drawName ?? '—'}</td>
                                <td className="py-1 pr-4">{formatDate(draw.drawDate)}</td>
                                <td className="py-1 pr-4 text-right">
                                  {formatCurrency(draw.sold ?? 0)}
                                </td>
                                <td className="py-1 pr-4 text-right">
                                  {formatCurrency(draw.returned ?? 0)}
                                </td>
                                <td className="py-1 pr-4 text-right">
                                  {formatCurrency(draw.net ?? 0)}
                                </td>
                                <td className="py-1 pr-4 text-right">
                                  {formatCurrency(draw.pwt)}
                                </td>
                                <td
                                  className={`py-1 text-right ${balanceClass(draw.balance)}`}
                                >
                                  {formatCurrency(draw.balance)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
              <tr className="border-t-2 border-cyber/50 bg-surface-high font-bold text-content">
                <td className="px-3 py-2" colSpan={3}>
                  Grand Total
                </td>
                <td className="px-3 py-2 text-right">{formatCurrency(totals.totalSale)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(totals.totalSaleReturn)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(totals.netSale)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(totals.totalPwt)}</td>
                <td className={`px-3 py-2 text-right ${balanceClass(totals.balance)}`}>
                  {formatCurrency(totals.balance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
