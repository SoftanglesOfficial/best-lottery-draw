import { useId, useRef, useState, useEffect } from 'react';
import {
  autoCompleteTicket,
  isValidTicketNumber,
  TICKET_NUMBER_LENGTH,
} from '../../lib/ticketAutoComplete';
import { SPREADSHEET_MIN_ROWS } from './TicketRangeTable';

export type TicketRow = { number: string };

export function emptyTicketRows(count = SPREADSHEET_MIN_ROWS): TicketRow[] {
  return Array.from({ length: count }, () => ({ number: '' }));
}

type TicketNumberTableProps = {
  rows: TicketRow[];
  onChange: (rows: TicketRow[]) => void;
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  onF5?: (index: number) => void;
  /** When set, F5 / Del button ask parent (confirm) instead of deleting inline. */
  onRequestDelete?: (index: number) => void;
  variant?: 'default' | 'blueSpreadsheet';
};

export default function TicketNumberTable({
  rows,
  onChange,
  activeIndex,
  onActiveIndexChange,
  onF5,
  onRequestDelete,
  variant = 'default',
}: TicketNumberTableProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const descriptionIdPrefix = useId();
  const [blurredRows, setBlurredRows] = useState<Set<number>>(() => new Set());
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const blueSpreadsheet = variant === 'blueSpreadsheet';
  const blueField =
    'h-7 w-full border border-[#315aa8] bg-[#f7fbff] px-1.5 font-mono text-xs text-[#071b4d] outline-none focus:border-[#ffd447] focus:ring-1 focus:ring-[#ffd447]';

  const setActiveRow = (index: number) => {
    setActiveRowIndex(index);
    onActiveIndexChange?.(index);
  };

  const focusRow = (index: number) => {
    setTimeout(() => inputRefs.current[index]?.focus(), 0);
    setActiveRow(index);
  };

  const updateRow = (index: number, digits: string, currentRows: TicketRow[]) =>
    currentRows.map((row, i) => (i === index ? { number: digits } : row));

  const resolveTicketDigits = (
    index: number,
    rawValue: string,
    options: { padShort?: boolean } = {},
  ) => {
    const rawDigits = rawValue.replace(/\D/g, '').slice(0, TICKET_NUMBER_LENGTH);
    if (rawDigits.length === 0) return '';
    if (rawDigits.length >= TICKET_NUMBER_LENGTH) {
      return rawDigits.slice(0, TICKET_NUMBER_LENGTH);
    }

    const previous = index > 0 ? rows[index - 1]?.number ?? '' : '';
    return autoCompleteTicket(previous, rawDigits, TICKET_NUMBER_LENGTH, options);
  };

  const handleTicketInput = (index: number, value: string) => {
    const rawDigits = value.replace(/\D/g, '').slice(0, TICKET_NUMBER_LENGTH);
    const next = updateRow(index, rawDigits, rows);
    onChange(next);

    if (rawDigits.length === TICKET_NUMBER_LENGTH) {
      if (index === next.length - 1) {
        onChange([...next, { number: '' }]);
      }
      focusRow(index + 1);
    }
  };

  const commitRow = (index: number, advance: boolean) => {
    const raw = rows[index]?.number ?? '';
    if (!raw) return;

    const digits = resolveTicketDigits(index, raw, { padShort: true });
    if (digits.length !== TICKET_NUMBER_LENGTH) return;

    let next = updateRow(index, digits, rows);
    if (advance && index === next.length - 1) {
      next = [...next, { number: '' }];
    }
    onChange(next);
    if (advance) focusRow(index + 1);
  };

  const advanceFromRow = (index: number) => {
    commitRow(index, true);
  };

  const handleTicketArrow = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    const key = event.key;
    if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'ArrowLeft' && key !== 'ArrowRight') {
      return;
    }

    if (key === 'ArrowUp' || key === 'ArrowDown') {
      event.preventDefault();
      const nextRow = key === 'ArrowUp' ? index - 1 : index + 1;
      if (nextRow < 0 || nextRow >= rows.length) return;
      focusRow(nextRow);
      return;
    }

    const { selectionStart, selectionEnd, value } = event.currentTarget;
    if (selectionStart == null || selectionEnd == null) return;
    if (selectionStart !== selectionEnd) return;

    if (key === 'ArrowLeft' && selectionStart === 0) {
      event.preventDefault();
      return;
    }
    if (key === 'ArrowRight' && selectionStart === value.length) {
      event.preventDefault();
    }
  };

  const removeRow = (index: number) => {
    if (onRequestDelete) {
      onRequestDelete(index);
      return;
    }
    if (rows.length <= 1) {
      onChange(blueSpreadsheet ? emptyTicketRows() : [{ number: '' }]);
      focusRow(0);
      onF5?.(0);
      return;
    }

    const next = rows.filter((_, i) => i !== index);
    const padded =
      blueSpreadsheet && next.length < SPREADSHEET_MIN_ROWS
        ? [...next, ...emptyTicketRows(SPREADSHEET_MIN_ROWS - next.length)]
        : next.length
          ? next
          : [{ number: '' }];
    onChange(padded);
    const focusIndex = Math.min(index, Math.max(0, padded.length - 1));
    focusRow(focusIndex);
    onF5?.(focusIndex);
  };

  useEffect(() => {
    if (rows.length === 0) {
      onChange(blueSpreadsheet ? emptyTicketRows() : [{ number: '' }]);
      return;
    }
    // ponytail: keep booking sheet density aligned with purchase min rows
    if (blueSpreadsheet && rows.length < SPREADSHEET_MIN_ROWS) {
      onChange([...rows, ...emptyTicketRows(SPREADSHEET_MIN_ROWS - rows.length)]);
    }
  }, [rows, onChange, blueSpreadsheet]);

  useEffect(() => {
    setActiveRowIndex((current) => Math.min(current, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  const duplicateSet = new Set<string>();
  const duplicateNumbers = new Set<string>();
  for (const row of rows) {
    if (!isValidTicketNumber(row.number)) continue;
    if (duplicateSet.has(row.number)) duplicateNumbers.add(row.number);
    duplicateSet.add(row.number);
  }

  const validCount = rows.filter((row) => isValidTicketNumber(row.number)).length;
  const currentActive = activeIndex ?? activeRowIndex;

  return (
    <div className={blueSpreadsheet ? 'flex h-full min-h-0 flex-col' : undefined}>
      <div className={blueSpreadsheet ? 'min-h-0 flex-1 overflow-auto border border-[#81c784] bg-[#e8f5e9]' : 'max-w-full overflow-x-auto rounded-cyber border border-line'}>
      <table className={blueSpreadsheet ? 'w-full min-w-[480px] table-fixed border-collapse text-xs' : 'min-w-[480px] w-full text-sm'}>
        <thead className={blueSpreadsheet ? 'sticky top-0 z-10 bg-[#f1b900] text-[#071b4d]' : 'bg-surface-high'}>
          <tr className={blueSpreadsheet ? 'border-b border-[#745600] text-left' : 'border-b border-line text-left'}>
            <th className={blueSpreadsheet ? 'w-12 border-r border-[#745600] px-1 py-1 text-center text-[10px] font-bold uppercase' : 'w-16 px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>Sr</th>
            <th className={blueSpreadsheet ? 'border-r border-[#745600] px-1 py-1 text-[10px] font-bold uppercase' : 'px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>Ticket No</th>
            <th className={blueSpreadsheet ? 'w-12 px-1 py-1 text-center text-[10px] font-bold uppercase' : 'w-24 px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'}>Del</th>
          </tr>
        </thead>
        <tbody className={blueSpreadsheet ? undefined : 'divide-y divide-line'}>
          {rows.map((row, index) => {
            const isDuplicate =
              isValidTicketNumber(row.number) && duplicateNumbers.has(row.number);
            const showInvalidError =
              blurredRows.has(index) &&
              row.number.length > 0 &&
              !isValidTicketNumber(row.number);
            const errorMessage = isDuplicate
              ? 'Duplicate ticket number.'
              : showInvalidError
                ? 'Ticket number must be 5 digits.'
                : null;
            const errorId = `${descriptionIdPrefix}-row-${index}-error`;
            const isActive = blueSpreadsheet && currentActive === index;
            const rowBg = blueSpreadsheet
              ? isActive
                ? 'bg-[#dc2626] text-white'
                : index % 2 === 0
                  ? 'bg-[#e8f5e9] text-[#071b4d]'
                  : 'bg-[#dcedc8] text-[#071b4d]'
              : '';
            const activeField = isActive ? `${blueField} bg-white` : blueField;

            const borderClass = isDuplicate
              ? 'border-[#c2410c] bg-[#fff7ed]'
              : showInvalidError
                ? 'border-[#dc2626] bg-[#fef2f2]'
                : blueSpreadsheet
                  ? activeField
                  : 'border-line-control bg-canvas';

            return (
              <tr key={index} className={blueSpreadsheet ? `${rowBg} border-b border-[#81c784]` : 'bg-surface-raised hover:bg-surface-high'}>
                <td className={blueSpreadsheet ? 'border-r border-[#81c784] px-2 py-1 text-center font-mono font-bold' : 'px-3 py-2 font-mono text-content-subtle'}>{index + 1}</td>
                <td className={blueSpreadsheet ? 'border-r border-[#81c784] px-1.5 py-1' : 'px-3 py-2'}>
                  <input
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    value={row.number}
                    onChange={(event) => handleTicketInput(index, event.target.value)}
                    onFocus={() => {
                      setActiveRow(index);
                      setBlurredRows((prev) => {
                        if (!prev.has(index)) return prev;
                        const next = new Set(prev);
                        next.delete(index);
                        return next;
                      });
                    }}
                    onBlur={() => {
                      setBlurredRows((prev) => new Set(prev).add(index));
                      commitRow(index, false);
                    }}
                    onKeyDown={(event) => {
                      handleTicketArrow(index, event);
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        advanceFromRow(index);
                      }
                      if (event.key === 'F5') {
                        event.preventDefault();
                        event.stopPropagation();
                        removeRow(index);
                      }
                    }}
                    className={
                      blueSpreadsheet
                        ? `${borderClass} w-28`
                        : `w-32 rounded-cyber border px-2 py-1 font-mono text-left text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20 ${borderClass}`
                    }
                    inputMode="numeric"
                    maxLength={TICKET_NUMBER_LENGTH}
                    aria-invalid={showInvalidError || isDuplicate}
                    aria-label={`Ticket number row ${index + 1}`}
                    aria-describedby={errorMessage ? errorId : undefined}
                  />
                  {errorMessage ? (
                    <p
                      id={errorId}
                      className={`mt-1 font-mono text-[10px] ${
                        isDuplicate ? 'text-[#c2410c]' : 'text-[#dc2626]'
                      }`}
                    >
                      {errorMessage}
                    </p>
                  ) : null}
                </td>
                <td className={blueSpreadsheet ? 'px-1.5 py-1 text-center' : 'px-3 py-2'}>
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
        {blueSpreadsheet ? (
          <tfoot>
            <tr className="border-t-2 border-[#81c784] bg-[#1b5e20] font-bold text-white">
              <td colSpan={3} className="px-2 py-2 text-right text-xs uppercase tracking-wide">
                Valid Tickets{' '}
                <span className="ml-2 font-mono text-[#ffe16a]">{validCount}</span>
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
      </div>
      {!blueSpreadsheet ? (
        <p className="mt-2 font-mono text-xs font-medium uppercase tracking-[0.05em] text-content-muted">
          Valid tickets: <span className="text-cyber-hover">{validCount}</span>
        </p>
      ) : null}
    </div>
  );
}

export function ticketsToTicketData(rows: TicketRow[]) {
  const tickets = rows
    .filter((row) => isValidTicketNumber(row.number))
    .map((row) => ({ number: row.number }));
  return JSON.stringify({ tickets });
}

export function validTicketNumbers(rows: TicketRow[]) {
  return rows.filter((row) => isValidTicketNumber(row.number)).map((row) => row.number);
}
