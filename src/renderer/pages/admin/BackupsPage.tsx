import { useCallback, useEffect, useState } from 'react';
import ConfirmDialog from '../../components/ConfirmDialog';
import Table, { type TableColumn } from '../../components/Table';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/ui';
import { api } from '../../lib/api';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useAuth } from '../../lib/auth';
import { useRoleGuard } from '../../lib/useRoleGuard';
import type { BackupRecord } from '../../../shared/types';

function formatBytes(size: number | null | undefined) {
  if (size == null) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString();
}

export default function BackupsPage() {
  const allowed = useRoleGuard(['admin', 'owner']);
  const { user } = useAuth();
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();

  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.backupsList();
      if (result.success) {
        setBackups(result.backups);
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to load backups.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (allowed) void loadBackups();
  }, [allowed, loadBackups]);

  const handleCreate = async () => {
    if (companyId == null || user == null) return;
    setCreating(true);
    try {
      const result = await api.backupsCreate(companyId, user.id);
      if (result.success) {
        showToast(
          `Backup saved: ${result.filename} (${result.recordCount} records)`,
          'success',
        );
        void loadBackups();
      } else {
        showToast(result.error ?? 'Backup cancelled.', 'error');
      }
    } catch {
      showToast('Backup failed.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async () => {
    if (user == null) return;
    setRestoring(true);
    try {
      const result = await api.backupsRestore();
      if (result.success) {
        showToast(result.message, 'success');
      } else {
        showToast(result.error ?? 'Restore cancelled.', 'error');
      }
    } catch {
      showToast('Restore failed.', 'error');
    } finally {
      setRestoring(false);
      setConfirmRestore(false);
    }
  };

  const columns: TableColumn<BackupRecord>[] = [
    { key: 'filename', header: 'Filename', render: (row) => row.filename },
    {
      key: 'size',
      header: 'Size',
      render: (row) => formatBytes(row.size),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: 'triggeredBy',
      header: 'Triggered By',
      render: (row) => row.triggeredByName ?? (row.triggeredBy != null ? `#${row.triggeredBy}` : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => row.status ?? '—',
    },
  ];

  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-6xl bg-white">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Backups</h1>
        <div className="flex gap-3">
          <Button onClick={() => void handleCreate()} disabled={creating || companyId == null}>
            {creating ? 'Creating…' : 'Create Backup'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setConfirmRestore(true)}
            disabled={restoring}
          >
            {restoring ? 'Restoring…' : 'Restore from Backup'}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading backups…</p>
      ) : (
        <Table columns={columns} data={backups} rowKey={(row) => row.id} />
      )}

      {confirmRestore ? (
        <ConfirmDialog
          message="Restore will replace all data for the company in the backup file. Continue?"
          onConfirm={() => void handleRestore()}
          onCancel={() => setConfirmRestore(false)}
          confirmLabel="Restore"
        />
      ) : null}
    </div>
  );
}
