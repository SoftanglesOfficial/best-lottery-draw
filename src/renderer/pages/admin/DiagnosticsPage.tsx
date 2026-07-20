import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { FullPageLoading } from '../../components/LoadingSpinner';
import { PageHeader } from '../../components/ui';
import { useRoleGuard } from '../../lib/useRoleGuard';
import type { DiagnosticsData } from '../../../shared/types';

export default function DiagnosticsPage() {
  const allowed = useRoleGuard(['admin']);
  const [data, setData] = useState<Awaited<ReturnType<typeof api.diagnosticsGet>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allowed) return;
    api.diagnosticsGet()
      .then(setData)
      .finally(() => setLoading(false));
  }, [allowed]);

  if (!allowed) return null;
  if (loading) return <FullPageLoading message="Loading diagnostics…" />;

  if (!data?.success) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Administration" title="System Diagnostics" subtitle="Inspect application health and runtime status." />
        <p className="rounded-cyber border border-cyber-error/40 bg-cyber-error/10 p-4 text-sm text-cyber-error">{data && !data.success ? data.error : 'Unavailable'}</p>
      </div>
    );
  }

  const info: DiagnosticsData = data.data;

  return (
    <div className="space-y-4 text-content">
      <PageHeader eyebrow="Administration" title="System Diagnostics" subtitle="Inspect application health and runtime status." />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-cyber-lg border border-line bg-surface-raised p-4">
            <h2 className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.08em] text-cyber-hover">Database</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-content-subtle">Status</dt>
                <dd className={info.dbConnected ? 'text-cyber-success' : 'text-cyber-error'}>{info.dbConnected ? 'Connected' : 'Disconnected'}</dd>
              </div>
              <div>
                <dt className="text-content-subtle">Version</dt>
                <dd className="break-all">{info.dbVersion ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-content-subtle">Host</dt>
                <dd className="font-mono">{info.dbConfig.host}:{info.dbConfig.port}/{info.dbConfig.database}</dd>
              </div>
            </dl>
        </section>

        <section className="rounded-cyber-lg border border-line bg-surface-raised p-4">
            <h2 className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.08em] text-cyber-hover">Network</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-content-subtle">Mode</dt>
                <dd>{info.networkMode}</dd>
              </div>
              <div>
                <dt className="text-content-subtle">Broadcast</dt>
                <dd>{info.broadcast.isBroadcasting ? 'Active' : 'Stopped'}</dd>
              </div>
              <div>
                <dt className="text-content-subtle">Local IP</dt>
                <dd>{info.broadcast.localIp}</dd>
              </div>
            </dl>
        </section>

        <section className="rounded-cyber-lg border border-line bg-surface-raised p-4">
            <h2 className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.08em] text-cyber-hover">Backup</h2>
            <p className="text-sm">Auto-backup: {info.autoBackup ? 'On' : 'Off'}</p>
            <p className="text-sm">Last backup date: {info.lastBackupDate ?? '—'}</p>
            <p className="text-sm">Last backup record: {info.lastBackupRecordAt ? new Date(info.lastBackupRecordAt).toLocaleString() : '—'}</p>
        </section>

        {info.tableCounts ? (
          <section className="rounded-cyber-lg border border-line bg-surface-raised p-4">
              <h2 className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.08em] text-cyber-hover">Table Counts</h2>
              <ul className="text-sm">
                <li>Users: {info.tableCounts.users}</li>
                <li>Companies: {info.tableCounts.companies}</li>
                <li>Transactions: {info.tableCounts.transactions}</li>
                <li>Draws: {info.tableCounts.draws}</li>
              </ul>
          </section>
        ) : null}

        <section className="rounded-cyber-lg border border-line bg-surface-raised p-4">
            <h2 className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.08em] text-cyber-hover">Runtime</h2>
            <ul className="text-sm">
              <li>App: {info.appVersion}</li>
              <li>Electron: {info.electronVersion}</li>
              <li>Node: {info.nodeVersion}</li>
            </ul>
        </section>

        <section className="rounded-cyber-lg border border-line bg-surface-raised p-4 lg:col-span-2">
            <h2 className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.08em] text-cyber-hover">Active Sessions</h2>
            {info.activeSessions.length === 0 ? (
              <p className="text-sm text-content-subtle">No session records.</p>
            ) : (
              <div className="overflow-x-auto"><table className="min-w-[640px] w-full text-sm">
                <thead>
                  <tr className="text-left font-mono text-xs uppercase text-content-muted">
                    <th className="py-2">User ID</th>
                    <th>Company</th>
                    <th>Last Seen</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {info.activeSessions.map((session) => (
                    <tr key={session.id} className="border-t border-line text-content-muted">
                      <td className="py-2">{session.userId}</td>
                      <td>{session.companyId}</td>
                      <td>{session.lastSeen ? new Date(session.lastSeen).toLocaleString() : '—'}</td>
                      <td>{session.ipAddress ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
        </section>
      </div>
    </div>
  );
}
