import type { ReactNode } from 'react';

export type TableColumn<T> = {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
};

type TableProps<T> = {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
};

export default function Table<T>({ columns, data, rowKey }: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="rounded-cyber-lg border border-dashed border-line-strong bg-surface-low py-12 text-center text-sm text-content-subtle">
        No records found
      </div>
    );
  }

  return (
    <div className="max-w-full overflow-x-auto rounded-cyber-lg border border-line bg-surface-raised">
      <table className="min-w-full divide-y divide-line">
        <thead className="border-b border-line bg-surface-high">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="whitespace-nowrap px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.map((row, index) => (
            <tr
              key={rowKey(row)}
              className={
                index % 2 === 0
                  ? 'bg-surface-raised hover:bg-surface-high'
                  : 'bg-surface-low hover:bg-surface-high'
              }
            >
              {columns.map((column) => (
                <td key={column.key} className="whitespace-nowrap px-4 py-3 text-sm text-content-muted">
                  {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
