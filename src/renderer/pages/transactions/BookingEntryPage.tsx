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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-cyber-hover">Booking workflow</p>
        <h1 className="font-display text-2xl font-bold text-content">Booking Entry</h1>
        <p className="mt-1 text-sm text-content-subtle">Book individual tickets against a buyer and draw.</p>
      </div>

      {drawPastClose && selectedDraw ? (
        <div className="rounded-cyber border border-cyber-warning/50 bg-cyber-warning/10 px-4 py-3 text-sm text-cyber-warning" role="alert">
          <strong>Warning:</strong> This draw closed at{' '}
          {formatCloseTimeLabel(selectedDraw.closeTime)} on{' '}
          {new Date(selectedDraw.drawDate).toLocaleDateString('en-GB')}. You are entering bookings
          after the close time.
        </div>
      ) : null}

      <section className="rounded-cyber-lg border border-line bg-surface-raised p-4" aria-label="Booking details">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Draw *</span>
            <select
              value={drawId ?? ''}
              onChange={(event) => setDrawId(Number(event.target.value) || null)}
              className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
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
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Book For *</span>
            <select
              value={buyerId ?? ''}
              onChange={(event) => setBuyerId(Number(event.target.value) || null)}
              className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
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
      </section>

      <section className="rounded-cyber-lg border border-line bg-surface-raised p-4" aria-label="Booking tickets">
        <div className="mb-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-content-subtle">Ticket grid</p>
          <h2 className="font-display font-bold text-content">Ticket Numbers</h2>
        </div>
        <TicketNumberTable rows={rows} onChange={setRows} />
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving || companyId == null}>
          {saving ? 'Saving…' : 'Save Booking'}
        </Button>
      </div>
    </form>
  );
}
