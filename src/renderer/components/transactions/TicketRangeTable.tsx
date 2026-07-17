import { useEffect, useRef } from 'react';
import { rangeCount } from '../../lib/transactionDisplay';

export type RangeRow = { from: string; to: string };

type TicketRangeTableProps = {
  rows: RangeRow[];
  onChange: (rows: RangeRow[]) => void;
  onActiveRowChange?: (index: number) => void;
};

export default function TicketRangeTable({ rows, onChange, onActiveRowChange }: TicketRangeTableProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

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
      return;
    }
    const next = rows.filter((_, i) => i !== index);
    onChange(next);
    const focusIndex = Math.max(0, index - 1);
    setTimeout(() => inputRefs.current[focusIndex]?.focus(), 0);
  };

  const totalCount = rows.reduce((sum, row) => sum + rangeCount(row.from, row.to), 0);

  useEffect(() => {
    if (rows.length === 0) onChange([{ from: '', to: '' }]);
  }, [rows.length, onChange]);

  return (
    <div>
      <div className="max-w-full overflow-x-auto rounded-cyber border border-line">
        <table className="min-w-[620px] w-full text-sm">
          <thead className="bg-surface-high">
            <tr className="border-b border-line text-left">
              <th className="w-16 px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">Sr No</th>
              <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">From</th>
              <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">To</th>
              <th className="w-24 px-3 py-2 text-right font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">Count</th>
              <th className="w-24 px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-content-muted">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, index) => (
              <tr key={index} className="bg-surface-raised hover:bg-surface-high">
                <td className="px-3 py-2 font-mono text-content-subtle">{index + 1}</td>
              <td className="px-3 py-2">
                <input
                  ref={(el) => {
                    inputRefs.current[index * 2] = el;
                  }}
                  value={row.from}
                  onChange={(event) => updateRow(index, { from: event.target.value.replace(/\D/g, '').slice(0, 5) })}
                  onFocus={() => onActiveRowChange?.(index)}
                  className="w-28 rounded-cyber border border-line-control bg-canvas px-2 py-1 font-mono text-left text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                  inputMode="numeric"
                  aria-label={`Row ${index + 1} from ticket`}
                />
              </td>
              <td className="px-3 py-2">
                <input
                  ref={(el) => {
                    inputRefs.current[index * 2 + 1] = el;
                  }}
                  value={row.to}
                  onChange={(event) => updateRow(index, { to: event.target.value.replace(/\D/g, '').slice(0, 5) })}
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
                  className="w-28 rounded-cyber border border-line-control bg-canvas px-2 py-1 font-mono text-left text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                  inputMode="numeric"
                  aria-label={`Row ${index + 1} to ticket`}
                />
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-content">{rangeCount(row.from, row.to) || '—'}</td>
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
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 font-mono text-xs font-medium uppercase tracking-[0.05em] text-content-muted">
        Total tickets: <span className="text-cyber-hover">{totalCount}</span>
      </p>
    </div>
  );
}

export function rangesToTicketData(rows: RangeRow[]) {
  const ranges = rows
    .filter((row) => row.from.length === 5 && row.to.length === 5 && rangeCount(row.from, row.to) > 0)
    .map((row) => ({
      from: row.from.padStart(5, '0'),
      to: row.to.padStart(5, '0'),
      count: rangeCount(row.from, row.to),
    }));
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
    if (row.from.length !== 5 || row.to.length !== 5) {
      return `Row ${rowNo}: From and To must be 5 digits.`;
    }
    if (rangeCount(row.from, row.to) <= 0) {
      return `Row ${rowNo}: To must be greater than or equal to From.`;
    }
  }
  if (totalRangeCount(validRows) <= 0) {
    return 'Add at least one valid ticket range.';
  }
  return null;
}

export function totalRangeCount(rows: RangeRow[]) {
  return rows.reduce((sum, row) => sum + rangeCount(row.from, row.to), 0);
}
