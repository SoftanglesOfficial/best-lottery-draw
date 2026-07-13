import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import { ProtectedRoute, ActiveCompanyRoute, PublicRoute } from './components/ProtectedRoute';
import { AuthProvider } from './lib/auth';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import OpenCompanyPage from './pages/OpenCompanyPage';
import OwnersPage from './pages/admin/OwnersPage';
import CompaniesPage from './pages/admin/CompaniesPage';
import UsersPage from './pages/master/UsersPage';
import ShiftGroupsPage from './pages/master/ShiftGroupsPage';
import ShiftsPage from './pages/master/ShiftsPage';
import ProviderGroupsPage from './pages/master/ProviderGroupsPage';
import ProvidersPage from './pages/master/ProvidersPage';
import BuyerGroupsPage from './pages/master/BuyerGroupsPage';
import BuyersPage from './pages/master/BuyersPage';
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
import ReportsSummaryPage from './pages/reports/ReportsSummaryPage';
import PnLPage from './pages/reports/PnLPage';
import BuyerLedgerPage from './pages/reports/BuyerLedgerPage';
import ProviderLedgerPage from './pages/reports/ProviderLedgerPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import BackupsPage from './pages/admin/BackupsPage';
import DiagnosticsPage from './pages/admin/DiagnosticsPage';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import AppListeners from './components/AppListeners';
import SessionTimeout from './components/SessionTimeout';
import { ConnectionProvider } from './lib/ConnectionContext';
import SettingsPage from './pages/SettingsPage';

const AppRouter = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <AppRouter>
      <AuthProvider>
        <ToastProvider>
        <ConnectionProvider>
        <AppListeners />
        <SessionTimeout />
        <ErrorBoundary>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/" element={<LoginPage />} />
          </Route>

          <Route element={<AppShell />}>
            <Route path="/settings" element={<SettingsPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/open-company" element={<OpenCompanyPage />} />

              <Route element={<ActiveCompanyRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />

              <Route path="/admin/owners" element={<OwnersPage />} />
              <Route path="/admin/companies" element={<CompaniesPage />} />

              <Route path="/master/users" element={<UsersPage />} />
              <Route path="/master/shift-groups" element={<ShiftGroupsPage />} />
              <Route path="/master/shifts" element={<ShiftsPage />} />
              <Route path="/master/provider-groups" element={<ProviderGroupsPage />} />
              <Route path="/master/providers" element={<ProvidersPage />} />
              <Route path="/master/buyer-groups" element={<BuyerGroupsPage />} />
              <Route path="/master/buyers" element={<BuyersPage />} />
              <Route path="/master/item-groups" element={<ItemGroupsPage />} />
              <Route path="/master/items" element={<ItemsPage />} />
              <Route path="/master/item-schemes-list" element={<ItemSchemesPage />} />
              <Route path="/item-schemes" element={<ItemSchemePage />} />

              <Route path="/draws" element={<DrawsPage />} />
              <Route path="/draws/:id/results" element={<DrawResultsPage />} />
              <Route path="/transactions/purchase-entry" element={<PurchaseEntryPage />} />
              <Route path="/transactions/purchase" element={<PurchaseListPage />} />
              <Route path="/transactions/purchase-return" element={<PurchaseReturnPage />} />
              <Route path="/transactions/purchase-returns" element={<PurchaseReturnsListPage />} />
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

              <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
              <Route path="/admin/backups" element={<BackupsPage />} />
              <Route path="/admin/diagnostics" element={<DiagnosticsPage />} />

              <Route path="/reports" element={<ReportsSummaryPage />} />
              <Route path="/reports/pnl" element={<PnLPage />} />
              <Route path="/reports/buyer-ledger" element={<BuyerLedgerPage />} />
              <Route path="/reports/provider-ledger" element={<ProviderLedgerPage />} />
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
