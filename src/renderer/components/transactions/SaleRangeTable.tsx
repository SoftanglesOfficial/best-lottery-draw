import { useEffect, useRef, useState } from 'react';
import {
  calculateAmount,
  calculateQuantity,
  matchItemByCode,
  resolveTo,
  validateRange,
  isFiveDigitTicket,
  isCompletableSaleRangeRow,
} from '../../../shared/ticketMath';
import { padTicketDigits } from '../../lib/ticketAutoComplete';
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
  /** Return false to abort new-row advance (e.g. dup cancel). */
  onBeforeAddRow?: (index: number) => boolean | Promise<boolean>;
};

/** code, item, prefix, series, from, to, rate */
const FOCUS_COLS = 7;
const COL = { code: 0, item: 1, prefix: 2, series: 3, from: 4, to: 5, rate: 6 } as const;

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
  return calculateQuantity(padTicketDigits(row.from), padTicketDigits(row.to));
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

/** Match purchase sheet density — empty trailing rows ignored on save */
export function emptySaleRangeRows(
  defaultRate = '',
  count = 18, // ponytail: same count as TicketRangeTable.SPREADSHEET_MIN_ROWS
): SaleRangeRow[] {
  return Array.from({ length: count }, () => emptySaleRangeRow(defaultRate));
}

