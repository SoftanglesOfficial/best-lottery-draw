import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../../components/ConfirmDialog';
import Modal from '../../components/Modal';
import Table, { type TableColumn } from '../../components/Table';
import { useToast } from '../../components/Toast';
import { Button, Input } from '../../components/ui';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { api } from '../../lib/api';
import type { ItemGroupRecord, ItemInput, ItemRecord, ShiftGroupRecord } from '../../../shared/types';

function emptyForm(companyId: number, groupId: number): ItemInput {
  return {
    code: '',
    name: '',
    itemGroupId: groupId,
    companyId,
    rate: null,
    mrp: null,
    noOfSeries: null,
    drawTime: '',
    shiftGroupId: null,
    type: '',
    length: null,
    ratePer100: null,
    defaultSeries: '',
  };
}

function formatAmount(value: string | null | undefined) {
  if (value == null || value === '') return '—';
  return `₹${value}`;
}

export default function ItemsPage() {
  const allowed = useRoleGuard(['admin', 'owner', 'manager']);
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [items, setItems] = useState<ItemRecord[]>([]);
  const [itemGroups, setItemGroups] = useState<ItemGroupRecord[]>([]);
  const [shiftGroups, setShiftGroups] = useState<ShiftGroupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ItemRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ItemRecord | null>(null);
  const [form, setForm] = useState<ItemInput | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (companyId == null) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [itemsResult, groupsResult, shiftsResult] = await Promise.all([
        api.itemsList(companyId),
        api.itemGroupsList(companyId),
        api.shiftGroupsList(companyId),
      ]);
      if (itemsResult.success) setItems(itemsResult.items);
      else showToast(itemsResult.error, 'error');
      if (groupsResult.success) setItemGroups(groupsResult.groups);
      else showToast(groupsResult.error, 'error');
      if (shiftsResult.success) setShiftGroups(shiftsResult.groups);
      else showToast(shiftsResult.error, 'error');
    } catch {
      showToast('Failed to load items.', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, showToast]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const openCreate = () => {
    if (companyId == null) return;
    if (itemGroups.length === 0) {
      showToast('Create an item group under Master → Item Groups first.', 'error');
      return;
    }
    setEditing(null);
    setForm(emptyForm(companyId, itemGroups[0]?.id ?? 0));
    setModalOpen(true);
  };

  const openEdit = (item: ItemRecord) => {
    setEditing(item);
    setForm({
      code: item.code ?? '',
      name: item.name,
      itemGroupId: item.itemGroupId,
      companyId: item.companyId,
      rate: item.rate != null ? Number(item.rate) : null,
      mrp: item.mrp != null ? Number(item.mrp) : null,
      noOfSeries: item.noOfSeries,
      drawTime: item.drawTime ?? '',
      shiftGroupId: item.shiftGroupId,
      type: item.type ?? '',
      length: item.length,
      ratePer100: item.ratePer100 != null ? Number(item.ratePer100) : null,
      defaultSeries: item.defaultSeries ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form || companyId == null) return;
    if (!form.itemGroupId) {
      showToast('Select an item group.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: ItemInput = {
        code: form.code?.trim() || null,
        name: form.name.trim(),
        itemGroupId: form.itemGroupId,
        companyId,
        rate: form.rate ?? null,
        mrp: form.mrp ?? null,
        noOfSeries: form.noOfSeries ?? null,
        drawTime: form.drawTime?.trim() || null,
        shiftGroupId: form.shiftGroupId ?? null,
        type: form.type?.trim() || null,
        length: form.length ?? null,
        ratePer100: form.ratePer100 ?? null,
        defaultSeries: form.defaultSeries?.trim() || null,
      };
      const result = editing
        ? await api.itemsUpdate(editing.id, payload)
        : await api.itemsCreate(payload);
      if (result.success) {
        showToast(editing ? 'Item updated' : 'Item created');
        setModalOpen(false);
        void load();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to save item.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const result = await api.itemsDelete(deleteTarget.id);
      if (result.success) {
        showToast('Item deleted');
        setDeleteTarget(null);
        void load();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to delete item.', 'error');
    }
  };

  const columns: TableColumn<ItemRecord>[] = [
    { key: 'code', header: 'Code', render: (row) => row.code ?? '—' },
    { key: 'name', header: 'Name' },
    { key: 'rate', header: 'Rate', render: (row) => formatAmount(row.rate) },
    { key: 'mrp', header: 'MRP', render: (row) => formatAmount(row.mrp) },
    { key: 'groupName', header: 'Group', render: (row) => row.groupName ?? '—' },
    { key: 'drawTime', header: 'Draw Time', render: (row) => row.drawTime ?? '—' },
    {
      key: 'noOfSeries',
      header: 'Series',
      render: (row) => (row.noOfSeries != null ? String(row.noOfSeries) : '—'),
    },
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
          <button
            type="button"
            className="text-indigo-600 hover:underline"
            onClick={() => navigate(`/item-schemes?itemId=${row.id}`)}
          >
            View Schemes
          </button>
        </div>
      ),
    },
  ];

  if (!allowed) return null;

  if (companyId == null) {
    return (
      <div>
        <h1 className="mb-6 text-xl font-semibold text-gray-900">Items</h1>
        <p className="text-sm text-gray-500">Select an active company to manage items.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Items</h1>
        <Button type="button" onClick={openCreate}>
          New Item
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <Table columns={columns} data={items} rowKey={(row) => row.id} />
      )}

      {modalOpen && form ? (
        <Modal title={editing ? 'Edit Item' : 'New Item'} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Code"
              value={form.code ?? ''}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Item Group</span>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.itemGroupId || ''}
                onChange={(e) => setForm({ ...form, itemGroupId: Number(e.target.value) })}
                required
              >
                <option value="">Select group</option>
                {itemGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Shift Group</span>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.shiftGroupId ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    shiftGroupId: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">None</option>
                {shiftGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="₹ Rate"
              type="number"
              step="0.01"
              value={form.rate ?? ''}
              onChange={(e) =>
                setForm({ ...form, rate: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
            <Input
              label="₹ MRP"
              type="number"
              step="0.01"
              value={form.mrp ?? ''}
              onChange={(e) =>
                setForm({ ...form, mrp: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
            <Input
              label="₹ Rate per 100"
              type="number"
              step="0.01"
              value={form.ratePer100 ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  ratePer100: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
            <Input
              label="Draw Time"
              value={form.drawTime ?? ''}
              onChange={(e) => setForm({ ...form, drawTime: e.target.value })}
            />
            <Input
              label="No. of Series"
              type="number"
              value={form.noOfSeries ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  noOfSeries: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
            <Input
              label="Default Series"
              value={form.defaultSeries ?? ''}
              onChange={(e) => setForm({ ...form, defaultSeries: e.target.value })}
            />
            <Input
              label="Length"
              type="number"
              value={form.length ?? ''}
              onChange={(e) =>
                setForm({ ...form, length: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
            <Input
              label="Type"
              value={form.type ?? ''}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            />
            <div className="col-span-full mt-2 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          message={`Delete item "${deleteTarget.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Delete"
        />
      ) : null}
    </div>
  );
}
