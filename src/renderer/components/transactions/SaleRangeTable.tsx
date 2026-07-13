import { useEffect, useRef } from 'react';
import { rangeCount } from '../../lib/transactionDisplay';
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
}: SaleRangeTableProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

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
    <div>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
            <th className="w-12 px-2 py-2">Sr No</th>
            <th className="min-w-[140px] px-2 py-2">Lottery Type</th>
            <th className="w-20 px-2 py-2">Code</th>
            <th className="w-24 px-2 py-2">From</th>
            <th className="w-24 px-2 py-2">To</th>
            <th className="w-16 px-2 py-2 text-right">Qty</th>
            <th className="w-20 px-2 py-2 text-right">Rate</th>
            <th className="w-24 px-2 py-2 text-right">Amount</th>
            <th className="w-20 px-2 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const qty = rowQty(row);
            const amount = rowAmount(row);
            return (
              <tr key={index} className="border-b">
                <td className="px-2 py-2">{index + 1}</td>
                <td className="px-2 py-2">
                  <select
                    value={row.itemId ?? ''}
                    onChange={(event) =>
                      handleItemChange(index, Number(event.target.value) || null)
                    }
                    onFocus={() => onActiveRowChange?.(index)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  >
                    <option value="">Select item</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <input
                    value={row.code}
                    onChange={(event) => updateRow(index, { code: event.target.value })}
                    onFocus={() => onActiveRowChange?.(index)}
                    className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-sm"
                  />
                </td>
                <td className="px-2 py-2">
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
                    className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-left"
                    inputMode="numeric"
                  />
                </td>
                <td className="px-2 py-2">
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
                    className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-left"
                    inputMode="numeric"
                  />
                </td>
                <td className="px-2 py-2 text-right font-mono">{qty || '—'}</td>
                <td className="px-2 py-2">
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
                    className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-left"
                    inputMode="decimal"
                  />
                </td>
                <td className="px-2 py-2">
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
                    className="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-left"
                  />
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    className="text-red-600 hover:underline"
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
          <tr className="border-t bg-gray-50 font-medium">
            <td colSpan={5} className="px-2 py-2 text-right text-gray-700">
              Totals
            </td>
            <td className="px-2 py-2 text-right font-mono">{totalQty}</td>
            <td className="px-2 py-2" />
            <td className="px-2 py-2 text-right font-mono">
              {totalAmount > 0 ? totalAmount.toFixed(2) : '—'}
            </td>
            <td className="px-2 py-2" />
          </tr>
        </tfoot>
      </table>
      <p className="mt-2 text-xs text-gray-500">Enter on Amount adds a new row · F5 deletes the current row</p>
    </div>
  );
}
