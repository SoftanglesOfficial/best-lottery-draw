import { FormEvent, useCallback, useEffect, useState, type ReactNode } from 'react';
import ConfirmDialog from './ConfirmDialog';
import EmptyState from './EmptyState';
import { FullPageLoading, InlineSpinner } from './LoadingSpinner';
import Modal from './Modal';
import Table, { type TableColumn } from './Table';
import { useToast } from './Toast';
import { Button, Input } from './ui';
import { useActiveCompany } from '../lib/useActiveCompany';
import { useRoleGuard } from '../lib/useRoleGuard';

type GroupRecord = {
  id: number;
  name: string;
};

type ListResult<T> =
  | { success: true; groups: T[] }
  | { success: false; error: string };

type MutateResult =
  | { success: true }
  | { success: false; error: string };

type GroupCrudPageProps<T extends GroupRecord> = {
  title: string;
  entityName: string;
  listFn: (companyId: number) => Promise<ListResult<T>>;
  createFn: (data: { name: string; companyId: number }) => Promise<MutateResult>;
  updateFn: (id: number, data: { name: string; companyId: number }) => Promise<MutateResult>;
  deleteFn: (id: number) => Promise<MutateResult>;
  renderExtraActions?: (row: T) => ReactNode;
};

export default function GroupCrudPage<T extends GroupRecord>({
  title,
  entityName,
  listFn,
  createFn,
  updateFn,
  deleteFn,
  renderExtraActions,
}: GroupCrudPageProps<T>) {
  const allowed = useRoleGuard(['admin', 'owner', 'manager']);
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (companyId == null) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await listFn(companyId);
      if (result.success) setRows(result.groups);
      else showToast(result.error, 'error');
    } catch {
      showToast(`Failed to load ${entityName}s. Restart the app (Ctrl+C, then npm start).`, 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, listFn, entityName, showToast]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setModalOpen(true);
  };

  const openEdit = (row: T) => {
    setEditing(row);
    setName(row.name);
    setModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (companyId == null) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), companyId };
      const result = editing
        ? await updateFn(editing.id, payload)
        : await createFn(payload);
      if (result.success) {
        showToast(editing ? `${title.slice(0, -1) || entityName} updated` : `${entityName} created`);
        setModalOpen(false);
        void load();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast(`Failed to save ${entityName}.`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const result = await deleteFn(deleteTarget.id);
      if (result.success) {
        showToast(`${entityName} deleted`);
        setDeleteTarget(null);
        void load();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast(`Failed to delete ${entityName}.`, 'error');
    }
  };

  const columns: TableColumn<T>[] = [
    { key: 'name', header: 'Name' },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="text-indigo-600 hover:underline" onClick={() => openEdit(row)}>
            Edit
          </button>
          <button type="button" className="text-red-600 hover:underline" onClick={() => setDeleteTarget(row)}>
            Delete
          </button>
          {renderExtraActions?.(row)}
        </div>
      ),
    },
  ];

  if (!allowed) return null;

  if (companyId == null) {
    return (
      <div>
        <h1 className="mb-6 text-xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500">Select an active company to manage {entityName}s.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <Button type="button" onClick={openCreate}>
          New {entityName}
        </Button>
      </div>

      {loading ? (
        <FullPageLoading message={`Loading ${entityName}s…`} />
      ) : rows.length === 0 ? (
        <EmptyState entity={entityName} actionLabel={`New ${entityName}`} onAction={openCreate} />
      ) : (
        <Table columns={columns} data={rows} rowKey={(row) => row.id} />
      )}

      {modalOpen ? (
        <Modal title={editing ? `Edit ${entityName}` : `New ${entityName}`} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <div className="mt-2 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <span className="flex items-center gap-2">
                    <InlineSpinner /> Saving…
                  </span>
                ) : editing ? (
                  'Update'
                ) : (
                  'Create'
                )}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          message={`Delete ${entityName} "${deleteTarget.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Delete"
        />
      ) : null}
    </div>
  );
}
