import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Database,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import CompanySwitcher from './CompanySwitcher';
import { useDbConnection } from '../lib/ConnectionContext';
import { useActiveUserCount } from '../lib/useActiveUserCount';
import { useAuth } from '../lib/auth';
import { buildNavigation, isNavItemActive, type NavItem } from '../lib/navigation';
import { ROLE_LABELS } from '../lib/roles';

type SectionKey = 'dashboard' | 'admin' | 'master' | 'transactions' | 'reports';

type SidebarSection = {
  key: SectionKey;
  title: string;
  icon: typeof LayoutDashboard;
  items: NavItem[];
};

function LiveClock({ timeOnly = false }: { timeOnly?: boolean }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <time dateTime={now.toISOString()} className="flex gap-3 tabular-nums">
      {!timeOnly ? <span>{now.toLocaleDateString([], { dateStyle: 'medium' })}</span> : null}
      <span>
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </time>
  );
}

function NavSection({
  section,
  expanded,
  collapsed,
  onToggle,
  headerRef,
}: {
  section: SidebarSection;
  expanded: boolean;
  collapsed: boolean;
  onToggle: () => void;
  headerRef?: (el: HTMLButtonElement | null) => void;
}) {
  const location = useLocation();
  const Icon = section.icon;
  const hasActiveItem = section.items.some((item) => isNavItemActive(item.path, location.pathname));

  if (section.items.length === 0) {
    return null;
  }

  if (section.items.length === 1) {
    const item = section.items[0];
    const active = isNavItemActive(item.path, location.pathname);
    return (
      <div className={collapsed ? 'mb-1' : 'mb-2'}>
        <NavLink
          to={item.path}
          aria-label={collapsed ? item.label : undefined}
          title={collapsed ? item.label : undefined}
          className={`flex items-center rounded-cyber border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber ${
            collapsed
              ? `h-10 w-full justify-center ${active ? 'border-cyber/50 bg-cyber-soft text-cyber' : 'border-transparent text-content-muted hover:bg-surface-high hover:text-content'}`
              : `gap-2 px-3 py-2 text-[13px] font-medium ${
                  active
                    ? 'border-cyber/50 bg-cyber-soft text-content'
                    : 'border-transparent text-content-muted hover:border-line hover:bg-surface-high hover:text-content'
                }`
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed ? item.label : null}
        </NavLink>
      </div>
    );
  }

  return (
    <div className={collapsed ? 'mb-1' : 'mb-2'}>
      <button
        ref={headerRef}
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed && expanded}
        aria-label={collapsed ? section.title : undefined}
        title={collapsed ? section.title : undefined}
        className={`flex h-10 w-full items-center rounded-cyber border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber ${
          collapsed
            ? `justify-center ${hasActiveItem ? 'border-cyber/50 bg-cyber-soft text-cyber' : 'border-transparent text-content-muted hover:bg-surface-high hover:text-content'}`
            : 'justify-between border-transparent px-3 text-content-muted hover:border-line hover:bg-surface-high hover:text-content'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em]">{section.title}</span>
          ) : null}
        </span>
        {!collapsed ? (
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        ) : null}
      </button>

      {!collapsed && expanded ? (
        <nav className="mt-1 flex flex-col gap-1" aria-label={`${section.title} links`}>
          {section.items.map((item) => {
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
      ) : null}
    </div>
  );
}

export default function AppShell() {
  const { user, activeCompanyName, activeShift, logout } = useAuth();
  const location = useLocation();
  const { isConnected, reconnect } = useDbConnection();
  const activeUsers = useActiveUserCount();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  const pendingFocusSectionRef = useRef<SectionKey | null>(null);
  const sectionHeaderRefs = useRef<Partial<Record<SectionKey, HTMLButtonElement | null>>>({});

  useEffect(() => {
    if (!user) {
      return;
    }
    const roleNavigation = buildNavigation(user.role);
    const candidates: Array<[SectionKey, NavItem[]]> = [
      ['admin', roleNavigation.admin],
      ['master', roleNavigation.master],
      ['transactions', roleNavigation.transactions],
      ['reports', roleNavigation.reports],
    ];
    const active = candidates.find(([, items]) =>
      items.some((item) => isNavItemActive(item.path, location.pathname)),
    );
    if (active) {
      setOpenSection(active[0]);
    }
  }, [location.pathname, user?.role, user]);

  useEffect(() => {
    const key = pendingFocusSectionRef.current;
    if (!key || isSidebarCollapsed) {
      return;
    }
    if (openSection !== key) {
      return;
    }
    const el = sectionHeaderRefs.current[key];
    if (el) {
      pendingFocusSectionRef.current = null;
      el.focus();
    }
  }, [isSidebarCollapsed, openSection]);

  const isSettingsRoute = location.pathname === '/settings';
  const isMenuRoute = location.pathname === '/menu';
  const isLegacyEntryRoute =
    location.pathname === '/transactions/sale-entry' ||
    location.pathname === '/transactions/sale-return' ||
    location.pathname === '/transactions/booking-entry';
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

  if (isLegacyEntryRoute) {
    return (
      <div className="h-screen min-w-[1024px] overflow-hidden">
        <main className="h-full overflow-hidden">
          <Outlet />
        </main>
      </div>
    );
  }

  if (!user.activeCompanyId) {
    const globalActions = [
      { label: 'Open Company', path: '/open-company', icon: Building2 },
      ...(user.role === 'admin'
        ? [
            { label: 'Manage Owners', path: '/admin/owners', icon: Users },
            { label: 'Manage Companies', path: '/admin/companies', icon: Shield },
          ]
        : []),
      { label: 'System Settings', path: '/settings', icon: Settings },
    ];

    return (
      <div className="flex h-screen min-w-0 flex-col overflow-hidden bg-canvas text-content">
        <header className="no-print grid h-9 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-line bg-surface px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 rounded border-2 border-cyber shadow-[0_0_8px_rgba(124,92,252,0.35)]" />
            <span className="truncate font-display text-xs font-bold uppercase tracking-[0.08em]">
              Best-<span className="text-cyber">12</span>
            </span>
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.05em] text-content-subtle">
            <LiveClock />
          </div>
          <div className="flex min-w-0 items-center justify-end gap-2">
            <span
              className={`hidden items-center gap-1 font-mono text-[9px] uppercase tracking-[0.05em] sm:flex ${
                isConnected ? 'text-cyber-success' : 'text-cyber-error'
              }`}
              aria-live="polite"
            >
              {isConnected ? (
                <Wifi className="h-3 w-3" aria-hidden="true" />
              ) : (
                <WifiOff className="h-3 w-3" aria-hidden="true" />
              )}
              {isConnected ? 'Connected' : 'Offline'}
            </span>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1 rounded-cyber border border-transparent px-2 py-1 text-[10px] font-medium text-content-muted hover:border-cyber-error/50 hover:bg-cyber-error/10 hover:text-cyber-error"
            >
              <LogOut className="h-3 w-3" aria-hidden="true" />
              Logout
            </button>
          </div>
        </header>

        {!isConnected ? (
          <div className="no-print flex items-center justify-center gap-2 border-b border-cyber-error/50 bg-cyber-error/10 px-3 py-1.5 text-center text-xs text-cyber-error">
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            Database connection lost.
            <button
              type="button"
              onClick={() => void reconnect()}
              className="rounded-cyber border border-cyber-error/50 px-2 py-0.5 font-semibold hover:bg-cyber-error/10"
            >
              Retry Now
            </button>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1">
          <aside className="no-print w-56 shrink-0 border-r border-line bg-surface p-3">
            <div className="mb-2 flex items-center gap-2 px-2">
              <h1 className="font-display text-xs font-bold text-content">Admin Panel</h1>
              <span className="rounded border border-line bg-surface-high px-1.5 py-0.5 font-mono text-[8px] uppercase text-content-subtle">
                {ROLE_LABELS[user.role]}
              </span>
            </div>
            <nav aria-label="Global actions" className="space-y-1">
              {globalActions.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => {
                      const active =
                        isActive ||
                        (item.path === '/open-company' && location.pathname === '/dashboard');
                      return `flex items-center gap-2 rounded-cyber border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                        active
                          ? 'border-cyber/50 bg-cyber text-cyber-foreground'
                          : 'border-transparent text-content-muted hover:border-line hover:bg-surface-high hover:text-content'
                      }`;
                    }}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto bg-canvas p-4">
            <Outlet />
          </main>
        </div>

        <footer className="no-print flex h-6 shrink-0 items-center justify-between border-t border-line bg-surface px-3 font-mono text-[9px] uppercase tracking-[0.05em] text-content-subtle">
          <span className="truncate">{user.fullName ?? user.username}</span>
          <span className="flex items-center gap-1.5 text-cyber-success">
            <Circle className="h-1.5 w-1.5 fill-current" aria-hidden="true" />
            {activeUsers > 0 ? `${activeUsers} online` : 'Session active'}
          </span>
        </footer>
      </div>
    );
  }

  const navigation = buildNavigation(user.role);
  const sidebarSections: SidebarSection[] = [
    {
      key: 'dashboard',
      title: 'Dashboard',
      icon: LayoutDashboard,
      items: [{ label: 'Dashboard', path: '/dashboard' }],
    },
    { key: 'admin', title: 'Admin', icon: ShieldCheck, items: navigation.admin },
    { key: 'master', title: 'Master', icon: Database, items: navigation.master },
    {
      key: 'transactions',
      title: 'Transactions',
      icon: ArrowLeftRight,
      items: navigation.transactions,
    },
    { key: 'reports', title: 'Reports', icon: BarChart3, items: navigation.reports },
  ];

  return (
    <div className="mc-app-frame flex h-screen min-w-[1024px] flex-col bg-canvas text-content">
      {isMenuRoute ? (
        <header className="no-print grid h-10 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-line bg-surface px-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded border-2 border-cyber shadow-[0_0_8px_rgba(124,92,252,0.35)]" />
            <span className="shrink-0 font-display text-xs font-bold uppercase tracking-[0.08em] text-content">
              Best-<span className="text-cyber">12</span>
            </span>
            <span className="h-4 border-l border-line" aria-hidden="true" />
            <div className="min-w-0 max-w-40 flex-1">
              <CompanySwitcher />
            </div>
            {activeShift ? (
              <div className="hidden min-w-0 items-center gap-1.5 border-l border-line pl-2 sm:flex">
                <span className="truncate text-[11px] text-content-muted">
                  {activeShift.shiftGroupName}
                </span>
                <span className="text-content-subtle" aria-hidden="true">
                  /
                </span>
                <span className="truncate text-[11px] text-content">{activeShift.name}</span>
              </div>
            ) : null}
          </div>

          <div className="px-2 font-mono text-[10px] uppercase tracking-[0.05em] text-content-subtle">
            <LiveClock timeOnly />
          </div>

          <nav aria-label="Menu actions" className="flex min-w-0 items-center justify-end gap-0.5">
            <NavLink
              to="/dashboard"
              className="flex items-center gap-1 rounded-cyber border border-transparent px-1.5 py-1 text-[11px] font-medium text-content-muted hover:border-line hover:bg-surface-high hover:text-content"
            >
              <LayoutDashboard className="h-3 w-3" aria-hidden="true" />
              Dashboard
            </NavLink>
            <NavLink
              to="/open-company"
              className="flex items-center gap-1 rounded-cyber border border-transparent px-1.5 py-1 text-[11px] font-medium text-content-muted hover:border-line hover:bg-surface-high hover:text-content"
            >
              <Building2 className="h-3 w-3" aria-hidden="true" />
              Open Company
            </NavLink>
            <NavLink
              to="/settings"
              className="flex items-center gap-1 rounded-cyber border border-transparent px-1.5 py-1 text-[11px] font-medium text-content-muted hover:border-line hover:bg-surface-high hover:text-content"
            >
              <Settings className="h-3 w-3" aria-hidden="true" />
              Settings
            </NavLink>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1 rounded-cyber border border-transparent px-1.5 py-1 text-[11px] font-medium text-content-muted hover:border-cyber-error/50 hover:bg-cyber-error/10 hover:text-cyber-error"
            >
              <LogOut className="h-3 w-3" aria-hidden="true" />
              Logout
            </button>
          </nav>
        </header>
      ) : (
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
      )}

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
          <aside
            aria-label="Primary navigation"
            className={`sidebar no-print flex shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ease-out motion-reduce:transition-none ${
              isSidebarCollapsed ? 'w-14' : 'w-[232px]'
            }`}
          >
            <div
              className={`flex h-12 items-center border-b border-line ${isSidebarCollapsed ? 'justify-center' : 'justify-end px-3'}`}
            >
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((value) => !value)}
                aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!isSidebarCollapsed}
                title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="flex h-9 w-9 items-center justify-center rounded-cyber border border-transparent text-content-muted transition-colors hover:border-line hover:bg-surface-high hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber"
              >
                {isSidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>

            {!isSidebarCollapsed ? (
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
                      isActive
                        ? 'border-cyber/50 bg-cyber-soft text-content'
                        : 'border-transparent text-content-muted hover:border-line hover:bg-surface-high hover:text-content'
                    }`
                  }
                >
                  <Building2 className="h-4 w-4 text-cyber" aria-hidden="true" />
                  Open Company
                </NavLink>
              </div>
            ) : null}

            <div className={`sidebar-nav flex-1 overflow-y-auto ${isSidebarCollapsed ? 'p-2' : 'p-3'}`}>
              {sidebarSections.map((section) => (
                <NavSection
                  key={section.key}
                  section={section}
                  expanded={openSection === section.key}
                  collapsed={isSidebarCollapsed}
                  headerRef={(el) => {
                    sectionHeaderRefs.current[section.key] = el;
                  }}
                  onToggle={() => {
                    if (isSidebarCollapsed) {
                      pendingFocusSectionRef.current = section.key;
                      setIsSidebarCollapsed(false);
                      setOpenSection(section.key);
                      return;
                    }
                    setOpenSection((current) => (current === section.key ? null : section.key));
                  }}
                />
              ))}
            </div>
          </aside>
        ) : null}

        <main
          className={`print-full-width min-w-0 flex-1 overflow-y-auto bg-canvas ${
            isMenuRoute ? 'p-0' : 'p-4 lg:p-6'
          }`}
        >
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
        {isMenuRoute && activeShift ? (
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate">Company: {activeCompanyName}</span>
            <span className="truncate">Shift group: {activeShift.shiftGroupName}</span>
            <span className="truncate text-cyber">Shift: {activeShift.name}</span>
          </div>
        ) : (
          <LiveClock />
        )}
      </footer>
    </div>
  );
}
