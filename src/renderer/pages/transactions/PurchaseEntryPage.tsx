import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LegacyTransactionShell from '../../components/transactions/LegacyTransactionShell';
import TicketRangeTable, {
  rangesToTicketData,
  totalRangeCount,
  validateTicketRangeRows,
  type RangeRow,
} from '../../components/transactions/TicketRangeTable';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { api } from '../../lib/api';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { toLocalDateString } from '../../../shared/localDate';
import type { DrawRecord, ProviderRecord } from '../../../shared/types';

type EntryOptions = {
  saveLabel?: string;
  type?: 'purchase' | 'purchase_return';
};

export default function PurchaseEntryPage({
  saveLabel = 'Save Purchase',
  type = 'purchase',
}: EntryOptions = {}) {
  const allowed = useRoleGuard(['admin', 'owner', 'manager', 'supervisor', 'data_entry']);
  const { user } = useAuth();
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [draws, setDraws] = useState<DrawRecord[]>([]);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [drawId, setDrawId] = useState<number | null>(null);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [entryDate, setEntryDate] = useState(() => toLocalDateString());
  const [memoId, setMemoId] = useState<number | null>(null);
  const [voucherNo, setVoucherNo] = useState('');
  const [rows, setRows] = useState<RangeRow[]>([{ from: '', to: '' }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [purchaseSummary, setPurchaseSummary] = useState<{
    totalPurchased: number;
    totalReturned: number;
    net: number;
  } | null>(null);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const openDraws = useMemo(
    () => draws.filter((draw) => draw.status === 'open'),
    [draws],
  );

  const selectedProvider = providers.find((provider) => provider.id === providerId) ?? null;

  const refreshMemo = useCallback(async () => {
    if (companyId == null) return;
    const result = await api.transactionsNextMemoId(companyId);
    if (result.success) setMemoId(result.nextMemoId);
  }, [companyId]);

  const load = useCallback(async () => {
    if (companyId == null) return;
    try {
      const [drawsResult, providersResult] = await Promise.all([
        api.drawsList(companyId),
        api.providersList(companyId),
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
      await refreshMemo();
    } catch {
      showToast('Failed to load form data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, refreshMemo, showToast]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  useEffect(() => {
    if (type !== 'purchase_return' || drawId == null || providerId == null) {
      setPurchaseSummary(null);
      return;
    }
    void api.transactionsGetProviderPurchaseSummary(providerId, drawId).then((result) => {
      if (result.success) setPurchaseSummary(result.summary);
    });
  }, [type, drawId, providerId]);

  const deleteActiveRow = useCallback(() => {
    if (rows.length <= 1) {
      setRows([{ from: '', to: '' }]);
      setActiveRowIndex(0);
      return;
    }
    const next = rows.filter((_, index) => index !== activeRowIndex);
    setRows(next.length ? next : [{ from: '', to: '' }]);
    setActiveRowIndex(Math.max(0, activeRowIndex - 1));
  }, [activeRowIndex, rows]);

  const clearWorksheet = useCallback(() => {
    setRows([{ from: '', to: '' }]);
    setActiveRowIndex(0);
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (companyId == null || user == null || drawId == null || providerId == null || memoId == null) {
      showToast('Complete all required fields.', 'error');
      return;
    }
    const rangeError = validateTicketRangeRows(rows);
    if (rangeError) {
      showToast(rangeError, 'error');
      return;
    }
    const ticketCount = totalRangeCount(rows);
    if (ticketCount <= 0) {
      showToast('Add at least one valid ticket range.', 'error');
      return;
    }

    if (type === 'purchase_return') {
      if (!purchaseSummary || purchaseSummary.net <= 0) {
        showToast('No purchase found for this provider in this draw', 'error');
        return;
      }
      if (ticketCount > purchaseSummary.net) {
        showToast(`Cannot return more than available (${purchaseSummary.net})`, 'error');
        return;
      }
    }

    const rate = selectedProvider?.purchaseRate ? Number(selectedProvider.purchaseRate) : 0;
    const amount = ticketCount * rate;

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
        ticketData: rangesToTicketData(rows),
        amount,
        enteredAt: entryDate,
      });
      if (result.success) {
        showToast(`${ticketCount} tickets saved.`, 'success');
        setRows([{ from: '', to: '' }]);
        setVoucherNo('');
        setActiveRowIndex(0);
        await refreshMemo();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to save purchase.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) return null;
  if (loading) return <LoadingSpinner />;

  const isReturn = type === 'purchase_return';

  return (
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
      partyLabel="Provider *"
      partyKind="provider"
      accent={isReturn ? 'orange' : 'blue'}
      memoId={memoId}
      entryDate={entryDate}
      onEntryDateChange={setEntryDate}
      providers={providers}
      providerId={providerId}
      onProviderIdChange={setProviderId}
      drawId={drawId}
      onDrawIdChange={setDrawId}
      draws={openDraws}
      voucherNo={voucherNo}
      onVoucherNoChange={setVoucherNo}
      statusBanner={
        isReturn && purchaseSummary ? (
          <div
            className="shrink-0 border-b border-[#ff8f63] bg-[#7c2d12] px-4 py-2 font-mono text-xs text-[#ffedd5]"
            role="status"
          >
            Purchased: {purchaseSummary.totalPurchased} | Already Returned:{' '}
            {purchaseSummary.totalReturned} | Available to Return: {purchaseSummary.net}
          </div>
        ) : null
      }
      rowCount={rows.length}
      activeRowIndex={activeRowIndex}
      totalQty={totalRangeCount(rows)}
      totalAmount={
        selectedProvider?.purchaseRate
          ? totalRangeCount(rows) * Number(selectedProvider.purchaseRate)
          : null
      }
      saving={saving}
      saveLabel={saving ? 'Saving…' : `${saveLabel} (F2)`}
      disabled={companyId == null}
      onSubmit={handleSubmit}
      onDeleteRow={deleteActiveRow}
      onClear={clearWorksheet}
      onSearch={() => navigate('/transactions/ticket-search')}
    >
      <TicketRangeTable
        rows={rows}
        onChange={setRows}
        onActiveRowChange={setActiveRowIndex}
        variant="blueSpreadsheet"
      />
    </LegacyTransactionShell>
  );
}
