import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ConfirmDialog from '../../components/ConfirmDialog';
import Modal from '../../components/Modal';
import Table, { type TableColumn } from '../../components/Table';
import { useToast } from '../../components/Toast';
import { Button, Input } from '../../components/ui';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { api } from '../../lib/api';
import type { ShiftGroupRecord, ShiftInput, ShiftRecord } from '../../../shared/types';

const EMPTY_FORM: ShiftInput = {
  name: '',
  shiftGroupId: 0,
};

export default function ShiftsPage() {
  const allowed = useRoleGuard(['admin', 'owner', 'manager']);
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const groupIdParam = searchParams.get('groupId');

  const [groups, setGroups] = useState<ShiftGroupRecord[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShiftRecord | null>(null);
  const [form, setForm] = useState<ShiftInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadGroups = useCallback(async () => {
    if (companyId == null) return;
    try {
      const result = await api.shiftGroupsList(companyId);
      if (result.success) {
        setGroups(result.groups);
        const paramId = groupIdParam ? Number(groupIdParam) : null;
        const validParam =
          paramId && result.groups.some((g) => g.id === paramId) ? paramId : null;
        setSelectedGroupId((current) => {
          if (validParam) return validParam;
          if (current && result.groups.some((g) => g.id === current)) return current;
          return result.groups[0]?.id ?? null;
        });
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to load shift groups.', 'error');
    }
  }, [companyId, groupIdParam, showToast]);

  const loadShifts = useCallback(async () => {
    if (selectedGroupId == null) {
      setShifts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await api.shiftsList(selectedGroupId);
      if (result.success) setShifts(result.shifts);
      else showToast(result.error, 'error');
    } catch {
      showToast('Failed to load shifts.', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId, showToast]);

  useEffect(() => {
    if (allowed && companyId != null) void loadGroups();
  }, [allowed, companyId, loadGroups]);

  useEffect(() => {
    if (allowed) void loadShifts();
  }, [allowed, loadShifts]);

  const openCreate = () => {
    if (groups.length === 0) {
      showToast('Create a shift group under Master → Shift Groups first.', 'error');
      return;
    }
    setEditing(null);
    setForm({
      name: '',
      shiftGroupId: selectedGroupId ?? groups[0]?.id ?? 0,
    });
    setModalOpen(true);
  };

  const openEdit = (shift: ShiftRecord) => {
    setEditing(shift);
    setForm({ name: shift.name, shiftGroupId: shift.shiftGroupId });
    setModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.shiftGroupId) {
      showToast('Select a shift group.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: ShiftInput = {
        name: form.name.trim(),
        shiftGroupId: form.shiftGroupId,
      };
      const result = editing
        ? await api.shiftsUpdate(editing.id, payload)
        : await api.shiftsCreate(payload);
      if (result.success) {
        showToast(editing ? 'Shift updated' : 'Shift created');
        setModalOpen(false);
        if (!editing || editing.shiftGroupId !== selectedGroupId) {
          setSelectedGroupId(payload.shiftGroupId);
        }
        void loadShifts();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to save shift.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const result = await api.shiftsDelete(deleteTarget.id);
      if (result.success) {
        showToast('Shift deleted');
        setDeleteTarget(null);
        void loadShifts();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to delete shift.', 'error');
    }
  };

  const columns: TableColumn<ShiftRecord>[] = [
    { key: 'name', header: 'Name' },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <button type="button" className="text-indigo-600 hover:underline" onClick={() => openEdit(row)}>
            Edit
          </button>
          <button type="button" className="text-red-600 hover:underline" onClick={() => setDeleteTarget(row)}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  if (!allowed) return null;

  if (companyId == null) {
    return (
      <div>
        <h1 className="mb-6 text-xl font-semibold text-gray-900">Shifts</h1>
        <p className="text-sm text-gray-500">Select an active company to manage shifts.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Shifts</h1>
        <Button type="button" onClick={openCreate}>
          New Shift
        </Button>
      </div>

      <label className="mb-4 flex max-w-xs flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">Shift Group</span>
        <select
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={selectedGroupId ?? ''}
          onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
        >
          {groups.length === 0 ? <option value="">No groups</option> : null}
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <Table columns={columns} data={shifts} rowKey={(row) => row.id} />
      )}

      {modalOpen ? (
        <Modal title={editing ? 'Edit Shift' : 'New Shift'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Shift Group</span>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.shiftGroupId || ''}
                onChange={(e) => setForm({ ...form, shiftGroupId: Number(e.target.value) })}
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
          message={`Delete shift "${deleteTarget.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Delete"
        />
      ) : null}
    </div>
  );
}
