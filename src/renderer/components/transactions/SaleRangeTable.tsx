import { useEffect, useRef } from 'react';
import { rangeCount } from '../../lib/transactionDisplay';
import { isAtLeastRole } from '../../lib/roles';
import { useAuth } from '../../lib/auth';
import type { ItemRecord } from '../../../shared/types';

export type SaleRangeRow = {
  itemId: number | null;
  code: string;
  from: string;
  to: string;
  rate: string;
};

type SaleRangeTableProps = {
  rows: SaleRangeRow[];
  onChange: (rows: SaleRangeRow[]) => void;
  items: ItemRecord[];
  defaultRate: string;
  onActiveRowChange?: (index: number) => void;
  variant?: 'default' | 'blueSpreadsheet';
};

function rowQty(row: SaleRangeRow) {
  if (row.from.length !== 5 || row.to.length !== 5) return 0;
  return rangeCount(row.from, row.to);
}

function rowAmount(row: SaleRangeRow) {
  const qty = rowQty(row);
  const rate = Number(row.rate);
  if (qty <= 0 || Number.isNaN(rate)) return 0;
  return qty * rate;
}

export function emptySaleRangeRow(defaultRate = ''): SaleRangeRow {
  return { itemId: null, code: '', from: '', to: '', rate: defaultRate };
}

export function saleRangesToTicketData(rows: SaleRangeRow[]) {
  const ranges = rows
    .filter((row) => row.itemId != null && row.from.length === 5 && row.to.length === 5 && rowQty(row) > 0)
    .map((row) => {
      const qty = rowQty(row);
      const rate = Number(row.rate) || 0;
      return {
        itemId: row.itemId,
        code: row.code,
        from: row.from.padStart(5, '0'),
        to: row.to.padStart(5, '0'),
        qty,
        rate,
        amount: qty * rate,
      };
    });
  return JSON.stringify({ ranges });
}

export function totalSaleRangeQty(rows: SaleRangeRow[]) {
  return rows.reduce((sum, row) => sum + rowQty(row), 0);
}

export function totalSaleRangeAmount(rows: SaleRangeRow[]) {
  return rows.reduce((sum, row) => sum + rowAmount(row), 0);
}

export function validateSaleRangeRows(rows: SaleRangeRow[]): string | null {
  const validRows = rows.filter((row) => row.from || row.to || row.itemId != null);
  if (validRows.length === 0) {
    return 'Add at least one ticket range.';
  }

  for (let index = 0; index < validRows.length; index += 1) {
    const row = validRows[index];
    const rowNo = index + 1;
    if (row.itemId == null) {
      return `Row ${rowNo}: select a lottery type.`;
    }
    if (row.from.length !== 5 || row.to.length !== 5) {
      return `Row ${rowNo}: From and To must be 5 digits.`;
    }
    const rate = Number(row.rate);
    if (Number.isNaN(rate) || rate <= 0) {
      return `Row ${rowNo}: Rate must be greater than zero.`;
    }
    if (rowQty(row) <= 0) {
      return `Row ${rowNo}: To must be greater than or equal to From.`;
    }
  }

  if (totalSaleRangeQty(validRows) <= 0) {
    return 'Add at least one valid ticket range.';
  }

  return null;
}

