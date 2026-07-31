import { lazy, Suspense, useEffect } from 'react';
import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import AppShell from './components/AppShell';
import {
  ProtectedRoute,
  ActiveCompanyRoute,
  CompanyAdministrationRoute,
  ActiveShiftRoute,
  PublicRoute,
} from './components/ProtectedRoute';
import { AuthProvider } from './lib/auth';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import OpenCompanyPage from './pages/OpenCompanyPage';
import OpenShiftPage from './pages/OpenShiftPage';
import MenuPage from './pages/MenuPage';
import OwnersPage from './pages/admin/OwnersPage';
import CompaniesPage from './pages/admin/CompaniesPage';
import UsersPage from './pages/master/UsersPage';
import ShiftGroupsPage from './pages/master/ShiftGroupsPage';
import ShiftsPage from './pages/master/ShiftsPage';
import ProviderGroupsPage from './pages/master/ProviderGroupsPage';
import ProvidersPage from './pages/master/ProvidersPage';
import BuyerGroupsPage from './pages/master/BuyerGroupsPage';
import BuyersPage from './pages/master/BuyersPage';
import SaleQuotasPage from './pages/master/SaleQuotasPage';
import ItemGroupsPage from './pages/master/ItemGroupsPage';
import ItemsPage from './pages/master/ItemsPage';
import ItemSchemesPage from './pages/master/ItemSchemesPage';
import ItemSchemePage from './pages/ItemSchemePage';
import DrawsPage from './pages/DrawsPage';
import DrawResultsPage from './pages/DrawResultsPage';
import PurchaseEntryPage from './pages/transactions/PurchaseEntryPage';
import PurchaseListPage from './pages/transactions/PurchaseListPage';
import PurchaseReturnPage from './pages/transactions/PurchaseReturnPage';
import PurchaseReturnsListPage from './pages/transactions/PurchaseReturnsListPage';
import SaleEntryPage from './pages/transactions/SaleEntryPage';
import SaleListPage from './pages/transactions/SaleListPage';
import SaleReturnPage from './pages/transactions/SaleReturnPage';
import SaleReturnsListPage from './pages/transactions/SaleReturnsListPage';
import BookingEntryPage from './pages/transactions/BookingEntryPage';
import BookingsListPage from './pages/transactions/BookingsListPage';
import DrawResultsListPage from './pages/transactions/DrawResultsListPage';
import WinningTicketsPage from './pages/transactions/WinningTicketsPage';
import TicketSearchPage from './pages/transactions/TicketSearchPage';
import StockTransferPage from './pages/transactions/StockTransferPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import BackupsPage from './pages/admin/BackupsPage';
import DiagnosticsPage from './pages/admin/DiagnosticsPage';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import AppListeners from './components/AppListeners';
import SessionTimeout from './components/SessionTimeout';
import ForceChangePassword from './components/ForceChangePassword';
import { ConnectionProvider } from './lib/ConnectionContext';
import SettingsPage from './pages/SettingsPage';
import { FullPageLoading } from './components/LoadingSpinner';

// ponytail: recharts lives in reports — lazy so cold start skips ~charts chunk
const ReportsSummaryPage = lazy(() => import('./pages/reports/ReportsSummaryPage'));
const PnLPage = lazy(() => import('./pages/reports/PnLPage'));
const BuyerLedgerPage = lazy(() => import('./pages/reports/BuyerLedgerPage'));
const ProviderLedgerPage = lazy(() => import('./pages/reports/ProviderLedgerPage'));
const UnsoldPage = lazy(() => import('./pages/reports/UnsoldPage'));

const AppRouter = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

function RouteFocusManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const destination =
        document.querySelector<HTMLElement>('h1') ??
        document.querySelector<HTMLElement>('main :is(h2, h3, h4, h5, h6)') ??
        document.querySelector<HTMLElement>('main');
      if (!destination) return;
      destination.tabIndex = -1;
      destination.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <AppRouter>
      <RouteFocusManager />
      <AuthProvider>
        <ToastProvider>
        <ConnectionProvider>
        <AppListeners />
        <SessionTimeout />
        <ForceChangePassword />
        <ErrorBoundary>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/" element={<LoginPage />} />
          </Route>

          <Route element={<AppShell />}>
            <Route path="/settings" element={<SettingsPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/open-company" element={<OpenCompanyPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route element={<CompanyAdministrationRoute />}>
                <Route path="/admin/owners" element={<OwnersPage />} />
                <Route path="/admin/companies" element={<CompaniesPage />} />
              </Route>

              <Route element={<ActiveCompanyRoute />}>
              <Route path="/open-shift" element={<OpenShiftPage />} />

              <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
              <Route path="/admin/backups" element={<BackupsPage />} />
              <Route path="/admin/diagnostics" element={<DiagnosticsPage />} />

              <Route path="/master/users" element={<UsersPage />} />
              <Route path="/master/shift-groups" element={<ShiftGroupsPage />} />
              <Route path="/master/shifts" element={<ShiftsPage />} />
              <Route path="/master/provider-groups" element={<ProviderGroupsPage />} />
              <Route path="/master/providers" element={<ProvidersPage />} />
              <Route path="/master/buyer-groups" element={<BuyerGroupsPage />} />
              <Route path="/master/buyers" element={<BuyersPage />} />
              <Route path="/master/sale-quotas" element={<SaleQuotasPage />} />
              <Route path="/master/item-groups" element={<ItemGroupsPage />} />
              <Route path="/master/items" element={<ItemsPage />} />
              <Route path="/master/item-schemes-list" element={<ItemSchemesPage />} />
              <Route path="/item-schemes" element={<ItemSchemePage />} />

              <Route element={<ActiveShiftRoute />}>
              <Route path="/menu" element={<MenuPage />} />

              <Route path="/draws" element={<DrawsPage />} />
              <Route path="/draws/:id/results" element={<DrawResultsPage />} />
              <Route path="/transactions/purchase-entry" element={<PurchaseEntryPage />} />
              <Route path="/transactions/purchase" element={<PurchaseListPage />} />
              <Route path="/transactions/purchase-return" element={<PurchaseReturnPage />} />
              <Route path="/transactions/purchase-returns" element={<PurchaseReturnsListPage />} />
              <Route path="/transactions/stock-transfer" element={<StockTransferPage />} />
              <Route path="/transactions/sale-entry" element={<SaleEntryPage />} />
              <Route path="/transactions/sale" element={<SaleListPage />} />
              <Route path="/transactions/sale-return" element={<SaleReturnPage />} />
              <Route path="/transactions/sale-returns" element={<SaleReturnsListPage />} />
              <Route path="/transactions/booking-entry" element={<BookingEntryPage />} />
              <Route path="/transactions/bookings" element={<BookingsListPage />} />
              <Route path="/transactions/winning" element={<WinningTicketsPage />} />
              <Route path="/transactions/winning-tickets" element={<WinningTicketsPage />} />
              <Route path="/transactions/ticket-search" element={<TicketSearchPage />} />
              <Route path="/transactions/draw-results" element={<DrawResultsListPage />} />

              <Route
                path="/reports"
                element={
                  <Suspense fallback={<FullPageLoading />}>
                    <ReportsSummaryPage />
                  </Suspense>
                }
              />
              <Route
                path="/reports/pnl"
                element={
                  <Suspense fallback={<FullPageLoading />}>
                    <PnLPage />
                  </Suspense>
                }
              />
              <Route
                path="/reports/buyer-ledger"
                element={
                  <Suspense fallback={<FullPageLoading />}>
                    <BuyerLedgerPage />
                  </Suspense>
                }
              />
              <Route
                path="/reports/provider-ledger"
                element={
                  <Suspense fallback={<FullPageLoading />}>
                    <ProviderLedgerPage />
                  </Suspense>
                }
              />
              <Route
                path="/reports/unsold"
                element={
                  <Suspense fallback={<FullPageLoading />}>
                    <UnsoldPage />
                  </Suspense>
                }
              />
              </Route>
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
        </ConnectionProvider>
        </ToastProvider>
      </AuthProvider>
    </AppRouter>
  );
}
