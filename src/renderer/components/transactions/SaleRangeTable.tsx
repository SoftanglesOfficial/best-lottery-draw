import { useEffect, useRef, useState } from 'react';
import {
  calculateAmount,
  calculateQuantity,
  resolveTo,
  validateRange,
} from '../../../shared/ticketMath';
import { isAtLeastRole } from '../../lib/roles';
import { useAuth } from '../../lib/auth';
import type { ItemRecord } from '../../../shared/types';

export type SaleRangeRow = {
  itemId: number | null;
  code: string;
  prefix: string;
  series: string;
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
  drawDateLabel?: string;
  drawDayLabel?: string;
  fieldsUnlocked?: boolean;
  absoluteToArmed?: boolean;
  onAbsoluteToConsumed?: () => void;
  onRowError?: (message: string) => void;
  focusItemRequest?: number;
};

const FOCUS_COLS = 4; // item, from, to, rate

const salesTokenStyle = {
  ['--sales-header' as string]: '#f1b900',
  ['--sales-header-text' as string]: '#071b4d',
  ['--sales-sheet' as string]: '#e8f5e9',
  ['--sales-stripe' as string]: '#dcedc8',
  ['--sales-active-row' as string]: '#dc2626',
  ['--sales-active-text' as string]: '#ffffff',
  ['--sales-focus' as string]: '#ffd447',
  ['--sales-error' as string]: '#dc2626',
  ['--sales-readonly' as string]: '#c8e6c9',
  ['--sales-locked' as string]: '#a5d6a7',
  ['--sales-border' as string]: '#81c784',
  ['--sales-totals' as string]: '#1b5e20',
} as const;

function rowQty(row: SaleRangeRow) {
  return calculateQuantity(row.from, row.to);
}

function rowAmount(row: SaleRangeRow) {
  return calculateAmount(rowQty(row), row.rate);
}

export function emptySaleRangeRow(defaultRate = ''): SaleRangeRow {
  return {
    itemId: null,
    code: '',
    prefix: '',
    series: '',
    from: '',
    to: '',
    rate: defaultRate,
  };
}

