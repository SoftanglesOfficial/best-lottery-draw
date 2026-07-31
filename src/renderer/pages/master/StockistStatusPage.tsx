import { useCallback, useEffect, useMemo, useState } from 'react';
import Badge, { statusBadgeColor } from '../../components/Badge';
import { FullPageLoading } from '../../components/LoadingSpinner';
import Table, { type TableColumn } from '../../components/Table';
import { useToast } from '../../components/Toast';
import { Input, PageHeader } from '../../components/ui';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { api } from '../../lib/api';
import type { EntityStatus } from '../../../shared/types';

type StatusFilter = 'all' | EntityStatus;

type StockistStatusRow = {
  key: string;
  name: string;
  type: 'buyer-stockist' | 'buyer-seller' | 'provider';
  status: EntityStatus | null;
};

function typeBadge(type: StockistStatusRow['type']) {
  if (type === 'buyer-seller') {
    return (
      <span className="inline-flex rounded-full border border-cyber/40 bg-cyber/10 px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-cyber-hover">
        Buyer · Seller
      </span>
    );
  }
  if (type === 'buyer-stockist') {
    return <Badge label="Buyer · Stockist" color="blue" />;
  }
  return <Badge label="Provider" color="orange" />;
}

export default function StockistStatusPage() {
  const allowed = useRoleGuard(['admin', 'owner', 'manager']);
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();
  const [rows, setRows] = useState<StockistStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    if (companyId == null) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [buyersResult, providersResult] = await Promise.all([
        api.buyersList(companyId),
        api.providersList(companyId),
      ]);
      if (!buyersResult.success) showToast(buyersResult.error, 'error');
      if (!providersResult.success) showToast(providersResult.error, 'error');

      const combined: StockistStatusRow[] = [];
      if (buyersResult.success) {
        for (const buyer of buyersResult.buyers) {
          combined.push({
            key: `buyer-${buyer.id}`,
            name: buyer.name,
            type: buyer.type === 'seller' ? 'buyer-seller' : 'buyer-stockist',
            status: buyer.status,
          });
        }
      }
      if (providersResult.success) {
        for (const provider of providersResult.providers) {
          combined.push({
            key: `provider-${provider.id}`,
            name: provider.name,
            type: 'provider',
            status: provider.status,
          });
        }
      }
      combined.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      setRows(combined);
    } catch {
      showToast('Failed to load stockist status.', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, showToast]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== 'all' && (row.status ?? 'active') !== statusFilter) return false;
      if (query && !row.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  const columns: TableColumn<StockistStatusRow>[] = [
    { key: 'name', header: 'Name' },
    {
      key: 'type',
      header: 'Type',
      render: (row) => typeBadge(row.type),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge label={row.status ?? 'unknown'} color={statusBadgeColor(row.status)} />
      ),
    },
  ];

  if (!allowed) return null;

  if (companyId == null) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Master data" title="Stockist Status" />
        <div className="rounded-cyber-lg border border-dashed border-line-strong bg-surface-low px-6 py-12 text-center text-sm text-content-subtle">
          Select an active company to view stockist status.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Master data"
        title="Stockist Status"
        subtitle="Monitor buyer and provider account status."
      />

      <div className="flex flex-wrap items-end gap-4 rounded-cyber-lg border border-line bg-surface-raised p-4">
        <Input
          label="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name…"
          className="min-w-[220px] flex-1"
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">
            Status
          </span>
          <select
            className="min-w-[160px] rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="locked">Locked</option>
            <option value="frozen">Frozen</option>
          </select>
        </label>
      </div>

      {loading ? (
        <FullPageLoading message="Loading stockist status…" />
      ) : (
        <Table columns={columns} data={filteredRows} rowKey={(row) => row.key} />
      )}
    </div>
  );
}
