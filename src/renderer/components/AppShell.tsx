import {
  Building2,
  Circle,
  Clock3,
  LayoutDashboard,
  LogOut,
  Settings,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import CompanySwitcher from './CompanySwitcher';
import { useDbConnection } from '../lib/ConnectionContext';
import { useActiveUserCount } from '../lib/useActiveUserCount';
import { useAuth } from '../lib/auth';
import { buildNavigation, isNavItemActive, type NavItem } from '../lib/navigation';
import { ROLE_LABELS } from '../lib/roles';

function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <time dateTime={now.toISOString()} className="flex gap-3 tabular-nums">
      <span>{now.toLocaleDateString([], { dateStyle: 'medium' })}</span>
      <span>
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </time>
  );
}

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  const location = useLocation();

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <p className="mb-1.5 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-content-subtle">{title}</p>
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = isNavItemActive(item.path, location.pathname);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`group flex items-center gap-2 rounded-cyber border px-3 py-2 text-[13px] font-medium transition-colors ${
                active
                  ? 'border-cyber/50 bg-cyber-soft text-content'
                  : 'border-transparent text-content-muted hover:border-line hover:bg-surface-high hover:text-content'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  active
                    ? 'bg-cyber shadow-[0_0_8px_var(--mc-primary)]'
                    : 'bg-line-strong group-hover:bg-content-subtle'
                }`}
              />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

