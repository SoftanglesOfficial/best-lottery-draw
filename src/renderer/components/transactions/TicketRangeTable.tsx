import { useEffect, useRef, useState } from 'react';
import { rangeCount } from '../../lib/transactionDisplay';
import { padTicketDigits, sanitizeTicketInput } from '../../lib/ticketAutoComplete';

export type RangeRow = { from: string; to: string };

type TicketRangeTableProps = {
  rows: RangeRow[];
  onChange: (rows: RangeRow[]) => void;
  onActiveRowChange?: (index: number) => void;
  variant?: 'default' | 'blueSpreadsheet';
};

function rowCount(row: RangeRow) {
  const from = padTicketDigits(row.from);
  const to = padTicketDigits(row.to);
  if (!from || !to) return 0;
  return rangeCount(from, to);
}

export default function TicketRangeTable({
  rows,
  onChange,
  onActiveRowChange,
  variant = 'default',
}: TicketRangeTableProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const blueSpreadsheet = variant === 'blueSpreadsheet';
  const blueField =
    'h-7 w-full border border-[#315aa8] bg-[#f7fbff] px-1.5 font-mono text-xs text-[#071b4d] outline-none focus:border-[#ffd447] focus:ring-1 focus:ring-[#ffd447]';
  const setActiveRow = (index: number) => {
    setActiveRowIndex(index);
    onActiveRowChange?.(index);
  };

  const updateRow = (index: number, patch: Partial<RangeRow>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const addRow = (afterIndex: number) => {
    const next = [...rows];
    next.splice(afterIndex + 1, 0, { from: '', to: '' });
    onChange(next);
    setTimeout(() => inputRefs.current[afterIndex + 1]?.focus(), 0);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) {
      onChange([{ from: '', to: '' }]);
      if (blueSpreadsheet) setActiveRow(0);
      return;
    }
    const next = rows.filter((_, i) => i !== index);
    onChange(next);
    const focusIndex = Math.max(0, index - 1);
    if (blueSpreadsheet) setActiveRow(focusIndex);
    setTimeout(() => inputRefs.current[focusIndex]?.focus(), 0);
  };

  const totalCount = rows.reduce((sum, row) => sum + rowCount(row), 0);

  useEffect(() => {
    if (rows.length === 0) onChange([{ from: '', to: '' }]);
  }, [rows.length, onChange]);

  useEffect(() => {
    if (blueSpreadsheet) {
      setActiveRowIndex((current) => Math.min(current, Math.max(0, rows.length - 1)));
    }
  }, [rows.length, blueSpreadsheet]);

  return (
    <div className={blueSpreadsheet ? 'flex h-full min-h-0 flex-col' : undefined}>
      <div
        className={
          blueSpreadsheet
            ? 'min-h-0 flex-1 overflow-auto border border-[#3f68ba] bg-[#071b5d]'
            : 'max-w-full overflow-x-auto rounded-cyber border border-line'
        }
      >
        <table
          className={
            blueSpreadsheet
              ? 'w-full min-w-[520px] table-fixed border-collapse text-xs'
              : 'min-w-[620px] w-full text-sm'
          }
        >
          <thead className={blueSpreadsheet ? 'sticky top-0 z-10 bg-white' : 'bg-surface-high'}>
            <tr
              className={
                blueSpreadsheet
                  ? 'border-b-2 border-[#071b4d] text-left text-[#071b4d]'
                  : 'border-b border-line text-left'
              }
            >
              <th
                className={
                  blueSpreadsheet
                    ? 'w-10 border-r border-[#071b4d] px-1 py-1 text-center text-[10px] font-bold uppercase'
                    : 'w-16 px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'
                }
              >
                {blueSpreadsheet ? 'Sr' : 'Sr No'}
              </th>
              <th
                className={
                  blueSpreadsheet
                    ? 'w-[11%] border-r border-[#071b4d] px-1 py-1 text-[10px] font-bold uppercase'
                    : 'px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'
                }
              >
                From
              </th>
              <th
                className={
                  blueSpreadsheet
                    ? 'w-[11%] border-r border-[#071b4d] px-1 py-1 text-[10px] font-bold uppercase'
                    : 'px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'
                }
              >
                To
              </th>
              <th
                className={
                  blueSpreadsheet
                    ? 'w-12 border-r border-[#071b4d] px-1 py-1 text-right text-[10px] font-bold uppercase'
                    : 'w-24 px-3 py-2 text-right font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'
                }
              >
                Count
              </th>
              <th
                className={
                  blueSpreadsheet
                    ? 'w-12 px-1 py-1 text-center text-[10px] font-bold uppercase'
                    : 'w-24 px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted'
                }
              >
                {blueSpreadsheet ? 'Del' : 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, index) => {
              const count = rowCount(row);
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
                <tr
                  key={index}
                  className={
                    blueSpreadsheet
                      ? `${rowBg} border-b border-[#83a5da]`
                      : 'bg-surface-raised hover:bg-surface-high'
                  }
                >
                  <td
                    className={
                      blueSpreadsheet
                        ? 'border-r border-[#9bb7e1] px-2 py-1 text-center font-mono font-bold'
                        : 'px-3 py-2 font-mono text-content-subtle'
                    }
                  >
                    {index + 1}
                  </td>
                  <td className={blueSpreadsheet ? 'border-r border-[#9bb7e1] px-1.5 py-1' : 'px-3 py-2'}>
                    <input
                      ref={(el) => {
                        inputRefs.current[index * 2] = el;
                      }}
                      value={row.from}
                      onChange={(event) =>
                        updateRow(index, { from: sanitizeTicketInput(event.target.value) })
                      }
                      onBlur={() => {
                        const padded = padTicketDigits(row.from);
                        if (padded && padded !== row.from) updateRow(index, { from: padded });
                      }}
                      onFocus={() =>
                        blueSpreadsheet ? setActiveRow(index) : onActiveRowChange?.(index)
                      }
                      className={
                        blueSpreadsheet
                          ? activeField
                          : 'w-28 rounded-cyber border border-line-control bg-canvas px-2 py-1 font-mono text-left text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20'
                      }
                      inputMode="numeric"
                      aria-label={`Row ${index + 1} from ticket`}
                    />
                  </td>
                  <td className={blueSpreadsheet ? 'border-r border-[#9bb7e1] px-1.5 py-1' : 'px-3 py-2'}>
                    <input
                      ref={(el) => {
                        inputRefs.current[index * 2 + 1] = el;
                      }}
                      value={row.to}
                      onChange={(event) =>
                        updateRow(index, { to: sanitizeTicketInput(event.target.value) })
                      }
                      onBlur={() => {
                        const padded = padTicketDigits(row.to);
                        if (padded && padded !== row.to) updateRow(index, { to: padded });
                      }}
                      onFocus={() =>
                        blueSpreadsheet ? setActiveRow(index) : onActiveRowChange?.(index)
                      }
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
                      className={
                        blueSpreadsheet
                          ? activeField
                          : 'w-28 rounded-cyber border border-line-control bg-canvas px-2 py-1 font-mono text-left text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20'
                      }
                      inputMode="numeric"
                      aria-label={`Row ${index + 1} to ticket`}
                    />
                  </td>
                  <td
                    className={
                      blueSpreadsheet
                        ? 'border-r border-[#9bb7e1] px-2 py-1 text-right font-mono font-bold tabular-nums'
                        : 'px-3 py-2 text-right font-mono tabular-nums text-content'
                    }
                  >
                    {count || '—'}
                  </td>
                  <td className={blueSpreadsheet ? 'px-1.5 py-1 text-center' : 'px-3 py-2'}>
                    <button
                      type="button"
                      className={
                        blueSpreadsheet
                          ? 'cursor-pointer px-1 py-0.5 text-[10px] font-bold uppercase text-[#9e1d32] hover:text-[#c93149] focus:outline-none focus:ring-1 focus:ring-[#ffd447]'
                          : 'rounded-cyber px-1.5 py-1 text-cyber-error hover:bg-cyber-error/10 focus:outline-none focus:ring-2 focus:ring-cyber-error/30'
                      }
                      onClick={() => removeRow(index)}
                    >
                      {blueSpreadsheet ? '×' : 'Delete'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {blueSpreadsheet ? (
            <tfoot>
              <tr className="border-t-2 border-[#8db3f2] bg-[#123d99] font-bold text-white">
                <td colSpan={3} className="px-2 py-2 text-right text-xs uppercase tracking-wide">
                  Totals
                </td>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-[#ffe16a]">
                  {totalCount}
                </td>
                <td className="px-2 py-2" />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {!blueSpreadsheet ? (
        <p className="mt-2 font-mono text-xs font-medium uppercase tracking-[0.05em] text-content-muted">
          Total tickets: <span className="text-cyber-hover">{totalCount}</span>
        </p>
      ) : null}
    </div>
  );
}

export function rangesToTicketData(rows: RangeRow[]) {
  const ranges = rows
    .filter((row) => rowCount(row) > 0)
    .map((row) => {
      const from = padTicketDigits(row.from);
      const to = padTicketDigits(row.to);
      return {
        from,
        to,
        count: rangeCount(from, to),
      };
    });
  return JSON.stringify({ ranges });
}

export function validateTicketRangeRows(rows: RangeRow[]): string | null {
  const validRows = rows.filter((row) => row.from || row.to);
  if (validRows.length === 0) {
    return 'Add at least one ticket range.';
  }
  for (let index = 0; index < validRows.length; index += 1) {
    const row = validRows[index];
    const rowNo = index + 1;
    const from = padTicketDigits(row.from);
    const to = padTicketDigits(row.to);
    if (!from || !to) {
      return `Row ${rowNo}: From and To are required.`;
    }
    if (rangeCount(from, to) <= 0) {
      return `Row ${rowNo}: To must be greater than or equal to From.`;
    }
  }
  if (totalRangeCount(validRows) <= 0) {
    return 'Add at least one valid ticket range.';
  }
  return null;
}

export function totalRangeCount(rows: RangeRow[]) {
  return rows.reduce((sum, row) => sum + rowCount(row), 0);
}
