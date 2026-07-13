import { FormEvent, useCallback, useEffect, useState } from 'react';
import Badge, { statusBadgeColor } from '../../components/Badge';
import ConfirmDialog from '../../components/ConfirmDialog';
import Modal from '../../components/Modal';
import Table, { type TableColumn } from '../../components/Table';
import { useToast } from '../../components/Toast';
import { Button, Input } from '../../components/ui';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import {
  buyerGroupsList,
  buyersCreate,
  buyersDelete,
  buyersList,
  buyersUpdate,
} from '../../lib/api';
import type { BuyerGroupRecord, BuyerInput, BuyerRecord, BuyerType, EntityStatus } from '../../../shared/types';

function emptyForm(companyId: number, groupId: number): BuyerInput {
  return {
    name: '',
    buyerGroupId: groupId,
    companyId,
    type: 'stockist',
    saleRate: null,
    commission: null,
    status: 'active',
    phone: '',
    address: '',
  };
}

function formatRate(value: string | null | undefined) {
  if (value == null || value === '') return '—';
  return `₹${value}`;
}

function buyerTypeBadge(type: BuyerType) {
  if (type === 'seller') {
    return (
      <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
        Seller
      </span>
    );
  }
  return <Badge label="Stockist" color="blue" />;
}

export default function BuyersPage() {
  const allowed = useRoleGuard(['admin', 'owner', 'manager']);
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();
  const [buyers, setBuyers] = useState<BuyerRecord[]>([]);
  const [groups, setGroups] = useState<BuyerGroupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BuyerRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BuyerRecord | null>(null);
  const [form, setForm] = useState<BuyerInput | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (companyId == null) {
      setBuyers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [buyersResult, groupsResult] = await Promise.all([
        buyersList(companyId),
        buyerGroupsList(companyId),
      ]);
      if (buyersResult.success) setBuyers(buyersResult.buyers);
      else showToast(buyersResult.error, 'error');
      if (groupsResult.success) setGroups(groupsResult.groups);
      else showToast(groupsResult.error, 'error');
    } catch {
      showToast('Failed to load buyers.', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, showToast]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const openCreate = () => {
    if (companyId == null) return;
    if (groups.length === 0) {
      showToast('Create a buyer group under Master → Buyer Groups first.', 'error');
      return;
    }
    setEditing(null);
    setForm(emptyForm(companyId, groups[0]?.id ?? 0));
    setModalOpen(true);
  };

  const openEdit = (buyer: BuyerRecord) => {
    setEditing(buyer);
    setForm({
      name: buyer.name,
      buyerGroupId: buyer.buyerGroupId,
      companyId: buyer.companyId,
      type: buyer.type,
      saleRate: buyer.saleRate != null ? Number(buyer.saleRate) : null,
      commission: buyer.commission != null ? Number(buyer.commission) : null,
      status: buyer.status ?? 'active',
      phone: buyer.phone ?? '',
      address: buyer.address ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form || companyId == null) return;
    if (!form.buyerGroupId) {
      showToast('Select a buyer group.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: BuyerInput = {
        name: form.name.trim(),
        buyerGroupId: form.buyerGroupId,
        companyId,
        type: form.type,
        saleRate: form.saleRate ?? null,
        commission: form.commission ?? null,
        status: form.status,
        phone: form.phone?.trim() || null,
        address: form.address?.trim() || null,
      };
      const result = editing
        ? await buyersUpdate(editing.id, payload)
        : await buyersCreate(payload);
      if (result.success) {
        showToast(editing ? 'Buyer updated' : 'Buyer created');
        setModalOpen(false);
        void load();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to save buyer.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const result = await buyersDelete(deleteTarget.id);
      if (result.success) {
        showToast('Buyer deleted');
        setDeleteTarget(null);
        void load();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to delete buyer.', 'error');
    }
  };

  const handleToggleStatus = async (buyer: BuyerRecord) => {
    const nextStatus: EntityStatus = buyer.status === 'active' ? 'locked' : 'active';
    try {
      const result = await buyersUpdate(buyer.id, {
        name: buyer.name,
        buyerGroupId: buyer.buyerGroupId,
        companyId: buyer.companyId,
        type: buyer.type,
        saleRate: buyer.saleRate != null ? Number(buyer.saleRate) : null,
        commission: buyer.commission != null ? Number(buyer.commission) : null,
        status: nextStatus,
        phone: buyer.phone,
        address: buyer.address,
      });
      if (result.success) {
        showToast(`Buyer ${nextStatus === 'active' ? 'activated' : 'locked'}`);
        void load();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to update buyer status.', 'error');
    }
  };

  const columns: TableColumn<BuyerRecord>[] = [
    { key: 'name', header: 'Name' },
    {
      key: 'type',
      header: 'Type',
      render: (row) => buyerTypeBadge(row.type),
    },
    { key: 'groupName', header: 'Group', render: (row) => row.groupName ?? '—' },
    {
      key: 'saleRate',
      header: 'Sale Rate',
      render: (row) => formatRate(row.saleRate),
    },
    {
      key: 'commission',
      header: 'Commission',
      render: (row) => formatRate(row.commission),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge label={row.status ?? 'unknown'} color={statusBadgeColor(row.status)} />
      ),
    },
    { key: 'phone', header: 'Phone', render: (row) => row.phone ?? '—' },
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
          <button type="button" className="text-indigo-600 hover:underline" onClick={() => handleToggleStatus(row)}>
            {row.status === 'active' ? 'Lock' : 'Activate'}
          </button>
        </div>
      ),
    },
  ];

  if (!allowed) return null;

  if (companyId == null) {
    return (
      <div>
        <h1 className="mb-6 text-xl font-semibold text-gray-900">Buyers</h1>
        <p className="text-sm text-gray-500">Select an active company to manage buyers.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Buyers</h1>
        <Button type="button" onClick={openCreate}>
          New Buyer
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <Table columns={columns} data={buyers} rowKey={(row) => row.id} />
      )}

      {modalOpen && form ? (
        <Modal title={editing ? 'Edit Buyer' : 'New Buyer'} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Type</span>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.type ?? 'stockist'}
                onChange={(e) => setForm({ ...form, type: e.target.value as BuyerType })}
              >
                <option value="stockist">Stockist</option>
                <option value="seller">Seller</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Group</span>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.buyerGroupId || ''}
                onChange={(e) => setForm({ ...form, buyerGroupId: Number(e.target.value) })}
                required
              >
                <option value="">Select group</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="₹ Sale Rate"
              type="number"
              step="0.01"
              value={form.saleRate ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  saleRate: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
            <Input
              label="₹ Commission"
              type="number"
              step="0.01"
              value={form.commission ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  commission: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Status</span>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.status ?? 'active'}
                onChange={(e) => setForm({ ...form, status: e.target.value as EntityStatus })}
              >
                <option value="active">Active</option>
                <option value="locked">Locked</option>
                <option value="frozen">Frozen</option>
              </select>
            </label>
            <Input
              label="Phone"
              value={form.phone ?? ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              label="Address"
              value={form.address ?? ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <div className="mt-2 flex justify-end gap-3">
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
          message={`Delete buyer "${deleteTarget.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Delete"
        />
      ) : null}
    </div>
  );
}
