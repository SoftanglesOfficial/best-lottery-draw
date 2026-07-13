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
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
            <th className="px-3 py-2 w-16">Sr No</th>
            <th className="px-3 py-2">From</th>
            <th className="px-3 py-2">To</th>
            <th className="px-3 py-2 w-24">Count</th>
            <th className="px-3 py-2 w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b">
              <td className="px-3 py-2">{index + 1}</td>
              <td className="px-3 py-2">
                <input
                  ref={(el) => {
                    inputRefs.current[index * 2] = el;
                  }}
                  value={row.from}
                  onChange={(event) => updateRow(index, { from: event.target.value.replace(/\D/g, '').slice(0, 5) })}
                  onFocus={() => onActiveRowChange?.(index)}
                  className="w-28 rounded border border-gray-300 px-2 py-1 font-mono text-left"
                  inputMode="numeric"
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
                  className="w-28 rounded border border-gray-300 px-2 py-1 font-mono text-left"
                  inputMode="numeric"
                />
              </td>
              <td className="px-3 py-2 text-right font-mono">{rangeCount(row.from, row.to) || '—'}</td>
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
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-sm font-medium text-gray-700">Total tickets: {totalCount}</p>
    </div>
  );
}

export function rangesToTicketData(rows: RangeRow[]) {
  const ranges = rows
    .filter((row) => row.from && row.to && rangeCount(row.from, row.to) > 0)
    .map((row) => ({
      from: row.from.padStart(5, '0'),
      to: row.to.padStart(5, '0'),
      count: rangeCount(row.from, row.to),
    }));
  return JSON.stringify({ ranges });
}

export function totalRangeCount(rows: RangeRow[]) {
  return rows.reduce((sum, row) => sum + rangeCount(row.from, row.to), 0);
}