export function saleRangesToTicketData(rows: SaleRangeRow[]) {
  const ranges = rows
    .filter((row) => row.itemId != null && rowQty(row) > 0)
    .map((row) => {
      const from = padTicketDigits(row.from);
      const to = padTicketDigits(row.to);
      const qty = calculateQuantity(from, to);
      const rate = Number(row.rate) || 0;
      return {
        itemId: row.itemId,
        code: row.code || undefined,
        prefix: row.prefix || undefined,
        series: row.series || undefined,
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
  const validRows = rows.filter((row) => isCompletableSaleRangeRow(row));
  if (validRows.length === 0) {
    return 'Add at least one ticket range.';
  }

  for (let index = 0; index < validRows.length; index += 1) {
    const row = validRows[index];
    const error = validateRange({
      ...row,
      from: padTicketDigits(row.from),
      to: padTicketDigits(row.to),
    });
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
  onBeforeAddRow,
}: SaleRangeTableProps) {
  const inputRefs = useRef<Array<HTMLInputElement | HTMLSelectElement | null>>([]);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [toDraft, setToDraft] = useState<{ index: number; value: string } | null>(null);
  const [invalidCell, setInvalidCell] = useState<string | null>(null);
  // Spec: Rate on sale fast path for all roles that can open Add Sale
  const canEditRate = true;
  const dense = variant === 'blueSpreadsheet';

  /** # ponytail: 350ms settle; bump if operators clip multi-digit diffs */
  const TO_SETTLE_MS = 350;
  const toSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearToSettleTimer = () => {
    if (toSettleTimerRef.current != null) {
      clearTimeout(toSettleTimerRef.current);
      toSettleTimerRef.current = null;
    }
  };

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

  const nextTypingCol = (fromCol: number): number | 'add' => {
    for (let col = fromCol + 1; col < FOCUS_COLS; col += 1) {
      if ((col === COL.prefix || col === COL.series) && !fieldsUnlocked) continue;
      if (col === COL.rate && !canEditRate) return 'add';
      return col;
    }
    return 'add';
  };

  const editableColOrder = (): number[] =>
    fieldsUnlocked ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 4, 5, 6];

  const nextEditableCol = (col: number): number | null => {
    const order = editableColOrder();
    const i = order.indexOf(col);
    return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
  };

  const prevEditableCol = (col: number): number | null => {
    const order = editableColOrder();
    const i = order.indexOf(col);
    return i > 0 ? order[i - 1] : null;
  };

  const advanceFrom = (rowIndex: number, fromCol: number) => {
    const next = nextTypingCol(fromCol);
    if (next === 'add') {
      void tryAdvanceFromRate(rowIndex);
      return;
    }
    focusCell(rowIndex, next);
  };

  const updateRow = (index: number, patch: Partial<SaleRangeRow>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const addRow = (afterIndex: number) => {
    const prev = rows[afterIndex];
    const blank = {
      ...emptySaleRangeRow(defaultRate),
      code: prev?.code ?? '',
      itemId: prev?.itemId ?? null,
      prefix: prev?.prefix ?? '',
      series: prev?.series ?? '',
    };
    const next = [...rows];
    next.splice(afterIndex + 1, 0, blank);
    onChange(next);
    setActiveRow(afterIndex + 1);
    focusCell(afterIndex + 1, COL.from);
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

  /** Commit To then focus Rate (same row). Add-row happens on Rate Enter. */
  const commitToAndAdvance = (index: number, rawInput: string) => {
    clearToSettleTimer();
    const row = rows[index];

    if (rawInput.trim() === '') {
      setToDraft(null);
      setInvalidCell(null);
      return;
    }
    const mode = absoluteToArmed ? 'absolute' : 'diff';
    const result = resolveTo(row.from, rawInput, mode);
    if (!result.ok) {
      if (result.error !== 'empty') {
        setInvalidCell(`${index}:to`);
        onRowError?.(result.error);
      }
      return;
    }

    updateRow(index, { to: result.to });
    setToDraft(null);
    if (absoluteToArmed) onAbsoluteToConsumed?.();

    if (row.itemId == null) {
      setInvalidCell(`${index}:item`);
      onRowError?.('Select a lottery type.');
      return;
    }

    setInvalidCell(null);
    focusCell(index, COL.rate);
  };

  const tryAdvanceFromRate = async (index: number) => {
    const row = rows[index];
    // Fallback rate before validate
    let finalRate = row.rate;
    const rateNum = Number(finalRate);
    if (!finalRate || Number.isNaN(rateNum) || rateNum <= 0) {
      finalRate = defaultRate;
    }
    const toValidate = { ...row, rate: finalRate };
    const error = validateRange(toValidate);
    if (error) {
      setInvalidCell(`${index}:rate`);
      onRowError?.(error);
      return;
    }
    setInvalidCell(null);
    // Write rate if we applied fallback
    if (finalRate !== row.rate) {
      updateRow(index, { rate: finalRate });
    }
    if (onBeforeAddRow) {
      const ok = await onBeforeAddRow(index);
      if (!ok) {
        focusCell(index, fieldsUnlocked ? COL.prefix : COL.code);
        return;
      }
    }
    addRow(index);
  };

  const settleToBeforeLeave = (rowIndex: number, fromCol: number) => {
    if (fromCol !== COL.to) return;
    clearToSettleTimer();
    if (toDraft?.index === rowIndex) {
      commitTo(rowIndex, toDraft.value);
    }
  };

  const handleCellArrow = (
    index: number,
    col: number,
    event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const key = event.key;
    if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'ArrowLeft' && key !== 'ArrowRight') {
      return;
    }

    if (key === 'ArrowUp' || key === 'ArrowDown') {
      event.preventDefault();
      const nextRow = key === 'ArrowUp' ? index - 1 : index + 1;
      if (nextRow < 0 || nextRow >= rows.length) return;
      settleToBeforeLeave(index, col);
      setActiveRow(nextRow);
      focusCell(nextRow, col);
      return;
    }

    if (col === COL.item) {
      event.preventDefault();
      const targetCol = key === 'ArrowLeft' ? prevEditableCol(col) : nextEditableCol(col);
      if (targetCol == null) return;
      settleToBeforeLeave(index, col);
      setActiveRow(index);
      focusCell(index, targetCol);
      return;
    }

    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;

    const { selectionStart, selectionEnd, value } = target;
    if (selectionStart == null || selectionEnd == null) return;
    if (selectionStart !== selectionEnd) return;

    if (key === 'ArrowLeft') {
      if (selectionStart !== 0) return;
      const prev = prevEditableCol(col);
      event.preventDefault();
      if (prev == null) return;
      settleToBeforeLeave(index, col);
      setActiveRow(index);
      focusCell(index, prev);
      return;
    }

    if (key === 'ArrowRight') {
      if (selectionStart !== value.length) return;
      const next = nextEditableCol(col);
      event.preventDefault();
      if (next == null) return;
      settleToBeforeLeave(index, col);
      setActiveRow(index);
      focusCell(index, next);
    }
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
    if (focusItemRequest > 0) focusCell(0, COL.item);
  }, [focusItemRequest]);

  useEffect(() => () => clearToSettleTimer(), []);

  useEffect(() => {
    clearToSettleTimer();
  }, [activeRowIndex]);

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
                      ref={(el) => {
                        inputRefs.current[index * FOCUS_COLS + COL.code] = el;
                      }}
                      value={row.code}
                      onChange={(event) => updateRow(index, { code: event.target.value })}
                      onFocus={() => setActiveRow(index)}
                      onKeyDown={(event) => {
                        handleCellArrow(index, COL.code, event);
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        event.stopPropagation();
                        const match = matchItemByCode(items, row.code);
                        if (match.status === 'none') {
                          onRowError?.(row.code.trim() ? 'No item matches this code.' : 'Enter an item code.');
                          return;
                        }
                        if (match.status === 'ambiguous') {
                          onRowError?.('Multiple items share this code. Pick the item from the list.');
                          return;
                        }
                        handleItemChange(index, match.item.id);
                        focusCell(index, COL.from);
                      }}
                      className={fieldClass}
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
                        inputRefs.current[index * FOCUS_COLS + COL.item] = el;
                      }}
                      value={row.itemId ?? ''}
                      onChange={(event) => {
                        handleItemChange(index, Number(event.target.value) || null);
                        advanceFrom(index, COL.item);
                      }}
                      onFocus={(event) => {
                        setActiveRow(index);
                        const el = event.currentTarget;
                        try {
                          if (typeof el.showPicker === 'function') el.showPicker();
                        } catch {
                          // # ponytail: showPicker may throw; native focus still works
                        }
                      }}
                      onKeyDown={(event) => {
                        handleCellArrow(index, COL.item, event);
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          advanceFrom(index, COL.item);
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
                      ref={(el) => {
                        inputRefs.current[index * FOCUS_COLS + COL.prefix] = el;
                      }}
                      value={row.prefix}
                      readOnly={!fieldsUnlocked}
                      tabIndex={fieldsUnlocked ? 0 : -1}
                      onChange={(event) => updateRow(index, { prefix: event.target.value })}
                      onFocus={() => setActiveRow(index)}
                      onKeyDown={(event) => {
                        handleCellArrow(index, COL.prefix, event);
                        if (event.key === 'Enter' && fieldsUnlocked) {
                          event.preventDefault();
                          advanceFrom(index, COL.prefix);
                        }
                      }}
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
                      ref={(el) => {
                        inputRefs.current[index * FOCUS_COLS + COL.series] = el;
                      }}
                      value={row.series}
                      readOnly={!fieldsUnlocked}
                      tabIndex={fieldsUnlocked ? 0 : -1}
                      onChange={(event) => updateRow(index, { series: event.target.value })}
                      onFocus={() => setActiveRow(index)}
                      onKeyDown={(event) => {
                        handleCellArrow(index, COL.series, event);
                        if (event.key === 'Enter' && fieldsUnlocked) {
                          event.preventDefault();
                          advanceFrom(index, COL.series);
                        }
                      }}
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
                        inputRefs.current[index * FOCUS_COLS + COL.from] = el;
                      }}
                      value={row.from}
                      onChange={(event) => {
                        const from = event.target.value.replace(/\D/g, '').slice(0, 5);
                        if (invalidCell === `${index}:from`) setInvalidCell(null);
                        updateRow(index, { from });
                        if (isFiveDigitTicket(from)) focusCell(index, COL.to);
                      }}
                      onBlur={() => {
                        const padded = padTicketDigits(row.from);
                        if (padded && padded !== row.from) updateRow(index, { from: padded });
                      }}
                      onFocus={() => setActiveRow(index)}
                      onKeyDown={(event) => {
                        handleCellArrow(index, COL.from, event);
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        event.stopPropagation();
                        if (!isFiveDigitTicket(row.from)) {
                          setInvalidCell(`${index}:from`);
                          return;
                        }
                        focusCell(index, COL.to);
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
                        inputRefs.current[index * FOCUS_COLS + COL.to] = el;
                      }}
                      value={toDisplay}
                      onChange={(event) => {
                        const maxLen = absoluteToArmed ? 5 : 6;
                        const value = event.target.value.replace(/\D/g, '').slice(0, maxLen);
                        setToDraft({ index, value });
                        clearToSettleTimer();
                        if (absoluteToArmed) {
                          if (value.length === 5) commitToAndAdvance(index, value);
                          return;
                        }
                        // diff: settle only — never commit on first keystroke alone without pause
                        toSettleTimerRef.current = setTimeout(() => {
                          toSettleTimerRef.current = null;
                          commitToAndAdvance(index, value);
                        }, TO_SETTLE_MS);
                      }}
                      onFocus={() => {
                        clearToSettleTimer();
                        setActiveRow(index);
                        setToDraft({ index, value: '' });
                      }}
                      onBlur={() => {
                        clearToSettleTimer();
                        if (toDraft?.index === index) {
                          // empty draft = cancel (existing commitTo); do not advance on empty
                          if (toDraft.value.trim() === '') {
                            commitTo(index, toDraft.value);
                            return;
                          }
                          commitToAndAdvance(index, toDraft.value);
                        }
                      }}
                      onKeyDown={(event) => {
                        handleCellArrow(index, COL.to, event);
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          event.stopPropagation();
                          clearToSettleTimer();
                          setToDraft(null);
                          setInvalidCell(null);
                          return;
                        }
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        event.stopPropagation();
                        if (toDraft?.index === index) {
                          commitToAndAdvance(index, toDraft.value);
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
                        inputRefs.current[index * FOCUS_COLS + COL.rate] = el;
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
                        handleCellArrow(index, COL.rate, event);
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void tryAdvanceFromRate(index);
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
