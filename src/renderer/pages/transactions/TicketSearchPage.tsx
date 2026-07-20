import { FormEvent, useState } from 'react';
import Table, { type TableColumn } from '../../components/Table';
import { useToast } from '../../components/Toast';
import { Button, Input, PageHeader } from '../../components/ui';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { api } from '../../lib/api';
import type { TicketSearchResult } from '../../../shared/types';

function formatDate(value: Date | string | null | undefined) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB');
}

function formatAmount(value: string | null | undefined) {
  if (value == null || value === '') return '—';
  return `₹${value}`;
}

export default function TicketSearchPage() {
  const allowed = useRoleGuard(['admin', 'owner', 'manager', 'supervisor', 'data_entry']);
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();

  const [ticketNumber, setTicketNumber] = useState('');
  const [results, setResults] = useState<TicketSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (companyId == null) return;
    const query = ticketNumber.trim();
    if (!query) {
      showToast('Enter a ticket number.', 'error');
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const result = await api.transactionsSearchTicket(companyId, query);
      if (result.success) setResults(result.results);
      else showToast(result.error, 'error');
    } catch {
      showToast('Search failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const columns: TableColumn<TicketSearchResult>[] = [
    { key: 'drawName', header: 'Draw Name', render: (row) => row.drawName ?? '—' },
    { key: 'drawDate', header: 'Date', render: (row) => formatDate(row.drawDate) },
    { key: 'buyerName', header: 'Buyer', render: (row) => row.buyerName ?? '—' },
    { key: 'type', header: 'Type', render: (row) => row.type },
    { key: 'amount', header: 'Amount', render: (row) => formatAmount(row.amount) },
    { key: 'ticketNumber', header: 'Ticket', render: (row) => row.ticketNumber },
  ];

  if (!allowed) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Transaction lookup"
        title="Ticket Search"
        subtitle="Locate a ticket across sales and bookings."
      />

      <form
        onSubmit={handleSearch}
        className="flex max-w-2xl flex-wrap items-end gap-3 rounded-cyber-lg border border-line bg-surface-raised p-4"
        aria-label="Ticket search"
      >
        <Input
          label="Ticket Number"
          value={ticketNumber}
          onChange={(event) => setTicketNumber(event.target.value)}
          placeholder="Enter ticket number"
          className="min-w-[240px] flex-1"
        />
        <Button type="submit" disabled={loading || companyId == null}>
          {loading ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {loading ? (
        <div className="rounded-cyber-lg border border-dashed border-line-strong bg-surface-low py-10 text-center font-mono text-xs uppercase tracking-[0.05em] text-content-subtle" role="status">Searching…</div>
      ) : searched ? (
        <Table columns={columns} data={results} rowKey={(row) => `${row.id}-${row.ticketNumber}`} />
      ) : (
        <div className="rounded-cyber-lg border border-dashed border-line-strong bg-surface-low py-10 text-center font-mono text-xs uppercase tracking-[0.05em] text-content-subtle">
          Search for a ticket number.
        </div>
      )}
    </div>
  );
}
