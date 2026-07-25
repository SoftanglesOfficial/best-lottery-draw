import { expect, test, type Page } from '@playwright/test';
import { installMockApi } from './helpers/mockApi';

test.use({ viewport: { width: 1440, height: 900 } });

async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('Username').fill('admin');
  await page.locator('#password').fill('admin123');
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('forced password change blocks the app until password is updated', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mockInitialized', 'true');
    localStorage.setItem('authenticated', 'false');
    Object.defineProperty(window, 'api', {
      value: {
        authRestore: async () => ({ success: false, error: 'No stored session' }),
        authLogin: async () => ({
          success: true,
          user: {
            id: 1,
            username: 'admin',
            fullName: 'Admin User',
            role: 'admin',
            companyId: null,
            activeCompanyId: null,
          },
          sessionToken: 'test-token',
          mustChangePassword: true,
        }),
        authChangePassword: async (_id: number, _current: string, next: string) => {
          if (next === 'admin123') {
            return { success: false, error: 'Choose a password other than the default seed password.' };
          }
          localStorage.setItem('passwordChanged', 'true');
          return { success: true };
        },
        authLogout: async () => {
          localStorage.setItem('authenticated', 'false');
          return { success: true };
        },
        dbGetStatus: async () => ({ connected: true, version: '16' }),
        prefsGet: async () => ({ autoBackup: false, networkMode: 'client' }),
        lanGetStatus: async () => ({ isBroadcasting: false, port: 41234, localIp: '127.0.0.1' }),
        onAppLogout: () => () => undefined,
        onDbConnectionLost: () => () => undefined,
        onDbConnectionRestored: () => () => undefined,
      },
      configurable: true,
    });
  });

  await page.goto('/');
  await page.getByLabel('Username').fill('admin');
  await page.locator('#password').fill('admin123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Change default password' })).toBeVisible();
  await page.locator('#new-password').fill('admin123');
  await page.locator('#confirm-new-password').fill('admin123');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByText('Choose a password other than the default seed password.')).toBeVisible();

  await page.locator('#new-password').fill('secure-pass-99');
  await page.locator('#confirm-new-password').fill('secure-pass-99');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('heading', { name: 'Change default password' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/dashboard$/);
});
test('global admin actions work before selecting a company', async ({ page }) => {
  await installMockApi(page, { seedCompanyId: null });

  await page.goto('/');
  await page.getByRole('link', { name: 'Manage Owners', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/owners$/);
  await expect(page.getByRole('heading', { name: 'Company Owners' })).toBeVisible();

  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'Manage Companies', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/companies$/);
  await expect(page.getByRole('heading', { name: 'Companies' })).toBeVisible();

  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'System Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
});

test('owners see only permitted actions before selecting a company', async ({ page }) => {
  await installMockApi(page, { role: 'owner', seedCompanyId: null });
  await page.goto('/');

  await expect(page.getByRole('link')).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Open Company', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'System Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Manage Owners', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Manage Companies', exact: true })).toHaveCount(0);

  await page.goto('/admin/owners');
  await expect(page).toHaveURL(/\/open-company$/);
});

test('owners with a company cannot navigate to global administration', async ({ page }) => {
  await installMockApi(page, { role: 'owner', seedCompanyId: 7, seedShiftId: 21 });
  await page.goto('/dashboard');

  const adminNavigation = page.getByRole('complementary', { name: 'Primary navigation' });
  await adminNavigation.getByRole('button', { name: 'Admin' }).click();
  await expect(adminNavigation.getByRole('link', { name: 'Company Owners' })).toHaveCount(0);
  await expect(adminNavigation.getByRole('link', { name: 'Companies', exact: true })).toHaveCount(0);
  await expect(adminNavigation.getByRole('link', { name: 'Backups' })).toBeVisible();

  for (const path of ['/admin/owners', '/admin/companies']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/open-company$/);
    await expect(page.getByRole('heading', { name: /Company Owners|Companies/ })).toHaveCount(0);
  }
});

