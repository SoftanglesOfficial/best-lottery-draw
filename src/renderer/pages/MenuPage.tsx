import { BarChart3, Building2, ReceiptText } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { buildNavigation, type NavItem } from '../lib/navigation';

const MENU_LABELS: Record<string, string> = {
  '/master/users': 'Manage Users',
  '/master/item-schemes-list': 'Item Schemes List',
  '/reports': 'P&L Summary',
  '/transactions/draw-results': 'Result Analyzer',
  '/transactions/purchase-entry': 'Add Purchase',
  '/transactions/purchase-return': 'Add Purchase Return',
  '/transactions/purchase-returns': 'Purchase Return List',
  '/transactions/sale-entry': 'Add Sale',
  '/transactions/sale-return': 'Add Sale Return',
  '/transactions/sale-returns': 'Sale Return List',
  '/transactions/booking-entry': 'Add Booking',
  '/transactions/bookings': 'Booking List',
};

const MENU_ARIA_LABELS: Record<string, string> = {
  '/transactions/purchase-return': 'Create purchase return',
  '/transactions/sale-return': 'Create sale return',
};

function withMenuLabel(item: NavItem): NavItem {
  return { ...item, label: MENU_LABELS[item.path] ?? item.label };
}

function MenuSection({
  id,
  title,
  items,
  icon: Icon,
}: {
  id: string;
  title: string;
  items: NavItem[];
  icon: typeof Building2;
}) {
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby={id}
      className="min-w-0 border-r border-line px-2 py-2 last:border-r-0"
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-cyber" aria-hidden="true" />
        <h2 id={id} className="font-display text-[11px] font-bold text-content">
          {title}
        </h2>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            aria-label={MENU_ARIA_LABELS[item.path]}
            className="flex h-8 min-w-0 items-center rounded-cyber border border-line bg-surface-raised px-2.5 text-xs font-medium text-content transition-colors hover:border-cyber/70 hover:bg-cyber-soft focus-visible:border-cyber focus-visible:outline-none"
          >
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function MenuPage() {
  const { user, activeShift } = useAuth();
  if (!activeShift) return <Navigate to="/open-shift" replace />;

  if (!user) return null;

  const navigation = buildNavigation(user.role);
  const itemSchemesIndex = navigation.master.findIndex(
    (item) => item.path === '/master/item-schemes-list',
  );
  const master = navigation.master.map(withMenuLabel);
  if (itemSchemesIndex >= 0) {
    master.splice(itemSchemesIndex, 0, {
      label: 'Item Scheme Entry',
      path: '/item-schemes',
    });
  }
  const draws = navigation.transactions.find((item) => item.path === '/draws');
  const companyData = [...master, ...(draws ? [draws] : [])];
  const reports = [
    ...navigation.reports
      .filter((item) => item.path !== '/reports/pnl')
      .map(withMenuLabel),
    ...navigation.transactions
      .filter((item) => item.path === '/transactions/draw-results')
      .map(withMenuLabel),
  ];
  const transactions = navigation.transactions
    .filter(
      (item) =>
        item.path !== '/draws' &&
        item.path !== '/transactions/draw-results' &&
        item.path !== '/transactions/ticket-search',
    )
    .map(withMenuLabel);
  transactions.push({ label: 'Open Dashboard', path: '/dashboard' });

  return (
    <div
      aria-label="Authorized shift menu"
      className="grid min-h-full w-full grid-cols-3"
    >
      <MenuSection
        id="company-data"
        title="Company Data"
        items={companyData}
        icon={Building2}
      />
      <MenuSection
        id="reports-analytics"
        title="Reports & Analytics"
        items={reports}
        icon={BarChart3}
      />
      <MenuSection
        id="transactions"
        title="Transactions"
        items={transactions}
        icon={ReceiptText}
      />
    </div>
  );
}
