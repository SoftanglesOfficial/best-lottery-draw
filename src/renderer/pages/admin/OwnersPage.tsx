import { FormEvent, useCallback, useEffect, useState } from 'react';
import Badge, { roleBadgeColor } from '../../components/Badge';
import Modal from '../../components/Modal';
import Table, { type TableColumn } from '../../components/Table';
import { useToast } from '../../components/Toast';
import { Button, Input, PageHeader } from '../../components/ui';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { api } from '../../lib/api';
import type { CompanyRecord, UserInput, UserRecord } from '../../../shared/types';
import { ROLE_LABELS } from '../../lib/roles';

const EMPTY_OWNER: UserInput = {
  fullName: '',
  username: '',
  password: '',
  role: 'owner',
  companyIds: [],
};

export default function OwnersPage() {
  const allowed = useRoleGuard(['admin']);
  const { showToast } = useToast();
  const [owners, setOwners] = useState<UserRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [assignOwner, setAssignOwner] = useState<UserRecord | null>(null);
  const [assignedIds, setAssignedIds] = useState<number[]>([]);
  const [form, setForm] = useState<UserInput>(EMPTY_OWNER);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ownersResult, companiesResult] = await Promise.all([
        api.authGetOwners(),
        api.companiesGetAll(),
      ]);
      if (ownersResult.success) setOwners(ownersResult.users);
      else showToast(ownersResult.error, 'error');
      if (companiesResult.success) setCompanies(companiesResult.companies);
      else showToast(companiesResult.error, 'error');
    } catch {
      showToast(
        'Failed to load owners. Restart the app (Ctrl+C, then npm start).',
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
    setForm(EMPTY_OWNER);
    setModalOpen(true);
  };

  const openEdit = async (owner: UserRecord) => {
    setEditing(owner);
    const idsResult = await api.authGetUserCompanyIds(owner.id);
    setForm({
      fullName: owner.fullName ?? '',
      username: owner.username,
      password: '',
      role: 'owner',
      companyIds: idsResult.success ? idsResult.companyIds : [],
    });
    setModalOpen(true);
  };

  const openAssign = async (owner: UserRecord) => {
    const idsResult = await api.authGetUserCompanyIds(owner.id);
    setAssignOwner(owner);
    setAssignedIds(idsResult.success ? idsResult.companyIds : []);
  };

  const toggleCompany = async (companyId: number, checked: boolean) => {
    if (!assignOwner) return;
    const fn = checked ? api.userCompaniesAssign : api.userCompaniesRemove;
    const result = await fn(assignOwner.id, companyId);
    if (result.success) {
      setAssignedIds((current) =>
        checked ? [...current, companyId] : current.filter((id) => id !== companyId),
      );
      showToast(checked ? 'Company assigned' : 'Company removed');
    } else {
      showToast(result.error, 'error');
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payload: UserInput = {
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        role: 'owner',
        companyIds: form.companyIds,
        ...(form.password ? { password: form.password } : {}),
      };

      const result = editing
        ? await api.authUpdateUser(editing.id, payload)
        : await api.authCreateUser({ ...payload, password: form.password! });

      if (result.success) {
        showToast(editing ? 'Owner updated' : 'Owner created');
        setModalOpen(false);
        void load();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Request failed. Restart the app and try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumn<UserRecord>[] = [
    { key: 'fullName', header: 'Full Name', render: (row) => row.fullName ?? '—' },
    { key: 'username', header: 'Username' },
    {
      key: 'role',
      header: 'Status',
      render: (row) => (
        <Badge label={ROLE_LABELS[row.role]} color={roleBadgeColor(row.role)} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <button type="button" className="font-medium text-cyber-hover hover:text-cyber-hover hover:underline focus:outline-none focus:ring-2 focus:ring-cyber/30" onClick={() => openEdit(row)}>
            Edit
          </button>
          <button type="button" className="font-medium text-cyber-hover hover:text-cyber-hover hover:underline focus:outline-none focus:ring-2 focus:ring-cyber/30" onClick={() => openAssign(row)}>
            Assign Companies
          </button>
        </div>
      ),
    },
  ];

  if (!allowed) return null;

  return (
    <div className="space-y-4 text-content">
      <PageHeader
        eyebrow="Administration"
        title="Company Owners"
        subtitle="Manage owner accounts and company assignments."
        actions={
          <Button type="button" onClick={openCreate}>
            New Owner
          </Button>
        }
      />

      {loading ? (
        <p className="rounded-cyber border border-line bg-surface-raised px-4 py-8 text-center text-sm text-content-subtle">Loading owners…</p>
      ) : (
        <Table columns={columns} data={owners} rowKey={(row) => row.id} />
      )}

      {modalOpen ? (
        <Modal
          title={editing ? 'Edit Owner' : 'New Owner'}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              label="Full Name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
            <Input
              label="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
            <Input
              label={editing ? 'Password (leave blank to keep)' : 'Password'}
              type="password"
              value={form.password ?? ''}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editing}
            />
            <div className="flex justify-end gap-3 pt-2">
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

      {assignOwner ? (
        <Modal
          title={`Assign Companies — ${assignOwner.fullName ?? assignOwner.username}`}
          onClose={() => setAssignOwner(null)}
          wide
        >
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {companies.map((company) => (
              <label
                key={company.id}
                className="flex cursor-pointer items-center gap-3 rounded-cyber border border-line bg-surface-low px-3 py-2 text-content-muted transition-colors hover:border-cyber/50 hover:bg-surface-high hover:text-content"
              >
                <input
                  type="checkbox"
                  checked={assignedIds.includes(company.id)}
                  onChange={(e) => toggleCompany(company.id, e.target.checked)}
                  className="h-4 w-4 accent-cyber"
                />
                <span className="text-sm">{company.name}</span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="button" onClick={() => setAssignOwner(null)}>
              Done
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
