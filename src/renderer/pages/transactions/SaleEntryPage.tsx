import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SaleRangeTable, {
  emptySaleRangeRow,
  saleRangesToTicketData,
  totalSaleRangeAmount,
  totalSaleRangeQty,
  validateSaleRangeRows,
  type SaleRangeRow,
} from '../../components/transactions/SaleRangeTable';
import { useToast } from '../../components/Toast';
import { Button, Input } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { api } from '../../lib/api';
import { isDrawPastCloseTime, formatCloseTimeLabel } from '../../lib/drawCloseTime';
import type { BuyerRecord, DrawRecord, ItemRecord } from '../../../shared/types';

type SaleEntryOptions = {
  title?: string;
  saveLabel?: string;
  type?: 'sale' | 'sale_return' | 'booking';
};

function isSameDay(a: Date | string, dateStr: string) {
  const date = a instanceof Date ? a : new Date(a);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === dateStr;
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
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [memoId, setMemoId] = useState<number | null>(null);
  const [rows, setRows] = useState<SaleRangeRow[]>([emptySaleRangeRow()]);
  const [saving, setSaving] = useState(false);
  const [buyerSummary, setBuyerSummary] = useState<{
    totalSold: number;
    totalReturned: number;
    net: number;
  } | null>(null);
  const [now, setNow] = useState(() => new Date());

  const defaultRate = useMemo(() => {
    const buyer = buyers.find((entry) => entry.id === buyerId);
    return buyer?.saleRate ? String(buyer.saleRate) : '';
  }, [buyers, buyerId]);

  const todayOpenDraws = useMemo(
    () =>
      draws.filter(
        (draw) => draw.status === 'open' && isSameDay(draw.drawDate, entryDate),
      ),
    [draws, entryDate],
  );

  const selectedDraw = draws.find((draw) => draw.id === drawId) ?? null;
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
        const openToday = drawsResult.draws.filter(
          (draw) => draw.status === 'open' && isSameDay(draw.drawDate, entryDate),
        );
        setDrawId((current) => current ?? openToday[0]?.id ?? null);
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
  }, [companyId, entryDate, refreshMemo, showToast]);

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
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void refreshBuyerSummary();
  }, [refreshBuyerSummary]);

  useEffect(() => {
    if (drawId == null) return;
    if (!todayOpenDraws.some((draw) => draw.id === drawId)) {
      setDrawId(todayOpenDraws[0]?.id ?? null);
    }
  }, [drawId, todayOpenDraws]);

  useEffect(() => {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        rate: row.rate || defaultRate,
      })),
    );
  }, [defaultRate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
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
    const amount = type === 'booking' ? null : totalSaleRangeAmount(rows);

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
        type,
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
        await refreshMemo();
        await refreshBuyerSummary();
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

  if (type === 'sale') {
    const totalQty = totalSaleRangeQty(rows);
    const totalAmount = totalSaleRangeAmount(rows);

    return (
      <form
        onSubmit={handleSubmit}
        className="flex h-full min-h-[720px] flex-col overflow-hidden bg-[#06154d] font-sans text-white"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b-2 border-[#78a5f2] bg-gradient-to-b from-[#2462d4] to-[#0e3d9e] px-5 shadow-[inset_0_-1px_0_#082969]">
          <div className="flex items-center gap-4">
            <div className="border-r border-[#75a2ef] pr-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c8dcff]">
                Best-12 Morning Booking
              </p>
              <h1 className="text-xl font-extrabold uppercase tracking-[0.04em] text-white">
                Sales Entry
              </h1>
            </div>
            <p className="hidden text-xs font-semibold text-[#d9e7ff] xl:block">
              Range Sales Worksheet
            </p>
          </div>
          <nav className="flex items-center gap-2" aria-label="Sales entry navigation">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="border border-[#9bbcf5] bg-[#123b92] px-4 py-1.5 text-xs font-bold uppercase text-white shadow-sm hover:bg-[#1a4aaa] focus:ring-2 focus:ring-[#ffd447]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => navigate('/menu')}
              className="border border-[#9bbcf5] bg-[#123b92] px-4 py-1.5 text-xs font-bold uppercase text-white shadow-sm hover:bg-[#1a4aaa] focus:ring-2 focus:ring-[#ffd447]"
            >
              Menu
            </button>
          </nav>
        </header>

        <section
          className="shrink-0 border-b border-[#5e8ddd] bg-[#0b2e83] px-4 py-2"
          aria-label="Sale details"
        >
          <div className="grid grid-cols-[minmax(220px,1.5fr)_minmax(240px,1.7fr)_180px_140px] gap-3">
            <label className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#c7dcff]">
                Draw *
              </span>
              <select
                value={drawId ?? ''}
                onChange={(event) => setDrawId(Number(event.target.value) || null)}
                className="h-8 min-w-0 flex-1 border border-[#8fb3ec] bg-[#f6faff] px-2 text-xs font-semibold text-[#071b4d] outline-none focus:border-[#ffd447] focus:ring-1 focus:ring-[#ffd447]"
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
            <label className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#c7dcff]">
                Sale To *
              </span>
              <select
                value={buyerId ?? ''}
                onChange={(event) => setBuyerId(Number(event.target.value) || null)}
                className="h-8 min-w-0 flex-1 border border-[#8fb3ec] bg-[#f6faff] px-2 text-xs font-semibold text-[#071b4d] outline-none focus:border-[#ffd447] focus:ring-1 focus:ring-[#ffd447]"
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
            <label className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#c7dcff]">
                Date
              </span>
              <input
                type="date"
                value={entryDate}
                onChange={(event) => setEntryDate(event.target.value)}
                className="h-8 min-w-0 flex-1 border border-[#8fb3ec] bg-[#f6faff] px-2 text-xs font-semibold text-[#071b4d] outline-none focus:border-[#ffd447] focus:ring-1 focus:ring-[#ffd447]"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#c7dcff]">
                Memo ID
              </span>
              <input
                value={memoId ?? ''}
                readOnly
                className="h-8 min-w-0 flex-1 border border-[#6f96d7] bg-[#bcd1f1] px-2 font-mono text-xs font-bold text-[#15366f]"
              />
            </label>
          </div>
        </section>

        {drawPastClose && selectedDraw ? (
          <div
            className="shrink-0 border-b border-[#ffcf45] bg-[#806000] px-4 py-2 text-xs font-semibold text-white"
            role="alert"
          >
            Warning: This draw closed at {formatCloseTimeLabel(selectedDraw.closeTime)} on{' '}
            {new Date(selectedDraw.drawDate).toLocaleDateString('en-GB')}. You are entering sales
            after the close time.
          </div>
        ) : null}

        <section
          className="flex min-h-0 flex-1 flex-col bg-[#06154d] p-3"
          aria-label="Sale ticket ranges"
        >
          <div className="flex shrink-0 items-center justify-between border border-b-0 border-[#4f78c4] bg-[#0d327f] px-3 py-1.5">
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-white">
              Sale Range Spreadsheet
            </h2>
            <span className="font-mono text-[10px] uppercase text-[#bad3ff]">
              Active memo {memoId ?? '—'}
            </span>
          </div>
          <SaleRangeTable
            rows={rows}
            onChange={setRows}
            items={items}
            defaultRate={defaultRate}
            variant="blueSpreadsheet"
          />
        </section>

        <div className="shrink-0 border-t border-[#6d98e4] bg-[#08266f]">
          <div className="grid h-9 grid-cols-[1fr_220px_220px] items-center border-b border-[#416db9] px-4 text-xs">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#bcd5ff]">
              Ready · Enter on Amount adds row · F5 deletes current row
            </p>
            <p className="border-l border-[#416db9] px-4 text-right font-bold uppercase">
              Total Qty <span className="ml-3 font-mono text-[#ffe16a]">{totalQty}</span>
            </p>
            <p className="border-l border-[#416db9] px-4 text-right font-bold uppercase">
              Net Amount{' '}
              <span className="ml-3 font-mono text-[#ffe16a]">{totalAmount.toFixed(2)}</span>
            </p>
          </div>
          <div className="flex h-12 items-center justify-between bg-[#0e3b99] px-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#bed5ff]">
              {rows.length} worksheet row{rows.length === 1 ? '' : 's'}
            </p>
            <button
              type="submit"
              disabled={saving || companyId == null}
              className="min-w-36 border-2 border-[#ffdf63] bg-[#f1b900] px-6 py-2 text-xs font-extrabold uppercase tracking-wide text-[#10275e] shadow-[0_2px_0_#745600] hover:bg-[#ffd447] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving…' : saveLabel}
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-cyber-hover">Sales workflow</p>
        <h1 className="font-display text-2xl font-bold text-content">{title}</h1>
        <p className="mt-1 text-sm text-content-subtle">Enter buyer, draw, lottery, and ticket range details.</p>
      </div>

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
            {todayOpenDraws.map((draw) => (
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
