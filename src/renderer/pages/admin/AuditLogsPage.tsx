import { useCallback, useEffect, useState } from 'react';
import Table, { type TableColumn } from '../../components/Table';
import { useToast } from '../../components/Toast';
import { PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import type { AuditLogListRecord, UserRecord } from '../../../shared/types';

function formatTimestamp(value: Date | string | null | undefined) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString();
}

function actionClass(action: string) {
  if (action === 'DRAW_LOCKED') return 'text-cyber-error font-medium';
  if (action === 'DRAW_UNLOCKED') return 'text-cyber-warning font-medium';
  return 'text-content-muted';
}

export default function AuditLogsPage() {
  const allowed = useRoleGuard(['admin', 'owner', 'manager']);
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();

  const [entity, setEntity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userId, setUserId] = useState<number | ''>('');
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [logs, setLogs] = useState<AuditLogListRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allowed || companyId == null) return;
    api.authGetUsers(companyId)
      .then((result) => {
        if (result.success) setUsers(result.users);
      })
      .catch(() => undefined);
  }, [allowed, companyId]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.auditLogsList({
        companyId: companyId ?? undefined,
        entity: entity || undefined,
        dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        dateTo: dateTo ? new Date(`${dateTo}T23:59:59.999`).toISOString() : undefined,
        userId: userId === '' ? undefined : userId,
      });
      if (result.success) {
        setLogs(result.logs);
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to load audit logs.', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, entity, dateFrom, dateTo, userId, showToast]);

  useEffect(() => {
    if (allowed) void loadLogs();
  }, [allowed, loadLogs]);

  useEffect(() => {
    if (!allowed) return;
    const timer = window.setInterval(() => {
      void loadLogs();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [allowed, loadLogs]);

  const columns: TableColumn<AuditLogListRecord>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (row) => formatTimestamp(row.timestamp),
    },
    {
      key: 'user',
      header: 'User',
      render: (row) => row.fullName ?? row.username ?? '—',
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => <span className={actionClass(row.action)}>{row.action}</span>,
    },
    { key: 'entity', header: 'Entity', render: (row) => row.entity },
    {
      key: 'entityId',
      header: 'Entity ID',
      render: (row) => (row.entityId != null ? String(row.entityId) : '—'),
    },
    {
      key: 'details',
      header: 'Details',
      render: (row) => row.details ?? '—',
    },
  ];

  if (!allowed) return null;

  return (
    <div className="space-y-4 text-content">
      <PageHeader
        eyebrow="Administration"
        title="Audit Logs"
        subtitle="Review user activity and system changes."
      />

      <div className="flex flex-wrap items-end gap-4 rounded-cyber-lg border border-line bg-surface-raised p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Entity Type</span>
          <select
            value={entity}
            onChange={(event) => setEntity(event.target.value)}
            className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
          >
            <option value="">All</option>
            <option value="draws">Draws</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Date From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Date To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
          />
        </label>
        <label className="flex min-w-[180px] flex-col gap-1 text-sm">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">User</span>
          <select
            value={userId}
            onChange={(event) =>
              setUserId(event.target.value ? Number(event.target.value) : '')
            }
            className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
          >
            <option value="">All users</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName ?? user.username}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded-cyber border border-cyber bg-cyber px-4 py-2 text-sm font-semibold text-cyber-foreground transition-colors hover:bg-cyber-hover focus:outline-none focus:ring-2 focus:ring-cyber/30"
          onClick={() => void loadLogs()}
        >
          Apply Filters
        </button>
      </div>

      {loading ? (
        <p className="rounded-cyber border border-line bg-surface-raised px-4 py-8 text-center text-sm text-content-subtle">Loading audit logs…</p>
      ) : (
        <Table columns={columns} data={logs} rowKey={(row) => row.id} />
      )}
    </div>
  );
}
