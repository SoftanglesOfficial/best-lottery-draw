import { useCallback, useEffect, useState } from 'react';
import Table, { type TableColumn } from '../../components/Table';
import { useToast } from '../../components/Toast';
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
  if (action === 'DRAW_LOCKED') return 'text-red-600 font-medium';
  if (action === 'DRAW_UNLOCKED') return 'text-orange-600 font-medium';
  return 'text-gray-600';
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
    <div className="mx-auto max-w-6xl bg-white">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Audit Logs</h1>

      <div className="mb-6 flex flex-wrap items-end gap-4 border-b bg-gray-50 p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Entity Type</span>
          <select
            value={entity}
            onChange={(event) => setEntity(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          >
            <option value="">All</option>
            <option value="draws">Draws</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Date From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Date To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex min-w-[180px] flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">User</span>
          <select
            value={userId}
            onChange={(event) =>
              setUserId(event.target.value ? Number(event.target.value) : '')
            }
            className="rounded border border-gray-300 px-3 py-2"
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
          className="rounded border px-4 py-2 text-sm"
          onClick={() => void loadLogs()}
        >
          Apply Filters
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading audit logs…</p>
      ) : (
        <Table columns={columns} data={logs} rowKey={(row) => row.id} />
      )}
    </div>
  );
}
