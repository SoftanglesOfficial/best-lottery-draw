import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '../ConfirmDialog';
import EmptyState from '../EmptyState';
import { FullPageLoading } from '../LoadingSpinner';
import { useToast } from '../Toast';
import { useAuth } from '../../lib/auth';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { isAtLeastRole } from '../../lib/roles';
import { api } from '../../lib/api';
import {
  extractTicketNumbers,
  formatAmount,
  formatRanges,
  formatTxnDate,
} from '../../lib/transactionDisplay';
import type { DrawRecord, TransactionRecord, TransactionType } from '../../../shared/types';

type TransactionListPageProps = {
  title: string;
  type: TransactionType;
  showProvider?: boolean;
  showBuyer?: boolean;
  showVoucher?: boolean;
  ticketView?: 'ranges' | 'tickets';
  showReturnStats?: boolean;
};

export default function TransactionListPage({
  title,
  type,
  showProvider = false,
  showBuyer = false,
  showVoucher = false,
  ticketView = 'ranges',
  showReturnStats = false,
}: TransactionListPageProps) {
  const allowed = useRoleGuard(['admin', 'owner', 'manager', 'supervisor', 'data_entry']);
  const { user } = useAuth();
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();

  const [draws, setDraws] = useState<DrawRecord[]>([]);
  const [rows, setRows] = useState<TransactionRecord[]>([]);
  const [returnRows, setReturnRows] = useState<TransactionRecord[]>([]);
  const [drawFilter, setDrawFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransactionRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const canDelete = user ? isAtLeastRole(user.role, 'supervisor') : false;

  const load = useCallback(async () => {
    if (companyId == null) {
      setRows([]);
      setReturnRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const returnType = showReturnStats && type === 'sale' ? ('sale_return' as const) : null;
      const [txnResult, returnsResult, drawsResult] = await Promise.all([
        api.transactionsList(companyId, undefined, type),
        returnType ? api.transactionsList(companyId, undefined, returnType) : Promise.resolve(null),
        api.drawsList(companyId),
      ]);
      if (txnResult.success) setRows(txnResult.transactions);
      else showToast(txnResult.error, 'error');
      if (returnsResult?.success) setReturnRows(returnsResult.transactions);
      else if (returnType) setReturnRows([]);
      if (drawsResult.success) setDraws(drawsResult.draws);
    } catch {
      showToast('Failed to load transactions.', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, type, showReturnStats, showToast]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (drawFilter && String(row.drawId) !== drawFilter) return false;
      if (partyFilter) {
        if (showProvider && String(row.providerId) !== partyFilter) return false;
        if (showBuyer && String(row.buyerId) !== partyFilter) return false;
      }
      if (dateFrom && row.enteredAt && new Date(row.enteredAt) < new Date(dateFrom)) return false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (row.enteredAt && new Date(row.enteredAt) > to) return false;
      }
      return true;
    });
  }, [rows, drawFilter, partyFilter, dateFrom, dateTo, showProvider, showBuyer]);

  const partyOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of rows) {
      if (showProvider && row.providerId != null && row.providerName) {
        map.set(row.providerId, row.providerName);
      }
      if (showBuyer && row.buyerId != null && row.buyerName) {
        map.set(row.buyerId, row.buyerName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows, showProvider, showBuyer]);

  const buyerDrawStats = useMemo(() => {
    const soldTotals = new Map<string, number>();
    const returnedTotals = new Map<string, number>();

    for (const row of rows) {
      if (row.buyerId == null || row.drawId == null) continue;
      const key = `${row.buyerId}-${row.drawId}`;
      soldTotals.set(key, (soldTotals.get(key) ?? 0) + (row.ticketCount ?? 0));
    }

    for (const row of returnRows) {
      if (row.buyerId == null || row.drawId == null) continue;
      const key = `${row.buyerId}-${row.drawId}`;
      returnedTotals.set(key, (returnedTotals.get(key) ?? 0) + (row.ticketCount ?? 0));
    }

    return { soldTotals, returnedTotals };
  }, [rows, returnRows]);

  const tableColumnCount =
    6 +
    (showVoucher ? 1 : 0) +
    (showProvider ? 1 : 0) +
    (showBuyer ? 1 : 0) +
    (showReturnStats ? 2 : 0);

  const handleDelete = async () => {
    if (!deleteTarget || !user) return;
    const result = await api.transactionsDelete(deleteTarget.id);
    if (result.success) {
      showToast('Transaction deleted.', 'success');
      setDeleteTarget(null);
      void load();
    } else {
      showToast(result.error, 'error');
    }
  };

  if (!allowed) return null;

  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-cyber-hover">Transaction register</p>
        <h1 className="font-display text-2xl font-bold text-content">{title}</h1>
        <p className="mt-1 text-sm text-content-subtle">Filter, inspect, and manage transaction records.</p>
      </div>

      <section className="flex flex-wrap gap-3 rounded-cyber-lg border border-line bg-surface-raised p-4" aria-label="Transaction filters">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Draw</span>
          <select
            value={drawFilter}
            onChange={(event) => setDrawFilter(event.target.value)}
            className="min-w-[160px] rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
          >
            <option value="">All draws</option>
            {draws.map((draw) => (
              <option key={draw.id} value={draw.id}>
                {draw.name}
              </option>
            ))}
          </select>
        </label>
        {(showProvider || showBuyer) && (
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">
              {showProvider ? 'Provider' : 'Buyer'}
            </span>
            <select
              value={partyFilter}
              onChange={(event) => setPartyFilter(event.target.value)}
              className="min-w-[160px] rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
            >
              <option value="">All</option>
              {partyOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
          />
        </label>
      </section>

      {loading ? (
        <FullPageLoading message="Loading transactions…" />
      ) : filtered.length === 0 ? (
        <EmptyState entity="transaction" />
      ) : (
        <div className="max-w-full overflow-x-auto rounded-cyber-lg border border-line bg-surface-raised">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="border-b border-line bg-surface-high text-left">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">Memo ID</th>
                {showVoucher ? <th className="whitespace-nowrap px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">Voucher No</th> : null}
                {showProvider ? <th className="whitespace-nowrap px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">Provider</th> : null}
                {showBuyer ? <th className="whitespace-nowrap px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">Buyer</th> : null}
                <th className="whitespace-nowrap px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">Draw</th>
                <th className="whitespace-nowrap px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">Date</th>
                {showReturnStats ? (
                  <>
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">Sold</th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">Returned</th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">Net</th>
                  </>
                ) : (
                  <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">Tickets</th>
                )}
                <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">Amount</th>
                <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((row) => {
                const statsKey =
                  row.buyerId != null && row.drawId != null
                    ? `${row.buyerId}-${row.drawId}`
                    : null;
                const soldTotal = statsKey ? (buyerDrawStats.soldTotals.get(statsKey) ?? 0) : 0;
                const returnedTotal = statsKey
                  ? (buyerDrawStats.returnedTotals.get(statsKey) ?? 0)
                  : 0;
                const netTotal = soldTotal - returnedTotal;
                const detailsId = `transaction-${row.id}-details`;

                return (
                <Fragment key={row.id}>
                  <tr className="bg-surface-raised text-content-muted hover:bg-surface-high">
                    <td className="px-4 py-3 font-mono text-content">{row.memoId ?? '—'}</td>
                    {showVoucher ? <td className="px-4 py-3">{row.voucherNo ?? '—'}</td> : null}
                    {showProvider ? <td className="px-4 py-3">{row.providerName ?? '—'}</td> : null}
                    {showBuyer ? <td className="px-4 py-3">{row.buyerName ?? '—'}</td> : null}
                    <td className="px-4 py-3">{row.drawName ?? '—'}</td>
                    <td className="px-4 py-3">{formatTxnDate(row.enteredAt)}</td>
                    {showReturnStats ? (
                      <>
                        <td className="px-4 py-3 text-right">{row.ticketCount ?? '—'}</td>
                        <td
                          className={`px-4 py-3 text-right ${
                            returnedTotal > 0 ? 'font-medium text-cyber-error' : ''
                          }`}
                        >
                          {returnedTotal}
                        </td>
                        <td className="px-4 py-3 text-right">{netTotal}</td>
                      </>
                    ) : (
                      <td className="px-4 py-3">{row.ticketCount ?? '—'}</td>
                    )}
                    <td className="px-4 py-3">{formatAmount(row.amount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-cyber px-1.5 py-1 text-cyber-hover hover:bg-cyber/10 focus:outline-none focus:ring-2 focus:ring-cyber/30"
                          onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                          aria-expanded={expandedId === row.id}
                          aria-controls={detailsId}
                        >
                          View
                        </button>
                        {canDelete ? (
                          <button
                            type="button"
                            className="rounded-cyber px-1.5 py-1 text-cyber-error hover:bg-cyber-error/10 focus:outline-none focus:ring-2 focus:ring-cyber-error/30"
                            onClick={() => setDeleteTarget(row)}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {expandedId === row.id ? (
                    <tr className="bg-surface-low">
                      <td id={detailsId} colSpan={tableColumnCount} className="px-4 py-3">
                        {ticketView === 'ranges' ? (
                          <p className="font-mono text-sm text-content-muted">{formatRanges(row.ticketData)}</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {extractTicketNumbers(row.ticketData).map((number) => (
                              <span
                                key={number}
                                className="rounded-cyber bg-canvas px-2 py-1 font-mono text-xs text-cyber-hover ring-1 ring-line"
                              >
                                {number}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <p className="py-8 text-center font-mono text-xs uppercase tracking-[0.05em] text-content-subtle">No records found.</p>
          ) : null}
        </div>
      )}

      {deleteTarget ? (
        <ConfirmDialog
          message={`Delete memo ${deleteTarget.memoId ?? deleteTarget.id}?`}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Delete"
        />
      ) : null}
    </div>
  );
}
