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
import { useAuth } from '../../lib/auth';
import { isAtLeastRole } from '../../lib/roles';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { api } from '../../lib/api';
import { isDrawPastCloseTime, formatCloseTimeLabel } from '../../lib/drawCloseTime';
import { findDuplicatePrefixCodeIndex } from '../../../shared/ticketMath';
import { toLocalDateString } from '../../../shared/localDate';
import type { DrawRecord, ItemRecord, ProviderRecord } from '../../../shared/types';

type EntryOptions = {
  title?: string;
  saveLabel?: string;
  type?: 'purchase' | 'purchase_return';
};

type ConfirmState =
  | { kind: 'delete' | 'clear'; message: string }
  | { kind: 'dup'; message: string; resolve: (ok: boolean) => void }
  | { kind: 'createParty'; name: string; message: string };

const LEGACY_TYPES = new Set<EntryOptions['type']>(['purchase', 'purchase_return']);

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

export default function PurchaseEntryPage({
  type = 'purchase',
}: EntryOptions = {}) {
  const allowed = useRoleGuard(['admin', 'owner', 'manager', 'supervisor', 'data_entry']);
  const { user } = useAuth();
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [draws, setDraws] = useState<DrawRecord[]>([]);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [drawId, setDrawId] = useState<number | null>(null);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [entryDate, setEntryDate] = useState(() => toLocalDateString());
  const [memoId, setMemoId] = useState<number | null>(null);
  const [voucherNo, setVoucherNo] = useState('');
  const [rows, setRows] = useState<SaleRangeRow[]>([emptySaleRangeRow()]);
  const [saving, setSaving] = useState(false);
  const [purchaseSummary, setPurchaseSummary] = useState<{
    totalPurchased: number;
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
    const provider = providers.find((entry) => entry.id === providerId);
    return provider?.purchaseRate ? String(provider.purchaseRate) : '';
  }, [providers, providerId]);

  const openDraws = useMemo(
    () => draws.filter((draw) => draw.status === 'open'),
    [draws],
  );

  const selectedDraw = draws.find((draw) => draw.id === drawId) ?? null;
  const selectedProvider = providers.find((provider) => provider.id === providerId) ?? null;
  const { dateLabel: drawDateLabel, dayLabel: drawDayLabel } = drawDateParts(selectedDraw);
  const drawPastClose =
    type === 'purchase' && selectedDraw != null && isDrawPastCloseTime(selectedDraw, now);

  const refreshMemo = useCallback(async () => {
    if (companyId == null) return;
    const result = await api.transactionsNextMemoId(companyId);
    if (result.success) setMemoId(result.nextMemoId);
  }, [companyId]);

  const load = useCallback(async () => {
    if (companyId == null) return;
    try {
      const [drawsResult, providersResult, itemsResult] = await Promise.all([
        api.drawsList(companyId),
        api.providersList(companyId),
        api.itemsList(companyId),
      ]);
      if (drawsResult.success) {
        setDraws(drawsResult.draws);
        const open = drawsResult.draws.filter((draw) => draw.status === 'open');
        setDrawId((current) => current ?? open[0]?.id ?? null);
      }
      if (providersResult.success) {
        setProviders(providersResult.providers);
        setProviderId((current) => current ?? providersResult.providers[0]?.id ?? null);
      }
      if (itemsResult.success) {
        setItems(itemsResult.items);
      }
      await refreshMemo();
    } catch {
      showToast('Failed to load form data.', 'error');
    }
  }, [companyId, refreshMemo, showToast]);

  const refreshPurchaseSummary = useCallback(async () => {
    if (type !== 'purchase_return' || drawId == null || providerId == null) {
      setPurchaseSummary(null);
      return;
    }
    const result = await api.transactionsGetProviderPurchaseSummary(providerId, drawId);
    if (result.success) setPurchaseSummary(result.summary);
    else setPurchaseSummary(null);
  }, [type, providerId, drawId]);

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
      setConfirm({ kind: 'clear', message: 'Clear all purchase data in this worksheet?' });
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
      const groupsResult = await api.providerGroupsList(companyId);
      if (!groupsResult.success || groupsResult.groups.length === 0) {
        showToast(
          groupsResult.success
            ? 'No provider group — create one in Master first.'
            : groupsResult.error,
          'error',
        );
        setPartyFocusRequest((n) => n + 1);
        return;
      }
      const createResult = await api.providersCreate({
        name,
        companyId,
        providerGroupId: groupsResult.groups[0].id,
      });
      if (!createResult.success || !createResult.provider) {
        showToast(createResult.success ? 'Failed to create party.' : createResult.error, 'error');
        setPartyFocusRequest((n) => n + 1);
        return;
      }
      const listResult = await api.providersList(companyId);
      if (listResult.success) setProviders(listResult.providers);
      setProviderId(createResult.provider.id);
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
      message: `Create party "${name}" as provider?`,
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
      if (event.key === 'F6' && type === 'purchase_return') {
        event.preventDefault();
        navigate('/transactions/purchase-entry');
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
    void refreshPurchaseSummary();
  }, [refreshPurchaseSummary]);

  useEffect(() => {
    if (drawId == null) return;
    if (!openDraws.some((draw) => draw.id === drawId)) {
      setDrawId(openDraws[0]?.id ?? null);
    }
  }, [drawId, openDraws]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (companyId == null || user == null || drawId == null || providerId == null || memoId == null) {
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

    if (type === 'purchase_return') {
      if (!purchaseSummary || purchaseSummary.totalPurchased <= 0) {
        showToast('No purchase found for this provider in this draw', 'error');
        return;
      }
      if (ticketCount > purchaseSummary.net) {
        showToast(`Cannot return more than available (${purchaseSummary.net})`, 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const result = await api.transactionsCreate({
        type,
        companyId,
        userId: user.id,
        drawId,
        providerId,
        memoId,
        voucherNo: voucherNo.trim() || null,
        ticketCount,
        ticketData: saleRangesToTicketData(rows),
        amount,
        enteredAt: entryDate,
      });
      if (result.success) {
        showToast(`${ticketCount} tickets saved.`, 'success');
        setRows([emptySaleRangeRow(defaultRate)]);
        setActiveRowIndex(0);
        setVoucherNo('');
        setFieldsUnlocked(false);
        setAbsoluteToArmed(false);
        setPartyFocusRequest((n) => n + 1);
        await refreshMemo();
        await refreshPurchaseSummary();
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
    const isReturn = type === 'purchase_return';

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
        pageTitle={isReturn ? 'Purchase Return' : 'Add Purchase'}
        centerTitle={isReturn ? 'Purchase Return' : 'Purchase Entry'}
        contextLabel={
          selectedProvider
            ? `${selectedProvider.name} (Sr ${activeRowIndex + 1})`
            : isReturn
              ? 'Return Entry'
              : 'Purchase Entry'
        }
        accent={isReturn ? 'orange' : 'blue'}
        memoId={memoId}
        entryDate={entryDate}
        onEntryDateChange={setEntryDate}
        voucherNo={voucherNo}
        onVoucherNoChange={setVoucherNo}
        parties={providers.map((p) => ({
          id: p.id,
          name: p.name,
        }))}
        partyId={providerId}
        onPartyIdChange={setProviderId}
        partyLabel="Provider Name *"
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
              {new Date(selectedDraw.drawDate).toLocaleDateString('en-GB')}. You are entering purchases
              after the close time.
            </div>
          ) : null
        }
        statusBanner={
          isReturn && purchaseSummary ? (
            <div
              className="shrink-0 border-b border-[#ff8f63] bg-[#7c2d12] px-4 py-2 font-mono text-xs text-[#ffedd5]"
              role="status"
            >
              Purchased: {purchaseSummary.totalPurchased} | Returned: {purchaseSummary.totalReturned} | Available:{' '}
              {purchaseSummary.net}
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
                'F6 Make Purchase',
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
            ? [{ label: 'Make Purchase (F6)', onClick: () => navigate('/transactions/purchase-entry') }]
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

  return null;
}
