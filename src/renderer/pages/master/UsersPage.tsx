import { FormEvent, useCallback, useEffect, useState } from 'react';
import Badge, { roleBadgeColor } from '../../components/Badge';
import ConfirmDialog from '../../components/ConfirmDialog';
import Modal from '../../components/Modal';
import Table, { type TableColumn } from '../../components/Table';
import { useToast } from '../../components/Toast';
import { Button, Input } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { ROLE_LABELS } from '../../lib/roles';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { api } from '../../lib/api';
import type { CompanyRecord, UserInput, UserRecord, UserRole } from '../../../shared/types';

const MANAGER_ROLES: UserRole[] = ['manager', 'supervisor', 'data_entry'];

const EMPTY_USER: UserInput = {
  fullName: '',
  username: '',
  password: '',
  role: 'data_entry',
  companyIds: [],
};

export default function UsersPage() {
  const allowed = useRoleGuard(['admin', 'owner', 'manager']);
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<UserInput>(EMPTY_USER);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersResult, companiesResult] = await Promise.all([
        api.authGetAllUsers(),
        api.companiesGetAll(),
      ]);
      if (usersResult.success) {
        setUsers(usersResult.users.filter((u: UserRecord) => MANAGER_ROLES.includes(u.role)));
      } else {
        showToast(usersResult.error, 'error');
      }
      if (companiesResult.success) setCompanies(companiesResult.companies);
      else showToast(companiesResult.error, 'error');
    } catch {
      showToast(
        'Failed to load users. Restart the app (Ctrl+C, then npm start).',
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
    setForm(EMPTY_USER);
    setModalOpen(true);
  };

  const openEdit = async (record: UserRecord) => {
    const idsResult = await api.authGetUserCompanyIds(record.id);
    setEditing(record);
    setForm({
      fullName: record.fullName ?? '',
      username: record.username,
      password: '',
      role: record.role,
      companyIds: idsResult.success ? idsResult.companyIds : [],
    });
    setModalOpen(true);
  };

  const toggleCompany = (companyId: number, checked: boolean) => {
    setForm((current) => ({
      ...current,
      companyIds: checked
        ? [...(current.companyIds ?? []), companyId]
        : (current.companyIds ?? []).filter((id) => id !== companyId),
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);

    const payload: UserInput = {
      fullName: form.fullName.trim(),
      username: form.username.trim(),
      role: form.role,
      companyIds: form.companyIds,
      ...(form.password ? { password: form.password } : {}),
    };

    const result = editing
      ? await api.authUpdateUser(editing.id, payload)
      : await api.authCreateUser({ ...payload, password: form.password! });

    setSaving(false);
    if (result.success) {
      showToast(editing ? 'User updated' : 'User created');
      setModalOpen(false);
      void load();
    } else {
      showToast(result.error, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !currentUser) return;
    const result = await api.authDeleteUser(deleteTarget.id, currentUser.id);
    if (result.success) {
      showToast('User deleted');
      setDeleteTarget(null);
      void load();
    } else {
      showToast(result.error, 'error');
    }
  };

  const columns: TableColumn<UserRecord>[] = [
    { key: 'fullName', header: 'Full Name', render: (row) => row.fullName ?? '—' },
    { key: 'username', header: 'Username' },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <Badge label={ROLE_LABELS[row.role]} color={roleBadgeColor(row.role)} />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: () => <Badge label="Active" color="green" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <button type="button" className="text-indigo-600 hover:underline" onClick={() => openEdit(row)}>
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Users</h1>
        <Button type="button" onClick={openCreate}>
          New User
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <Table columns={columns} data={users} rowKey={(row) => row.id} />
      )}

      {modalOpen ? (
        <Modal title={editing ? 'Edit User' : 'New User'} onClose={() => setModalOpen(false)} wide>
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
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Role</span>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              >
                <option value="manager">Manager</option>
                <option value="supervisor">Supervisor</option>
                <option value="data_entry">Data Entry</option>
              </select>
            </label>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Company Assignment</p>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-gray-200 p-3">
                {companies.map((company) => (
                  <label key={company.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(form.companyIds ?? []).includes(company.id)}
                      onChange={(e) => toggleCompany(company.id, e.target.checked)}
                    />
                    {company.name}
                  </label>
                ))}
              </div>
            </div>
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

      {deleteTarget ? (
        <ConfirmDialog
          message={`Delete user "${deleteTarget.fullName ?? deleteTarget.username}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Delete"
        />
      ) : null}
    </div>
  );
}
