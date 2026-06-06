import { useEffect, useState } from 'react';
import { diagnosticsGet } from '../../lib/api';
import { FullPageLoading } from '../../components/LoadingSpinner';
import { useRoleGuard } from '../../lib/useRoleGuard';
import type { DiagnosticsData } from '../../../shared/types';

export default function DiagnosticsPage() {
  const allowed = useRoleGuard(['admin']);
  const [data, setData] = useState<Awaited<ReturnType<typeof diagnosticsGet>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allowed) return;
    diagnosticsGet()
      .then(setData)
      .finally(() => setLoading(false));
  }, [allowed]);

  if (!allowed) return null;
  if (loading) return <FullPageLoading message="Loading diagnostics…" />;

  if (!data?.success) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-xl font-semibold text-gray-900">System Diagnostics</h1>
        <p className="text-sm text-red-600">{data && !data.success ? data.error : 'Unavailable'}</p>
      </div>
    );
  }

  const info: DiagnosticsData = data.data;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">System Diagnostics</h1>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-700">Database</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd>{info.dbConnected ? 'Connected' : 'Disconnected'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Version</dt>
                <dd className="break-all">{info.dbVersion ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Host</dt>
                <dd>{info.dbConfig.host}:{info.dbConfig.port}/{info.dbConfig.database}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-700">Network</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-gray-500">Mode</dt>
                <dd>{info.networkMode}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Broadcast</dt>
                <dd>{info.broadcast.isBroadcasting ? 'Active' : 'Stopped'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Local IP</dt>
                <dd>{info.broadcast.localIp}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-700">Backup</h2>
            <p className="text-sm">Auto-backup: {info.autoBackup ? 'On' : 'Off'}</p>
            <p className="text-sm">Last backup date: {info.lastBackupDate ?? '—'}</p>
            <p className="text-sm">Last backup record: {info.lastBackupRecordAt ? new Date(info.lastBackupRecordAt).toLocaleString() : '—'}</p>
          </section>

          {info.tableCounts ? (
            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-700">Table Counts</h2>
              <ul className="text-sm">
                <li>Users: {info.tableCounts.users}</li>
                <li>Companies: {info.tableCounts.companies}</li>
                <li>Transactions: {info.tableCounts.transactions}</li>
                <li>Draws: {info.tableCounts.draws}</li>
              </ul>
            </section>
          ) : null}

          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-700">Runtime</h2>
            <ul className="text-sm">
              <li>App: {info.appVersion}</li>
              <li>Electron: {info.electronVersion}</li>
              <li>Node: {info.nodeVersion}</li>
            </ul>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-700">Active Sessions</h2>
            {info.activeSessions.length === 0 ? (
              <p className="text-sm text-gray-500">No session records.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500">
                    <th className="py-2">User ID</th>
                    <th>Company</th>
                    <th>Last Seen</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {info.activeSessions.map((session) => (
                    <tr key={session.id} className="border-t">
                      <td className="py-2">{session.userId}</td>
                      <td>{session.companyId}</td>
                      <td>{session.lastSeen ? new Date(session.lastSeen).toLocaleString() : '—'}</td>
                      <td>{session.ipAddress ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
    </div>
  );
}
