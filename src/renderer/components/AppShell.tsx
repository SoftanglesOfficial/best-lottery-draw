import { LogOut, WifiOff } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import CompanySwitcher from './CompanySwitcher';
import { useDbConnection } from '../lib/ConnectionContext';
import { useActiveUserCount } from '../lib/useActiveUserCount';
import { useAuth } from '../lib/auth';
import { isAdminOrOwner, isAtLeastRole, ROLE_BADGE_CLASSES, ROLE_LABELS } from '../lib/roles';
import type { UserRole } from '../../shared/types';

interface NavItem {
  label: string;
  path: string;
}

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <p className="mb-1 px-3 text-xs uppercase tracking-wider text-gray-400">{title}</p>
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `rounded px-3 py-2 text-sm transition-colors ${
                isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function buildNavigation(role: UserRole) {
  const admin: NavItem[] = isAdminOrOwner(role)
    ? [
        { label: 'Company Owners', path: '/admin/owners' },
        { label: 'Companies', path: '/admin/companies' },
        { label: 'Diagnostics', path: '/admin/diagnostics' },
        { label: 'Settings', path: '/settings?tab=audit' },
      ]
    : [];

  const master: NavItem[] = isAtLeastRole(role, 'manager')
    ? [
        { label: 'Users', path: '/master/users' },
        { label: 'Shift Groups', path: '/master/shift-groups' },
        { label: 'Shifts', path: '/master/shifts' },
        { label: 'Provider Groups', path: '/master/provider-groups' },
        { label: 'Providers', path: '/master/providers' },
        { label: 'Buyer Groups', path: '/master/buyer-groups' },
        { label: 'Buyers', path: '/master/buyers' },
        { label: 'Item Groups', path: '/master/item-groups' },
        { label: 'Items', path: '/master/items' },
        { label: 'Item Schemes', path: '/master/item-schemes-list' },
      ]
    : [];

  const transactions: NavItem[] = [
    { label: 'Draws', path: '/draws' },
    { label: 'Purchase Entry', path: '/transactions/purchase-entry' },
    { label: 'Purchase List', path: '/transactions/purchase' },
    { label: 'Purchase Return', path: '/transactions/purchase-return' },
    { label: 'Purchase Returns', path: '/transactions/purchase-returns' },
    { label: 'Sale Entry', path: '/transactions/sale-entry' },
    { label: 'Sale List', path: '/transactions/sale' },
    { label: 'Sale Return', path: '/transactions/sale-return' },
    { label: 'Sale Returns', path: '/transactions/sale-returns' },
    { label: 'Booking Entry', path: '/transactions/booking-entry' },
    { label: 'Bookings', path: '/transactions/bookings' },
    { label: 'Winning Tickets', path: '/transactions/winning-tickets' },
    { label: 'Ticket Search', path: '/transactions/ticket-search' },
    { label: 'Draw Results', path: '/transactions/draw-results' },
  ];

  const reports: NavItem[] = isAtLeastRole(role, 'manager')
    ? [
        { label: 'Summary', path: '/reports' },
        ...(isAdminOrOwner(role) ? [{ label: 'P&L', path: '/reports/pnl' }] : []),
        { label: 'Buyer Ledger', path: '/reports/buyer-ledger' },
        { label: 'Provider Ledger', path: '/reports/provider-ledger' },
      ]
    : [];

  return { admin, master, transactions, reports };
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { isConnected, reconnect } = useDbConnection();
  const activeUsers = useActiveUserCount();

  if (!user) {
    return null;
  }

  const navigation = buildNavigation(user.role);

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {!isConnected ? (
        <div className="flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-center text-sm text-white">
          <WifiOff className="h-4 w-4" />
          Database connection lost. Attempting to reconnect...
          <button
            type="button"
            onClick={() => void reconnect()}
            className="ml-2 underline hover:no-underline"
          >
            Retry Now
          </button>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
      <aside className="sidebar no-print flex w-[220px] shrink-0 flex-col bg-gray-900 text-white">
        <div className="border-b border-gray-800 p-4">
          <h1 className="text-lg font-bold">Best-12</h1>
          <CompanySwitcher />
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <NavSection title="Dashboard" items={[{ label: 'Dashboard', path: '/dashboard' }]} />
          <NavSection title="Admin" items={navigation.admin} />
          <NavSection title="Master" items={navigation.master} />
          <NavSection title="Transactions" items={navigation.transactions} />
          <NavSection title="Reports" items={navigation.reports} />
        </div>

        <div className="border-t border-gray-800 p-4">
          {activeUsers > 0 ? (
            <p className="mb-2 text-xs text-gray-400">
              {activeUsers} user{activeUsers === 1 ? '' : 's'} online
            </p>
          ) : null}
          <div className="mb-3">
            <p className="truncate text-sm font-medium">{user.fullName ?? user.username}</p>
            <span
              className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_CLASSES[user.role]}`}
            >
              {ROLE_LABELS[user.role]}
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="mb-2 flex w-full items-center gap-2 rounded border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <Outlet />
      </main>
      </div>
    </div>
  );
}