export default function AppShell() {
  const { user, activeCompanyName, activeShift, logout } = useAuth();
  const location = useLocation();
  const { isConnected, reconnect } = useDbConnection();
  const activeUsers = useActiveUserCount();

  const isSettingsRoute = location.pathname === '/settings';
  const isMenuRoute = location.pathname === '/menu';
  const isSaleEntryRoute = location.pathname === '/transactions/sale-entry';
  const isSelectionRoute =
    location.pathname === '/open-company' || location.pathname === '/open-shift';

  if (!user) {
    if (isSettingsRoute) {
      return (
        <div className="min-h-screen bg-canvas text-content">
          <main className="mc-legacy-content print-full-width mx-auto max-w-5xl p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      );
    }
    return null;
  }

  if (isSelectionRoute) {
    return (
      <main>
        <Outlet />
      </main>
    );
  }

  if (isSaleEntryRoute) {
    return (
      <div className="h-screen min-w-[1024px] overflow-hidden">
        <main className="h-full overflow-hidden">
          <Outlet />
        </main>
      </div>
    );
  }

  const navigation = buildNavigation(user.role);

  return (
    <div className="mc-app-frame flex h-screen min-w-[1024px] flex-col bg-canvas text-content">
      <header className="no-print flex h-11 shrink-0 items-center border-b border-line bg-surface px-4">
        <div className="flex min-w-[190px] items-center gap-2">
          <span className="h-2.5 w-2.5 rounded border-2 border-cyber shadow-[0_0_10px_rgba(124,92,252,0.35)]" />
          <span className="font-display text-sm font-bold uppercase tracking-[0.08em] text-content">
            Best-<span className="text-cyber">12</span>
          </span>
          <span className="hidden border-l border-line pl-2 font-mono text-[10px] uppercase tracking-[0.05em] text-content-subtle xl:inline">
            Morning Booking
          </span>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-4 px-4 text-sm text-content-muted">
          {isMenuRoute ? (
            <div className="w-full max-w-56">
              <CompanySwitcher />
            </div>
          ) : (
            <span className="flex min-w-0 items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-cyber" aria-hidden="true" />
              <span className="truncate">{activeCompanyName ?? 'No company selected'}</span>
            </span>
          )}
          {isMenuRoute && activeShift ? (
            <span className="flex min-w-0 items-center gap-2 border-l border-line pl-4">
              <Clock3 className="h-4 w-4 shrink-0 text-cyber" aria-hidden="true" />
              <span className="truncate">{activeShift.name}</span>
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className={`mr-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.05em] ${
              isConnected ? 'text-cyber-success' : 'text-cyber-error'
            }`}
            aria-live="polite"
          >
            {isConnected ? (
              <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isConnected ? 'Connected' : 'Offline'}
          </span>
          <NavLink
            to="/open-company"
            className={({ isActive }) =>
              `flex items-center gap-1.5 rounded-cyber border px-2.5 py-1.5 text-xs font-medium ${
                isActive || !user.activeCompanyId
                  ? 'border-cyber/50 bg-cyber-soft text-content'
                  : 'border-transparent text-content-muted hover:border-line hover:bg-surface-high hover:text-content'
              }`
            }
          >
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            Open Company
          </NavLink>
          {!isMenuRoute ? (
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-cyber border px-2.5 py-1.5 text-xs font-medium ${
                  isActive
                    ? 'border-cyber/50 bg-cyber-soft text-content'
                    : 'border-transparent text-content-muted hover:border-line hover:bg-surface-high hover:text-content'
                }`
              }
            >
              <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
              Dashboard
            </NavLink>
          ) : null}
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-1.5 rounded-cyber border px-2.5 py-1.5 text-xs font-medium ${
                isActive
                  ? 'border-cyber/50 bg-cyber-soft text-content'
                  : 'border-transparent text-content-muted hover:border-line hover:bg-surface-high hover:text-content'
              }`
            }
          >
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
            Settings
          </NavLink>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 rounded-cyber border border-transparent px-2.5 py-1.5 text-xs font-medium text-content-muted hover:border-cyber-error/50 hover:bg-cyber-error/10 hover:text-cyber-error"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Logout
          </button>
        </div>
      </header>

      {!isConnected ? (
        <div className="no-print flex items-center justify-center gap-2 border-b border-cyber-error/50 bg-cyber-error/10 px-4 py-2 text-center text-sm text-cyber-error">
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          Database connection lost. Attempting to reconnect...
          <button
            type="button"
            onClick={() => void reconnect()}
            className="ml-2 rounded-cyber border border-cyber-error/50 px-2 py-1 font-semibold hover:bg-cyber-error/10"
          >
            Retry Now
          </button>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        {!isMenuRoute ? (
          <aside className="sidebar no-print flex w-[220px] shrink-0 flex-col border-r border-line bg-surface lg:w-[232px] 2xl:w-64">
            <div className="border-b border-line p-4">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-content-subtle">
                Active company
              </p>
              <div className="rounded-cyber border border-line bg-surface-low px-3 py-2">
                <CompanySwitcher />
              </div>
              <NavLink
                to="/open-company"
                className={({ isActive }) =>
                  `mt-3 flex items-center gap-2 rounded-cyber border px-3 py-2 text-[13px] font-medium ${
                    isActive || !user.activeCompanyId
                      ? 'border-cyber/50 bg-cyber-soft text-content'
                      : 'border-transparent text-content-muted hover:border-line hover:bg-surface-high hover:text-content'
                  }`
                }
              >
                <Building2 className="h-4 w-4 text-cyber" aria-hidden="true" />
                Open Company
              </NavLink>
            </div>

            <div className="sidebar-nav flex-1 overflow-y-auto p-3">
              <NavSection title="Dashboard" items={[{ label: 'Dashboard', path: '/dashboard' }]} />
              <NavSection title="Admin" items={navigation.admin} />
              <NavSection title="Master" items={navigation.master} />
              <NavSection title="Transactions" items={navigation.transactions} />
              <NavSection title="Reports" items={navigation.reports} />
            </div>
          </aside>
        ) : null}

        <main className="print-full-width min-w-0 flex-1 overflow-y-auto bg-canvas p-4 lg:p-6">
          <div className={isMenuRoute ? 'w-full' : 'mc-legacy-content mx-auto w-full max-w-content'}>
            <Outlet />
          </div>
        </main>
      </div>
      <footer className="no-print flex h-7 shrink-0 items-center justify-between border-t border-line bg-surface px-3 font-mono text-[10px] uppercase tracking-[0.05em] text-content-subtle">
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-content-muted">{user.fullName ?? user.username}</span>
          <span className="rounded border border-line bg-surface-high px-1.5 py-0.5">
            {ROLE_LABELS[user.role]}
          </span>
          {activeUsers > 0 ? (
            <span className="flex items-center gap-1.5 text-cyber-success">
              <Circle className="h-1.5 w-1.5 fill-current" aria-hidden="true" />
              {activeUsers} online
            </span>
          ) : null}
        </div>
        <LiveClock />
      </footer>
    </div>
  );
}
