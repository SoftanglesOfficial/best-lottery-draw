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
import type { EntityStatus, ProviderGroupRecord, ProviderInput, ProviderRecord } from '../../../shared/types';

function emptyForm(companyId: number, groupId: number): ProviderInput {
  return {
    name: '',
    providerGroupId: groupId,
    companyId,
    purchaseRate: null,
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

export default function ProvidersPage() {
  const allowed = useRoleGuard(['admin', 'owner', 'manager']);
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [groups, setGroups] = useState<ProviderGroupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProviderRecord | null>(null);
  const [form, setForm] = useState<ProviderInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (companyId == null) {
      setProviders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [providersResult, groupsResult] = await Promise.all([
        api.providersList(companyId),
        api.providerGroupsList(companyId),
      ]);
      if (providersResult.success) setProviders(providersResult.providers);
      else showToast(providersResult.error, 'error');
      if (groupsResult.success) setGroups(groupsResult.groups);
      else showToast(groupsResult.error, 'error');
    } catch {
      showToast('Failed to load providers.', 'error');
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
      showToast('Create a provider group under Master → Provider Groups first.', 'error');
      return;
    }
    setEditing(null);
    setForm(emptyForm(companyId, groups[0]?.id ?? 0));
    setModalOpen(true);
  };

  const openEdit = (provider: ProviderRecord) => {
    setEditing(provider);
    setForm({
      name: provider.name,
      providerGroupId: provider.providerGroupId,
      companyId: provider.companyId,
      purchaseRate: provider.purchaseRate != null ? Number(provider.purchaseRate) : null,
      commission: provider.commission != null ? Number(provider.commission) : null,
      status: provider.status ?? 'active',
      phone: provider.phone ?? '',
      address: provider.address ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form || companyId == null) return;
    if (!form.providerGroupId) {
      showToast('Select a provider group.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: ProviderInput = {
        name: form.name.trim(),
        providerGroupId: form.providerGroupId,
        companyId,
        purchaseRate: form.purchaseRate ?? null,
        commission: form.commission ?? null,
        status: form.status,
        phone: form.phone?.trim() || null,
        address: form.address?.trim() || null,
      };
      const result = editing
        ? await api.providersUpdate(editing.id, payload)
        : await api.providersCreate(payload);
      if (result.success) {
        showToast(editing ? 'Provider updated' : 'Provider created');
        setModalOpen(false);
        void load();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to save provider.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const result = await api.providersDelete(deleteTarget.id);
      if (result.success) {
        showToast('Provider deleted');
        setDeleteTarget(null);
        void load();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to delete provider.', 'error');
    }
  };

  const handleExportCsv = () => {
    downloadCsv(
      'providers.csv',
      ['ID', 'Name', 'Group', 'Purchase Rate', 'Commission', 'Status', 'Phone', 'Address'],
      providers.map((row) => [
        String(row.id),
        row.name,
        row.groupName ?? '',
        row.purchaseRate ?? '',
        row.commission ?? '',
        row.status ?? '',
        row.phone ?? '',
        row.address ?? '',
      ]),
    );
  };

  const handleToggleStatus = async (provider: ProviderRecord) => {
    const nextStatus: EntityStatus = provider.status === 'active' ? 'locked' : 'active';
    try {
      const result = await api.providersUpdate(provider.id, {
        name: provider.name,
        providerGroupId: provider.providerGroupId,
        companyId: provider.companyId,
        purchaseRate: provider.purchaseRate != null ? Number(provider.purchaseRate) : null,
        commission: provider.commission != null ? Number(provider.commission) : null,
        status: nextStatus,
        phone: provider.phone,
        address: provider.address,
      });
      if (result.success) {
        showToast(`Provider ${nextStatus === 'active' ? 'activated' : 'locked'}`);
        void load();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to update provider status.', 'error');
    }
  };

  const columns: TableColumn<ProviderRecord>[] = [
    { key: 'name', header: 'Name' },
    { key: 'groupName', header: 'Group', render: (row) => row.groupName ?? '—' },
    {
      key: 'purchaseRate',
      header: 'Purchase Rate',
      render: (row) => formatRate(row.purchaseRate),
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
        <PageHeader eyebrow="Master data" title="Providers" subtitle="Manage provider records and purchase terms." />
        <div className="rounded-cyber-lg border border-dashed border-line-strong bg-surface-low px-6 py-12 text-center text-sm text-content-subtle">
          Select an active company to manage providers.
        </div>
      </div>
    );
  }

  const filteredProviders = providers.filter((provider) =>
    provider.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Master data"
        title="Providers"
        subtitle="Manage provider records and purchase terms."
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
              New Provider
            </Button>
          </div>
        }
      />

      <Input
        label="Search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name"
      />

      {loading ? (
        <FullPageLoading message="Loading providers…" />
      ) : (
        <Table columns={columns} data={filteredProviders} rowKey={(row) => row.id} />
      )}

      {modalOpen && form ? (
        <Modal title={editing ? 'Edit Provider' : 'New Provider'} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Group</span>
              <select
                className="w-full rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                value={form.providerGroupId || ''}
                onChange={(e) => setForm({ ...form, providerGroupId: Number(e.target.value) })}
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
              label="₹ Purchase Rate"
              type="number"
              step="0.01"
              value={form.purchaseRate ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  purchaseRate: e.target.value === '' ? null : Number(e.target.value),
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
          message={`Delete provider "${deleteTarget.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Delete"
        />
      ) : null}
    </div>
  );
}
