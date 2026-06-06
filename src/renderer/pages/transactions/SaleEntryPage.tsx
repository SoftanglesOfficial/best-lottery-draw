import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import TicketNumberTable, {
  ticketsToTicketData,
  validTicketNumbers,
  type TicketRow,
} from '../../components/transactions/TicketNumberTable';
import { useToast } from '../../components/Toast';
import { Button, Input } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { useKeyboardShortcuts } from '../../lib/useKeyboardShortcuts';
import {
  buyersList,
  drawsList,
  transactionsCreate,
  transactionsGetBuyerSaleSummary,
  transactionsList,
  transactionsNextMemoId,
} from '../../lib/api';
import { isDrawPastCloseTime, formatCloseTimeLabel } from '../../lib/drawCloseTime';

import type { BuyerRecord, DrawRecord, TransactionRecord } from '../../../shared/types';

type SaleEntryOptions = {
  title?: string;
  saveLabel?: string;
  type?: 'sale' | 'sale_return' | 'booking';
};

export default function SaleEntryPage({
  title = 'Sale Entry',
  saveLabel = 'Save Sale',
  type = 'sale',
}: SaleEntryOptions = {}) {
  const allowed = useRoleGuard(['admin', 'owner', 'manager', 'supervisor', 'data_entry']);
  const { user } = useAuth();
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();

  const [draws, setDraws] = useState<DrawRecord[]>([]);
  const [buyers, setBuyers] = useState<BuyerRecord[]>([]);
  const [drawId, setDrawId] = useState<number | null>(null);
  const [buyerId, setBuyerId] = useState<number | null>(null);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [memoId, setMemoId] = useState<number | null>(null);
  const [rows, setRows] = useState<TicketRow[]>([{ number: '' }]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [buyerSummary, setBuyerSummary] = useState<{
    totalSold: number;
    totalReturned: number;
    net: number;
  } | null>(null);
  const [buyerPanelOpen, setBuyerPanelOpen] = useState(false);
  const [allBuyersPanelOpen, setAllBuyersPanelOpen] = useState(false);
  const [drawSales, setDrawSales] = useState<TransactionRecord[]>([]);
  const [now, setNow] = useState(() => new Date());

  const openDraws = useMemo(() => draws.filter((draw) => draw.status === 'open'), [draws]);
  const selectedBuyer = buyers.find((buyer) => buyer.id === buyerId) ?? null;
  const selectedDraw = draws.find((draw) => draw.id === drawId) ?? null;
  const drawPastClose =
    type === 'sale' && selectedDraw != null && isDrawPastCloseTime(selectedDraw, now);
  const sessionTickets = validTicketNumbers(rows);

  const refreshMemo = useCallback(async () => {
    if (companyId == null) return;
    const result = await transactionsNextMemoId(companyId);
    if (result.success) setMemoId(result.nextMemoId);
  }, [companyId]);

  const load = useCallback(async () => {
    if (companyId == null) return;
    try {
      const [drawsResult, buyersResult] = await Promise.all([
        drawsList(companyId),
        buyersList(companyId),
      ]);
      if (drawsResult.success) {
        setDraws(drawsResult.draws);
        const open = drawsResult.draws.filter((draw) => draw.status === 'open');
        setDrawId((current) => current ?? open[0]?.id ?? null);
      }
      if (buyersResult.success) {
        setBuyers(buyersResult.buyers);
        setBuyerId((current) => current ?? buyersResult.buyers[0]?.id ?? null);
      }
      await refreshMemo();
    } catch {
      showToast('Failed to load form data.', 'error');
    }
  }, [companyId, refreshMemo, showToast]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (drawId == null || buyerId == null) {
      setBuyerSummary(null);
      return;
    }
    void transactionsGetBuyerSaleSummary(buyerId, drawId).then((result) => {
      if (result.success) setBuyerSummary(result.summary);
    });
  }, [drawId, buyerId]);

  useEffect(() => {
    if (companyId == null || drawId == null) {
      setDrawSales([]);
      return;
    }
    void transactionsList(companyId, drawId, 'sale').then((result) => {
      if (result.success) setDrawSales(result.transactions);
    });
  }, [companyId, drawId, saving]);

  useKeyboardShortcuts({
    onF1: () => setBuyerPanelOpen(true),
    onF11: () => setAllBuyersPanelOpen(true),
    onEscape: () => {
      setBuyerPanelOpen(false);
      setAllBuyersPanelOpen(false);
    },
  });

  const buyerCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const txn of drawSales) {
      const name = txn.buyerName ?? 'Unknown';
      map.set(name, (map.get(name) ?? 0) + (txn.ticketCount ?? 0));
    }
    return Array.from(map.entries());
  }, [drawSales]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (companyId == null || user == null || drawId == null || buyerId == null || memoId == null) {
      showToast('Complete all required fields.', 'error');
      return;
    }

    const tickets = validTicketNumbers(rows);
    if (tickets.length === 0) {
      showToast('Add at least one valid 5-digit ticket.', 'error');
      return;
    }

    if (type === 'sale_return') {
      if (!buyerSummary || buyerSummary.totalSold <= 0) {
        showToast('No sale found for this buyer in this draw', 'error');
        return;
      }
    }

    const rate =
      type === 'booking' ? 0 : selectedBuyer?.saleRate ? Number(selectedBuyer.saleRate) : 0;
    const amount = type === 'booking' ? null : tickets.length * rate;

    setSaving(true);
    try {
      const result = await transactionsCreate({
        type,
        companyId,
        userId: user.id,
        drawId,
        buyerId,
        memoId,
        ticketCount: tickets.length,
        ticketData: ticketsToTicketData(rows),
        amount,
        enteredAt: entryDate,
      });
      if (result.success) {
        showToast(`${tickets.length} tickets saved.`, 'success');
        setRows([{ number: '' }]);
        setActiveIndex(0);
        await refreshMemo();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) return null;

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <div className="rounded border border-gray-200 bg-white p-3 text-sm text-gray-700">
          <p className="font-medium">{selectedBuyer?.name ?? '—'}</p>
          <p>{selectedDraw?.name ?? '—'}</p>
          <p>Session tickets: {sessionTickets.length}</p>
          <p className="text-xs text-gray-500">F1 buyer summary · F11 all buyers · F5 delete row</p>
        </div>
      </div>

      {drawPastClose && selectedDraw ? (
        <div className="mb-4 rounded border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          <strong>Warning:</strong> This draw closed at{' '}
          {formatCloseTimeLabel(selectedDraw.closeTime)} on{' '}
          {new Date(selectedDraw.drawDate).toLocaleDateString('en-GB')}. You are entering sales after
          the close time.
        </div>
      ) : null}

      {type === 'sale_return' && buyerSummary ? (
        <div className="mb-4 rounded border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900">
          Sold: {buyerSummary.totalSold} | Returned: {buyerSummary.totalReturned} | Available:{' '}
          {buyerSummary.net}
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-1 gap-3 rounded border border-gray-200 bg-white p-4 md:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Draw *</span>
          <select
            value={drawId ?? ''}
            onChange={(event) => setDrawId(Number(event.target.value) || null)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
            required
          >
            <option value="">Select draw</option>
            {openDraws.map((draw) => (
              <option key={draw.id} value={draw.id}>
                {draw.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Sale To *</span>
          <select
            value={buyerId ?? ''}
            onChange={(event) => setBuyerId(Number(event.target.value) || null)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
            required
          >
            <option value="">Select buyer</option>
            {buyers.map((buyer) => (
              <option key={buyer.id} value={buyer.id}>
                {buyer.name}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Date"
          type="date"
          value={entryDate}
          onChange={(event) => setEntryDate(event.target.value)}
        />
        <Input label="Memo ID" value={memoId ?? ''} readOnly />
      </div>

      <div className="mb-4 rounded border border-gray-200 bg-white p-4">
        <TicketNumberTable
          rows={rows}
          onChange={setRows}
          activeIndex={activeIndex}
          onActiveIndexChange={setActiveIndex}
        />
      </div>

      <Button type="submit" disabled={saving || companyId == null}>
        {saving ? 'Saving…' : saveLabel}
      </Button>

      {buyerPanelOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="h-full w-full max-w-sm bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Buyer Summary (F1)</h2>
              <button type="button" onClick={() => setBuyerPanelOpen(false)}>
                Close
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto font-mono text-sm">
              {sessionTickets.length === 0 ? (
                <p className="text-gray-500">No tickets entered this session.</p>
              ) : (
                sessionTickets.map((ticket) => <div key={ticket}>{ticket}</div>)
              )}
            </div>
          </div>
        </div>
      ) : null}

      {allBuyersPanelOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="h-full w-full max-w-sm bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">All Buyers (F11)</h2>
              <button type="button" onClick={() => setAllBuyersPanelOpen(false)}>
                Close
              </button>
            </div>
            <ul className="space-y-2 text-sm">
              {buyerCounts.map(([name, count]) => (
                <li key={name} className="flex justify-between border-b pb-1">
                  <span>{name}</span>
                  <span className="font-medium">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </form>
  );
}
