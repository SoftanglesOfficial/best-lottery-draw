import { useId, useRef, useState } from 'react';
import {
  autoCompleteTicket,
  isValidTicketNumber,
  TICKET_NUMBER_LENGTH,
} from '../../lib/ticketAutoComplete';

export type TicketRow = { number: string };

type TicketNumberTableProps = {
  rows: TicketRow[];
  onChange: (rows: TicketRow[]) => void;
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  onF5?: (index: number) => void;
};

export default function TicketNumberTable({
  rows,
  onChange,
  activeIndex,
  onActiveIndexChange,
  onF5,
}: TicketNumberTableProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const descriptionIdPrefix = useId();
  const [blurredRows, setBlurredRows] = useState<Set<number>>(() => new Set());

  const focusRow = (index: number) => {
    setTimeout(() => inputRefs.current[index]?.focus(), 0);
    onActiveIndexChange?.(index);
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

  const removeRow = (index: number) => {
    if (rows.length <= 1) {
      onChange([{ number: '' }]);
      focusRow(0);
      onF5?.(0);
      return;
    }

    const next = rows.filter((_, i) => i !== index);
    onChange(next.length ? next : [{ number: '' }]);
    const focusIndex = Math.min(index, next.length - 1);
    focusRow(focusIndex);
    onActiveIndexChange?.(focusIndex);
    onF5?.(focusIndex);
  };

  const duplicateSet = new Set<string>();
  const duplicateNumbers = new Set<string>();
  for (const row of rows) {
    if (!isValidTicketNumber(row.number)) continue;
    if (duplicateSet.has(row.number)) duplicateNumbers.add(row.number);
    duplicateSet.add(row.number);
  }

  const validCount = rows.filter((row) => isValidTicketNumber(row.number)).length;

  return (
    <div>
      <div className="max-w-full overflow-x-auto rounded-cyber border border-line">
      <table className="min-w-[480px] w-full text-sm">
        <thead className="bg-surface-high">
          <tr className="border-b border-line text-left">
            <th className="w-16 px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">Sr No</th>
            <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">Ticket Number</th>
            <th className="w-24 px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
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

            const borderClass = isDuplicate
              ? 'border-cyber-warning bg-cyber-warning/10'
              : showInvalidError
                ? 'border-cyber-error bg-cyber-error/10'
                : 'border-line-control bg-canvas';

            return (
              <tr key={index} className="bg-surface-raised hover:bg-surface-high">
                <td className="px-3 py-2 font-mono text-content-subtle">{index + 1}</td>
                <td className="px-3 py-2">
                  <input
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    value={row.number}
                    onChange={(event) => handleTicketInput(index, event.target.value)}
                    onFocus={() => {
                      onActiveIndexChange?.(index);
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
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        advanceFromRow(index);
                      }
                      if (event.key === 'F5') {
                        event.preventDefault();
                        removeRow(index);
                      }
                    }}
                    className={`w-32 rounded-cyber border px-2 py-1 font-mono text-left text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20 ${borderClass}`}
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
                        isDuplicate ? 'text-cyber-warning' : 'text-cyber-error'
                      }`}
                    >
                      {errorMessage}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="rounded-cyber px-1.5 py-1 text-cyber-error hover:bg-cyber-error/10 focus:outline-none focus:ring-2 focus:ring-cyber-error/30"
                    onClick={() => removeRow(index)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <p className="mt-2 font-mono text-xs font-medium uppercase tracking-[0.05em] text-content-muted">
        Valid tickets: <span className="text-cyber-hover">{validCount}</span>
      </p>
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
