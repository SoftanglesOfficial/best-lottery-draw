import { FormEvent, useCallback, useEffect, useState } from 'react';
import Badge, { statusBadgeColor } from '../../components/Badge';
import Modal from '../../components/Modal';
import Table, { type TableColumn } from '../../components/Table';
import { useToast } from '../../components/Toast';
import { Button, Input } from '../../components/ui';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { api } from '../../lib/api';
import type { CompanyInput, CompanyRecord, CompanyStatus, UserRecord } from '../../../shared/types';

const EMPTY_FORM: CompanyInput = {
  name: '',
  ownerId: null,
  address: '',
  phone: '',
  email: '',
};

export default function CompaniesPage() {
  const allowed = useRoleGuard(['admin', 'owner']);
  const { showToast } = useToast();
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [owners, setOwners] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyRecord | null>(null);
  const [form, setForm] = useState<CompanyInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [companiesResult, ownersResult] = await Promise.all([
        api.companiesGetAll(),
        api.authGetOwnerAdminUsers(),
      ]);
      if (companiesResult.success) setCompanies(companiesResult.companies);
      else showToast(companiesResult.error, 'error');
      if (ownersResult.success) setOwners(ownersResult.users);
      else showToast(ownersResult.error, 'error');
    } catch {
      showToast(
        'Failed to load companies. Restart the app (Ctrl+C, then npm start).',
        'error',
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (company: CompanyRecord) => {
    setEditing(company);
    setForm({
      name: company.name,
      ownerId: company.ownerId,
      address: company.address ?? '',
      phone: company.phone ?? '',
      email: company.email ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const payload: CompanyInput = {
      name: form.name.trim(),
      ownerId: form.ownerId || null,
      address: form.address?.trim() || null,
      phone: form.phone?.trim() || null,
      email: form.email?.trim() || null,
    };

    const result = editing
      ? await api.companiesUpdate(editing.id, payload)
      : await api.companiesCreate(payload);

    setSaving(false);
    if (result.success) {
      showToast(editing ? 'Company updated' : 'Company created');
      setModalOpen(false);
      void load();
    } else {
      showToast(result.error, 'error');
    }
  };

  const handleClone = async (company: CompanyRecord) => {
    const result = await api.companiesClone(company.id);
    if (result.success) {
      showToast('Company cloned');
      void load();
    } else {
      showToast(result.error, 'error');
    }
  };

  const handleStatus = async (company: CompanyRecord, status: CompanyStatus) => {
    const result = await api.companiesSetStatus(company.id, status);
    if (result.success) {
      showToast(`Status set to ${status}`);
      void load();
    } else {
      showToast(result.error, 'error');
    }
  };

  const handleBillingLock = async (company: CompanyRecord) => {
    const result = await api.companiesSetBillingLock(company.id, !company.billingLocked);
    if (result.success) {
      showToast(company.billingLocked ? 'Billing unlocked' : 'Billing locked');
      void load();
    } else {
      showToast(result.error, 'error');
    }
  };

  const columns: TableColumn<CompanyRecord>[] = [
    { key: 'name', header: 'Name' },
    {
      key: 'ownerName',
      header: 'Owner',
      render: (row) => row.ownerName ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge label={row.status ?? 'unknown'} color={statusBadgeColor(row.status)} />
      ),
    },
    {
      key: 'billingLocked',
      header: 'Billing Lock',
      render: (row) => (
        <Badge
          label={row.billingLocked ? 'Locked' : 'Open'}
          color={row.billingLocked ? 'red' : 'green'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="text-indigo-600 hover:underline" onClick={() => openEdit(row)}>
            Edit
          </button>
          <button type="button" className="text-indigo-600 hover:underline" onClick={() => handleClone(row)}>
            Clone
          </button>
          <select
            className="rounded border border-gray-300 px-2 py-1 text-xs"
            value={row.status ?? 'active'}
            onChange={(e) => handleStatus(row, e.target.value as CompanyStatus)}
          >
            <option value="active">Active</option>
            <option value="locked">Locked</option>
            <option value="frozen">Frozen</option>
          </select>
          <button
            type="button"
            className="text-indigo-600 hover:underline"
            onClick={() => handleBillingLock(row)}
          >
            {row.billingLocked ? 'Unlock Billing' : 'Lock Billing'}
          </button>
        </div>
      ),
    },
  ];

  if (!allowed) return null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Companies</h1>
        <Button type="button" onClick={openCreate}>
          New Company
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <Table columns={columns} data={companies} rowKey={(row) => row.id} />
      )}

      {modalOpen ? (
        <Modal title={editing ? 'Edit Company' : 'New Company'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Owner</span>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.ownerId ?? ''}
                onChange={(e) =>
                  setForm({ ...form, ownerId: e.target.value ? Number(e.target.value) : null })
                }
              >
                <option value="">None</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.fullName ?? owner.username} ({owner.role})
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Address"
              value={form.address ?? ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <Input
              label="Phone"
              value={form.phone ?? ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              value={form.email ?? ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
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
    </div>
  );
}
