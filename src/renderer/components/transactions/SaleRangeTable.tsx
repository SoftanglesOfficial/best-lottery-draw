import { useEffect, useRef, useState } from 'react';
import { rangeCount } from '../../lib/transactionDisplay';
import { isAtLeastRole } from '../../lib/roles';
import { useAuth } from '../../lib/auth';
import { padTicketDigits, sanitizeTicketInput } from '../../lib/ticketAutoComplete';
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
  const from = padTicketDigits(row.from);
  const to = padTicketDigits(row.to);
  if (!from || !to) return 0;
  return rangeCount(from, to);
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
    .filter((row) => row.itemId != null && rowQty(row) > 0)
    .map((row) => {
      const from = padTicketDigits(row.from);
      const to = padTicketDigits(row.to);
      const qty = rangeCount(from, to);
      const rate = Number(row.rate) || 0;
      return {
        itemId: row.itemId,
        code: row.code,
        from,
        to,
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
    const from = padTicketDigits(row.from);
    const to = padTicketDigits(row.to);
    if (!from || !to) {
      return `Row ${rowNo}: From and To are required.`;
    }
    const rate = Number(row.rate);
    if (Number.isNaN(rate) || rate <= 0) {
      return `Row ${rowNo}: Rate must be greater than zero.`;
    }
    if (rangeCount(from, to) <= 0) {
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
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const { user } = useAuth();
  const canEditRate = user ? isAtLeastRole(user.role, 'manager') : false;
  const blueSpreadsheet = variant === 'blueSpreadsheet';
  const blueField =
    'h-7 w-full border border-[#315aa8] bg-[#f7fbff] px-1.5 font-mono text-xs text-[#071b4d] outline-none focus:border-[#ffd447] focus:ring-1 focus:ring-[#ffd447]';
  const setActiveRow = (index: number) => {
    setActiveRowIndex(index);
    onActiveRowChange?.(index);
  };

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
      setActiveRow(0);
      return;
    }
    const next = rows.filter((_, i) => i !== index);
    onChange(next);
    const focusIndex = Math.max(0, index - 1);
    setActiveRow(focusIndex);
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

  useEffect(() => {
    setActiveRowIndex((current) => Math.min(current, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  return (
    <div className={blueSpreadsheet ? 'flex h-full min-h-0 flex-col' : undefined}>
      <div className={blueSpreadsheet ? 'min-h-0 flex-1 overflow-auto border border-[#3f68ba] bg-[#071b5d]' : 'max-w-full overflow-x-auto rounded-cyber border border-line'}>
      <table className={blueSpreadsheet ? 'w-full min-w-[980px] table-fixed border-collapse text-xs' : 'min-w-[980px] w-full text-sm'}>
        <thead className={blueSpreadsheet ? 'sticky top-0 z-10 bg-white' : 'bg-surface-high'}>
          <tr className={blueSpreadsheet ? 'border-b-2 border-[#071b4d] text-left text-[#071b4d]' : 'border-b border-line text-left'}>
            <th className={blueSpreadsheet ? 'w-10 border-r border-[#071b4d] px-1 py-1 text-center text-[10px] font-bold uppercase' : 'w-12 px-2 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>Sr</th>
            <th className={blueSpreadsheet ? 'w-[22%] border-r border-[#071b4d] px-1 py-1 text-[10px] font-bold uppercase' : 'min-w-[140px] px-2 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>Item</th>
            <th className={blueSpreadsheet ? 'w-14 border-r border-[#071b4d] px-1 py-1 text-[10px] font-bold uppercase' : 'w-20 px-2 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>Code</th>
            <th className={blueSpreadsheet ? 'w-[11%] border-r border-[#071b4d] px-1 py-1 text-[10px] font-bold uppercase' : 'w-24 px-2 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>From</th>
            <th className={blueSpreadsheet ? 'w-[11%] border-r border-[#071b4d] px-1 py-1 text-[10px] font-bold uppercase' : 'w-24 px-2 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>To</th>
            <th className={blueSpreadsheet ? 'w-12 border-r border-[#071b4d] px-1 py-1 text-right text-[10px] font-bold uppercase' : 'w-16 px-2 py-2 text-right font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>Qty</th>
            <th className={blueSpreadsheet ? 'w-14 border-r border-[#071b4d] px-1 py-1 text-right text-[10px] font-bold uppercase' : 'w-20 px-2 py-2 text-right font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>Rate</th>
            <th className={blueSpreadsheet ? 'w-[11%] border-r border-[#071b4d] px-1 py-1 text-right text-[10px] font-bold uppercase' : 'w-24 px-2 py-2 text-right font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>Amt (auto)</th>
            <th className={blueSpreadsheet ? 'w-12 px-1 py-1 text-center text-[10px] font-bold uppercase' : 'w-20 px-2 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>Del</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, index) => {
            const qty = rowQty(row);
            const amount = rowAmount(row);
            const isActive = blueSpreadsheet && activeRowIndex === index;
            const rowBg = blueSpreadsheet
              ? isActive
                ? 'bg-[#e85d04] text-white'
                : index % 2 === 0
                  ? 'bg-[#dceaff] text-[#071b4d]'
                  : 'bg-[#c9dcfb] text-[#071b4d]'
              : '';
            const activeField = isActive
              ? 'h-7 w-full border border-[#ffd447] bg-white px-1.5 font-mono text-xs text-[#071b4d] outline-none focus:border-[#ffd447] focus:ring-1 focus:ring-[#ffd447]'
              : blueField;
            return (
              <tr key={index} className={blueSpreadsheet ? `${rowBg} border-b border-[#83a5da]` : 'bg-surface-raised hover:bg-surface-high'}>
                <td className={blueSpreadsheet ? 'border-r border-[#9bb7e1] px-2 py-1 text-center font-mono font-bold' : 'px-2 py-2 font-mono text-content-subtle'}>{index + 1}</td>
                <td className={blueSpreadsheet ? 'border-r border-[#9bb7e1] px-1.5 py-1' : 'px-2 py-2'}>
                  <select
                    value={row.itemId ?? ''}
                    onChange={(event) =>
                      handleItemChange(index, Number(event.target.value) || null)
                    }
                    onFocus={() => setActiveRow(index)}
                    className={blueSpreadsheet ? activeField : 'w-full rounded-cyber border border-line-control bg-canvas px-2 py-1 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20'}
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
                    onFocus={() => setActiveRow(index)}
                    className={blueSpreadsheet ? activeField : 'w-full rounded-cyber border border-line-control bg-canvas px-2 py-1 font-mono text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20'}
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
                        from: sanitizeTicketInput(event.target.value),
                      })
                    }
                    onBlur={() => {
                      const padded = padTicketDigits(row.from);
                      if (!padded) return;
                      // ponytail: single-ticket entry — copy From→To so qty/amount appear
                      const patch: Partial<SaleRangeRow> = {};
                      if (padded !== row.from) patch.from = padded;
                      if (!row.to) patch.to = padded;
                      if (Object.keys(patch).length > 0) updateRow(index, patch);
                    }}
                    onFocus={() => setActiveRow(index)}
                    className={blueSpreadsheet ? activeField : 'w-full rounded-cyber border border-line-control bg-canvas px-2 py-1 font-mono text-left text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20'}
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
                        to: sanitizeTicketInput(event.target.value),
                      })
                    }
                    onBlur={() => {
                      const padded = padTicketDigits(row.to);
                      if (padded && padded !== row.to) updateRow(index, { to: padded });
                    }}
                    onFocus={() => setActiveRow(index)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        const paddedTo = padTicketDigits(row.to) || padTicketDigits(row.from);
                        if (paddedTo && paddedTo !== row.to) {
                          updateRow(index, { to: paddedTo });
                        }
                        addRow(index);
                      }
                      if (event.key === 'F5') {
                        event.preventDefault();
                        removeRow(index);
                      }
                    }}
                    className={blueSpreadsheet ? activeField : 'w-full rounded-cyber border border-line-control bg-canvas px-2 py-1 font-mono text-left text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20'}
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
                    onFocus={() => setActiveRow(index)}
                    readOnly={!canEditRate}
                    className={
                      blueSpreadsheet
                        ? `${activeField} ${!canEditRate ? 'bg-[#b8cbed] text-[#33517f]' : ''}`
                        : `w-full rounded-cyber border border-line-control px-2 py-1 font-mono text-left text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20 ${!canEditRate ? 'bg-surface-high text-content-subtle' : 'bg-canvas'}`
                    }
                    inputMode="decimal"
                    aria-label={`Row ${index + 1} rate`}
                  />
                </td>
                <td className={blueSpreadsheet ? 'border-r border-[#9bb7e1] px-1.5 py-1' : 'px-2 py-2'}>
                  <input
                    ref={(el) => {
                      inputRefs.current[index * 4 + 3] = el;
                    }}
                    value={amount > 0 ? amount.toFixed(2) : '—'}
                    readOnly
                    tabIndex={0}
                    onFocus={() => setActiveRow(index)}
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
                    // ponytail: amount is always qty×rate — never typed; "—" when From/To empty
                    className={
                      blueSpreadsheet
                        ? `h-7 w-full cursor-default border border-[#315aa8] px-1.5 font-mono text-xs font-bold outline-none focus:border-[#ffd447] focus:ring-1 focus:ring-[#ffd447] ${
                            isActive ? 'border-[#ffd447] bg-[#c2410c]/20 text-white' : 'bg-[#8eaddc] text-[#071b4d]'
                          }`
                        : 'w-full cursor-default rounded-cyber border border-line bg-surface-high px-2 py-1 font-mono text-left text-content-muted outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20'
                    }
                    aria-readonly="true"
                    aria-label={`Row ${index + 1} amount (qty × rate)`}
                    title={
                      amount > 0
                        ? 'Amount = Qty × Rate'
                        : 'Fill From and To — amount calculates automatically'
                    }
                  />
                </td>
                <td className={blueSpreadsheet ? 'px-1.5 py-1 text-center' : 'px-2 py-2'}>
                  <button
                    type="button"
                    className={blueSpreadsheet ? 'cursor-pointer px-1 py-0.5 text-[10px] font-bold uppercase text-[#9e1d32] hover:text-[#c93149] focus:outline-none focus:ring-1 focus:ring-[#ffd447]' : 'rounded-cyber px-1.5 py-1 text-cyber-error hover:bg-cyber-error/10 focus:outline-none focus:ring-2 focus:ring-cyber-error/30'}
                    onClick={() => removeRow(index)}
                  >
                    ×
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
      {!blueSpreadsheet ? (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.05em] text-content-subtle">
          Enter on Amount adds a new row · F5 deletes the current row
        </p>
      ) : null}
    </div>
  );
}
