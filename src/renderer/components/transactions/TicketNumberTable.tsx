import { useRef, useState } from 'react';
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
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
            <th className="w-16 px-3 py-2">Sr No</th>
            <th className="px-3 py-2">Ticket Number</th>
            <th className="w-24 px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isDuplicate =
              isValidTicketNumber(row.number) && duplicateNumbers.has(row.number);
            const showInvalidError =
              blurredRows.has(index) &&
              row.number.length > 0 &&
              !isValidTicketNumber(row.number);

            const borderClass = isDuplicate
              ? 'border-amber-500 bg-amber-50'
              : showInvalidError
                ? 'border-red-500 bg-red-50'
                : 'border-gray-300';

            return (
              <tr key={index} className="border-b">
                <td className="px-3 py-2">{index + 1}</td>
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
                    className={`w-32 rounded border px-2 py-1 font-mono text-right ${borderClass}`}
                    inputMode="numeric"
                    maxLength={TICKET_NUMBER_LENGTH}
                    aria-invalid={showInvalidError || isDuplicate}
                  />
                </td>
                <td className="px-3 py-2">
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
      </table>
      <p className="mt-2 text-sm font-medium text-gray-700">Valid tickets: {validCount}</p>
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
