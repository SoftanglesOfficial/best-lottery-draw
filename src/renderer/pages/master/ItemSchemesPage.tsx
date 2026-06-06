import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ConfirmDialog from '../../components/ConfirmDialog';
import Table, { type TableColumn } from '../../components/Table';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/ui';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import {
  itemSchemesDelete,
  itemSchemesList,
  itemSchemesListByItem,
} from '../../lib/api';
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
        ? await itemSchemesListByItem(filterItemId)
        : companyId != null
          ? await itemSchemesList(companyId)
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
      const result = await itemSchemesDelete(deleteTarget.id);
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
            className="text-indigo-600 hover:underline"
            onClick={() => navigate(`/item-schemes?id=${row.id}`)}
          >
            Edit
          </button>
          <button
            type="button"
            className="text-red-600 hover:underline"
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
      <div>
        <h1 className="mb-6 text-xl font-semibold text-gray-900">Item Schemes</h1>
        <p className="text-sm text-gray-500">Select an active company to manage item schemes.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Item Schemes</h1>
        <Button type="button" onClick={() => navigate('/item-schemes')}>
          New Scheme
        </Button>
      </div>

      {filterItemId ? (
        <p className="mb-4 text-sm text-gray-500">Showing schemes for item #{filterItemId}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
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
