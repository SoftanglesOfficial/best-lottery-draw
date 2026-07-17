import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FullPageLoading } from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';
import { Button, Input } from '../components/ui';
import { useActiveCompany } from '../lib/useActiveCompany';
import { useRoleGuard } from '../lib/useRoleGuard';
import { api } from '../lib/api';
import type { ItemRecord, ItemSchemePrizeInput } from '../../shared/types';

type PrizeRow = ItemSchemePrizeInput;

function defaultPrizes(): PrizeRow[] {
  return Array.from({ length: 5 }, (_, index) => ({
    prizeRank: index + 1,
    checkPrefix: null,
    checkSeries: null,
    prizeNoLength: null,
    noOfResult: null,
    prizeAmount: null,
    bonusReceivable: null,
    bonusPayable: null,
    incentiveReceivable: null,
    incentivePayable: null,
  }));
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function mapDbPrize(prize: ItemSchemePrizeInput): PrizeRow {
  return {
    prizeRank: Number(prize.prizeRank),
    checkPrefix: prize.checkPrefix ?? null,
    checkSeries: prize.checkSeries ?? null,
    prizeNoLength: toNumber(prize.prizeNoLength),
    noOfResult: toNumber(prize.noOfResult),
    prizeAmount: toNumber(prize.prizeAmount),
    bonusReceivable: toNumber(prize.bonusReceivable),
    bonusPayable: toNumber(prize.bonusPayable),
    incentiveReceivable: toNumber(prize.incentiveReceivable),
    incentivePayable: toNumber(prize.incentivePayable),
  };
}

function formatDateInput(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ItemSchemePage() {
  const allowed = useRoleGuard(['admin', 'owner', 'manager']);
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const schemeId = searchParams.get('id');
  const itemIdParam = searchParams.get('itemId');
  const editingId = schemeId ? Number(schemeId) : null;

  const [items, setItems] = useState<ItemRecord[]>([]);
  const [itemId, setItemId] = useState<number | null>(null);
  const [schemeDate, setSchemeDate] = useState('');
  const [drawNo, setDrawNo] = useState('');
  const [prizes, setPrizes] = useState<PrizeRow[]>(defaultPrizes());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async () => {
    if (companyId == null) {
      setItems([]);
      return;
    }
    try {
      const result = await api.itemsList(companyId);
      if (result.success) setItems(result.items);
      else showToast(result.error, 'error');
    } catch {
      showToast('Failed to load items.', 'error');
    }
  }, [companyId, showToast]);

  const loadScheme = useCallback(async () => {
    if (!editingId) {
      setPrizes(defaultPrizes());
      setSchemeDate('');
      setDrawNo('');
      setItemId(itemIdParam ? Number(itemIdParam) : null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await api.itemSchemesGet(editingId);
      if (result.success) {
        const scheme = result.scheme;
        if (scheme.companyId !== companyId) {
          showToast('Scheme not found in active company.', 'error');
          navigate('/master/item-schemes-list');
          return;
        }
        setItemId(scheme.itemId);
        setSchemeDate(formatDateInput(scheme.schemeDate));
        setDrawNo(scheme.drawNo ?? '');
        setPrizes(
          scheme.prizes.length > 0 ? scheme.prizes.map(mapDbPrize) : defaultPrizes(),
        );
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to load scheme.', 'error');
    } finally {
      setLoading(false);
    }
  }, [editingId, itemIdParam, showToast, companyId, navigate]);

  useEffect(() => {
    if (allowed && companyId != null) void loadItems();
  }, [allowed, companyId, loadItems]);

  useEffect(() => {
    if (allowed) void loadScheme();
  }, [allowed, loadScheme]);

  const updatePrize = (index: number, field: keyof PrizeRow, value: string) => {
    setPrizes((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        if (
          field === 'checkPrefix' ||
          field === 'checkSeries'
        ) {
          return { ...row, [field]: value || null };
        }
        return {
          ...row,
          [field]: value === '' ? null : Number(value),
        };
      }),
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (companyId == null || itemId == null) {
      showToast('Select an item.', 'error');
      return;
    }
    if (!schemeDate) {
      showToast('Scheme date is required.', 'error');
      return;
    }
    const hasPrizeData = prizes.some(
      (prize) =>
        prize.prizeAmount != null ||
        prize.noOfResult != null ||
        prize.prizeNoLength != null ||
        prize.checkPrefix ||
        prize.checkSeries,
    );
    if (!hasPrizeData) {
      showToast('Add at least one prize row with data.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        itemId,
        schemeDate,
        drawNo: drawNo.trim() || null,
        companyId,
        prizes,
      };
      const result = editingId
        ? await api.itemSchemesUpdate(editingId, payload)
        : await api.itemSchemesCreate(payload);
      if (result.success) {
        showToast(editingId ? 'Scheme updated' : 'Scheme created');
        navigate('/master/item-schemes-list');
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to save scheme.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) return null;

  if (companyId == null) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-content">
          {editingId ? 'Edit Item Scheme' : 'New Item Scheme'}
        </h1>
        <div className="rounded-cyber-lg border border-dashed border-line-strong bg-surface-low px-6 py-12 text-center text-sm text-content-subtle">
          Select an active company to manage item schemes.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-content">
          {editingId ? 'Edit Item Scheme' : 'New Item Scheme'}
        </h1>
        <Button type="button" variant="secondary" onClick={() => navigate('/master/item-schemes-list')}>
          Back to List
        </Button>
      </div>

      {loading ? (
        <FullPageLoading message="Loading item scheme…" />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="grid grid-cols-1 gap-4 rounded-cyber-lg border border-line bg-surface-raised p-4 sm:grid-cols-2 lg:max-w-3xl">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Item</span>
              <select
                className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                value={itemId ?? ''}
                onChange={(e) => setItemId(e.target.value ? Number(e.target.value) : null)}
                required
              >
                <option value="">Select item</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Scheme Date"
              type="date"
              value={schemeDate}
              onChange={(e) => setSchemeDate(e.target.value)}
              required
            />
            <Input
              label="Draw No"
              value={drawNo}
              onChange={(e) => setDrawNo(e.target.value)}
            />
          </section>

          <section className="max-w-full overflow-x-auto rounded-cyber-lg border border-line bg-surface-raised">
            <table className="min-w-[1120px] divide-y divide-line text-sm">
              <thead className="border-b border-line bg-surface-high">
                <tr>
                  {['Rank', 'Prefix', 'Series', 'No Length', 'Results', '₹ Prize', '₹ Bonus Recv', '₹ Bonus Pay', '₹ Incent Recv', '₹ Incent Pay'].map((heading) => (
                    <th key={heading} className="whitespace-nowrap px-3 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {prizes.map((prize, index) => (
                  <tr key={prize.prizeRank} className={index % 2 === 0 ? 'bg-surface-raised' : 'bg-surface-low'}>
                    <td className="px-3 py-2 font-mono font-medium text-cyber-hover">{prize.prizeRank}</td>
                    <td className="px-3 py-2">
                      <input
                        aria-label={`Prefix for prize ${prize.prizeRank}`}
                        className="w-full rounded-cyber border border-line-control bg-canvas px-2 py-1.5 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                        value={prize.checkPrefix ?? ''}
                        onChange={(e) => updatePrize(index, 'checkPrefix', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        aria-label={`Series for prize ${prize.prizeRank}`}
                        className="w-full rounded-cyber border border-line-control bg-canvas px-2 py-1.5 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                        value={prize.checkSeries ?? ''}
                        onChange={(e) => updatePrize(index, 'checkSeries', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        aria-label={`Number length for prize ${prize.prizeRank}`}
                        className="w-full rounded-cyber border border-line-control bg-canvas px-2 py-1.5 text-left text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                        value={prize.prizeNoLength ?? ''}
                        onChange={(e) => updatePrize(index, 'prizeNoLength', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        aria-label={`Results for prize ${prize.prizeRank}`}
                        className="w-full rounded-cyber border border-line-control bg-canvas px-2 py-1.5 text-left text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                        value={prize.noOfResult ?? ''}
                        onChange={(e) => updatePrize(index, 'noOfResult', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        aria-label={`Prize amount for prize ${prize.prizeRank}`}
                        className="w-full rounded-cyber border border-line-control bg-canvas px-2 py-1.5 text-left text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                        value={prize.prizeAmount ?? ''}
                        onChange={(e) => updatePrize(index, 'prizeAmount', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        aria-label={`Bonus receivable for prize ${prize.prizeRank}`}
                        className="w-full rounded-cyber border border-line-control bg-canvas px-2 py-1.5 text-left text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                        value={prize.bonusReceivable ?? ''}
                        onChange={(e) => updatePrize(index, 'bonusReceivable', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        aria-label={`Bonus payable for prize ${prize.prizeRank}`}
                        className="w-full rounded-cyber border border-line-control bg-canvas px-2 py-1.5 text-left text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                        value={prize.bonusPayable ?? ''}
                        onChange={(e) => updatePrize(index, 'bonusPayable', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        aria-label={`Incentive receivable for prize ${prize.prizeRank}`}
                        className="w-full rounded-cyber border border-line-control bg-canvas px-2 py-1.5 text-left text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                        value={prize.incentiveReceivable ?? ''}
                        onChange={(e) => updatePrize(index, 'incentiveReceivable', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        aria-label={`Incentive payable for prize ${prize.prizeRank}`}
                        className="w-full rounded-cyber border border-line-control bg-canvas px-2 py-1.5 text-left text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                        value={prize.incentivePayable ?? ''}
                        onChange={(e) => updatePrize(index, 'incentivePayable', e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="flex justify-end border-t border-line pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update Scheme' : 'Save Scheme'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
