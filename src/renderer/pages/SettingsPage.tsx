import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import Badge, { roleBadgeColor } from '../components/Badge';
import { FullPageLoading, InlineSpinner } from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';
import { Button, Input, PageHeader } from '../components/ui';
import { downloadCsv } from '../lib/exportCsv';
import { useAuth } from '../lib/auth';
import { isAdminOrOwner, isAtLeastRole, ROLE_LABELS } from '../lib/roles';
import { validate, validators, parseMemoIds } from '../lib/validation';
import { useActiveCompany } from '../lib/useActiveCompany';
import { api } from '../lib/api';
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
  return <p className="mt-1 text-xs text-cyber-error">{message}</p>;
}

function actionBadgeClass(action: string) {
  if (action === 'DRAW_LOCKED' || action === 'USER_DELETED') return 'border border-cyber-error/30 bg-cyber-error/10 text-cyber-error';
  if (action === 'DRAW_UNLOCKED') return 'border border-cyber-warning/30 bg-cyber-warning/10 text-cyber-warning';
  if (action === 'USER_CREATED') return 'border border-cyber/30 bg-cyber/10 text-cyber-hover';
  return 'border border-line bg-surface-high text-content-muted';
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

  const tabParam = user ? (searchParams.get('tab') as TabId) || 'database' : 'database';
  const [activeTab, setActiveTab] = useState<TabId>(tabParam);

  useEffect(() => {
    setActiveTab(tabParam);
  }, [tabParam]);

  const setTab = (id: TabId) => {
    setActiveTab(id);
    setSearchParams({ tab: id });
  };

  const visibleTabs = user
    ? TABS.filter((tab) => !tab.minRole || isAtLeastRole(user.role, tab.minRole))
    : TABS.filter((tab) => tab.id === 'database');

  return (
    <div className={!user ? 'mx-auto w-full max-w-3xl py-4 sm:py-8' : 'space-y-4'}>
      {!user ? (
        <div className="mb-5 flex items-center gap-4">
          <Button
            type="button"
            variant="secondary"
            allowOffline
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold text-content">Settings</h1>
            <p className="mt-1 text-sm text-content-muted">
              Configure the database connection before signing in.
            </p>
          </div>
        </div>
      ) : (
        <PageHeader
          eyebrow="Application"
          title="Settings"
          subtitle="Manage database, backups, audit, profile, and utilities."
        />
      )}

      {user ? (
        <div className="flex flex-wrap gap-1 border-b border-line">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`cursor-pointer px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-cyber text-cyber-hover'
                  : 'text-content-subtle hover:text-content'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="rounded-cyber-lg border border-line-strong bg-surface-raised p-4 sm:p-6">
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
  const canMutateLan = Boolean(userRole && isAtLeastRole(userRole as UserRole, 'manager'));
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
    try {
      const [status, prefs, lan] = await Promise.all([api.dbGetStatus(), api.prefsGet(), api.lanGetStatus()]);
      setConnected(status.connected);
      setVersion(status.version ?? null);
      if (status.config) {
        setConfig((c) => ({
          ...c,
          ...status.config,
          // Redacted status must not wipe a typed password.
          password:
            status.config.password === '********'
              ? c.password
              : (status.config.password ?? c.password),
        }));
      }
      setNetworkMode(prefs.networkMode);
      setBroadcasting(lan.isBroadcasting);
    } catch {
      // ponytail: keep form usable when IPC is down; status banner shows disconnected
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    api.dbGetConfig().then(setConfig).catch(() => undefined);
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
      const result = await api.dbTestConnection(config);
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
      const result = await api.dbConnect(config);
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
      const connectResult = await api.dbConnect(config);
      if (!connectResult.success) {
        showToast(connectResult.error ?? 'Connection failed', 'error');
        return;
      }
      const setupResult = await api.dbSetup();
      if (setupResult.success) {
        showToast(
          'Setup complete. New installs: admin / admin123 (existing admin password unchanged).',
          'success',
        );
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
      const result = await api.lanDiscoverServer();
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
    if (!canMutateLan) {
      showToast('Sign in as manager or higher to change LAN mode.', 'warning');
      return;
    }
    const result = await api.lanSetMode(mode);
    if (result.success) {
      setNetworkMode(mode);
      setBroadcasting(mode === 'server');
      showToast(`LAN mode set to ${mode}`, 'success');
    } else if ('error' in result && result.error) {
      showToast(result.error, 'error');
    }
  };

  const handleStartBroadcast = async () => {
    if (!canMutateLan) {
      showToast('Sign in as manager or higher to control broadcast.', 'warning');
      return;
    }
    const result = await api.lanStartBroadcast();
    if (result.success) {
      setBroadcasting(true);
      showToast('Broadcasting started', 'success');
    } else if ('error' in result && result.error) {
      showToast(result.error, 'error');
    }
  };

  const handleStopBroadcast = async () => {
    if (!canMutateLan) {
      showToast('Sign in as manager or higher to control broadcast.', 'warning');
      return;
    }
    const result = await api.lanStopBroadcast();
    if (result.success) {
      setBroadcasting(false);
      showToast('Broadcasting stopped', 'info');
    } else if ('error' in result && result.error) {
      showToast(result.error, 'error');
    }
  };

  return (
    <form onSubmit={handleConnect} className="space-y-6">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            connected ? 'bg-cyber-success' : 'bg-cyber-error'
          }`}
        />
        <span className="text-sm text-content-muted">
          {connected ? 'Connected' : 'Disconnected'}
        </span>
        {connected && version ? (
          <span className="text-sm text-content-subtle">— {version.split(',')[0]}</span>
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
        <p className={`text-sm ${testStatus === 'ok' ? 'text-cyber-success' : 'text-cyber-error'}`}>
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

      <div className="rounded-cyber border border-line bg-surface-low p-4">
        <h3 className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.05em] text-content-muted">
          LAN Mode
        </h3>
        {!canMutateLan ? (
          <p className="mb-3 text-sm text-content-subtle">
            Sign in as manager or higher to change server/client mode or broadcast.
            Auto-Discover remains available without login.
          </p>
        ) : null}
        <div className="mb-3 flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm text-content-muted">
            <input
              type="radio"
              name="networkMode"
              checked={networkMode === 'server'}
              disabled={!canMutateLan}
              onChange={() => void handleNetworkMode('server')}
              className="accent-cyber"
            />
            This PC is the Server
          </label>
          <label className="flex items-center gap-2 text-sm text-content-muted">
            <input
              type="radio"
              name="networkMode"
              checked={networkMode === 'client'}
              disabled={!canMutateLan}
              onChange={() => void handleNetworkMode('client')}
              className="accent-cyber"
            />
            This PC is a Client
          </label>
        </div>
        {networkMode === 'server' ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-content-muted">
              Broadcast: {broadcasting ? 'Active (UDP 41234)' : 'Stopped'}
            </span>
            {canMutateLan ? (
              broadcasting ? (
                <Button type="button" variant="secondary" allowOffline onClick={() => void handleStopBroadcast()}>
                  Stop Broadcasting
                </Button>
              ) : (
                <Button type="button" allowOffline onClick={() => void handleStartBroadcast()}>
                  Start Broadcasting
                </Button>
              )
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-content-subtle">
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
      const [backupResult, prefs] = await Promise.all([api.backupsList(), api.prefsGet()]);
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
      const result = await api.backupsCreate(companyId, userId);
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
      const result = await api.backupsRestore();
      if (result.success) showToast(result.message, 'success');
      else showToast(result.error ?? 'Restore cancelled', 'error');
    } finally {
      setRestoring(false);
      setConfirmRestore(false);
    }
  };

  const toggleAutoBackup = async () => {
    const next = !autoBackup;
    await api.prefsSetAutoBackup(next);
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
        <input type="checkbox" checked={autoBackup} onChange={() => void toggleAutoBackup()} className="h-4 w-4 rounded accent-cyber" />
        <span className="text-sm text-content-muted">Automatic daily backup at 11 PM</span>
      </label>

      <div className="overflow-x-auto rounded-cyber-lg border border-line">
        <table className="min-w-[720px] w-full text-sm text-content-muted">
          <thead>
            <tr className="bg-surface-high text-left font-mono text-xs font-medium uppercase tracking-wider text-content-muted">
              <th className="px-4 py-3">Filename</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Triggered By</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((row) => (
              <tr key={row.id} className="border-t border-line transition-colors hover:bg-surface-high">
                <td className="px-4 py-3">{row.filename}</td>
                <td className="px-4 py-3">{formatKb(row.size)}</td>
                <td className="px-4 py-3">{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-cyber border px-2 py-0.5 text-xs ${row.status === 'completed' ? 'border-cyber-success/30 bg-cyber-success/10 text-cyber-success' : 'border-cyber-error/30 bg-cyber-error/10 text-cyber-error'}`}>
                    {row.status ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3">{row.triggeredByName ?? '—'}</td>
              </tr>
            ))}
            {backups.length === 0 ? (
              <tr><td colSpan={5} className="border-t border-line px-4 py-8 text-center text-content-subtle">No backup records.</td></tr>
            ) : null}
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
      const result = await api.auditLogsList({
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
          <span className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Entity</span>
          <select value={entity} onChange={(e) => setEntity(e.target.value)} className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20">
            <option value="">All</option>
            <option value="draws">Draws</option>
            <option value="transactions">Transactions</option>
            <option value="users">Users</option>
          </select>
        </label>
        <Input label="Date From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input label="Date To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <Button variant="secondary" onClick={() => void load()}>Apply</Button>
        <button type="button" className="flex items-center gap-2 rounded-cyber border border-line-strong bg-surface-raised px-3 py-2 text-sm font-semibold text-content-muted transition-colors hover:border-cyber hover:text-cyber-hover focus:outline-none focus:ring-2 focus:ring-cyber/30" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Export CSV
        </button>
        <label className="flex items-center gap-2 text-sm text-content-muted">
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="h-4 w-4 accent-cyber" />
          Auto-refresh (30s)
        </label>
      </div>

      {loading ? (
        <FullPageLoading message="Loading audit logs…" />
      ) : (
        <div className="overflow-x-auto rounded-cyber-lg border border-line">
          <table className="min-w-[880px] w-full text-sm text-content-muted">
            <thead>
              <tr className="bg-surface-high text-left font-mono text-xs font-medium uppercase tracking-wider text-content-muted">
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
                <tr key={row.id} className="border-t border-line transition-colors hover:bg-surface-high">
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
              {logs.length === 0 ? (
                <tr><td colSpan={6} className="border-t border-line px-4 py-8 text-center text-content-subtle">No audit logs match these filters.</td></tr>
              ) : null}
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
    return <p className="text-sm text-content-subtle">Login to manage your profile.</p>;
  }

  const saveName = async () => {
    setSavingName(true);
    try {
      const result = await api.authUpdateUser(user.id, { fullName: fullName.trim() });
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
      const result = await api.authChangePassword(user.id, currentPassword, newPassword);
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
        <p className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-cyber-hover">Account Info</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium text-content">{user.fullName ?? user.username}</p>
          <Badge label={ROLE_LABELS[user.role]} color={roleBadgeColor(user.role)} />
          <p className="font-mono text-sm text-content-subtle">@{user.username}</p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-cyber-hover">Change Display Name</p>
        <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Button onClick={() => void saveName()} disabled={savingName}>
          {savingName ? 'Saving…' : 'Save Name'}
        </Button>
      </div>

      <form onSubmit={savePassword} className="space-y-3">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-cyber-hover">Change Password</p>
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
      api.buyersList(companyId),
      api.providersList(companyId),
      api.buyerGroupsList(companyId),
      api.drawsList(companyId),
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
    return <p className="text-sm text-content-subtle">Manager access required.</p>;
  }

  if (loading) return <FullPageLoading />;

  const applyBuyerRate = async () => {
    if (buyerId === '' || !buyerRate) return;
    const result = await api.utilitiesChangeBuyerRate(buyerId, Number(buyerRate), userId);
    if (result.success) {
      const name = buyers.find((b) => b.id === buyerId)?.name ?? 'Buyer';
      showToast(`Sale rate for ${name} changed to ₹${buyerRate}`, 'success');
    } else showToast(result.error, 'error');
  };

  const applyProviderRate = async () => {
    if (providerId === '' || !providerRate) return;
    const result = await api.utilitiesChangeProviderRate(providerId, Number(providerRate), userId);
    if (result.success) {
      const name = providers.find((p) => p.id === providerId)?.name ?? 'Provider';
      showToast(`Purchase rate for ${name} changed to ₹${providerRate}`, 'success');
    } else showToast(result.error, 'error');
  };

  const applyCommission = async () => {
    if (partyId === '' || !commissionRate) return;
    const result = await api.utilitiesChangeCommission(partyType, partyId, Number(commissionRate), userId);
    if (result.success) showToast('Commission rate updated', 'success');
    else showToast(result.error, 'error');
  };

  const applyBulk = async () => {
    if (bulkGroupId === '' || !bulkRate) return;
    const result = await api.utilitiesBulkRateUpdate(bulkGroupId, Number(bulkRate), userId);
    if (result.success) showToast(`Updated ${result.updated} buyer(s)`, 'success');
    else showToast(result.error, 'error');
  };

  const previewMemos = () => {
    setMemoPreview(parseMemoIds(memoInput));
  };

  const deleteMemos = async () => {
    if (memoDrawId === '' || memoPreview.length === 0 || !userRole) return;
    const result = await api.utilitiesDeleteMemos(memoDrawId, memoPreview, userRole);
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
      const result = await api.utilitiesReindex();
      if (result.success) showToast('Database reindex completed', 'success');
      else showToast(result.error, 'error');
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-cyber-hover">Rate Management</h2>

        <div className="grid gap-4 rounded-cyber-lg border border-line bg-surface-low p-4 md:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Buyer</span>
            <select value={buyerId} onChange={(e) => setBuyerId(Number(e.target.value) || '')} className="w-full rounded-cyber border border-line-control bg-canvas px-3 py-2 text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20">
              <option value="">Select</option>
              {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <Input label="New Sale Rate" value={buyerRate} onChange={(e) => setBuyerRate(e.target.value)} />
          <div className="flex items-end">
            <Button onClick={() => void applyBuyerRate()}>Apply</Button>
          </div>
        </div>

        <div className="grid gap-4 rounded-cyber-lg border border-line bg-surface-low p-4 md:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Provider</span>
            <select value={providerId} onChange={(e) => setProviderId(Number(e.target.value) || '')} className="w-full rounded-cyber border border-line-control bg-canvas px-3 py-2 text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20">
              <option value="">Select</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <Input label="New Purchase Rate" value={providerRate} onChange={(e) => setProviderRate(e.target.value)} />
          <div className="flex items-end">
            <Button onClick={() => void applyProviderRate()}>Apply</Button>
          </div>
        </div>

        <div className="grid gap-4 rounded-cyber-lg border border-line bg-surface-low p-4 md:grid-cols-5">
          <label className="text-sm">
            <span className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Party Type</span>
            <select value={partyType} onChange={(e) => setPartyType(e.target.value as 'buyer' | 'provider')} className="w-full rounded-cyber border border-line-control bg-canvas px-3 py-2 text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20">
              <option value="buyer">Buyer</option>
              <option value="provider">Provider</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Party</span>
            <select value={partyId} onChange={(e) => setPartyId(Number(e.target.value) || '')} className="w-full rounded-cyber border border-line-control bg-canvas px-3 py-2 text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20">
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

        <div className="grid gap-4 rounded-cyber-lg border border-line bg-surface-low p-4 md:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Buyer Group</span>
            <select value={bulkGroupId} onChange={(e) => setBulkGroupId(Number(e.target.value) || '')} className="w-full rounded-cyber border border-line-control bg-canvas px-3 py-2 text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20">
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
          <h2 className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-cyber-hover">Database Utilities</h2>

          <div className="space-y-3 rounded-cyber-lg border border-cyber-error/30 bg-cyber-error/5 p-4">
            <p className="text-sm font-medium text-content">Delete Multiple Memos</p>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Draw</span>
                <select value={memoDrawId} onChange={(e) => setMemoDrawId(Number(e.target.value) || '')} className="w-full rounded-cyber border border-line-control bg-canvas px-3 py-2 text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20">
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
              <p className="text-sm text-cyber-warning">This will delete {memoPreview.length} memo(s): {memoPreview.join(', ')}</p>
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
