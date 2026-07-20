import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LegacyTransactionShell from '../../components/transactions/LegacyTransactionShell';
import TicketNumberTable, {
  ticketsToTicketData,
  validTicketNumbers,
  type TicketRow,
} from '../../components/transactions/TicketNumberTable';
import { useToast } from '../../components/Toast';
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
  const navigate = useNavigate();

  const [draws, setDraws] = useState<DrawRecord[]>([]);
  const [buyers, setBuyers] = useState<BuyerRecord[]>([]);
  const [drawId, setDrawId] = useState<number | null>(null);
  const [buyerId, setBuyerId] = useState<number | null>(null);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [memoId, setMemoId] = useState<number | null>(null);
  const [rows, setRows] = useState<TicketRow[]>([{ number: '' }]);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const todayOpenDraws = draws.filter(
    (draw) => draw.status === 'open' && isSameDay(draw.drawDate, entryDate),
  );
  const selectedDraw = draws.find((draw) => draw.id === drawId) ?? null;
  const selectedBuyer = buyers.find((buyer) => buyer.id === buyerId) ?? null;
  const drawPastClose = selectedDraw != null && isDrawPastCloseTime(selectedDraw, now);
  const totalQty = validTicketNumbers(rows).length;

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

  const deleteActiveRow = useCallback(() => {
    if (rows.length <= 1) {
      setRows([{ number: '' }]);
      setActiveRowIndex(0);
      return;
    }
    const next = rows.filter((_, index) => index !== activeRowIndex);
    setRows(next.length ? next : [{ number: '' }]);
    setActiveRowIndex(Math.max(0, activeRowIndex - 1));
  }, [activeRowIndex, rows]);

  const clearWorksheet = useCallback(() => {
    setRows([{ number: '' }]);
    setActiveRowIndex(0);
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
      if (event.key === 'F3') {
        event.preventDefault();
        deleteActiveRow();
      }
      if (event.key === 'F7') {
        event.preventDefault();
        navigate('/transactions/ticket-search');
      }
      if (event.key === 'F8') {
        event.preventDefault();
        clearWorksheet();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        navigate(-1);
      }
      if (event.key === 'F12') {
        event.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteActiveRow, clearWorksheet, navigate]);

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
    <LegacyTransactionShell
      formRef={formRef}
      pageTitle="Add Booking"
      centerTitle="Booking Entry"
      contextLabel={
        selectedBuyer ? `${selectedBuyer.name} (Sr ${activeRowIndex + 1})` : 'Booking Entry'
      }
      partyLabel="Book For *"
      memoId={memoId}
      entryDate={entryDate}
      onEntryDateChange={setEntryDate}
      buyerId={buyerId}
      onBuyerIdChange={setBuyerId}
      buyers={buyers}
      drawId={drawId}
      onDrawIdChange={setDrawId}
      draws={todayOpenDraws}
      alerts={
        drawPastClose && selectedDraw ? (
          <div
            className="shrink-0 border-b border-[#ffcf45] bg-[#806000] px-4 py-2 text-xs font-semibold text-white"
            role="alert"
          >
            Warning: This draw closed at {formatCloseTimeLabel(selectedDraw.closeTime)} on{' '}
            {new Date(selectedDraw.drawDate).toLocaleDateString('en-GB')}. You are entering
            bookings after the close time.
          </div>
        ) : null
      }
      rowCount={rows.length}
      activeRowIndex={activeRowIndex}
      totalQty={totalQty}
      totalAmount={null}
      saving={saving}
      saveLabel={saving ? 'Saving…' : 'Save (F2)'}
      disabled={companyId == null}
      onSubmit={handleSubmit}
      onDeleteRow={deleteActiveRow}
      onClear={clearWorksheet}
      onSearch={() => navigate('/transactions/ticket-search')}
    >
      <TicketNumberTable
        rows={rows}
        onChange={setRows}
        variant="blueSpreadsheet"
        onActiveIndexChange={setActiveRowIndex}
      />
    </LegacyTransactionShell>
  );
}
