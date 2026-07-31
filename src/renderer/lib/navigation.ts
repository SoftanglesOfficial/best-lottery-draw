import type { UserRole } from '../../shared/types';
import { canViewPnL, isAdminOrOwner, isAtLeastRole } from './roles';

export interface NavItem {
  label: string;
  path: string;
}

export function isNavItemActive(navPath: string, pathname: string): boolean {
  const [base] = navPath.split('?');

  if (base === '/draws') {
    return pathname === '/draws' || pathname.startsWith('/draws/');
  }
  if (base === '/master/item-schemes-list') {
    return pathname === '/master/item-schemes-list' || pathname === '/item-schemes';
  }
  if (base === '/transactions/winning-tickets') {
    return pathname === '/transactions/winning-tickets' || pathname === '/transactions/winning';
  }

  return pathname === base;
}

export function buildNavigation(role: UserRole) {
  const admin: NavItem[] = [
    ...(role === 'admin'
      ? [
          { label: 'Company Owners', path: '/admin/owners' },
          { label: 'Companies', path: '/admin/companies' },
        ]
      : []),
    ...(isAdminOrOwner(role) ? [{ label: 'Backups', path: '/admin/backups' }] : []),
    ...(role === 'admin' ? [{ label: 'Diagnostics', path: '/admin/diagnostics' }] : []),
    ...(isAtLeastRole(role, 'manager')
      ? [{ label: 'Audit Logs', path: '/admin/audit-logs' }]
      : []),
  ];

  const master: NavItem[] = isAtLeastRole(role, 'manager')
    ? [
        { label: 'Users', path: '/master/users' },
        { label: 'Shift Groups', path: '/master/shift-groups' },
        { label: 'Shifts', path: '/master/shifts' },
        { label: 'Provider Groups', path: '/master/provider-groups' },
        { label: 'Providers', path: '/master/providers' },
        { label: 'Buyer Groups', path: '/master/buyer-groups' },
        { label: 'Buyers', path: '/master/buyers' },
        { label: 'Stockist Status', path: '/master/stockist-status' },
        { label: 'Sale Quotas', path: '/master/sale-quotas' },
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
    { label: 'Stock Transfer', path: '/transactions/stock-transfer' },
    { label: 'Sale Entry', path: '/transactions/sale-entry' },
    { label: 'Sale List', path: '/transactions/sale' },
    { label: 'Sale Return', path: '/transactions/sale-return' },
    { label: 'Sale Returns', path: '/transactions/sale-returns' },
    { label: 'Booking Entry', path: '/transactions/booking-entry' },
    { label: 'Bookings', path: '/transactions/bookings' },
    { label: 'Winning Tickets', path: '/transactions/winning-tickets' },
    { label: 'Ticket Search', path: '/transactions/ticket-search' },
    ...(isAtLeastRole(role, 'supervisor')
      ? [{ label: 'Draw Results', path: '/transactions/draw-results' }]
      : []),
  ];

  const reports: NavItem[] = [
    ...(isAtLeastRole(role, 'manager')
      ? [
          { label: 'Summary', path: '/reports' },
          ...(canViewPnL(role) ? [{ label: 'P&L', path: '/reports/pnl' }] : []),
          { label: 'Buyer Ledger', path: '/reports/buyer-ledger' },
          { label: 'Provider Ledger', path: '/reports/provider-ledger' },
        ]
      : []),
    ...(isAtLeastRole(role, 'supervisor')
      ? [{ label: 'Unsold Tickets', path: '/reports/unsold' }]
      : []),
  ];

  return { admin, master, transactions, reports };
}
