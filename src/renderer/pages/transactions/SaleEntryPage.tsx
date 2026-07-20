import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LegacyTransactionShell from '../../components/transactions/LegacyTransactionShell';
import SaleRangeTable, {
  emptySaleRangeRow,
  saleRangesToTicketData,
  totalSaleRangeAmount,
  totalSaleRangeQty,
  validateSaleRangeRows,
  type SaleRangeRow,
} from '../../components/transactions/SaleRangeTable';
import { useToast } from '../../components/Toast';
import { Button, Input, PageHeader } from '../../components/ui';
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

const LEGACY_TYPES = new Set<SaleEntryOptions['type']>(['sale', 'sale_return']);

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
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const useLegacyShell = LEGACY_TYPES.has(type);
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
  const selectedBuyer = buyers.find((buyer) => buyer.id === buyerId) ?? null;
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
    if (!useLegacyShell) return;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [useLegacyShell]);

  const deleteActiveRow = useCallback(() => {
    if (rows.length <= 1) {
      setRows([emptySaleRangeRow(defaultRate)]);
      setActiveRowIndex(0);
      return;
    }
    const next = rows.filter((_, index) => index !== activeRowIndex);
    setRows(next);
    setActiveRowIndex(Math.max(0, activeRowIndex - 1));
  }, [activeRowIndex, defaultRate, rows]);

  const clearWorksheet = useCallback(() => {
    setRows([emptySaleRangeRow(defaultRate)]);
    setActiveRowIndex(0);
  }, [defaultRate]);

  useEffect(() => {
    if (!useLegacyShell) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
      if (event.key === 'F3') {
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
        event.preventDefault();
        navigate(-1);
      }
      if (event.key === 'F10' || event.key === 'F12') {
        event.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [useLegacyShell, type, deleteActiveRow, clearWorksheet, navigate]);

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

  if (useLegacyShell) {
    const totalQty = totalSaleRangeQty(rows);
    const totalAmount = totalSaleRangeAmount(rows);
    const isReturn = type === 'sale_return';

    return (
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
                'F3 Delete Row',
                'F5 Delete Row',
                'F6 Make Sale',
                'F7 Search',
                'F8 Clear',
                'Esc Exit',
                'F10 Print',
              ]
            : undefined
        }
        extraActions={
          isReturn
            ? [{ label: 'Make Sale (F6)', onClick: () => navigate('/transactions/sale-entry') }]
            : []
        }
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
        />
      </LegacyTransactionShell>
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
