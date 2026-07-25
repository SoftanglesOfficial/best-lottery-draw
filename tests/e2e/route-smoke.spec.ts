import { expect, test } from '@playwright/test';
import { installMockApi } from './helpers/mockApi';

test.use({ viewport: { width: 1440, height: 900 } });

const routes: { path: string; expectText: string | RegExp }[] = [
  { path: '/menu', expectText: 'Add Sale' },
  { path: '/dashboard', expectText: /Welcome,/ },
  { path: '/settings', expectText: /Database|Settings/ },
  { path: '/master/users', expectText: 'Users' },
  { path: '/master/shift-groups', expectText: 'Shift Groups' },
  { path: '/master/shifts', expectText: 'Shifts' },
  { path: '/master/provider-groups', expectText: 'Provider Groups' },
  { path: '/master/providers', expectText: 'Providers' },
  { path: '/master/buyer-groups', expectText: 'Buyer Groups' },
  { path: '/master/buyers', expectText: 'Buyers' },
  { path: '/master/item-groups', expectText: 'Item Groups' },
  { path: '/master/items', expectText: 'Items' },
  { path: '/master/item-schemes-list', expectText: 'Item Schemes' },
  { path: '/item-schemes', expectText: /Item Scheme|New Item Scheme/ },
  { path: '/draws', expectText: 'Draws' },
  { path: '/draws/31/results', expectText: /Result|Draw/ },
  { path: '/transactions/purchase-entry', expectText: 'Add Purchase' },
  { path: '/transactions/purchase', expectText: 'Purchase List' },
  { path: '/transactions/purchase-return', expectText: 'Purchase Return' },
  { path: '/transactions/purchase-returns', expectText: 'Purchase Returns' },
  { path: '/transactions/sale-entry', expectText: 'Add Sale' },
  { path: '/transactions/sale', expectText: 'Sale List' },
  { path: '/transactions/sale-return', expectText: 'Sale Return' },
  { path: '/transactions/sale-returns', expectText: 'Sale Returns' },
  { path: '/transactions/booking-entry', expectText: 'Add Booking' },
  { path: '/transactions/bookings', expectText: 'Bookings' },
  { path: '/transactions/winning-tickets', expectText: 'Winning Tickets' },
  { path: '/transactions/ticket-search', expectText: /Ticket Search|Search/ },
  { path: '/transactions/draw-results', expectText: /Draw Results|Results/ },
  { path: '/reports', expectText: /Summary|Report/ },
  { path: '/reports/pnl', expectText: /Profit|P&L|Loss/ },
  { path: '/reports/buyer-ledger', expectText: /Buyer Ledger|Ledger/ },
  { path: '/reports/provider-ledger', expectText: /Provider Ledger|Ledger/ },
  { path: '/admin/owners', expectText: 'Company Owners' },
  { path: '/admin/companies', expectText: 'Companies' },
  { path: '/admin/audit-logs', expectText: 'Audit Logs' },
  { path: '/admin/backups', expectText: 'Backups' },
  { path: '/admin/diagnostics', expectText: /Diagnostics/ },
];

test.beforeEach(async ({ page }) => {
  await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });
});

for (const route of routes) {
  test(`smoke ${route.path}`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page).not.toHaveURL(/\/$|\/open-company|\/open-shift/);
    await expect(page.getByText(route.expectText).first()).toBeVisible({ timeout: 15000 });
  });
}
