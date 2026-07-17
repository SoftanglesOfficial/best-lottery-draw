import { useCallback, useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '../../components/ConfirmDialog';
import Table, { type TableColumn } from '../../components/Table';
import { useToast } from '../../components/Toast';
import { Button, Input } from '../../components/ui';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { api } from '../../lib/api';
import type { BuyerRecord, DrawRecord, WinningTicketRecord } from '../../../shared/types';

function formatAmount(value: string | null | undefined) {
  if (value == null || value === '') return '—';
  return `₹${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface PrizeBreakdownRow {
  prizeLevel: number;
  count: number;
  totalAmount: number;
}

export default function WinningTicketsPage() {
  const allowed = useRoleGuard(['admin', 'owner', 'manager', 'supervisor', 'data_entry']);
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();

  const [draws, setDraws] = useState<DrawRecord[]>([]);
  const [buyers, setBuyers] = useState<BuyerRecord[]>([]);
  const [selectedDrawId, setSelectedDrawId] = useState<number | null>(null);
  const [tickets, setTickets] = useState<WinningTicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [finding, setFinding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WinningTicketRecord | null>(null);
  const [manualTicket, setManualTicket] = useState('');
  const [manualPrizeLevel, setManualPrizeLevel] = useState('1');
  const [manualAmount, setManualAmount] = useState('');
  const [manualBuyerId, setManualBuyerId] = useState<number | ''>('');
  const [adding, setAdding] = useState(false);

  const loadDraws = useCallback(async () => {
    if (companyId == null) {
      setDraws([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [drawResult, buyerResult] = await Promise.all([
        api.drawsList(companyId),
        api.buyersList(companyId),
      ]);
      if (drawResult.success) {
        setDraws(drawResult.draws);
        setSelectedDrawId((current) => {
          if (current && drawResult.draws.some((draw) => draw.id === current)) return current;
          return drawResult.draws[0]?.id ?? null;
        });
      } else {
        showToast(drawResult.error, 'error');
      }
      if (buyerResult.success) setBuyers(buyerResult.buyers);
    } catch {
      showToast('Failed to load draws.', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, showToast]);

  const loadTickets = useCallback(async () => {
    if (selectedDrawId == null) {
      setTickets([]);
      return;
    }
    try {
      const result = await api.winningTicketsList(selectedDrawId);
      if (result.success) setTickets(result.tickets);
      else showToast(result.error, 'error');
    } catch {
      showToast('Failed to load winning tickets.', 'error');
    }
  }, [selectedDrawId, showToast]);

  useEffect(() => {
    if (allowed) void loadDraws();
  }, [allowed, loadDraws]);

  useEffect(() => {
    if (allowed && selectedDrawId != null) void loadTickets();
  }, [allowed, selectedDrawId, loadTickets]);

  const selectedDraw = draws.find((draw) => draw.id === selectedDrawId) ?? null;

  const prizeBreakdown = useMemo((): PrizeBreakdownRow[] => {
    const map = new Map<number, PrizeBreakdownRow>();
    for (const ticket of tickets) {
      const existing = map.get(ticket.prizeLevel) ?? {
        prizeLevel: ticket.prizeLevel,
        count: 0,
        totalAmount: 0,
      };
      existing.count += 1;
      existing.totalAmount += Number(ticket.amount ?? 0);
      map.set(ticket.prizeLevel, existing);
    }
    return [...map.values()].sort((a, b) => a.prizeLevel - b.prizeLevel);
  }, [tickets]);

  const partyWinners = useMemo(
    () => tickets.filter((ticket) => ticket.buyerId != null),
    [tickets],
  );

  const handleFindWinners = async () => {
    if (selectedDrawId == null) {
      showToast('Select a draw first.', 'error');
      return;
    }
    if (!selectedDraw?.resultImported) {
      showToast('Import results for this draw before finding winners.', 'error');
      return;
    }
    setFinding(true);
    try {
      const result = await api.winningTicketsFindWinners(selectedDrawId);
      if (result.success) {
        showToast(`Found ${result.count} winning ticket(s).`, 'success');
        void loadTickets();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to find winners.', 'error');
    } finally {
      setFinding(false);
    }
  };

  const handleManualAdd = async () => {
    if (selectedDrawId == null) return;
    if (!manualTicket.trim()) {
      showToast('Ticket number is required.', 'error');
      return;
    }
    setAdding(true);
    try {
      const result = await api.winningTicketsCreate(selectedDrawId, [
        {
          ticketNumber: manualTicket.trim(),
          prizeLevel: Number(manualPrizeLevel) || 1,
          amount: manualAmount ? Number(manualAmount) : null,
          buyerId: manualBuyerId === '' ? null : manualBuyerId,
        },
      ]);
      if (result.success) {
        showToast('Winning ticket added.', 'success');
        setManualTicket('');
        setManualAmount('');
        void loadTickets();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to add winning ticket.', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const result = await api.winningTicketsDelete(deleteTarget.id);
    if (result.success) {
      showToast('Winning ticket deleted.', 'success');
      setDeleteTarget(null);
      void loadTickets();
    } else {
      showToast(result.error, 'error');
    }
  };

  const columns: TableColumn<WinningTicketRecord>[] = [
    { key: 'ticketNumber', header: 'Ticket Number', render: (row) => row.ticketNumber },
    { key: 'prizeLevel', header: 'Prize Level', render: (row) => row.prizeLevel },
    { key: 'amount', header: 'Amount', render: (row) => formatAmount(row.amount) },
    { key: 'buyer', header: 'Buyer', render: (row) => row.buyerName ?? '—' },
    { key: 'provider', header: 'Provider', render: (row) => row.providerName ?? '—' },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <button
          type="button"
          className="rounded-cyber px-1.5 py-1 text-cyber-error hover:bg-cyber-error/10"
          onClick={() => setDeleteTarget(row)}
        >
          Delete
        </button>
      ),
    },
  ];

  const partyColumns: TableColumn<WinningTicketRecord>[] = [
    { key: 'buyer', header: 'Buyer', render: (row) => row.buyerName ?? '—' },
    { key: 'ticketNumber', header: 'Ticket', render: (row) => row.ticketNumber },
    { key: 'prizeLevel', header: 'Prize Level', render: (row) => row.prizeLevel },
    { key: 'amount', header: 'Amount', render: (row) => formatAmount(row.amount) },
  ];

  if (!allowed) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-cyber-hover">Winner register</p>
          <h1 className="font-display text-2xl font-bold text-content">Winning Tickets</h1>
          <p className="mt-1 text-sm text-content-subtle">Find, review, and manage winners for a draw.</p>
        </div>
        <Button onClick={() => void handleFindWinners()} disabled={finding}>
          {finding ? 'Finding…' : 'Find Winners'}
        </Button>
      </div>

      <section className="rounded-cyber-lg border border-line bg-surface-raised p-4">
        <label className="flex max-w-md flex-col gap-1">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Select Draw</span>
          <select
            value={selectedDrawId ?? ''}
            onChange={(event) => setSelectedDrawId(Number(event.target.value) || null)}
            className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
            disabled={loading}
          >
            <option value="">Select a draw</option>
            {draws.map((draw) => (
              <option key={draw.id} value={draw.id}>
                {draw.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {prizeBreakdown.length > 0 ? (
        <section className="overflow-hidden rounded-cyber-lg border border-line bg-surface-raised">
          <div className="border-b border-line px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-content-subtle">Current draw</p>
            <h2 className="font-display font-bold text-content">Prize Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[520px] w-full text-sm">
              <thead className="bg-surface-high">
                <tr className="border-b border-line text-left">
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-content-muted">Prize Level</th>
                  <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.05em] text-content-muted">Count</th>
                  <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.05em] text-content-muted">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {prizeBreakdown.map((row) => (
                  <tr key={row.prizeLevel} className="even:bg-surface-low hover:bg-surface-high">
                    <td className="px-3 py-2 font-mono text-cyber-hover">{row.prizeLevel}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-content-muted">{row.count}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-content">
                      {formatAmount(String(row.totalAmount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rounded-cyber-lg border border-line bg-surface-raised p-4">
        <div className="mb-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-content-subtle">Manual action</p>
          <h2 className="font-display font-bold text-content">Add Winning Ticket Manually</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Ticket Number"
            value={manualTicket}
            onChange={(event) => setManualTicket(event.target.value)}
          />
          <Input
            label="Prize Level"
            type="number"
            value={manualPrizeLevel}
            onChange={(event) => setManualPrizeLevel(event.target.value)}
          />
          <Input
            label="Amount"
            type="number"
            value={manualAmount}
            onChange={(event) => setManualAmount(event.target.value)}
          />
          <label className="flex min-w-[160px] flex-col gap-1 text-sm">
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Buyer</span>
            <select
              value={manualBuyerId}
              onChange={(event) =>
                setManualBuyerId(event.target.value ? Number(event.target.value) : '')
              }
              className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
            >
              <option value="">Optional</option>
              {buyers.map((buyer) => (
                <option key={buyer.id} value={buyer.id}>
                  {buyer.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            onClick={() => void handleManualAdd()}
            disabled={adding || selectedDrawId == null}
          >
            {adding ? 'Adding…' : 'Add Ticket'}
          </Button>
        </div>
      </section>

      {loading ? (
        <div className="rounded-cyber-lg border border-dashed border-line-strong bg-surface-low py-12 text-center font-mono text-xs uppercase tracking-[0.05em] text-content-subtle" role="status">Loading winning tickets…</div>
      ) : (
        <Table columns={columns} data={tickets} rowKey={(row) => row.id} />
      )}

      {partyWinners.length > 0 ? (
        <section className="pt-2">
          <h2 className="mb-3 font-display font-bold text-content">Party-wise Winners</h2>
          <Table columns={partyColumns} data={partyWinners} rowKey={(row) => row.id} />
        </section>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          message={`Delete ticket ${deleteTarget.ticketNumber}?`}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Delete"
        />
      ) : null}
    </div>
  );
}
