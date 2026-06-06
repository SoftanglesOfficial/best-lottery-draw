import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import TicketRangeTable, {
  rangesToTicketData,
  totalRangeCount,
  type RangeRow,
} from '../../components/transactions/TicketRangeTable';
import { useToast } from '../../components/Toast';
import { Button, Input } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { drawsList, providersList, transactionsCreate, transactionsGetProviderPurchaseSummary, transactionsNextMemoId } from '../../lib/api';
import type { DrawRecord, ProviderRecord } from '../../../shared/types';

type EntryOptions = {
  title?: string;
  saveLabel?: string;
  type?: 'purchase' | 'purchase_return';
};

export default function PurchaseEntryPage({
  title = 'Purchase Entry',
  saveLabel = 'Save Purchase',
  type = 'purchase',
}: EntryOptions = {}) {
  const allowed = useRoleGuard(['admin', 'owner', 'manager', 'supervisor', 'data_entry']);
  const { user } = useAuth();
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();

  const [draws, setDraws] = useState<DrawRecord[]>([]);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [drawId, setDrawId] = useState<number | null>(null);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [memoId, setMemoId] = useState<number | null>(null);
  const [voucherNo, setVoucherNo] = useState('');
  const [rows, setRows] = useState<RangeRow[]>([{ from: '', to: '' }]);
  const [saving, setSaving] = useState(false);
  const [purchaseSummary, setPurchaseSummary] = useState<{
    totalPurchased: number;
    totalReturned: number;
    net: number;
  } | null>(null);

  const openDraws = useMemo(
    () => draws.filter((draw) => draw.status === 'open'),
    [draws],
  );

  const selectedProvider = providers.find((provider) => provider.id === providerId) ?? null;

  const refreshMemo = useCallback(async () => {
    if (companyId == null) return;
    const result = await transactionsNextMemoId(companyId);
    if (result.success) setMemoId(result.nextMemoId);
  }, [companyId]);

  const load = useCallback(async () => {
    if (companyId == null) return;
    try {
      const [drawsResult, providersResult] = await Promise.all([
        drawsList(companyId),
        providersList(companyId),
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
    void transactionsGetProviderPurchaseSummary(providerId, drawId).then((result) => {
      if (result.success) setPurchaseSummary(result.summary);
    });
  }, [type, drawId, providerId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (companyId == null || user == null || drawId == null || providerId == null || memoId == null) {
      showToast('Complete all required fields.', 'error');
      return;
    }
    const ticketCount = totalRangeCount(rows);
    if (ticketCount <= 0) {
      showToast('Add at least one valid ticket range.', 'error');
      return;
    }

    const rate = selectedProvider?.purchaseRate ? Number(selectedProvider.purchaseRate) : 0;
    const amount = ticketCount * rate;

    setSaving(true);
    try {
      const result = await transactionsCreate({
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

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">{title}</h1>

      {type === 'purchase_return' && purchaseSummary ? (
        <div className="mb-4 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Purchased: {purchaseSummary.totalPurchased} | Already Returned:{' '}
          {purchaseSummary.totalReturned} | Available to Return: {purchaseSummary.net}
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-1 gap-3 rounded border border-gray-200 bg-white p-4 md:grid-cols-5">
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
          <span className="text-sm font-medium text-gray-700">Provider *</span>
          <select
            value={providerId ?? ''}
            onChange={(event) => setProviderId(Number(event.target.value) || null)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
            required
          >
            <option value="">Select provider</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
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
        <Input
          label="Voucher No"
          value={voucherNo}
          onChange={(event) => setVoucherNo(event.target.value)}
        />
      </div>

      <div className="mb-4 rounded border border-gray-200 bg-white p-4">
        <TicketRangeTable rows={rows} onChange={setRows} />
      </div>

      <Button type="submit" disabled={saving || companyId == null}>
        {saving ? 'Saving…' : saveLabel}
      </Button>
    </form>
  );
}
