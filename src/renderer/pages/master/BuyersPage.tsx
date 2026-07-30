import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import Badge, { statusBadgeColor } from '../../components/Badge';
import ConfirmDialog from '../../components/ConfirmDialog';
import { FullPageLoading } from '../../components/LoadingSpinner';
import Modal from '../../components/Modal';
import Table, { type TableColumn } from '../../components/Table';
import { useToast } from '../../components/Toast';
import { Button, Input, PageHeader } from '../../components/ui';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { api } from '../../lib/api';
import { downloadCsv } from '../../lib/exportCsv';
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
      <span className="inline-flex rounded-full border border-cyber/40 bg-cyber/10 px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-cyber-hover">
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
        api.buyersList(companyId),
        api.buyerGroupsList(companyId),
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
        ? await api.buyersUpdate(editing.id, payload)
        : await api.buyersCreate(payload);
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
      const result = await api.buyersDelete(deleteTarget.id);
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

  const handleExportCsv = () => {
    downloadCsv(
      'buyers.csv',
      ['ID', 'Name', 'Type', 'Group', 'Sale Rate', 'Commission', 'Status', 'Phone', 'Address'],
      buyers.map((row) => [
        String(row.id),
        row.name,
        row.type,
        row.groupName ?? '',
        row.saleRate ?? '',
        row.commission ?? '',
        row.status ?? '',
        row.phone ?? '',
        row.address ?? '',
      ]),
    );
  };

  const handleToggleStatus = async (buyer: BuyerRecord) => {
    const nextStatus: EntityStatus = buyer.status === 'active' ? 'locked' : 'active';
    try {
      const result = await api.buyersUpdate(buyer.id, {
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
          <button type="button" className="rounded-cyber px-1.5 py-1 text-cyber-hover outline-none hover:bg-cyber/10 focus-visible:ring-2 focus-visible:ring-cyber/40" onClick={() => openEdit(row)}>
            Edit
          </button>
          <button type="button" className="rounded-cyber px-1.5 py-1 text-cyber-error outline-none hover:bg-cyber-error/10 focus-visible:ring-2 focus-visible:ring-cyber-error/40" onClick={() => setDeleteTarget(row)}>
            Delete
          </button>
          <button type="button" className="rounded-cyber px-1.5 py-1 text-cyber-hover outline-none hover:bg-cyber/10 focus-visible:ring-2 focus-visible:ring-cyber/40" onClick={() => handleToggleStatus(row)}>
            {row.status === 'active' ? 'Lock' : 'Activate'}
          </button>
        </div>
      ),
    },
  ];

  if (!allowed) return null;

  if (companyId == null) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Master data" title="Buyers" subtitle="Manage buyer records and sales terms." />
        <div className="rounded-cyber-lg border border-dashed border-line-strong bg-surface-low px-6 py-12 text-center text-sm text-content-subtle">
          Select an active company to manage buyers.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Master data"
        title="Buyers"
        subtitle="Manage buyer records and sales terms."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex items-center gap-2"
              onClick={handleExportCsv}
              disabled={loading}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button type="button" onClick={openCreate}>
              New Buyer
            </Button>
          </div>
        }
      />

      {loading ? (
        <FullPageLoading message="Loading buyers…" />
      ) : (
        <Table columns={columns} data={buyers} rowKey={(row) => row.id} />
      )}

      {modalOpen && form ? (
        <Modal title={editing ? 'Edit Buyer' : 'New Buyer'} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Type</span>
              <select
                className="w-full rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                value={form.type ?? 'stockist'}
                onChange={(e) => setForm({ ...form, type: e.target.value as BuyerType })}
              >
                <option value="stockist">Stockist</option>
                <option value="seller">Seller</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Group</span>
              <select
                className="w-full rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
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
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Status</span>
              <select
                className="w-full rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
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
            <div className="mt-2 flex flex-wrap justify-end gap-3 border-t border-line pt-4">
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