test('focus follows the primary route-transition workflow', async ({ page }) => {
  await installMockApi(page);
  await login(page);

  await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeFocused();
  await page.getByRole('link', { name: 'Open Company', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Open Company' })).toBeFocused();
  await page.getByRole('button', { name: /Midnight Lottery/ }).click();
  await expect(page.getByRole('heading', { name: 'Open Shift' })).toBeFocused();
  await page.getByRole('button', { name: /Morning Draws/ }).click();
  await page.getByRole('button', { name: /First Shift/ }).click();
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('heading', { name: 'Company Data' })).toBeFocused();
  await page.getByRole('link', { name: 'Add Sale', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add Sale' })).toBeFocused();
});

test('opens company and authorized shift without application chrome', async ({ page }) => {
  await installMockApi(page);
  await login(page);
  await page.getByRole('link', { name: 'Open Company', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Open Company' })).toBeVisible();
  await expect(page.locator('header')).toHaveCount(0);
  await expect(page.locator('aside')).toHaveCount(0);
  await expect(page.locator('footer')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/open-company-1440x900.png', fullPage: true });
  await page.getByRole('button', { name: /Midnight Lottery/ }).click();

  await expect(page.getByRole('heading', { name: 'Open Shift' })).toBeVisible();
  await expect(page.locator('header')).toHaveCount(0);
  await expect(page.locator('aside')).toHaveCount(0);
  await expect(page.locator('footer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /First Shift/ })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/open-shift-groups-1440x900.png', fullPage: true });

  await page.getByRole('button', { name: /Morning Draws/ }).click();
  await expect(page.getByRole('button', { name: /Morning Draws/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('button', { name: /Morning Draws/ })).toBeVisible();
  await page.getByRole('button', { name: /Morning Draws/ }).click();
  await page.getByRole('button', { name: /First Shift/ }).click();
  await expect(page.getByRole('button', { name: /First Shift/ })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/open-shift-list-1440x900.png', fullPage: true });
  await page.getByRole('button', { name: 'Open' }).click();

  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.locator('header').getByText('First Shift', { exact: true })).toBeVisible();
});

test('restores a no-company session to the compact landing', async ({ page }) => {
  await installMockApi(page, { seedCompanyId: null });
  await page.goto('/');
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.reload();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();
  await expect(page.getByText('Welcome, Admin User')).toBeVisible();
});

test('restores a company without a shift to the shift picker', async ({ page }) => {
  await installMockApi(page, { seedCompanyId: 7 });
  await page.goto('/');

  await expect(page).toHaveURL(/\/open-shift$/);
  await expect(page.getByRole('heading', { name: 'Open Shift' })).toBeVisible();
});

test('direct menu URL requires an active shift', async ({ page }) => {
  await installMockApi(page, { seedCompanyId: 7 });
  await page.goto('/menu');

  await expect(page).toHaveURL(/\/open-shift$/);
  await expect(page.getByRole('heading', { name: 'Open Shift' })).toBeVisible();
});

test('restores a company and authorized shift to the menu', async ({ page }) => {
  await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });
  await page.goto('/');

  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByRole('heading', { name: 'Company Data' })).toBeVisible();
  await expect(page.locator('header').getByText('First Shift', { exact: true })).toBeVisible();
});

test('company switch clears the active shift', async ({ page }) => {
  await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });
  await page.goto('/menu');
  await expect(page.locator('header').getByText('First Shift', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Midnight Lottery/ }).click();
  await page.getByRole('button', { name: /Evening Company/ }).click();

  await expect(page).toHaveURL(/\/open-shift$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('activeShiftId'))).toBe('');
});

test('stale restored shift is cleared and returns to shift picker', async ({ page }) => {
  await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21, staleShift: true });
  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/open-shift$/);
  await expect(page.getByRole('heading', { name: 'Open Shift' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('activeShiftId'))).toBe('');
});

