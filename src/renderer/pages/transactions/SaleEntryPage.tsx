import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../../components/ConfirmDialog';
import LegacyTransactionShell from '../../components/transactions/LegacyTransactionShell';
import SaleRangeTable, {
  emptySaleRangeRow,
  rowHasSaleData,
  saleRangesToTicketData,
  totalSaleRangeAmount,
  totalSaleRangeQty,
  validateSaleRangeRows,
  type SaleRangeRow,
} from '../../components/transactions/SaleRangeTable';
import { useToast } from '../../components/Toast';
import { Button, Input, PageHeader } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { isAtLeastRole } from '../../lib/roles';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { api } from '../../lib/api';
import { isDrawPastCloseTime, formatCloseTimeLabel } from '../../lib/drawCloseTime';
import { findDuplicatePrefixCodeIndex } from '../../../shared/ticketMath';
import { toLocalDateString } from '../../../shared/localDate';
import type { BuyerRecord, DrawRecord, ItemRecord } from '../../../shared/types';

type SaleEntryOptions = {
  title?: string;
  saveLabel?: string;
  type?: 'sale' | 'sale_return' | 'booking';
};

type ConfirmState =
  | { kind: 'delete' | 'clear'; message: string }
  | { kind: 'dup'; message: string; resolve: (ok: boolean) => void }
  | { kind: 'createParty'; name: string; message: string };

const LEGACY_TYPES = new Set<SaleEntryOptions['type']>(['sale', 'sale_return']);

function drawDateParts(draw: DrawRecord | null) {
  if (!draw) return { dateLabel: '—', dayLabel: '—' };
  const date = draw.drawDate instanceof Date ? draw.drawDate : new Date(draw.drawDate);
  if (Number.isNaN(date.getTime())) return { dateLabel: '—', dayLabel: '—' };
  return {
    dateLabel: date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }),
    dayLabel: date.toLocaleDateString('en-GB', { weekday: 'short' }),
  };
}

/** Intentional unlock — structured for future audit logging. */
function requestManagerUnlock(
  userRole: string | undefined,
  fields: Array<'prefix' | 'series' | 'absoluteTo'>,
): boolean {
  if (!userRole || !isAtLeastRole(userRole, 'manager')) return false;
  // ponytail: audit hook point — log unlock(fields) when audit exists
  void fields;
  return true;
}

