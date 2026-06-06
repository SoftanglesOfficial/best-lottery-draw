import { useCallback, useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '../../components/ConfirmDialog';
import Table, { type TableColumn } from '../../components/Table';
import { useToast } from '../../components/Toast';
import { Button, Input } from '../../components/ui';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import {
  buyersList,
  drawsList,
  winningTicketsCreate,
  winningTicketsDelete,
  winningTicketsFindWinners,
  winningTicketsList,
} from '../../lib/api';
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
        drawsList(companyId),
        buyersList(companyId),
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
      const result = await winningTicketsList(selectedDrawId);
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
    if (selectedDrawId == null) return;
    setFinding(true);
    try {
      const result = await winningTicketsFindWinners(selectedDrawId);
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
      const result = await winningTicketsCreate(selectedDrawId, [
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
    const result = await winningTicketsDelete(deleteTarget.id);
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
          className="text-red-600 hover:underline"
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
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Winning Tickets</h1>
        <Button
          onClick={() => void handleFindWinners()}
          disabled={selectedDrawId == null || !selectedDraw?.resultImported || finding}
        >
          {finding ? 'Finding…' : 'Find Winners'}
        </Button>
      </div>

      <label className="mb-6 flex max-w-md flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">Select Draw</span>
        <select
          value={selectedDrawId ?? ''}
          onChange={(event) => setSelectedDrawId(Number(event.target.value) || null)}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm"
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

      {prizeBreakdown.length > 0 ? (
        <div className="mb-6 rounded border border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-medium text-gray-700">Prize Breakdown</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-3 py-2">Prize Level</th>
                <th className="px-3 py-2 text-right">Count</th>
                <th className="px-3 py-2 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {prizeBreakdown.map((row) => (
                <tr key={row.prizeLevel} className="border-b">
                  <td className="px-3 py-2">{row.prizeLevel}</td>
                  <td className="px-3 py-2 text-right">{row.count}</td>
                  <td className="px-3 py-2 text-right">
                    {formatAmount(String(row.totalAmount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mb-6 rounded border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-700">Add Winning Ticket Manually</h2>
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
            <span className="font-medium text-gray-700">Buyer</span>
            <select
              value={manualBuyerId}
              onChange={(event) =>
                setManualBuyerId(event.target.value ? Number(event.target.value) : '')
              }
              className="rounded border border-gray-300 px-3 py-2"
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
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <Table columns={columns} data={tickets} rowKey={(row) => row.id} />
      )}

      {partyWinners.length > 0 ? (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-gray-700">Party-wise Winners</h2>
          <Table columns={partyColumns} data={partyWinners} rowKey={(row) => row.id} />
        </div>
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
