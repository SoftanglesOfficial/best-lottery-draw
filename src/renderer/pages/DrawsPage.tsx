import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History } from 'lucide-react';
import Badge, { drawStatusBadgeColor } from '../components/Badge';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import Table, { type TableColumn } from '../components/Table';
import { useToast } from '../components/Toast';
import { Button, Input } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useActiveCompany } from '../lib/useActiveCompany';
import { useRoleGuard } from '../lib/useRoleGuard';
import { isAdminOrOwner, isAtLeastRole } from '../lib/roles';
import { api } from '../lib/api';
import { isDrawClosingWithin } from '../lib/drawCloseTime';
import type { AuditLogRecord, DrawInput, DrawRecord, ItemRecord } from '../../shared/types';

function formatDate(value: Date | string | null | undefined) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB');
}

function formatDateInput(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatAuditTimestamp(value: Date | string | null | undefined) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function emptyForm(companyId: number, itemId: number): DrawInput {
  return {
    name: '',
    companyId,
    itemId,
    drawDate: new Date().toISOString().slice(0, 10),
    closeTime: '',
  };
}

export default function DrawsPage() {
  const allowed = useRoleGuard(['admin', 'owner', 'manager', 'supervisor', 'data_entry']);
  const { user } = useAuth();
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [draws, setDraws] = useState<DrawRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DrawRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DrawRecord | null>(null);
  const [form, setForm] = useState<DrawInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [historyDraw, setHistoryDraw] = useState<DrawRecord | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [extendTarget, setExtendTarget] = useState<DrawRecord | null>(null);
  const [extendNewTime, setExtendNewTime] = useState('');
  const [extendReason, setExtendReason] = useState('');
  const [extending, setExtending] = useState(false);

  const isAdmin = user?.role === 'admin';
  const canUnlock = user ? isAdminOrOwner(user.role) : false;
  const canImportResults = user ? isAtLeastRole(user.role, 'supervisor') : false;

  const openExtendTime = (draw: DrawRecord) => {
    setExtendTarget(draw);
    setExtendNewTime(draw.closeTime ?? '');
    setExtendReason('');
  };

  const handleExtendTime = async (event: FormEvent) => {
    event.preventDefault();
    if (!extendTarget || !user) return;
    setExtending(true);
    try {
      const result = await api.drawsExtendTime(
        extendTarget.id,
        user.id,
        user.role,
        extendNewTime,
        extendReason,
      );
      if (result.success) {
        showToast('Draw close time extended.', 'success');
        setDraws((prev) => prev.map((row) => (row.id === result.draw.id ? result.draw : row)));
        setExtendTarget(null);
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to extend draw time.', 'error');
    } finally {
      setExtending(false);
    }
  };

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (companyId == null) {
      setDraws([]);
      if (!options?.silent) setLoading(false);
      return;
    }
    if (!options?.silent) setLoading(true);
    try {
      const [drawsResult, itemsResult] = await Promise.all([
        api.drawsList(companyId),
        api.itemsList(companyId),
      ]);
      if (drawsResult.success) setDraws(drawsResult.draws);
      else showToast(drawsResult.error, 'error');
      if (itemsResult.success) setItems(itemsResult.items);
      else showToast(itemsResult.error, 'error');
    } catch {
      showToast('Failed to load draws.', 'error');
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [companyId, showToast]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const filteredDraws = useMemo(() => {
    return draws.filter((draw) => {
      if (statusFilter && draw.status !== statusFilter) return false;
      if (itemFilter && String(draw.itemId) !== itemFilter) return false;
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (new Date(draw.drawDate) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(draw.drawDate) > to) return false;
      }
      return true;
    });
  }, [draws, statusFilter, itemFilter, dateFrom, dateTo]);

  const closingSoonCount = useMemo(
    () => draws.filter((draw) => isDrawClosingWithin(draw, 30 * 60 * 1000)).length,
    [draws],
  );

  const openCreate = () => {
    if (companyId == null) return;
    if (items.length === 0) {
      showToast('Add lottery items under Master → Items before creating draws.', 'error');
      return;
    }
    setEditing(null);
    setForm(emptyForm(companyId, items[0]?.id ?? 0));
    setModalOpen(true);
  };

  const openEdit = (draw: DrawRecord) => {
    if (draw.status !== 'open') {
      showToast('Draw is locked', 'error');
      return;
    }
    setEditing(draw);
    setForm({
      name: draw.name,
      companyId: draw.companyId,
      itemId: draw.itemId ?? 0,
      drawDate: formatDateInput(draw.drawDate),
      closeTime: draw.closeTime ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form || companyId == null || !form.itemId) return;
    setSaving(true);
    try {
      const payload: DrawInput = {
        ...form,
        companyId,
        closeTime: form.closeTime?.trim() || null,
        name: form.name?.trim() || undefined,
      };
      const result = editing
        ? await api.drawsUpdate(editing.id, payload)
        : await api.drawsCreate(payload);
      if (result.success) {
        showToast(editing ? 'Draw updated.' : 'Draw created.', 'success');
        setModalOpen(false);
        setDraws((prev) => {
          if (editing) {
            return prev.map((draw) => (draw.id === result.draw.id ? result.draw : draw));
          }
          return [result.draw, ...prev.filter((draw) => draw.id !== result.draw.id)];
        });
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to save draw.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const result = await api.drawsDelete(deleteTarget.id);
    if (result.success) {
      showToast('Draw deleted.', 'success');
      setDraws((prev) => prev.filter((draw) => draw.id !== deleteTarget.id));
      setDeleteTarget(null);
    } else {
      showToast(result.error, 'error');
    }
  };

  const handleLockToggle = async (draw: DrawRecord) => {
    if (!user) return;
    if (draw.status === 'locked') {
      if (!canUnlock) return;
      const result = await api.drawsUnlock(draw.id, draw.updatedAt?.getTime() ?? null);
      if (result.success) {
        showToast('Draw unlocked.', 'success');
        setDraws((prev) =>
          prev.map((row) => (row.id === result.draw.id ? result.draw : row)),
        );
      } else {
        showToast(result.error, 'error');
      }
      return;
    }
    const result = await api.drawsLock(draw.id, user.id, draw.updatedAt?.getTime() ?? null);
    if (result.success) {
      showToast('Draw locked.', 'success');
      setDraws((prev) => prev.map((row) => (row.id === result.draw.id ? result.draw : row)));
    } else {
      showToast(result.error, 'error');
    }
  };

  const handleFindWinners = async (draw: DrawRecord) => {
    const result = await api.winningTicketsFindWinners(draw.id);
    if (result.success) {
      showToast(`Found ${result.count} winning ticket(s).`, 'success');
    } else {
      showToast(result.error, 'error');
    }
  };

  const openHistory = async (draw: DrawRecord) => {
    setHistoryDraw(draw);
    setHistoryLoading(true);
    try {
      const result = await api.drawsAuditList(draw.id);
      if (result.success) setAuditLogs(result.logs);
      else showToast(result.error, 'error');
    } catch {
      showToast('Failed to load history.', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setHistoryDraw(null);
    setAuditLogs([]);
  };

  const columns: TableColumn<DrawRecord>[] = [
    { key: 'name', header: 'Name', render: (row) => row.name },
    { key: 'item', header: 'Item', render: (row) => row.itemName ?? '—' },
    { key: 'drawDate', header: 'Draw Date', render: (row) => formatDate(row.drawDate) },
    { key: 'closeTime', header: 'Close Time', render: (row) => row.closeTime ?? '—' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge label={row.status ?? 'unknown'} color={drawStatusBadgeColor(row.status)} />
      ),
    },
    {
      key: 'resultImported',
      header: 'Result Imported',
      render: (row) => (
        <Badge
          label={row.resultImported ? 'Yes' : 'No'}
          color={row.resultImported ? 'green' : 'gray'}
        />
      ),
    },
    { key: 'lockedBy', header: 'Locked By', render: (row) => row.lockedByName ?? '—' },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        const isLocked = row.status === 'locked';
        const canEdit = row.status === 'open';
        const canDelete = row.status === 'open' && (row.transactionCount ?? 0) === 0;
        const canImport = canImportResults && !(isLocked && row.resultImported);
        const canFindWinners = row.resultImported === true;
        const lockLabel = isLocked ? (canUnlock ? 'Unlock' : 'Locked') : 'Lock';

        return (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-cyber px-1.5 py-1 text-cyber-hover hover:bg-cyber/10 disabled:cursor-not-allowed disabled:text-content-subtle"
              disabled={!canEdit}
              title={!canEdit ? 'Draw is locked' : undefined}
              onClick={() => openEdit(row)}
            >
              Edit
            </button>
            <button
              type="button"
              className="rounded-cyber px-1.5 py-1 text-cyber-error hover:bg-cyber-error/10 disabled:cursor-not-allowed disabled:text-content-subtle"
              disabled={!canDelete}
              title={!canDelete ? (isLocked ? 'Draw is locked' : 'Draw has transactions') : undefined}
              onClick={() => setDeleteTarget(row)}
            >
              Delete
            </button>
            <button
              type="button"
              className="rounded-cyber px-1.5 py-1 text-cyber-hover hover:bg-cyber/10 disabled:cursor-not-allowed disabled:text-content-subtle"
              disabled={!canImport}
              title={!canImport ? 'Results already imported and draw is locked' : undefined}
              onClick={() => navigate(`/draws/${row.id}/results`)}
            >
              Import Results
            </button>
            <button
              type="button"
              className="rounded-cyber px-1.5 py-1 text-cyber-hover hover:bg-cyber/10 disabled:cursor-not-allowed disabled:text-content-subtle"
              disabled={!canFindWinners}
              title={!canFindWinners ? 'Import results first' : undefined}
              onClick={() => void handleFindWinners(row)}
            >
              Find Winners
            </button>
            {(isLocked ? canUnlock : true) && (
              <button
                type="button"
                className="rounded-cyber px-1.5 py-1 text-cyber-warning hover:bg-cyber-warning/10 disabled:cursor-not-allowed disabled:text-content-subtle"
                disabled={isLocked && !canUnlock}
                title={isLocked && !canUnlock ? 'Draw is locked' : undefined}
                onClick={() => void handleLockToggle(row)}
              >
                {lockLabel}
              </button>
            )}
            {isAdmin && row.status === 'open' ? (
              <button
                type="button"
                className="rounded-cyber px-1.5 py-1 text-cyber-hover hover:bg-cyber/10"
                onClick={() => openExtendTime(row)}
              >
                Extend Time
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-cyber p-1.5 text-content-subtle hover:bg-surface-high hover:text-cyber-hover"
              title="History"
              onClick={() => void openHistory(row)}
            >
              <History className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  if (!allowed) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-cyber-hover">Draw lifecycle</p>
          <h1 className="font-display text-2xl font-bold text-content">Draws</h1>
          <p className="mt-1 text-sm text-content-subtle">
            Create, monitor, lock, and process lottery draws.
          </p>
        </div>
        <Button onClick={openCreate} disabled={companyId == null}>
          New Draw
        </Button>
      </div>

      {items.length === 0 && (
        <div className="rounded-cyber border border-cyber-info/40 bg-cyber-info/10 px-4 py-3 text-sm text-cyber-info">
          Create lottery items under Master → Items to enable new draws.
        </div>
      )}

      {closingSoonCount > 0 && (
        <div className="rounded-cyber border border-cyber-warning/40 bg-cyber-warning/10 px-4 py-3 text-sm text-cyber-warning">
          {closingSoonCount} draw{closingSoonCount === 1 ? '' : 's'} closing in the next 30 minutes
        </div>
      )}

      <section className="rounded-cyber-lg border border-line bg-surface-raised p-4">
        <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-content-subtle">
          Filter register
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="From"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-40"
          />
          <Input
            label="To"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-40"
          />
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="locked">Locked</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Item</span>
            <select
              value={itemFilter}
              onChange={(event) => setItemFilter(event.target.value)}
              className="min-w-[160px] rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
            >
              <option value="">All items</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {loading ? (
        <div className="rounded-cyber-lg border border-dashed border-line-strong bg-surface-low py-12 text-center font-mono text-xs uppercase tracking-[0.05em] text-content-subtle" role="status">
          Loading draws…
        </div>
      ) : (
        <Table columns={columns} data={filteredDraws} rowKey={(row) => row.id} />
      )}

      {modalOpen && form ? (
        <Modal title={editing ? 'Edit Draw' : 'New Draw'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Name"
              value={form.name ?? ''}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Auto-generated if left blank"
            />
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Item *</span>
              <select
                required
                value={form.itemId}
                onChange={(event) => setForm({ ...form, itemId: Number(event.target.value) })}
                className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
              >
                <option value={0} disabled>
                  Select item
                </option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Draw Date *"
              type="date"
              required
              value={form.drawDate}
              onChange={(event) => setForm({ ...form, drawDate: event.target.value })}
            />
            <Input
              label="Close Time"
              type="time"
              value={form.closeTime ?? ''}
              onChange={(event) => setForm({ ...form, closeTime: event.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          message={`Delete "${deleteTarget.name}"? This cannot be undone.`}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Delete"
        />
      ) : null}

      {extendTarget ? (
        <Modal title={`Extend Time — ${extendTarget.name}`} onClose={() => setExtendTarget(null)}>
          <form onSubmit={handleExtendTime} className="flex flex-col gap-4">
            <Input
              label="Current Close Time"
              value={extendTarget.closeTime ?? '—'}
              readOnly
            />
            <Input
              label="New Close Time *"
              type="time"
              required
              value={extendNewTime}
              onChange={(event) => setExtendNewTime(event.target.value)}
            />
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Reason *</span>
              <textarea
                required
                value={extendReason}
                onChange={(event) => setExtendReason(event.target.value)}
                className="min-h-[80px] rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none placeholder:text-content-subtle focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                placeholder="Why is the close time being extended?"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setExtendTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={extending}>
                {extending ? 'Saving…' : 'Confirm'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {historyDraw ? (
        <Modal title={`Draw History — ${historyDraw.name}`} onClose={closeHistory}>
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            {historyLoading ? (
              <p className="text-sm text-content-subtle" role="status">Loading…</p>
            ) : auditLogs.length === 0 ? (
              <p className="rounded-cyber border border-dashed border-line-strong bg-surface-low p-6 text-center text-sm text-content-subtle">No audit entries.</p>
            ) : (
              <ul className="space-y-3">
                {auditLogs.map((log) => (
                  <li key={log.id} className="rounded-cyber border border-line bg-surface-low p-3 text-sm">
                    <p className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-cyber-hover">{log.action}</p>
                    <p className="mt-1 text-content-muted">
                      {log.fullName ?? log.username ?? 'Unknown user'}
                    </p>
                    <p className="font-mono text-[10px] text-content-subtle">{formatAuditTimestamp(log.timestamp)}</p>
                    {log.details ? <p className="mt-2 border-t border-line pt-2 text-content-muted">{log.details}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
