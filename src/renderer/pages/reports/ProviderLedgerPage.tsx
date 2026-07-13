import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Printer } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/ui';
import { api } from '../../lib/api';
import { downloadCsv } from '../../lib/exportCsv';
import { printReport } from '../../lib/exportPdf';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import type { ProviderLedgerRow, ProviderRecord } from '../../../shared/types';

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
  if (value > 0) return 'text-green-600';
  if (value < 0) return 'text-red-600';
  return '';
}

export default function ProviderLedgerPage() {
  const allowed = useRoleGuard(['admin', 'owner', 'manager']);
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();

  const today = useMemo(() => new Date(), []);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(toDateInputValue(today));
  const [providerId, setProviderId] = useState<number | ''>('');
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [rows, setRows] = useState<ProviderLedgerRow[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    if (!allowed || companyId == null) return;
    api.providersList(companyId)
      .then((result) => {
        if (result.success) setProviders(result.providers);
      })
      .catch(() => undefined);
  }, [allowed, companyId]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          totalPurchase: acc.totalPurchase + row.totalPurchase,
          totalPurchaseReturn: acc.totalPurchaseReturn + row.totalPurchaseReturn,
          netPurchase: acc.netPurchase + row.netPurchase,
          totalPwtPayable: acc.totalPwtPayable + row.totalPwtPayable,
          balance: acc.balance + row.balance,
        }),
        {
          totalPurchase: 0,
          totalPurchaseReturn: 0,
          netPurchase: 0,
          totalPwtPayable: 0,
          balance: 0,
        },
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
        undefined,
        providerId === '' ? undefined : providerId,
      );
      if (result.success) {
        setRows(result.ledger.providers);
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
  }, [companyId, dateFrom, dateTo, providerId, showToast]);

  const handleExportCsv = () => {
    downloadCsv(
      'provider-ledger.csv',
      [
        'Provider Name',
        'Group',
        'Total Purchase',
        'Purchase Return',
        'Net Purchase',
        'PWT Payable',
        'Balance Payable',
      ],
      rows.map((row) => [
        row.providerName,
        row.groupName ?? '',
        formatCurrency(row.totalPurchase),
        formatCurrency(row.totalPurchaseReturn),
        formatCurrency(row.netPurchase),
        formatCurrency(row.totalPwtPayable),
        formatCurrency(row.balance),
      ]),
    );
  };

  if (!allowed) return null;

  return (
    <div className="print-full-width mx-auto max-w-6xl bg-white">
      <div className="no-print mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Provider Ledger</h1>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex items-center gap-1 rounded border px-3 py-1 text-sm"
            onClick={() => printReport('Provider Ledger')}
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            type="button"
            className="flex items-center gap-1 rounded border px-3 py-1 text-sm"
            onClick={handleExportCsv}
            disabled={!generated}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

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
        <label className="flex min-w-[200px] flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Provider</span>
          <select
            value={providerId}
            onChange={(event) =>
              setProviderId(event.target.value ? Number(event.target.value) : '')
            }
            className="rounded border border-gray-300 px-3 py-2"
          >
            <option value="">All providers</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={() => void handleGenerate()} disabled={loading}>
          {loading ? 'Generating…' : 'Generate Report'}
        </Button>
      </div>

      {!generated ? (
        <p className="text-sm text-gray-500">Set filters and click Generate Report.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-3 py-2" />
                <th className="px-3 py-2">Provider Name</th>
                <th className="px-3 py-2">Group</th>
                <th className="px-3 py-2 text-right">Total Purchase</th>
                <th className="px-3 py-2 text-right">Purchase Return</th>
                <th className="px-3 py-2 text-right">Net Purchase</th>
                <th className="px-3 py-2 text-right">PWT Payable</th>
                <th className="px-3 py-2 text-right">Balance Payable</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.providerId}>
                  <tr
                    className="cursor-pointer border-b hover:bg-gray-50"
                    onClick={() =>
                      setExpandedId((current) =>
                        current === row.providerId ? null : row.providerId,
                      )
                    }
                  >
                    <td className="px-3 py-2">
                      {expandedId === row.providerId ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">{row.providerName}</td>
                    <td className="px-3 py-2">{row.groupName ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.totalPurchase)}</td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrency(row.totalPurchaseReturn)}
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.netPurchase)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.totalPwtPayable)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${balanceClass(row.balance)}`}>
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                  {expandedId === row.providerId ? (
                    <tr>
                      <td colSpan={8} className="bg-gray-50 px-6 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-gray-600">
                              <th className="pb-2 pr-4">Draw Name</th>
                              <th className="pb-2 pr-4">Date</th>
                              <th className="pb-2 pr-4 text-right">Purchased</th>
                              <th className="pb-2 pr-4 text-right">Returned</th>
                              <th className="pb-2 pr-4 text-right">Net</th>
                              <th className="pb-2 pr-4 text-right">PWT</th>
                              <th className="pb-2 text-right">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.drawBreakdown.map((draw) => (
                              <tr key={draw.drawId} className="border-t border-gray-200">
                                <td className="py-1 pr-4">{draw.drawName ?? '—'}</td>
                                <td className="py-1 pr-4">{formatDate(draw.drawDate)}</td>
                                <td className="py-1 pr-4 text-right">
                                  {formatCurrency(draw.purchased ?? 0)}
                                </td>
                                <td className="py-1 pr-4 text-right">
                                  {formatCurrency(draw.purchaseReturned ?? 0)}
                                </td>
                                <td className="py-1 pr-4 text-right">
                                  {formatCurrency(draw.netPurchase ?? 0)}
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
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                <td className="px-3 py-2" colSpan={3}>
                  Grand Total
                </td>
                <td className="px-3 py-2 text-right">{formatCurrency(totals.totalPurchase)}</td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(totals.totalPurchaseReturn)}
                </td>
                <td className="px-3 py-2 text-right">{formatCurrency(totals.netPurchase)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(totals.totalPwtPayable)}</td>
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
