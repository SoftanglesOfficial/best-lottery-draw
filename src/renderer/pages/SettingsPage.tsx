import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import { FullPageLoading, InlineSpinner } from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';
import { Button, Input } from '../components/ui';
import { downloadCsv } from '../lib/exportCsv';
import { useAuth } from '../lib/auth';
import { isAdminOrOwner, isAtLeastRole, ROLE_BADGE_CLASSES, ROLE_LABELS } from '../lib/roles';
import { validate, validators, parseMemoIds } from '../lib/validation';
import { useActiveCompany } from '../lib/useActiveCompany';
import {
  auditLogsList,
  authChangePassword,
  authUpdateUser,
  backupsCreate,
  backupsList,
  backupsRestore,
  buyerGroupsList,
  buyersList,
  dbConnect,
  dbGetConfig,
  dbGetStatus,
  dbSetup,
  dbTestConnection,
  drawsList,
  lanDiscoverServer,
  lanGetStatus,
  lanSetMode,
  lanStartBroadcast,
  lanStopBroadcast,
  prefsGet,
  prefsSetAutoBackup,
  providersList,
  utilitiesBulkRateUpdate,
  utilitiesChangeBuyerRate,
  utilitiesChangeCommission,
  utilitiesChangeProviderRate,
  utilitiesDeleteMemos,
  utilitiesReindex,
} from '../lib/api';
import type { AuditLogListRecord, BackupRecord, DbConfig, UserRole } from '../../shared/types';

type TabId = 'database' | 'backup' | 'audit' | 'profile' | 'utilities';

const TABS: { id: TabId; label: string; minRole?: 'manager' }[] = [
  { id: 'database', label: 'Database Connection' },
  { id: 'backup', label: 'Backup & Restore' },
  { id: 'audit', label: 'Audit Logs' },
  { id: 'profile', label: 'User Profile' },
  { id: 'utilities', label: 'Utilities', minRole: 'manager' },
];

function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

function actionBadgeClass(action: string) {
  if (action === 'DRAW_LOCKED' || action === 'USER_DELETED') return 'bg-red-100 text-red-700';
  if (action === 'DRAW_UNLOCKED') return 'bg-orange-100 text-orange-700';
  if (action === 'USER_CREATED') return 'bg-blue-100 text-blue-700';
  return 'bg-gray-100 text-gray-600';
}

