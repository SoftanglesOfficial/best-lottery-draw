import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import TicketRangeTable, {
  rangesToTicketData,
  totalRangeCount,
  validateTicketRangeRows,
  type RangeRow,
} from '../../components/transactions/TicketRangeTable';
import { useToast } from '../../components/Toast';
import { Button, Input } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { api } from '../../lib/api';
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-cyber-hover">Purchase workflow</p>
        <h1 className="font-display text-2xl font-bold text-content">{title}</h1>
        <p className="mt-1 text-sm text-content-subtle">Enter provider, draw, and ticket range details.</p>
      </div>

      {type === 'purchase_return' && purchaseSummary ? (
        <div className="rounded-cyber border border-cyber-info/40 bg-cyber-info/10 px-4 py-3 font-mono text-xs text-cyber-info" role="status">
          Purchased: {purchaseSummary.totalPurchased} | Already Returned:{' '}
          {purchaseSummary.totalReturned} | Available to Return: {purchaseSummary.net}
        </div>
      ) : null}

      <section className="rounded-cyber-lg border border-line bg-surface-raised p-4" aria-label="Purchase details">
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
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Provider *</span>
          <select
            value={providerId ?? ''}
            onChange={(event) => setProviderId(Number(event.target.value) || null)}
            className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
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
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
        <Input
          label="Voucher No"
          value={voucherNo}
          onChange={(event) => setVoucherNo(event.target.value)}
        />
        </div>
      </section>

      <section className="rounded-cyber-lg border border-line bg-surface-raised p-4" aria-label="Ticket ranges">
        <div className="mb-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-content-subtle">Ticket grid</p>
          <h2 className="font-display font-bold text-content">Purchase Ranges</h2>
        </div>
        <TicketRangeTable rows={rows} onChange={setRows} />
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving || companyId == null}>
          {saving ? 'Saving…' : saveLabel}
        </Button>
      </div>
    </form>
  );
}