export default function SaleRangeTable({
  rows,
  onChange,
  items,
  defaultRate,
  onActiveRowChange,
  variant = 'default',
}: SaleRangeTableProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const { user } = useAuth();
  const canEditRate = user ? isAtLeastRole(user.role, 'manager') : false;
  const blueSpreadsheet = variant === 'blueSpreadsheet';
  const blueField =
    'h-7 w-full border border-[#315aa8] bg-[#f7fbff] px-2 font-mono text-xs text-[#071b4d] outline-none focus:border-[#ffd447] focus:ring-1 focus:ring-[#ffd447]';

  const updateRow = (index: number, patch: Partial<SaleRangeRow>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const addRow = (afterIndex: number) => {
    const next = [...rows];
    next.splice(afterIndex + 1, 0, emptySaleRangeRow(defaultRate));
    onChange(next);
    setTimeout(() => inputRefs.current[(afterIndex + 1) * 4]?.focus(), 0);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) {
      onChange([emptySaleRangeRow(defaultRate)]);
      return;
    }
    const next = rows.filter((_, i) => i !== index);
    onChange(next);
    const focusIndex = Math.max(0, index - 1);
    setTimeout(() => inputRefs.current[focusIndex * 4]?.focus(), 0);
  };

  const handleItemChange = (index: number, itemId: number | null) => {
    const item = items.find((entry) => entry.id === itemId);
    updateRow(index, {
      itemId,
      code: item?.code ?? '',
    });
  };

  const totalQty = totalSaleRangeQty(rows);
  const totalAmount = totalSaleRangeAmount(rows);

  useEffect(() => {
    if (rows.length === 0) onChange([emptySaleRangeRow(defaultRate)]);
  }, [rows.length, onChange, defaultRate]);

  return (
    <div className={blueSpreadsheet ? 'flex h-full min-h-0 flex-col' : undefined}>
      <div className={blueSpreadsheet ? 'min-h-0 flex-1 overflow-auto border border-[#3f68ba] bg-[#071b5d]' : 'max-w-full overflow-x-auto rounded-cyber border border-line'}>
      <table className={blueSpreadsheet ? 'w-full min-w-[980px] border-collapse text-xs' : 'min-w-[980px] w-full text-sm'}>
        <thead className={blueSpreadsheet ? 'sticky top-0 z-10 bg-[#1748ad]' : 'bg-surface-high'}>
          <tr className={blueSpreadsheet ? 'border-b border-[#78a4ec] text-left text-white' : 'border-b border-line text-left'}>
            <th className={blueSpreadsheet ? 'w-12 border-r border-[#4f78c4] px-2 py-1.5 text-center font-semibold uppercase' : 'w-12 px-2 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>Sr No</th>
            <th className={blueSpreadsheet ? 'min-w-[180px] border-r border-[#4f78c4] px-2 py-1.5 font-semibold uppercase' : 'min-w-[140px] px-2 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>Lottery Type</th>
            <th className={blueSpreadsheet ? 'w-24 border-r border-[#4f78c4] px-2 py-1.5 font-semibold uppercase' : 'w-20 px-2 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>Code</th>
            <th className={blueSpreadsheet ? 'w-28 border-r border-[#4f78c4] px-2 py-1.5 font-semibold uppercase' : 'w-24 px-2 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>From</th>
            <th className={blueSpreadsheet ? 'w-28 border-r border-[#4f78c4] px-2 py-1.5 font-semibold uppercase' : 'w-24 px-2 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>To</th>
            <th className={blueSpreadsheet ? 'w-20 border-r border-[#4f78c4] px-2 py-1.5 text-right font-semibold uppercase' : 'w-16 px-2 py-2 text-right font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>Qty</th>
            <th className={blueSpreadsheet ? 'w-24 border-r border-[#4f78c4] px-2 py-1.5 text-right font-semibold uppercase' : 'w-20 px-2 py-2 text-right font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>Rate</th>
            <th className={blueSpreadsheet ? 'w-28 border-r border-[#4f78c4] px-2 py-1.5 text-right font-semibold uppercase' : 'w-24 px-2 py-2 text-right font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>Amount</th>
            <th className={blueSpreadsheet ? 'w-20 px-2 py-1.5 text-center font-semibold uppercase' : 'w-20 px-2 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, index) => {
            const qty = rowQty(row);
            const amount = rowAmount(row);
            return (
              <tr key={index} className={blueSpreadsheet ? `${index % 2 === 0 ? 'bg-[#dceaff]' : 'bg-[#c9dcfb]'} border-b border-[#83a5da] text-[#071b4d]` : 'bg-surface-raised hover:bg-surface-high'}>
                <td className={blueSpreadsheet ? 'border-r border-[#9bb7e1] px-2 py-1 text-center font-mono font-bold' : 'px-2 py-2 font-mono text-content-subtle'}>{index + 1}</td>
                <td className={blueSpreadsheet ? 'border-r border-[#9bb7e1] px-1.5 py-1' : 'px-2 py-2'}>
                  <select
                    value={row.itemId ?? ''}
                    onChange={(event) =>
                      handleItemChange(index, Number(event.target.value) || null)
                    }
                    onFocus={() => onActiveRowChange?.(index)}
                    className={blueSpreadsheet ? blueField : 'w-full rounded-cyber border border-line-control bg-canvas px-2 py-1 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20'}
                    aria-label={`Row ${index + 1} lottery type`}
                  >
                    <option value="">Select item</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={blueSpreadsheet ? 'border-r border-[#9bb7e1] px-1.5 py-1' : 'px-2 py-2'}>
                  <input
                    value={row.code}
                    onChange={(event) => updateRow(index, { code: event.target.value })}
                    onFocus={() => onActiveRowChange?.(index)}
                    className={blueSpreadsheet ? blueField : 'w-full rounded-cyber border border-line-control bg-canvas px-2 py-1 font-mono text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20'}
                    aria-label={`Row ${index + 1} item code`}
                  />
                </td>
                <td className={blueSpreadsheet ? 'border-r border-[#9bb7e1] px-1.5 py-1' : 'px-2 py-2'}>
                  <input
                    ref={(el) => {
                      inputRefs.current[index * 4] = el;
                    }}
                    value={row.from}
                    onChange={(event) =>
                      updateRow(index, {
                        from: event.target.value.replace(/\D/g, '').slice(0, 5),
                      })
                    }
                    onFocus={() => onActiveRowChange?.(index)}
                    className={blueSpreadsheet ? blueField : 'w-full rounded-cyber border border-line-control bg-canvas px-2 py-1 font-mono text-left text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20'}
                    inputMode="numeric"
                    aria-label={`Row ${index + 1} from ticket`}
                  />
                </td>
                <td className={blueSpreadsheet ? 'border-r border-[#9bb7e1] px-1.5 py-1' : 'px-2 py-2'}>
                  <input
                    ref={(el) => {
                      inputRefs.current[index * 4 + 1] = el;
                    }}
                    value={row.to}
                    onChange={(event) =>
                      updateRow(index, {
                        to: event.target.value.replace(/\D/g, '').slice(0, 5),
                      })
                    }
                    onFocus={() => onActiveRowChange?.(index)}
                    className={blueSpreadsheet ? blueField : 'w-full rounded-cyber border border-line-control bg-canvas px-2 py-1 font-mono text-left text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20'}
                    inputMode="numeric"
                    aria-label={`Row ${index + 1} to ticket`}
                  />
                </td>
                <td className={blueSpreadsheet ? 'border-r border-[#9bb7e1] px-2 py-1 text-right font-mono font-bold tabular-nums' : 'px-2 py-2 text-right font-mono tabular-nums text-content'}>{qty || '—'}</td>
                <td className={blueSpreadsheet ? 'border-r border-[#9bb7e1] px-1.5 py-1' : 'px-2 py-2'}>
                  <input
                    ref={(el) => {
                      inputRefs.current[index * 4 + 2] = el;
                    }}
                    value={row.rate}
                    onChange={(event) =>
                      updateRow(index, {
                        rate: event.target.value.replace(/[^\d.]/g, ''),
                      })
                    }
                    onFocus={() => onActiveRowChange?.(index)}
                    readOnly={!canEditRate}
                    className={blueSpreadsheet ? `${blueField} ${!canEditRate ? 'bg-[#b8cbed] text-[#33517f]' : ''}` : `w-full rounded-cyber border border-line-control px-2 py-1 font-mono text-left text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20 ${!canEditRate ? 'bg-surface-high text-content-subtle' : 'bg-canvas'}`}
                    inputMode="decimal"
                    aria-label={`Row ${index + 1} rate`}
                  />
                </td>
                <td className={blueSpreadsheet ? 'border-r border-[#9bb7e1] px-1.5 py-1' : 'px-2 py-2'}>
                  <input
                    ref={(el) => {
                      inputRefs.current[index * 4 + 3] = el;
                    }}
                    value={amount ? amount.toFixed(2) : ''}
                    readOnly
                    tabIndex={0}
                    onFocus={() => onActiveRowChange?.(index)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addRow(index);
                      }
                      if (event.key === 'F5') {
                        event.preventDefault();
                        removeRow(index);
                      }
                    }}
                    className={blueSpreadsheet ? `${blueField} bg-[#aec7ef] font-bold` : 'w-full rounded-cyber border border-line bg-surface-high px-2 py-1 font-mono text-left text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20'}
                    aria-label={`Row ${index + 1} amount`}
                  />
                </td>
                <td className={blueSpreadsheet ? 'px-1.5 py-1 text-center' : 'px-2 py-2'}>
                  <button
                    type="button"
                    className={blueSpreadsheet ? 'border border-[#9e1d32] bg-[#c93149] px-2 py-1 text-[10px] font-bold uppercase text-white hover:bg-[#a91f35] focus:outline-none focus:ring-2 focus:ring-[#ffd447]' : 'rounded-cyber px-1.5 py-1 text-cyber-error hover:bg-cyber-error/10 focus:outline-none focus:ring-2 focus:ring-cyber-error/30'}
                    onClick={() => removeRow(index)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className={blueSpreadsheet ? 'border-t-2 border-[#8db3f2] bg-[#123d99] font-bold text-white' : 'border-t border-line bg-surface-high font-medium'}>
            <td colSpan={5} className={blueSpreadsheet ? 'px-2 py-2 text-right text-xs uppercase tracking-wide' : 'px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.05em] text-content-muted'}>
              Totals
            </td>
            <td className={blueSpreadsheet ? 'px-2 py-2 text-right font-mono tabular-nums text-[#ffe16a]' : 'px-2 py-2 text-right font-mono tabular-nums text-cyber-hover'}>{totalQty}</td>
            <td className="px-2 py-2" />
            <td className={blueSpreadsheet ? 'px-2 py-2 text-right font-mono tabular-nums text-[#ffe16a]' : 'px-2 py-2 text-right font-mono tabular-nums text-cyber-hover'}>
              {totalAmount > 0 ? totalAmount.toFixed(2) : '—'}
            </td>
            <td className="px-2 py-2" />
          </tr>
        </tfoot>
      </table>
      </div>
      <p className={blueSpreadsheet ? 'bg-[#0b2d7d] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#bcd5ff]' : 'mt-2 font-mono text-[10px] uppercase tracking-[0.05em] text-content-subtle'}>Enter on Amount adds a new row · F5 deletes the current row</p>
    </div>
  );
}