test('cross-company shift rejection remains on shift picker', async ({ page }) => {
  await installMockApi(page, { foreignShift: true });
  await login(page);
  await page.getByRole('link', { name: 'Open Company', exact: true }).click();
  await page.getByRole('button', { name: /Midnight Lottery/ }).click();
  await page.getByRole('button', { name: /Morning Draws/ }).click();
  await page.getByRole('button', { name: /Foreign Shift/ }).click();
  await page.getByRole('button', { name: 'Open' }).click();

  await expect(page).toHaveURL(/\/open-shift$/);
  await expect(page.getByRole('alert')).toContainText('Shift not found for the active company.');
});

test.describe('role-aware menu', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('shows authorized sections and captures the stable target view', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-07-17T07:48:12.000Z'));
    await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });
    await page.goto('/menu');

    const companyData = page.getByRole('region', { name: 'Company Data' });
    const reports = page.getByRole('region', { name: 'Reports & Analytics' });
    const transactions = page.getByRole('region', { name: 'Transactions' });
    await expect(companyData).toBeVisible();
    await expect(reports).toBeVisible();
    await expect(transactions).toBeVisible();
    await expect(companyData.getByRole('link')).toHaveText([
      'Manage Users',
      'Shift Groups',
      'Shifts',
      'Provider Groups',
      'Providers',
      'Buyer Groups',
      'Buyers',
      'Item Groups',
      'Items',
      'Item Scheme Entry',
      'Item Schemes List',
      'Draws',
    ]);
    await expect(reports.getByRole('link')).toHaveText([
      'P&L Summary',
      'Buyer Ledger',
      'Provider Ledger',
      'Result Analyzer',
    ]);
    await expect(transactions.getByRole('link')).toHaveText([
      'Add Purchase',
      'Purchase List',
      'Add Purchase Return',
      'Purchase Return List',
      'Add Sale',
      'Sale List',
      'Add Sale Return',
      'Sale Return List',
      'Add Booking',
      'Booking List',
      'Winning Tickets',
      'Open Dashboard',
    ]);
    await expect(page.getByRole('button', { name: /Midnight Lottery/ })).toBeVisible();
    const header = page.locator('header');
    await expect(header.getByText('Morning Draws', { exact: true })).toBeVisible();
    await expect(header.getByText('First Shift', { exact: true })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Open Company' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(header.getByRole('button', { name: 'Logout' })).toBeVisible();
    await expect(header.locator('time')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const rect = document.querySelector('header time')?.getBoundingClientRect();
          return rect ? Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2) : Infinity;
        }),
      )
      .toBeLessThanOrEqual(1);
    const footer = page.getByRole('contentinfo');
    await expect(footer).toContainText('Shift group: Morning Draws');
    await expect(footer).toContainText('Shift: First Shift');
    await expect(page.locator('aside')).toHaveCount(0);
    await expect(transactions.getByRole('link', { name: 'Add Sale', exact: true })).toHaveCSS('font-size', '12px');
    await expect(companyData).toHaveCSS('border-right-style', 'solid');
    await expect(reports).toHaveCSS('border-right-style', 'solid');
    await page.screenshot({ path: 'test-results/menu-admin-1920x1080.png', fullPage: true });

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  });

  const roleMatrix = [
    {
      role: 'admin',
      visible: ['Manage Users', 'P&L Summary', 'Result Analyzer'],
    },
    {
      role: 'owner',
      visible: ['Manage Users', 'P&L Summary', 'Result Analyzer'],
    },
    {
      role: 'manager',
      visible: ['Manage Users', 'P&L Summary', 'Result Analyzer'],
    },
    {
      role: 'supervisor',
      visible: ['Result Analyzer'],
    },
    {
      role: 'data_entry',
      visible: [],
    },
  ] as const;
  const sensitiveLinks = [
    'Manage Users',
    'P&L Summary',
    'Result Analyzer',
  ] as const;

  for (const { role, visible } of roleMatrix) {
    test(`matches sensitive-link permissions for ${role}`, async ({ page }) => {
      await installMockApi(page, { role, seedCompanyId: 7, seedShiftId: 21 });
      await page.goto('/menu');

      await expect(page.getByRole('link', { name: 'Add Sale', exact: true })).toBeVisible();
      for (const label of sensitiveLinks) {
        await expect(page.getByRole('link', { name: label, exact: true })).toHaveCount(
          visible.includes(label) ? 1 : 0,
        );
      }
    });
  }

  test('opens dashboard and sale entry from explicit actions', async ({ page }) => {
    await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });
    await page.goto('/menu');

    await page.getByRole('link', { name: 'Open Dashboard' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Welcome, Admin User' })).toBeVisible();

    await page.goto('/menu');
    await page.getByRole('link', { name: 'Add Sale', exact: true }).click();
    await expect(page).toHaveURL(/\/transactions\/sale-entry$/);
  });

  test('collapses sidebar to a module rail and reopens the selected module', async ({ page }) => {
    await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });
    await page.goto('/dashboard');

    const sidebar = page.getByRole('complementary', { name: 'Primary navigation' });
    await expect(sidebar).toHaveCSS('width', '232px');

    const collapse = page.getByRole('button', { name: 'Collapse sidebar' });
    await collapse.focus();
    await collapse.press('Enter');

    await expect(sidebar).toHaveCSS('width', '56px');
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    await expect(sidebar.getByText('Active company')).toHaveCount(0);

    await sidebar.getByRole('button', { name: 'Transactions' }).click();
    await expect(sidebar).toHaveCSS('width', '232px');
    await expect(sidebar.getByRole('link', { name: 'Purchase Entry' })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Transactions' })).toBeFocused();
  });

  test('dashboard limits recent transactions newest-first and shows today’s draw', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-07-17T07:48:12.000Z'));
    await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });
    await page.goto('/dashboard');

    await expect(page.getByRole('region', { name: "Today's performance" }).locator(':scope > div')).toHaveCount(4);
    const recentRows = page.getByRole('region', { name: 'Recent transactions' }).getByRole('row');
    await expect(recentRows).toHaveCount(7);
    await expect(recentRows.nth(1)).toContainText('508');
    await expect(recentRows.nth(6)).toContainText('503');
    await expect(page.getByRole('region', { name: 'Recent transactions' })).not.toContainText('502');
    await expect(page.getByRole('complementary', { name: 'Current operation status' })).toContainText('Morning 10:00');
    await expect(page.getByRole('complementary', { name: 'Current operation status' })).toContainText('open');
  });

  test('dashboard respects its content cap without horizontal overflow', async ({ page }) => {
    await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });

    for (const width of [1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/dashboard');
      await expect(page.getByRole('region', { name: 'Recent transactions' })).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
      await expect
        .poll(async () => (await page.locator('main > div').boundingBox())?.width ?? 0)
        .toBeGreaterThanOrEqual(Math.min(width - 320, 1440));
    }
  });

  test('lower roles skip financial KPIs and expose only allowed quick actions', async ({ page }) => {
    await installMockApi(page, { role: 'data_entry', seedCompanyId: 7, seedShiftId: 21 });
    await page.goto('/dashboard');

    await expect(page.getByRole('region', { name: "Today's performance" })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('reportsSummaryCalls'))).toBeNull();
    const quickActions = page.getByRole('region', { name: 'Quick actions' }).getByRole('link');
    await expect(quickActions).toHaveCount(4);
    await expect(quickActions).toHaveText(['New Sale', 'New Purchase', 'New Booking', 'View Draws']);
  });

  test('transaction panel retries independently after an error', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-07-17T07:48:12.000Z'));
    await installMockApi(page, {
      seedCompanyId: 7,
      seedShiftId: 21,
      transactionsFailOnce: true,
    });
    await page.goto('/dashboard');

    const recentPanel = page.getByRole('region', { name: 'Recent transactions' });
    await expect(recentPanel.getByRole('alert')).toHaveText('Temporary transaction failure.');
    await expect(page.getByRole('complementary', { name: 'Current operation status' })).toContainText('Morning 10:00');
    await recentPanel.getByRole('button', { name: 'Retry' }).click();
    await expect(recentPanel.getByRole('row')).toHaveCount(7);
  });

  test('enters, edits, saves, and captures the blue sale spreadsheet', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-07-17T07:48:12.000Z'));
    await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });
    await page.goto('/menu');
    await page.getByRole('link', { name: 'Add Sale', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Add Sale' })).toBeVisible();
    await expect(page.locator('aside')).toHaveCount(0);
    // Status footer is app chrome (connection); sale entry still hides the module sidebar.
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.getByLabel('Draw *')).toHaveValue('31');
    await expect(page.getByLabel('Party Name *')).toHaveValue('Blue Star Agency');
    await expect(page.getByLabel('Date')).toHaveValue('2026-07-17');
    await expect(page.getByLabel('Memo ID')).toHaveValue('501');

    await page.getByLabel('Row 1 item name').selectOption('51');
    await page.getByLabel('Row 1 from ticket').fill('00001');
    await page.getByLabel('Row 1 from ticket').blur();
    // Diff mode: To = From + N → 00001 + 2 = 00003 (qty 3)
    await page.getByLabel('Row 1 to ticket').fill('2');
    await page.getByLabel('Row 1 to ticket').press('Tab');
    await page.getByLabel('Row 1 rate').fill('2.5');
    await expect(page.getByRole('row', { name: /Dear 100/ })).toContainText('3');
    await expect(page.getByRole('row', { name: /Dear 100/ })).toContainText('7.50');

    await page.screenshot({
      path: 'test-results/sale-entry-blue-1920x1080.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Save (F2)' }).click();

    await expect(page.getByText('3 tickets saved.')).toBeVisible();
    await expect(page.getByLabel('Row 1 item name')).toHaveValue('');
    await expect(page.getByLabel('Memo ID')).toHaveValue('502');
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem('transactionsCreatePayload') ?? 'null')),
      )
      .toEqual({
        type: 'sale',
        companyId: 7,
        userId: 1,
        drawId: 31,
        buyerId: 41,
        memoId: 501,
        ticketCount: 3,
        ticketData:
          '{"ranges":[{"itemId":51,"code":"DR","from":"00001","to":"00003","qty":3,"rate":2.5,"amount":7.5}]}',
        amount: 7.5,
        enteredAt: '2026-07-17',
      });
  });
});

