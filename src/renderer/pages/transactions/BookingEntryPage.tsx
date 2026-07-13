import { FormEvent, useCallback, useEffect, useState } from 'react';
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
import { api } from '../../lib/api';
import { formatCloseTimeLabel, isDrawPastCloseTime } from '../../lib/drawCloseTime';
import type { BuyerRecord, DrawRecord } from '../../../shared/types';

function isSameDay(a: Date | string, dateStr: string) {
  const date = a instanceof Date ? a : new Date(a);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === dateStr;
}

export default function BookingEntryPage() {
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
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const todayOpenDraws = draws.filter(
    (draw) => draw.status === 'open' && isSameDay(draw.drawDate, entryDate),
  );
  const selectedDraw = draws.find((draw) => draw.id === drawId) ?? null;
  const drawPastClose =
    selectedDraw != null && isDrawPastCloseTime(selectedDraw, now);

  const refreshMemo = useCallback(async () => {
    if (companyId == null) return;
    const result = await api.transactionsNextMemoId(companyId);
    if (result.success) setMemoId(result.nextMemoId);
  }, [companyId]);

  const load = useCallback(async () => {
    if (companyId == null) return;
    try {
      const [drawsResult, buyersResult] = await Promise.all([
        api.drawsList(companyId),
        api.buyersList(companyId),
      ]);
      if (drawsResult.success) {
        setDraws(drawsResult.draws);
        const openToday = drawsResult.draws.filter(
          (draw) => draw.status === 'open' && isSameDay(draw.drawDate, entryDate),
        );
        setDrawId((current) => current ?? openToday[0]?.id ?? null);
      }
      if (buyersResult.success) {
        setBuyers(buyersResult.buyers);
        setBuyerId((current) => current ?? buyersResult.buyers[0]?.id ?? null);
      }
      await refreshMemo();
    } catch {
      showToast('Failed to load form data.', 'error');
    }
  }, [companyId, entryDate, refreshMemo, showToast]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (drawId == null) return;
    if (!todayOpenDraws.some((draw) => draw.id === drawId)) {
      setDrawId(todayOpenDraws[0]?.id ?? null);
    }
  }, [drawId, todayOpenDraws]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (companyId == null || user == null || drawId == null || buyerId == null || memoId == null) {
      showToast('Complete all required fields.', 'error');
      return;
    }

    const ticketNumbers = validTicketNumbers(rows);
    if (ticketNumbers.length === 0) {
      showToast('Enter at least one valid ticket number.', 'error');
      return;
    }

    setSaving(true);
    try {
      const result = await api.transactionsCreate({
        type: 'booking',
        companyId,
        userId: user.id,
        drawId,
        buyerId,
        memoId,
        ticketCount: ticketNumbers.length,
        ticketData: ticketsToTicketData(rows),
        amount: null,
        enteredAt: entryDate,
      });
      if (result.success) {
        showToast(`${ticketNumbers.length} tickets booked.`, 'success');
        setRows([{ number: '' }]);
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
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Booking Entry</h1>

      {drawPastClose && selectedDraw ? (
        <div className="mb-4 rounded border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          <strong>Warning:</strong> This draw closed at{' '}
          {formatCloseTimeLabel(selectedDraw.closeTime)} on{' '}
          {new Date(selectedDraw.drawDate).toLocaleDateString('en-GB')}. You are entering bookings
          after the close time.
        </div>
      ) : null}

      <div className="mb-4 rounded border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Draw *</span>
            <select
              value={drawId ?? ''}
              onChange={(event) => setDrawId(Number(event.target.value) || null)}
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm"
              required
            >
              <option value="">Select draw</option>
              {todayOpenDraws.map((draw) => (
                <option key={draw.id} value={draw.id}>
                  {draw.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Book For *</span>
            <select
              value={buyerId ?? ''}
              onChange={(event) => setBuyerId(Number(event.target.value) || null)}
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm"
              required
            >
              <option value="">Select buyer</option>
              {buyers.map((buyer) => (
                <option key={buyer.id} value={buyer.id}>
                  {buyer.name} ({buyer.type === 'stockist' ? 'Stocker' : 'Seller'})
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
      </div>

      <div className="mb-4 rounded border border-gray-200 bg-white p-4">
        <TicketNumberTable rows={rows} onChange={setRows} />
      </div>

      <Button type="submit" disabled={saving || companyId == null}>
        {saving ? 'Saving…' : 'Save Booking'}
      </Button>
    </form>
  );
}