export function saleRangesToTicketData(rows: SaleRangeRow[]) {
  const ranges = rows
    .filter((row) => row.itemId != null && rowQty(row) > 0)
    .map((row) => {
      const qty = rowQty(row);
      const rate = Number(row.rate) || 0;
      return {
        itemId: row.itemId,
        code: row.code || undefined,
        prefix: row.prefix || undefined,
        series: row.series || undefined,
        from: row.from,
        to: row.to,
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
    const error = validateRange(validRows[index]);
    if (error) return `Row ${index + 1}: ${error}`;
  }

  if (totalSaleRangeQty(validRows) <= 0) {
    return 'Add at least one valid ticket range.';
  }

  return null;
}

export function rowHasSaleData(row: SaleRangeRow): boolean {
  return Boolean(row.itemId != null || row.from || row.to || row.code || row.prefix || row.series);
}

export default function SaleRangeTable({
  rows,
  onChange,
  items,
  defaultRate,
  onActiveRowChange,
  variant = 'default',
  drawDateLabel = '—',
  drawDayLabel = '—',
  fieldsUnlocked = false,
  absoluteToArmed = false,
  onAbsoluteToConsumed,
  onRowError,
  focusItemRequest = 0,
}: SaleRangeTableProps) {
  const inputRefs = useRef<Array<HTMLInputElement | HTMLSelectElement | null>>([]);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [toDraft, setToDraft] = useState<{ index: number; value: string } | null>(null);
  const [invalidCell, setInvalidCell] = useState<string | null>(null);
  const { user } = useAuth();
  const canEditRate = user ? isAtLeastRole(user.role, 'manager') : false;
  const dense = variant === 'blueSpreadsheet';

  const fieldClass = dense
    ? 'h-7 w-full border border-[color:var(--sales-border)] bg-white px-1.5 font-mono text-xs text-[#071b4d] outline-none focus:border-[color:var(--sales-focus)] focus:ring-1 focus:ring-[color:var(--sales-focus)]'
    : 'w-full rounded-cyber border border-line-control bg-canvas px-2 py-1 font-mono text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20';
  const lockedClass = dense
    ? `${fieldClass} bg-[color:var(--sales-locked)] text-[#33517f]`
    : `${fieldClass} bg-surface-high text-content-subtle`;
  const errorClass = dense
    ? 'border-[color:var(--sales-error)] ring-1 ring-[color:var(--sales-error)]'
    : 'border-cyber-error ring-2 ring-cyber-error/30';

  const setActiveRow = (index: number) => {
    setActiveRowIndex(index);
    onActiveRowChange?.(index);
  };

  const focusCell = (rowIndex: number, col: number) => {
    setTimeout(() => inputRefs.current[rowIndex * FOCUS_COLS + col]?.focus(), 0);
  };

  const updateRow = (index: number, patch: Partial<SaleRangeRow>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const addRow = (afterIndex: number) => {
    const next = [...rows];
    next.splice(afterIndex + 1, 0, emptySaleRangeRow(defaultRate));
    onChange(next);
    setActiveRow(afterIndex + 1);
    focusCell(afterIndex + 1, 0);
  };

  const handleItemChange = (index: number, itemId: number | null) => {
    const item = items.find((entry) => entry.id === itemId);
    updateRow(index, {
      itemId,
      code: item?.code ?? '',
      prefix: item?.prefix ?? '',
      series: item?.defaultSeries ?? '',
    });
  };

  const commitTo = (index: number, rawInput: string): boolean => {
    const row = rows[index];
    if (rawInput.trim() === '') {
      // empty draft = cancel edit; keep existing To
      setToDraft(null);
      setInvalidCell(null);
      return true;
    }
    const mode = absoluteToArmed ? 'absolute' : 'diff';
    const result = resolveTo(row.from, rawInput, mode);
    if (!result.ok) {
      if (result.error !== 'empty') {
        setInvalidCell(`${index}:to`);
        onRowError?.(result.error);
      }
      return false;
    }
    updateRow(index, { to: result.to });
    setToDraft(null);
    setInvalidCell(null);
    if (absoluteToArmed) onAbsoluteToConsumed?.();
    return true;
  };

  const tryAdvanceFromRate = (index: number) => {
    const row = rows[index];
    const error = validateRange(row);
    if (error) {
      setInvalidCell(`${index}:rate`);
      onRowError?.(error);
      return;
    }
    setInvalidCell(null);
    addRow(index);
  };

  const totalQty = totalSaleRangeQty(rows);
  const totalAmount = totalSaleRangeAmount(rows);

  useEffect(() => {
    if (rows.length === 0) onChange([emptySaleRangeRow(defaultRate)]);
  }, [rows.length, onChange, defaultRate]);

  useEffect(() => {
    setActiveRowIndex((current) => Math.min(current, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  useEffect(() => {
    if (focusItemRequest > 0) focusCell(0, 0);
  }, [focusItemRequest]);

  return (
    <div
      className={dense ? 'flex h-full min-h-0 flex-col' : undefined}
      style={dense ? salesTokenStyle : undefined}
    >
      <div
        className={
          dense
            ? 'min-h-0 flex-1 overflow-auto border border-[color:var(--sales-border)] bg-[color:var(--sales-sheet)]'
            : 'max-w-full overflow-x-auto rounded-cyber border border-line'
        }
      >
        <table
          className={
            dense
              ? 'w-full min-w-[1100px] table-fixed border-collapse text-xs'
              : 'min-w-[1100px] w-full text-sm'
          }
        >
          <thead
            className={
              dense
                ? 'sticky top-0 z-10 bg-[color:var(--sales-header)] text-[color:var(--sales-header-text)]'
                : 'bg-surface-high'
            }
          >
            <tr className={dense ? 'text-left' : 'border-b border-line text-left'}>
              {[
                ['Sr No', 'w-12 text-center'],
                ['Code', 'w-16 sticky left-0 z-[1]'],
                ['Item Name', 'w-[16%] sticky left-16 z-[1]'],
                ['Draw Date', 'w-24'],
                ['Day', 'w-14'],
                ['Prefix', 'w-16'],
                ['Series', 'w-16'],
                ['From', 'w-[9%]'],
                ['To', 'w-[9%]'],
                ['Quantity', 'w-16 text-right'],
                ['Rate', 'w-16 text-right'],
                ['Amount', 'w-20 text-right'],
              ].map(([label, width]) => (
                <th
                  key={label}
                  className={
                    dense
                      ? `${width} border-r border-[#745600] px-1 py-1 text-[10px] font-bold uppercase`
                      : 'px-2 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'
                  }
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const qty = rowQty(row);
              const amount = rowAmount(row);
              const isActive = dense && activeRowIndex === index;
              const rowBg = dense
                ? isActive
                  ? 'bg-[color:var(--sales-active-row)] text-[color:var(--sales-active-text)]'
                  : index % 2 === 0
                    ? 'bg-[color:var(--sales-sheet)] text-[#071b4d]'
                    : 'bg-[color:var(--sales-stripe)] text-[#071b4d]'
                : 'bg-surface-raised hover:bg-surface-high';
              const toDisplay =
                toDraft?.index === index ? toDraft.value : row.to;
              const cellErr = (key: string) =>
                invalidCell === `${index}:${key}` ? errorClass : '';

              return (
                <tr
                  key={index}
                  className={dense ? `${rowBg} border-b border-[color:var(--sales-border)]` : rowBg}
                >
                  <td
                    className={
                      dense
                        ? 'border-r border-[color:var(--sales-border)] px-2 py-1 text-center font-mono font-bold'
                        : 'px-2 py-2 font-mono text-content-subtle'
                    }
                  >
                    {index + 1}
                  </td>
                  <td
                    className={
                      dense
                        ? 'sticky left-0 z-[1] border-r border-[color:var(--sales-border)] bg-inherit px-1.5 py-1'
                        : 'px-2 py-2'
                    }
                  >
                    <input
                      value={row.code}
                      readOnly={!fieldsUnlocked}
                      tabIndex={fieldsUnlocked ? 0 : -1}
                      onChange={(event) => updateRow(index, { code: event.target.value })}
                      onFocus={() => setActiveRow(index)}
                      className={fieldsUnlocked ? fieldClass : lockedClass}
                      aria-label={`Row ${index + 1} code`}
                    />
                  </td>
                  <td
                    className={
                      dense
                        ? 'sticky left-16 z-[1] border-r border-[color:var(--sales-border)] bg-inherit px-1.5 py-1'
                        : 'px-2 py-2'
                    }
                  >
                    <select
                      ref={(el) => {
                        inputRefs.current[index * FOCUS_COLS] = el;
                      }}
                      value={row.itemId ?? ''}
                      onChange={(event) =>
                        handleItemChange(index, Number(event.target.value) || null)
                      }
                      onFocus={() => setActiveRow(index)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          focusCell(index, 1);
                        }
                      }}
                      className={`${fieldClass} ${cellErr('item')}`}
                      aria-label={`Row ${index + 1} item name`}
                    >
                      <option value="">Select item</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    className={
                      dense
                        ? 'border-r border-[color:var(--sales-border)] px-2 py-1 font-mono'
                        : 'px-2 py-2 font-mono'
                    }
                  >
                    {drawDateLabel}
                  </td>
                  <td
                    className={
                      dense
                        ? 'border-r border-[color:var(--sales-border)] px-2 py-1 font-mono'
                        : 'px-2 py-2 font-mono'
                    }
                  >
                    {drawDayLabel}
                  </td>
                  <td
                    className={
                      dense
                        ? 'border-r border-[color:var(--sales-border)] px-1.5 py-1'
                        : 'px-2 py-2'
                    }
                  >
                    <input
                      value={row.prefix}
                      readOnly={!fieldsUnlocked}
                      tabIndex={fieldsUnlocked ? 0 : -1}
                      onChange={(event) => updateRow(index, { prefix: event.target.value })}
                      onFocus={() => setActiveRow(index)}
                      className={fieldsUnlocked ? fieldClass : lockedClass}
                      aria-label={`Row ${index + 1} prefix`}
                    />
                  </td>
                  <td
                    className={
                      dense
                        ? 'border-r border-[color:var(--sales-border)] px-1.5 py-1'
                        : 'px-2 py-2'
                    }
                  >
                    <input
                      value={row.series}
                      readOnly={!fieldsUnlocked}
                      tabIndex={fieldsUnlocked ? 0 : -1}
                      onChange={(event) => updateRow(index, { series: event.target.value })}
                      onFocus={() => setActiveRow(index)}
                      className={fieldsUnlocked ? fieldClass : lockedClass}
                      aria-label={`Row ${index + 1} series`}
                    />
                  </td>
                  <td
                    className={
                      dense
                        ? 'border-r border-[color:var(--sales-border)] px-1.5 py-1'
                        : 'px-2 py-2'
                    }
                  >
                    <input
                      ref={(el) => {
                        inputRefs.current[index * FOCUS_COLS + 1] = el;
                      }}
                      value={row.from}
                      onChange={(event) =>
                        updateRow(index, {
                          from: event.target.value.replace(/\D/g, '').slice(0, 5),
                        })
                      }
                      onFocus={() => setActiveRow(index)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          focusCell(index, 2);
                        }
                      }}
                      className={`${fieldClass} ${cellErr('from')}`}
                      inputMode="numeric"
                      aria-label={`Row ${index + 1} from ticket`}
                    />
                  </td>
                  <td
                    className={
                      dense
                        ? 'border-r border-[color:var(--sales-border)] px-1.5 py-1'
                        : 'px-2 py-2'
                    }
                  >
                    <input
                      ref={(el) => {
                        inputRefs.current[index * FOCUS_COLS + 2] = el;
                      }}
                      value={toDisplay}
                      onChange={(event) => {
                        const value = event.target.value.replace(/\D/g, '').slice(0, absoluteToArmed ? 5 : 6);
                        setToDraft({ index, value });
                      }}
                      onFocus={() => {
                        setActiveRow(index);
                        setToDraft({ index, value: '' });
                      }}
                      onBlur={() => {
                        if (toDraft?.index === index) {
                          commitTo(index, toDraft.value);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          if (toDraft?.index === index && !commitTo(index, toDraft.value)) return;
                          if (canEditRate) focusCell(index, 3);
                          else tryAdvanceFromRate(index);
                        }
                      }}
                      className={`${fieldClass} ${cellErr('to')}`}
                      inputMode="numeric"
                      title={absoluteToArmed ? 'Absolute To (5 digits)' : 'Enter difference from From'}
                      aria-label={`Row ${index + 1} to ticket`}
                    />
                  </td>
                  <td
                    className={
                      dense
                        ? 'border-r border-[color:var(--sales-border)] px-2 py-1 text-right font-mono font-bold tabular-nums'
                        : 'px-2 py-2 text-right font-mono tabular-nums'
                    }
                  >
                    {qty || '—'}
                  </td>
                  <td
                    className={
                      dense
                        ? 'border-r border-[color:var(--sales-border)] px-1.5 py-1'
                        : 'px-2 py-2'
                    }
                  >
                    <input
                      ref={(el) => {
                        inputRefs.current[index * FOCUS_COLS + 3] = el;
                      }}
                      value={row.rate}
                      onChange={(event) =>
                        updateRow(index, {
                          rate: event.target.value.replace(/[^\d.]/g, ''),
                        })
                      }
                      onFocus={() => setActiveRow(index)}
                      readOnly={!canEditRate}
                      tabIndex={canEditRate ? 0 : -1}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          tryAdvanceFromRate(index);
                        }
                      }}
                      className={`${canEditRate ? fieldClass : lockedClass} ${cellErr('rate')}`}
                      inputMode="decimal"
                      aria-label={`Row ${index + 1} rate`}
                    />
                  </td>
                  <td
                    className={
                      dense
                        ? 'px-2 py-1 text-right font-mono font-bold tabular-nums'
                        : 'px-2 py-2 text-right font-mono tabular-nums'
                    }
                  >
                    {amount > 0 ? amount.toFixed(2) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr
              className={
                dense
                  ? 'border-t-2 border-[color:var(--sales-border)] bg-[color:var(--sales-totals)] font-bold text-white'
                  : 'border-t border-line bg-surface-high font-medium'
              }
            >
              <td colSpan={9} className="px-2 py-2 text-right text-xs uppercase tracking-wide">
                Totals
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums text-[#ffe16a]">
                {totalQty}
              </td>
              <td className="px-2 py-2" />
              <td className="px-2 py-2 text-right font-mono tabular-nums text-[#ffe16a]">
                {totalAmount > 0 ? totalAmount.toFixed(2) : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {!dense ? (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.05em] text-content-subtle">
          Enter on Rate adds a new row · Ctrl+Delete removes the active row
        </p>
      ) : null}
    </div>
  );
}
