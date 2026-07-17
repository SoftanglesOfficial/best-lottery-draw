import {
  ArrowUpRight,
  BarChart3,
  Building2,
  LayoutDashboard,
  ReceiptText,
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { buildNavigation, type NavItem } from '../lib/navigation';

const ANALYTICS_PATHS = new Set([
  '/transactions/winning-tickets',
  '/transactions/ticket-search',
  '/transactions/draw-results',
]);

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
    <section aria-labelledby={id}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-5 w-5 text-cyber" aria-hidden="true" />
        <h2 id={id} className="font-display text-sm font-bold text-content">
          {title}
        </h2>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="group flex min-h-9 items-center justify-between rounded-cyber border border-line bg-surface-raised px-3 py-2 text-sm text-content transition-colors hover:border-cyber/70 hover:bg-cyber-soft focus-visible:border-cyber"
          >
            <span className="font-medium">{item.label}</span>
            <ArrowUpRight
              className="h-4 w-4 shrink-0 text-content-subtle group-hover:text-cyber"
              aria-hidden="true"
            />
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
  const companyData = [...navigation.admin, ...navigation.master];
  const reports = [
    ...navigation.reports,
    ...navigation.transactions.filter((item) => ANALYTICS_PATHS.has(item.path)),
  ];
  const transactions = navigation.transactions
    .filter((item) => !ANALYTICS_PATHS.has(item.path))
    .map((item) => {
      if (item.path === '/transactions/purchase-entry') return { ...item, label: 'Add Purchase' };
      if (item.path === '/transactions/sale-entry') return { ...item, label: 'Add Sale' };
      if (item.path === '/transactions/booking-entry') return { ...item, label: 'Add Booking' };
      return item;
    });

  return (
    <div className="grid w-full gap-6 lg:grid-cols-3">
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
      <div className="flex flex-col gap-5">
        <MenuSection
          id="transactions"
          title="Transactions"
          items={transactions}
          icon={ReceiptText}
        />

        <section aria-labelledby="open-dashboard">
          <div className="mb-3 flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-cyber" aria-hidden="true" />
            <h2 id="open-dashboard" className="font-display text-sm font-bold text-content">
              Open Dashboard
            </h2>
          </div>
          <Link
            to="/dashboard"
            className="group flex min-h-10 items-center justify-between rounded-cyber border border-cyber/50 bg-cyber-soft px-3 py-2 text-sm text-content hover:border-cyber focus-visible:border-cyber"
          >
            <span className="font-bold">Open Dashboard</span>
            <ArrowUpRight
              className="h-4 w-4 shrink-0 text-cyber group-hover:text-cyber-hover"
              aria-hidden="true"
            />
          </Link>
        </section>
      </div>
    </div>
  );
}