function formatKb(size: number | null | undefined) {
  if (size == null) return '—';
  return `${(size / 1024).toFixed(1)} KB`;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { companyId } = useActiveCompany();

  const tabParam = (searchParams.get('tab') as TabId) || 'database';
  const [activeTab, setActiveTab] = useState<TabId>(tabParam);

  useEffect(() => {
    setActiveTab(tabParam);
  }, [tabParam]);

  const setTab = (id: TabId) => {
    setActiveTab(id);
    setSearchParams({ tab: id });
  };

  const visibleTabs = TABS.filter(
    (tab) => !tab.minRole || (user && isAtLeastRole(user.role, tab.minRole)),
  );

  return (
    <div>
      {!user ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate('/')}
          className="mb-4 inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      ) : null}

      <h1 className="mb-6 text-2xl font-bold text-gray-900">Settings</h1>

        <div className="mb-6 flex flex-wrap gap-1 border-b border-gray-200">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`cursor-pointer px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          {activeTab === 'database' ? <DatabaseTab userRole={user?.role} /> : null}
          {activeTab === 'backup' ? <BackupTab companyId={companyId} userId={user?.id} /> : null}
          {activeTab === 'audit' ? <AuditTab companyId={companyId} /> : null}
          {activeTab === 'profile' ? <ProfileTab user={user} /> : null}
          {activeTab === 'utilities' ? (
            <UtilitiesTab companyId={companyId} userId={user?.id} userRole={user?.role} />
          ) : null}
        </div>
    </div>
  );
}

function DatabaseTab({ userRole }: { userRole?: string }) {
  const { showToast } = useToast();
  const canRunSetup = !userRole || userRole === 'admin';
  const [config, setConfig] = useState<DbConfig>({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '',
    database: 'best12_dev',
  });
  const [connected, setConnected] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [loading, setLoading] = useState<'connect' | 'test' | 'setup' | null>(null);
  const [networkMode, setNetworkMode] = useState<'server' | 'client'>('client');
  const [broadcasting, setBroadcasting] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  const refreshStatus = useCallback(async () => {
    const [status, prefs, lan] = await Promise.all([dbGetStatus(), prefsGet(), lanGetStatus()]);
    setConnected(status.connected);
    setVersion(status.version ?? null);
    if (status.config) setConfig((c) => ({ ...c, ...status.config }));
    setNetworkMode(prefs.networkMode);
    setBroadcasting(lan.isBroadcasting);
  }, []);

  useEffect(() => {
    dbGetConfig().then(setConfig).catch(() => undefined);
    void refreshStatus();
  }, [refreshStatus]);

  const updateField = (field: keyof DbConfig, value: string | number) => {
    setConfig((current) => ({ ...current, [field]: value }));
    setTestStatus('idle');
  };

  const handleTest = async () => {
    setLoading('test');
    setTestStatus('idle');
    try {
      const result = await dbTestConnection(config);
      if (result.success) {
        setTestStatus('ok');
        setTestMessage(result.version.split(',')[0] ?? 'Connected');
        showToast('Connection test successful', 'success');
      } else {
        setTestStatus('fail');
        setTestMessage(result.error);
        showToast(result.error, 'error');
      }
    } catch {
      setTestStatus('fail');
      setTestMessage('Connection test failed');
    } finally {
      setLoading(null);
    }
  };

  const handleConnect = async (event: FormEvent) => {
    event.preventDefault();
    setLoading('connect');
    try {
      const result = await dbConnect(config);
      if (result.success) {
        showToast('Connected successfully', 'success');
        await refreshStatus();
      } else {
        showToast(result.error ?? 'Connection failed', 'error');
      }
    } finally {
      setLoading(null);
    }
  };

  const handleSetup = async () => {
    setLoading('setup');
    try {
      const connectResult = await dbConnect(config);
      if (!connectResult.success) {
        showToast(connectResult.error ?? 'Connection failed', 'error');
        return;
      }
      const setupResult = await dbSetup();
      if (setupResult.success) {
        showToast('Setup complete. Admin: admin / admin123', 'success');
        await refreshStatus();
      } else {
        showToast(setupResult.error ?? 'Setup failed', 'error');
      }
    } finally {
      setLoading(null);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const result = await lanDiscoverServer();
      if (result.success) {
        setConfig((current) => ({
          ...current,
          host: result.host,
          port: result.dbPort,
          database: result.database,
        }));
        showToast(`Found server at ${result.host}`, 'success');
      } else {
        showToast(result.error, 'error');
      }
    } finally {
      setDiscovering(false);
    }
  };

  const handleNetworkMode = async (mode: 'server' | 'client') => {
    const result = await lanSetMode(mode);
    if (result.success) {
      setNetworkMode(mode);
      setBroadcasting(mode === 'server');
      showToast(`LAN mode set to ${mode}`, 'success');
    } else if ('error' in result && result.error) {
      showToast(result.error, 'error');
    }
  };

  const handleStartBroadcast = async () => {
    const result = await lanStartBroadcast();
    if (result.success) {
      setBroadcasting(true);
      showToast('Broadcasting started', 'success');
    } else if ('error' in result && result.error) {
      showToast(result.error, 'error');
    }
  };

  const handleStopBroadcast = async () => {
    await lanStopBroadcast();
    setBroadcasting(false);
    showToast('Broadcasting stopped', 'info');
  };

  return (
    <form onSubmit={handleConnect} className="space-y-6">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <span className="text-sm text-gray-700">
          {connected ? 'Connected' : 'Disconnected'}
        </span>
        {connected && version ? (
          <span className="text-sm text-gray-500">— {version.split(',')[0]}</span>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Host" value={config.host} onChange={(e) => updateField('host', e.target.value)} required />
        <Input label="Port" type="number" value={config.port} onChange={(e) => updateField('port', Number(e.target.value))} required />
        <Input label="User" value={config.user} onChange={(e) => updateField('user', e.target.value)} required />
        <Input label="Password" type="password" value={config.password ?? ''} onChange={(e) => updateField('password', e.target.value)} />
        <Input label="Database" value={config.database} onChange={(e) => updateField('database', e.target.value)} required className="sm:col-span-2" />
      </div>

      {testStatus !== 'idle' ? (
        <p className={`text-sm ${testStatus === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
          Test: {testMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" allowOffline disabled={loading !== null} onClick={() => void handleTest()}>
          {loading === 'test' ? <span className="flex items-center gap-2"><InlineSpinner /> Testing…</span> : 'Test Connection'}
        </Button>
        <Button type="submit" allowOffline disabled={loading !== null}>
          {loading === 'connect' ? 'Connecting…' : 'Save & Connect'}
        </Button>
        {canRunSetup ? (
          <Button type="button" variant="secondary" allowOffline disabled={loading !== null} onClick={() => void handleSetup()}>
            {loading === 'setup' ? 'Setting up…' : 'Setup Tables & Admin'}
          </Button>
        ) : null}
        <Button type="button" variant="secondary" allowOffline disabled={discovering} onClick={() => void handleDiscover()}>
          {discovering ? 'Discovering…' : 'Auto-Discover Server'}
        </Button>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-700">LAN Mode</h3>
        <div className="mb-3 flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="networkMode"
              checked={networkMode === 'server'}
              onChange={() => void handleNetworkMode('server')}
            />
            This PC is the Server
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="networkMode"
              checked={networkMode === 'client'}
              onChange={() => void handleNetworkMode('client')}
            />
            This PC is a Client
          </label>
        </div>
        {networkMode === 'server' ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-600">
              Broadcast: {broadcasting ? 'Active (UDP 41234)' : 'Stopped'}
            </span>
            {broadcasting ? (
              <Button type="button" variant="secondary" allowOffline onClick={() => void handleStopBroadcast()}>
                Stop Broadcasting
              </Button>
            ) : (
              <Button type="button" allowOffline onClick={() => void handleStartBroadcast()}>
                Start Broadcasting
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Use Auto-Discover Server to find the database host on your LAN.
          </p>
        )}
      </div>
    </form>
  );
}

function BackupTab({ companyId, userId }: { companyId?: number | null; userId?: number }) {
  const { showToast } = useToast();
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [autoBackup, setAutoBackup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [backupResult, prefs] = await Promise.all([backupsList(), prefsGet()]);
      if (backupResult.success) setBackups(backupResult.backups);
      setAutoBackup(prefs.autoBackup);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (companyId == null || userId == null) {
      showToast('Open a company first.', 'warning');
      return;
    }
    setCreating(true);
    try {
      const result = await backupsCreate(companyId, userId);
      if (result.success) {
        showToast(`Backup saved: ${result.filename}`, 'success');
        void load();
      } else {
        showToast(result.error ?? 'Backup cancelled', 'error');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async () => {
    if (userId == null) return;
    setRestoring(true);
    try {
      const result = await backupsRestore();
      if (result.success) showToast(result.message, 'success');
      else showToast(result.error ?? 'Restore cancelled', 'error');
    } finally {
      setRestoring(false);
      setConfirmRestore(false);
    }
  };

  const toggleAutoBackup = async () => {
    const next = !autoBackup;
    await prefsSetAutoBackup(next);
    setAutoBackup(next);
    showToast(`Automatic backup ${next ? 'enabled' : 'disabled'}`, 'info');
  };

  if (loading) return <FullPageLoading message="Loading backups…" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void handleCreate()} disabled={creating}>
          {creating ? 'Creating…' : 'Create Backup Now'}
        </Button>
        <Button variant="secondary" onClick={() => setConfirmRestore(true)} disabled={restoring}>
          Restore from File
        </Button>
      </div>

      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" checked={autoBackup} onChange={() => void toggleAutoBackup()} className="h-4 w-4 rounded" />
        <span className="text-sm text-gray-700">Automatic daily backup at 11 PM</span>
      </label>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">Filename</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Triggered By</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((row) => (
              <tr key={row.id} className="border-t border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3">{row.filename}</td>
                <td className="px-4 py-3">{formatKb(row.size)}</td>
                <td className="px-4 py-3">{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs ${row.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {row.status ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3">{row.triggeredByName ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmRestore ? (
        <ConfirmDialog
          message="This will overwrite all current data. Are you sure?"
          onConfirm={() => void handleRestore()}
          onCancel={() => setConfirmRestore(false)}
          confirmLabel="Restore"
        />
      ) : null}
    </div>
  );
}

function AuditTab({ companyId }: { companyId?: number | null }) {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<AuditLogListRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [entity, setEntity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await auditLogsList({
        companyId: companyId ?? undefined,
        entity: entity || undefined,
        dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        dateTo: dateTo ? new Date(`${dateTo}T23:59:59.999`).toISOString() : undefined,
      });
      if (result.success) setLogs(result.logs);
      else showToast(result.error, 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, entity, dateFrom, dateTo, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, load]);

  const exportCsv = () => {
    downloadCsv(
      'audit-logs.csv',
      ['Timestamp', 'User', 'Action', 'Entity', 'Entity ID', 'Details'],
      logs.map((row) => [
        row.timestamp ? new Date(row.timestamp).toLocaleString() : '',
        row.fullName ?? row.username ?? '',
        row.action,
        row.entity,
        row.entityId != null ? String(row.entityId) : '',
        row.details ?? '',
      ]),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Entity</span>
          <select value={entity} onChange={(e) => setEntity(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500">
            <option value="">All</option>
            <option value="draws">Draws</option>
            <option value="transactions">Transactions</option>
            <option value="users">Users</option>
          </select>
        </label>
        <Input label="Date From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input label="Date To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <Button variant="secondary" onClick={() => void load()}>Apply</Button>
        <button type="button" className="flex items-center gap-1 rounded border px-3 py-2 text-sm" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Export CSV
        </button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          Auto-refresh (30s)
        </label>
      </div>

      {loading ? (
        <FullPageLoading message="Loading audit logs…" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Entity ID</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => (
                <tr key={row.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">{row.timestamp ? new Date(row.timestamp).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">{row.fullName ?? row.username ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${actionBadgeClass(row.action)}`}>
                      {row.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.entity}</td>
                  <td className="px-4 py-3">{row.entityId ?? '—'}</td>
                  <td className="px-4 py-3">{row.details ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProfileTab({ user }: { user: ReturnType<typeof useAuth>['user'] }) {
  const { showToast } = useToast();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setFullName(user?.fullName ?? '');
  }, [user]);

  if (!user) {
    return <p className="text-sm text-gray-500">Login to manage your profile.</p>;
  }

  const saveName = async () => {
    setSavingName(true);
    try {
      const result = await authUpdateUser(user.id, { fullName: fullName.trim() });
      if (result.success) showToast('Display name updated', 'success');
      else showToast(result.error, 'error');
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string | null> = {
      current: validate(currentPassword, [validators.required]),
      new: validate(newPassword, [validators.required, (v) => validators.minLength(6)(String(v ?? ''))]),
      confirm: newPassword !== confirmPassword ? 'Passwords do not match' : null,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSavingPassword(true);
    try {
      const result = await authChangePassword(user.id, currentPassword, newPassword);
      if (result.success) {
        showToast('Password changed successfully', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showToast(result.error, 'error');
      }
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-gray-700">Account Info</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-gray-900">{user.fullName ?? user.username}</p>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_CLASSES[user.role]}`}>
            {ROLE_LABELS[user.role]}
          </span>
          <p className="text-sm text-gray-500">@{user.username}</p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-gray-700">Change Display Name</p>
        <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Button onClick={() => void saveName()} disabled={savingName}>
          {savingName ? 'Saving…' : 'Save Name'}
        </Button>
      </div>

      <form onSubmit={savePassword} className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-gray-700">Change Password</p>
        <div>
          <Input label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <FieldError message={errors.current} />
        </div>
        <div>
          <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <FieldError message={errors.new} />
        </div>
        <div>
          <Input label="Confirm New Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          <FieldError message={errors.confirm} />
        </div>
        <Button type="submit" disabled={savingPassword}>
          {savingPassword ? 'Updating…' : 'Change Password'}
        </Button>
      </form>
    </div>
  );
}

function UtilitiesTab({
  companyId,
  userId,
  userRole,
}: {
  companyId?: number | null;
  userId?: number;
  userRole?: UserRole;
}) {
  const { showToast } = useToast();
  const [buyers, setBuyers] = useState<{ id: number; name: string }[]>([]);
  const [providers, setProviders] = useState<{ id: number; name: string }[]>([]);
  const [buyerGroups, setBuyerGroups] = useState<{ id: number; name: string }[]>([]);
  const [draws, setDraws] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [buyerId, setBuyerId] = useState<number | ''>('');
  const [buyerRate, setBuyerRate] = useState('');
  const [providerId, setProviderId] = useState<number | ''>('');
  const [providerRate, setProviderRate] = useState('');
  const [partyType, setPartyType] = useState<'buyer' | 'provider'>('buyer');
  const [partyId, setPartyId] = useState<number | ''>('');
  const [commissionRate, setCommissionRate] = useState('');
  const [bulkGroupId, setBulkGroupId] = useState<number | ''>('');
  const [bulkRate, setBulkRate] = useState('');
  const [memoDrawId, setMemoDrawId] = useState<number | ''>('');
  const [memoInput, setMemoInput] = useState('');
  const [memoPreview, setMemoPreview] = useState<number[]>([]);
  const [confirmMemos, setConfirmMemos] = useState(false);
  const [reindexing, setReindexing] = useState(false);

  useEffect(() => {
    if (companyId == null) {
      setLoading(false);
      return;
    }
    Promise.all([
      buyersList(companyId),
      providersList(companyId),
      buyerGroupsList(companyId),
      drawsList(companyId),
    ])
      .then(([b, p, g, d]) => {
        if (b.success) setBuyers(b.buyers.map((x) => ({ id: x.id, name: x.name })));
        if (p.success) setProviders(p.providers.map((x) => ({ id: x.id, name: x.name })));
        if (g.success) setBuyerGroups(g.groups.map((x) => ({ id: x.id, name: x.name })));
        if (d.success) setDraws(d.draws.map((x) => ({ id: x.id, name: x.name })));
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  if (!userId || !userRole || !isAtLeastRole(userRole, 'manager')) {
    return <p className="text-sm text-gray-500">Manager access required.</p>;
  }

  if (loading) return <FullPageLoading />;

  const applyBuyerRate = async () => {
    if (buyerId === '' || !buyerRate) return;
    const result = await utilitiesChangeBuyerRate(buyerId, Number(buyerRate), userId);
    if (result.success) {
      const name = buyers.find((b) => b.id === buyerId)?.name ?? 'Buyer';
      showToast(`Sale rate for ${name} changed to ₹${buyerRate}`, 'success');
    } else showToast(result.error, 'error');
  };

  const applyProviderRate = async () => {
    if (providerId === '' || !providerRate) return;
    const result = await utilitiesChangeProviderRate(providerId, Number(providerRate), userId);
    if (result.success) {
      const name = providers.find((p) => p.id === providerId)?.name ?? 'Provider';
      showToast(`Purchase rate for ${name} changed to ₹${providerRate}`, 'success');
    } else showToast(result.error, 'error');
  };

  const applyCommission = async () => {
    if (partyId === '' || !commissionRate) return;
    const result = await utilitiesChangeCommission(partyType, partyId, Number(commissionRate), userId);
    if (result.success) showToast('Commission rate updated', 'success');
    else showToast(result.error, 'error');
  };

  const applyBulk = async () => {
    if (bulkGroupId === '' || !bulkRate) return;
    const result = await utilitiesBulkRateUpdate(bulkGroupId, Number(bulkRate), userId);
    if (result.success) showToast(`Updated ${result.updated} buyer(s)`, 'success');
    else showToast(result.error, 'error');
  };

  const previewMemos = () => {
    setMemoPreview(parseMemoIds(memoInput));
  };

  const deleteMemos = async () => {
    if (memoDrawId === '' || memoPreview.length === 0 || !userRole) return;
    const result = await utilitiesDeleteMemos(memoDrawId, memoPreview, userRole);
    if (result.success) {
      showToast(`Deleted ${result.deleted} memo(s)`, 'success');
      setConfirmMemos(false);
      setMemoInput('');
      setMemoPreview([]);
    } else showToast(result.error, 'error');
  };

  const runReindex = async () => {
    setReindexing(true);
    try {
      const result = await utilitiesReindex();
      if (result.success) showToast('Database reindex completed', 'success');
      else showToast(result.error, 'error');
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-700">Rate Management</h2>

        <div className="grid gap-4 rounded-lg border border-gray-200 p-4 md:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Buyer</span>
            <select value={buyerId} onChange={(e) => setBuyerId(Number(e.target.value) || '')} className="w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">Select</option>
              {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <Input label="New Sale Rate" value={buyerRate} onChange={(e) => setBuyerRate(e.target.value)} />
          <div className="flex items-end">
            <Button onClick={() => void applyBuyerRate()}>Apply</Button>
          </div>
        </div>

        <div className="grid gap-4 rounded-lg border border-gray-200 p-4 md:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Provider</span>
            <select value={providerId} onChange={(e) => setProviderId(Number(e.target.value) || '')} className="w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">Select</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <Input label="New Purchase Rate" value={providerRate} onChange={(e) => setProviderRate(e.target.value)} />
          <div className="flex items-end">
            <Button onClick={() => void applyProviderRate()}>Apply</Button>
          </div>
        </div>

        <div className="grid gap-4 rounded-lg border border-gray-200 p-4 md:grid-cols-5">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Party Type</span>
            <select value={partyType} onChange={(e) => setPartyType(e.target.value as 'buyer' | 'provider')} className="w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="buyer">Buyer</option>
              <option value="provider">Provider</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Party</span>
            <select value={partyId} onChange={(e) => setPartyId(Number(e.target.value) || '')} className="w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">Select</option>
              {(partyType === 'buyer' ? buyers : providers).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <Input label="New Commission" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} />
          <div className="flex items-end">
            <Button onClick={() => void applyCommission()}>Apply</Button>
          </div>
        </div>

        <div className="grid gap-4 rounded-lg border border-gray-200 p-4 md:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Buyer Group</span>
            <select value={bulkGroupId} onChange={(e) => setBulkGroupId(Number(e.target.value) || '')} className="w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">Select</option>
              {buyerGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
          <Input label="New Rate for All" value={bulkRate} onChange={(e) => setBulkRate(e.target.value)} />
          <div className="flex items-end">
            <Button onClick={() => void applyBulk()}>Apply to All</Button>
          </div>
        </div>
      </section>

      {userRole && isAdminOrOwner(userRole) ? (
        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-700">Database Utilities</h2>

          <div className="rounded-lg border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-900">Delete Multiple Memos</p>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Draw</span>
                <select value={memoDrawId} onChange={(e) => setMemoDrawId(Number(e.target.value) || '')} className="w-full rounded-md border border-gray-300 px-3 py-2">
                  <option value="">Select draw</option>
                  {draws.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <Input label="Memo IDs (1,2,3 or 1-10)" value={memoInput} onChange={(e) => setMemoInput(e.target.value)} />
              <div className="flex items-end gap-2">
                <Button variant="secondary" onClick={previewMemos}>Preview</Button>
                <Button disabled={memoPreview.length === 0} onClick={() => setConfirmMemos(true)}>Delete</Button>
              </div>
            </div>
            {memoPreview.length > 0 ? (
              <p className="text-sm text-gray-600">This will delete {memoPreview.length} memo(s): {memoPreview.join(', ')}</p>
            ) : null}
          </div>

          <Button variant="secondary" disabled={reindexing} onClick={() => void runReindex()}>
            {reindexing ? 'Reindexing…' : 'Reindex Database'}
          </Button>
        </section>
      ) : null}

      {confirmMemos ? (
        <ConfirmDialog
          message={`This will delete ${memoPreview.length} memo(s). Confirm?`}
          onConfirm={() => void deleteMemos()}
          onCancel={() => setConfirmMemos(false)}
          confirmLabel="Delete Memos"
        />
      ) : null}
    </div>
  );
}