export default function SaleEntryPage({
  title = 'Sale Entry',
  saveLabel = 'Save Sale',
  type = 'sale',
}: SaleEntryOptions = {}) {
  const allowed = useRoleGuard(['admin', 'owner', 'manager', 'supervisor', 'data_entry']);
  const { user } = useAuth();
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [draws, setDraws] = useState<DrawRecord[]>([]);
  const [buyers, setBuyers] = useState<BuyerRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [drawId, setDrawId] = useState<number | null>(null);
  const [buyerId, setBuyerId] = useState<number | null>(null);
  const [entryDate, setEntryDate] = useState(() => toLocalDateString());
  const [memoId, setMemoId] = useState<number | null>(null);
  const [rows, setRows] = useState<SaleRangeRow[]>([emptySaleRangeRow()]);
  const [saving, setSaving] = useState(false);
  const [buyerSummary, setBuyerSummary] = useState<{
    totalSold: number;
    totalReturned: number;
    net: number;
  } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [fieldsUnlocked, setFieldsUnlocked] = useState(false);
  const [absoluteToArmed, setAbsoluteToArmed] = useState(false);
  const [partyFocusRequest, setPartyFocusRequest] = useState(0);
  const [drawFocusRequest, setDrawFocusRequest] = useState(0);
  const [focusItemRequest, setFocusItemRequest] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const partyListOpenRef = useRef(false);

  const useLegacyShell = LEGACY_TYPES.has(type);
  const canManageUnlock = user ? isAtLeastRole(user.role, 'manager') : false;
  const defaultRate = useMemo(() => {
    const buyer = buyers.find((entry) => entry.id === buyerId);
    return buyer?.saleRate ? String(buyer.saleRate) : '';
  }, [buyers, buyerId]);

  const openDraws = useMemo(
    () => draws.filter((draw) => draw.status === 'open'),
    [draws],
  );

  const selectedDraw = draws.find((draw) => draw.id === drawId) ?? null;
  const selectedBuyer = buyers.find((buyer) => buyer.id === buyerId) ?? null;
  const { dateLabel: drawDateLabel, dayLabel: drawDayLabel } = drawDateParts(selectedDraw);
  const drawPastClose =
    type === 'sale' && selectedDraw != null && isDrawPastCloseTime(selectedDraw, now);

  const refreshMemo = useCallback(async () => {
    if (companyId == null) return;
    const result = await api.transactionsNextMemoId(companyId);
    if (result.success) setMemoId(result.nextMemoId);
  }, [companyId]);

  const load = useCallback(async () => {
    if (companyId == null) return;
    try {
      const [drawsResult, buyersResult, itemsResult] = await Promise.all([
        api.drawsList(companyId),
        api.buyersList(companyId),
        api.itemsList(companyId),
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
      if (itemsResult.success) {
        setItems(itemsResult.items);
      }
      await refreshMemo();
    } catch {
      showToast('Failed to load form data.', 'error');
    }
  }, [companyId, refreshMemo, showToast]);

  const refreshBuyerSummary = useCallback(async () => {
    if (type !== 'sale_return' || drawId == null || buyerId == null) {
      setBuyerSummary(null);
      return;
    }
    const result = await api.transactionsGetBuyerSaleSummary(buyerId, drawId);
    if (result.success) setBuyerSummary(result.summary);
    else setBuyerSummary(null);
  }, [type, buyerId, drawId]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  useEffect(() => {
    if (!useLegacyShell) return;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [useLegacyShell]);

  const deleteActiveRow = useCallback(() => {
    const row = rows[activeRowIndex];
    const doDelete = () => {
      if (rows.length <= 1) {
        setRows([emptySaleRangeRow(defaultRate)]);
        setActiveRowIndex(0);
        return;
      }
      const next = rows.filter((_, index) => index !== activeRowIndex);
      setRows(next);
      setActiveRowIndex(Math.max(0, activeRowIndex - 1));
    };
    if (row && rowHasSaleData(row)) {
      setConfirm({ kind: 'delete', message: `Delete row ${activeRowIndex + 1}?` });
      return;
    }
    doDelete();
  }, [activeRowIndex, defaultRate, rows]);

  const clearWorksheet = useCallback(() => {
    const dirty = rows.some(rowHasSaleData);
    if (dirty) {
      setConfirm({ kind: 'clear', message: 'Clear all sales data in this worksheet?' });
      return;
    }
    setRows([emptySaleRangeRow(defaultRate)]);
    setActiveRowIndex(0);
  }, [defaultRate, rows]);

  const applyConfirm = useCallback(async () => {
    if (!confirm) return;
    if (confirm.kind === 'delete') {
      if (rows.length <= 1) {
        setRows([emptySaleRangeRow(defaultRate)]);
        setActiveRowIndex(0);
      } else {
        const next = rows.filter((_, index) => index !== activeRowIndex);
        setRows(next);
        setActiveRowIndex(Math.max(0, activeRowIndex - 1));
      }
      setConfirm(null);
    } else if (confirm.kind === 'clear') {
      setRows([emptySaleRangeRow(defaultRate)]);
      setActiveRowIndex(0);
      setConfirm(null);
    } else if (confirm.kind === 'dup') {
      confirm.resolve(true);
      setConfirm(null);
    } else if (confirm.kind === 'createParty') {
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
  }, [activeRowIndex, companyId, confirm, defaultRate, rows, showToast]);

  const cancelConfirm = useCallback(() => {
    if (confirm?.kind === 'dup') confirm.resolve(false);
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

  const onBeforeAddRow = useCallback(
    (index: number) => {
      const dupAt = findDuplicatePrefixCodeIndex(rows, index);
      if (dupAt < 0) return true;
      const code = rows[index]?.code?.trim() || '(blank)';
      return new Promise<boolean>((resolve) => {
        setConfirm({
          kind: 'dup',
          message: `Duplicate prefix for code ${code} (also on row ${dupAt + 1}). Continue?`,
          resolve,
        });
      });
    },
    [rows],
  );

  const toggleFieldUnlock = useCallback(() => {
    if (fieldsUnlocked) {
      setFieldsUnlocked(false);
      return;
    }
    if (!requestManagerUnlock(user?.role, ['prefix', 'series'])) {
      showToast('Manager unlock required', 'error');
      return;
    }
    setFieldsUnlocked(true);
    showToast('Prefix / Series unlocked', 'success');
  }, [fieldsUnlocked, showToast, user?.role]);

  const armAbsoluteTo = useCallback(() => {
    if (!requestManagerUnlock(user?.role, ['absoluteTo'])) {
      showToast('Manager unlock required', 'error');
      return;
    }
    setAbsoluteToArmed(true);
    showToast('Absolute To armed for one edit', 'success');
  }, [showToast, user?.role]);

  useEffect(() => {
    if (!useLegacyShell) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        if (partyListOpenRef.current) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        if (!saving) formRef.current?.requestSubmit();
      }
      if (event.key === 'Delete' && event.ctrlKey) {
        event.preventDefault();
        deleteActiveRow();
      }
      if (event.key === 'F5') {
        event.preventDefault();
        deleteActiveRow();
      }
      if (event.key === 'F6' && type === 'sale_return') {
        event.preventDefault();
        navigate('/transactions/sale-entry');
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
        if (partyListOpenRef.current) return;
        event.preventDefault();
        navigate(-1);
      }
      if (event.key === 'F10' || event.key === 'F12') {
        event.preventDefault();
        window.print();
      }
      if (event.key === 'u' && event.ctrlKey && canManageUnlock) {
        event.preventDefault();
        toggleFieldUnlock();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    useLegacyShell,
    type,
    deleteActiveRow,
    clearWorksheet,
    navigate,
    saving,
    canManageUnlock,
    toggleFieldUnlock,
  ]);

  useEffect(() => {
    void refreshBuyerSummary();
  }, [refreshBuyerSummary]);

  useEffect(() => {
    if (drawId == null) return;
    if (!openDraws.some((draw) => draw.id === drawId)) {
      setDrawId(openDraws[0]?.id ?? null);
    }
  }, [drawId, openDraws]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (companyId == null || user == null || drawId == null || buyerId == null || memoId == null) {
      showToast('Complete all required fields.', 'error');
      return;
    }

    const validationError = validateSaleRangeRows(rows);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    const ticketCount = totalSaleRangeQty(rows);
    const amount = totalSaleRangeAmount(rows);

    if (type === 'sale_return') {
      if (!buyerSummary || buyerSummary.totalSold <= 0) {
        showToast('No sale found for this buyer in this draw', 'error');
        return;
      }
      if (ticketCount > buyerSummary.net) {
        showToast(`Cannot return more than available (${buyerSummary.net})`, 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const result = await api.transactionsCreate({
        type: type === 'booking' ? 'booking' : type,
        companyId,
        userId: user.id,
        drawId,
        buyerId,
        memoId,
        ticketCount,
        ticketData: saleRangesToTicketData(rows),
        amount,
        enteredAt: entryDate,
      });
      if (result.success) {
        showToast(`${ticketCount} tickets saved.`, 'success');
        setRows([emptySaleRangeRow(defaultRate)]);
        setActiveRowIndex(0);
        setFieldsUnlocked(false);
        setAbsoluteToArmed(false);
        setPartyFocusRequest((n) => n + 1);
        await refreshMemo();
        await refreshBuyerSummary();
      } else {
        showToast(result.error, 'error');
        setFocusItemRequest((n) => n + 1);
      }
    } catch {
      showToast('Failed to save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) return null;

  if (useLegacyShell) {
    const totalQty = totalSaleRangeQty(rows);
    const totalAmount = totalSaleRangeAmount(rows);
    const isReturn = type === 'sale_return';

    const unlockActions = canManageUnlock
      ? [
          {
            label: fieldsUnlocked ? 'Lock Fields' : 'Unlock Fields',
            onClick: toggleFieldUnlock,
          },
          {
            label: absoluteToArmed ? 'Absolute To Armed' : 'Arm Absolute To',
            onClick: armAbsoluteTo,
          },
        ]
      : [];

    return (
      <>
      <LegacyTransactionShell
        formRef={formRef}
        pageTitle={isReturn ? 'Sale Return' : 'Add Sale'}
        centerTitle={isReturn ? 'Sale Return' : 'Sales Entry'}
        contextLabel={
          selectedBuyer
            ? `${selectedBuyer.name} (Sr ${activeRowIndex + 1})`
            : isReturn
              ? 'Return Entry'
              : 'Sales Entry'
        }
        accent={isReturn ? 'orange' : 'blue'}
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
        partyFocusRequest={partyFocusRequest}
        drawFocusRequest={drawFocusRequest}
        partyListOpenRef={partyListOpenRef}
        onRequestCreateParty={onRequestCreateParty}
        alerts={
          drawPastClose && selectedDraw ? (
            <div
              className="shrink-0 border-b border-[#ffcf45] bg-[#806000] px-4 py-2 text-xs font-semibold text-white"
              role="alert"
            >
              Warning: This draw closed at {formatCloseTimeLabel(selectedDraw.closeTime)} on{' '}
              {new Date(selectedDraw.drawDate).toLocaleDateString('en-GB')}. You are entering sales
              after the close time.
            </div>
          ) : null
        }
        statusBanner={
          isReturn && buyerSummary ? (
            <div
              className="shrink-0 border-b border-[#ff8f63] bg-[#7c2d12] px-4 py-2 font-mono text-xs text-[#ffedd5]"
              role="status"
            >
              Sold: {buyerSummary.totalSold} | Returned: {buyerSummary.totalReturned} | Available:{' '}
              {buyerSummary.net}
            </div>
          ) : null
        }
        rowCount={rows.length}
        activeRowIndex={activeRowIndex}
        totalQty={totalQty}
        totalAmount={totalAmount}
        saving={saving}
        saveLabel={saving ? 'Saving…' : 'Save (F2)'}
        disabled={companyId == null}
        printShortcut={isReturn ? 'F10' : 'F12'}
        shortcuts={
          isReturn
            ? [
                'F2 Save',
                'F5 Delete Row',
                'F6 Make Sale',
                'F7 Search',
                'F8 Clear',
                'Esc Exit',
                'F10 Print',
              ]
            : undefined
        }
        extraActions={[
          ...unlockActions,
          ...(isReturn
            ? [{ label: 'Make Sale (F6)', onClick: () => navigate('/transactions/sale-entry') }]
            : []),
        ]}
        onSubmit={handleSubmit}
        onDeleteRow={deleteActiveRow}
        onClear={clearWorksheet}
        onSearch={() => navigate('/transactions/ticket-search')}
      >
        <SaleRangeTable
          rows={rows}
          onChange={setRows}
          items={items}
          defaultRate={defaultRate}
          variant="blueSpreadsheet"
          onActiveRowChange={setActiveRowIndex}
          drawDateLabel={drawDateLabel}
          drawDayLabel={drawDayLabel}
          fieldsUnlocked={fieldsUnlocked}
          absoluteToArmed={absoluteToArmed}
          onAbsoluteToConsumed={() => setAbsoluteToArmed(false)}
          onRowError={(message) => showToast(message, 'error')}
          focusItemRequest={focusItemRequest}
          onBeforeAddRow={onBeforeAddRow}
        />
      </LegacyTransactionShell>
      {confirm ? (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={applyConfirm}
          onCancel={cancelConfirm}
          confirmLabel={
            confirm.kind === 'dup' ? 'Continue' : confirm.kind === 'createParty' ? 'Create' : 'Confirm'
          }
        />
      ) : null}
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PageHeader
        eyebrow="Sales workflow"
        title={title}
        subtitle="Enter buyer, draw, lottery, and ticket range details."
      />

      {drawPastClose && selectedDraw ? (
        <div className="rounded-cyber border border-cyber-warning/50 bg-cyber-warning/10 px-4 py-3 text-sm text-cyber-warning" role="alert">
          <strong>Warning:</strong> This draw closed at{' '}
          {formatCloseTimeLabel(selectedDraw.closeTime)} on{' '}
          {new Date(selectedDraw.drawDate).toLocaleDateString('en-GB')}. You are entering sales after
          the close time.
        </div>
      ) : null}

      {type === 'sale_return' && buyerSummary ? (
        <div className="rounded-cyber border border-cyber/40 bg-cyber/10 px-4 py-3 font-mono text-xs text-cyber-hover" role="status">
          Sold: {buyerSummary.totalSold} | Returned: {buyerSummary.totalReturned} | Available:{' '}
          {buyerSummary.net}
        </div>
      ) : null}

      <section className="rounded-cyber-lg border border-line bg-surface-raised p-4" aria-label="Sale details">
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
            {openDraws.map((draw) => (
              <option key={draw.id} value={draw.id}>
                {draw.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Sale To *</span>
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

      <section className="rounded-cyber-lg border border-line bg-surface-raised p-4" aria-label="Sale ticket ranges">
        <div className="mb-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-content-subtle">Ticket grid</p>
          <h2 className="font-display font-bold text-content">Sale Ranges</h2>
        </div>
        <SaleRangeTable
          rows={rows}
          onChange={setRows}
          items={items}
          defaultRate={defaultRate}
          drawDateLabel={drawDateLabel}
          drawDayLabel={drawDayLabel}
          fieldsUnlocked={fieldsUnlocked}
          absoluteToArmed={absoluteToArmed}
          onAbsoluteToConsumed={() => setAbsoluteToArmed(false)}
          onRowError={(message) => showToast(message, 'error')}
        />
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving || companyId == null}>
          {saving ? 'Saving…' : saveLabel}
        </Button>
      </div>
    </form>
  );
}
