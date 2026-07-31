import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './auth';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/settings': 'Settings',
  '/reports': 'Reports',
  '/reports/pnl': 'P&L',
  '/reports/buyer-ledger': 'Buyer Ledger',
  '/reports/provider-ledger': 'Provider Ledger',
  '/reports/unsold': 'Unsold Tickets',
  '/draws': 'Draws',
  '/open-company': 'Open Company',
};

function resolvePageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/transactions/')) {
    return pathname.split('/').pop()?.replace(/-/g, ' ') ?? 'Transactions';
  }
  if (pathname.startsWith('/master/')) {
    return pathname.split('/').pop()?.replace(/-/g, ' ') ?? 'Master';
  }
  if (pathname.startsWith('/admin/')) {
    return pathname.split('/').pop()?.replace(/-/g, ' ') ?? 'Admin';
  }
  return 'Best-12';
}

export function useWindowTitle() {
  const location = useLocation();
  const { activeCompanyName } = useAuth();

  useEffect(() => {
    const page = resolvePageTitle(location.pathname);
    const company = activeCompanyName ?? 'No Company';
    const title = `Best-12 — ${company} — ${page}`;
    document.title = title;
    window.api.windowSetTitle?.(title);
  }, [location.pathname, activeCompanyName]);
}