test('direct transaction URL requires an active shift', async ({ page }) => {
  await installMockApi(page, { seedCompanyId: 7 });
  await page.goto('/transactions/sale-entry');

  await expect(page).toHaveURL(/\/open-shift$/);
  await expect(page.getByRole('heading', { name: 'Open Shift' })).toBeVisible();
});

test('company-scoped routes still require an active company', async ({ page }) => {
  await installMockApi(page, { seedCompanyId: null });

  for (const path of ['/admin/audit-logs', '/master/users']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/open-company$/);
  }
});

test('ignores stale shift-list responses after choosing another group', async ({ page }) => {
  await installMockApi(page, { seedCompanyId: 7, racingShiftGroups: true });
  await page.goto('/open-shift');

  await page.getByRole('button', { name: /Morning Draws/ }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: /Evening Draws/ }).click();

  await expect(page.getByRole('button', { name: /Second Shift/ })).toBeVisible();
  await page.waitForTimeout(250);
  await expect(page.getByRole('button', { name: /First Shift/ })).toHaveCount(0);
});

test('hides shift setup from roles that cannot manage shifts', async ({ page }) => {
  await installMockApi(page, { role: 'data_entry', seedCompanyId: 7, noShiftGroups: true });
  await page.goto('/open-shift');

  await expect(page.getByText('No shift groups are configured for this company.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set up shift groups' })).toHaveCount(0);
});
