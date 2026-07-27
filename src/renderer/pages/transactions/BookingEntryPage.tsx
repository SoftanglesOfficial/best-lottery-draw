import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../../components/ConfirmDialog';
import LegacyTransactionShell from '../../components/transactions/LegacyTransactionShell';
import TicketNumberTable, {
  emptyTicketRows,
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
import { isSameCalendarDay, toLocalDateString } from '../../../shared/localDate';
import type { BuyerRecord, DrawRecord } from '../../../shared/types';

type ConfirmState =
  | null
  | { kind: 'delete'; message: string }
  | { kind: 'createParty'; name: string; message: string };

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
  const [entryDate, setEntryDate] = useState(() => toLocalDateString());
  const [memoId, setMemoId] = useState<number | null>(null);
  const [rows, setRows] = useState<TicketRow[]>(() => emptyTicketRows());
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [partyFocusRequest, setPartyFocusRequest] = useState(0);
  const [drawFocusRequest, setDrawFocusRequest] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const openDraws = draws.filter((draw) => draw.status === 'open');
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
        const open = drawsResult.draws.filter((draw) => draw.status === 'open');
        const preferred =
          open.find((draw) => isSameCalendarDay(draw.drawDate, entryDate)) ?? open[0];
        setDrawId((current) => current ?? preferred?.id ?? null);
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

  const doDeleteActiveRow = useCallback(() => {
    if (rows.length <= 1) {
      setRows(emptyTicketRows());
      setActiveRowIndex(0);
      return;
    }
    const next = rows.filter((_, index) => index !== activeRowIndex);
    setRows(next.length ? next : emptyTicketRows());
    setActiveRowIndex(Math.max(0, activeRowIndex - 1));
  }, [activeRowIndex, rows]);

  const deleteActiveRow = useCallback(() => {
    const row = rows[activeRowIndex];
    if (row?.number?.trim()) {
      setConfirm({ kind: 'delete', message: `Delete row ${activeRowIndex + 1}?` });
      return;
    }
    doDeleteActiveRow();
  }, [activeRowIndex, doDeleteActiveRow, rows]);

  const applyConfirm = useCallback(async () => {
    if (!confirm) return;
    if (confirm.kind === 'delete') {
      doDeleteActiveRow();
      setConfirm(null);
      return;
    }
    if (confirm.kind === 'createParty') {
      const name = confirm.name;
      setConfirm(null);
      if (companyId == null) {
        showToast('No active company.', 'error');
        setPartyFocusRequest((n) => n + 1);
        return;
      }
      const groupsResult = await api.buyerGroupsList(companyId);
      if (!groupsResult.success || groupsResult.groups.length === 0) {
        showToast(
          groupsResult.success
            ? 'No buyer group — create one in Master first.'
            : groupsResult.error,
          'error',
        );
        setPartyFocusRequest((n) => n + 1);
        return;
      }
      const createResult = await api.buyersCreate({
        name,
        companyId,
        buyerGroupId: groupsResult.groups[0].id,
        type: 'stockist',
      });
      if (!createResult.success || !createResult.buyer) {
        showToast(createResult.success ? 'Failed to create party.' : createResult.error, 'error');
        setPartyFocusRequest((n) => n + 1);
        return;
      }
      const listResult = await api.buyersList(companyId);
      if (listResult.success) setBuyers(listResult.buyers);
      setBuyerId(createResult.buyer.id);
      setDrawFocusRequest((n) => n + 1);
    }
  }, [companyId, confirm, doDeleteActiveRow, showToast]);

  const cancelConfirm = useCallback(() => {
    if (confirm?.kind === 'createParty') setPartyFocusRequest((n) => n + 1);
    setConfirm(null);
  }, [confirm]);

  const onRequestCreateParty = useCallback((name: string) => {
    setConfirm({
      kind: 'createParty',
      name,
      message: `Create party "${name}" as stockist?`,
    });
  }, []);

  const clearWorksheet = useCallback(() => {
    setRows(emptyTicketRows());
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
      if (event.key === 'F3' || event.key === 'F5') {
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
    if (!openDraws.some((draw) => draw.id === drawId)) {
      setDrawId(openDraws[0]?.id ?? null);
    }
  }, [drawId, openDraws]);

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
        setRows(emptyTicketRows());
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
    <>
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
      parties={buyers.map((b) => ({
        id: b.id,
        name: b.name,
        detail: b.type === 'stockist' ? 'Stocker' : 'Seller',
      }))}
      partyId={buyerId}
      onPartyIdChange={setBuyerId}
      drawId={drawId}
      onDrawIdChange={setDrawId}
      draws={openDraws}
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
      partyFocusRequest={partyFocusRequest}
      drawFocusRequest={drawFocusRequest}
      onRequestCreateParty={onRequestCreateParty}
    >
      <TicketNumberTable
        rows={rows}
        onChange={setRows}
        variant="blueSpreadsheet"
        onActiveIndexChange={setActiveRowIndex}
        onRequestDelete={(index) => {
          setActiveRowIndex(index);
          if (rows[index]?.number?.trim()) {
            setConfirm({ kind: 'delete', message: `Delete row ${index + 1}?` });
            return;
          }
          if (rows.length <= 1) {
            setRows([{ number: '' }]);
            setActiveRowIndex(0);
            return;
          }
          const next = rows.filter((_, i) => i !== index);
          setRows(next.length ? next : [{ number: '' }]);
          setActiveRowIndex(Math.max(0, Math.min(index, next.length - 1)));
        }}
      />
    </LegacyTransactionShell>
    {confirm ? (
      <ConfirmDialog
        message={confirm.message}
        onConfirm={() => void applyConfirm()}
        onCancel={cancelConfirm}
        confirmLabel={confirm.kind === 'createParty' ? 'Create' : 'Confirm'}
      />
    ) : null}
    </>
  );
}
