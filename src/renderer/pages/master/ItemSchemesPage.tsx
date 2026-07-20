import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ConfirmDialog from '../../components/ConfirmDialog';
import { FullPageLoading } from '../../components/LoadingSpinner';
import Table, { type TableColumn } from '../../components/Table';
import { useToast } from '../../components/Toast';
import { Button, PageHeader } from '../../components/ui';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { api } from '../../lib/api';
import type { ItemSchemeRecord } from '../../../shared/types';

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

export default function ItemSchemesPage() {
  const allowed = useRoleGuard(['admin', 'owner', 'manager']);
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const itemIdParam = searchParams.get('itemId');
  const filterItemId = itemIdParam ? Number(itemIdParam) : null;

  const [schemes, setSchemes] = useState<ItemSchemeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ItemSchemeRecord | null>(null);

  const load = useCallback(async () => {
    if (companyId == null && filterItemId == null) {
      setSchemes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = filterItemId
        ? await api.itemSchemesListByItem(filterItemId)
        : companyId != null
          ? await api.itemSchemesList(companyId)
          : { success: false as const, error: 'No company selected' };
      if (result.success) setSchemes(result.schemes);
      else showToast(result.error, 'error');
    } catch {
      showToast('Failed to load item schemes.', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, filterItemId, showToast]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const result = await api.itemSchemesDelete(deleteTarget.id);
      if (result.success) {
        showToast('Scheme deleted');
        setDeleteTarget(null);
        void load();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to delete scheme.', 'error');
    }
  };

  const columns: TableColumn<ItemSchemeRecord>[] = [
    { key: 'itemName', header: 'Item', render: (row) => row.itemName ?? '—' },
    {
      key: 'schemeDate',
      header: 'Scheme Date',
      render: (row) => formatDate(row.schemeDate),
    },
    { key: 'drawNo', header: 'Draw No', render: (row) => row.drawNo ?? '—' },
    {
      key: 'prizeCount',
      header: 'Prizes',
      render: (row) => (row.prizeCount != null ? String(row.prizeCount) : '—'),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-cyber px-1.5 py-1 text-cyber-hover outline-none hover:bg-cyber/10 focus-visible:ring-2 focus-visible:ring-cyber/40"
            onClick={() => navigate(`/item-schemes?id=${row.id}`)}
          >
            Edit
          </button>
          <button
            type="button"
            className="rounded-cyber px-1.5 py-1 text-cyber-error outline-none hover:bg-cyber-error/10 focus-visible:ring-2 focus-visible:ring-cyber-error/40"
            onClick={() => setDeleteTarget(row)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  if (!allowed) return null;

  if (companyId == null && filterItemId == null) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Master data" title="Item Schemes" subtitle="Manage prize schemes for lottery items." />
        <div className="rounded-cyber-lg border border-dashed border-line-strong bg-surface-low px-6 py-12 text-center text-sm text-content-subtle">
          Select an active company to manage item schemes.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Master data"
        title="Item Schemes"
        subtitle="Manage prize schemes for lottery items."
        actions={
          <Button type="button" onClick={() => navigate('/item-schemes')}>
            New Scheme
          </Button>
        }
      />

      {filterItemId ? (
        <div className="rounded-cyber border border-cyber-info/30 bg-cyber-info/10 px-4 py-3 text-sm text-cyber-info">
          Showing schemes for item #{filterItemId}
        </div>
      ) : null}

      {loading ? (
        <FullPageLoading message="Loading item schemes…" />
      ) : (
        <Table columns={columns} data={schemes} rowKey={(row) => row.id} />
      )}

      {deleteTarget ? (
        <ConfirmDialog
          message={`Delete scheme for "${deleteTarget.itemName ?? 'item'}" on ${formatDate(deleteTarget.schemeDate)}?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Delete"
        />
      ) : null}
    </div>
  );
}
