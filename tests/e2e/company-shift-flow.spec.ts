import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

type MockOptions = {
  role?: 'admin' | 'owner' | 'manager' | 'supervisor' | 'data_entry';
  seedCompanyId?: number | null;
  seedShiftId?: number | null;
  staleShift?: boolean;
  foreignShift?: boolean;
  noShiftGroups?: boolean;
  racingShiftGroups?: boolean;
};

async function installMockApi(page: Page, options: MockOptions = {}) {
  await page.addInitScript((mockOptions) => {
    const baseUser = {
      id: 1,
      username: 'admin',
      fullName: 'Admin User',
      role: mockOptions.role ?? 'admin',
      companyId: null,
      activeCompanyId: null,
    };
    if (!localStorage.getItem('mockInitialized')) {
      localStorage.setItem('mockInitialized', 'true');
      localStorage.setItem('authenticated', mockOptions.seedCompanyId !== undefined ? 'true' : 'false');
      localStorage.setItem('activeCompanyId', String(mockOptions.seedCompanyId ?? ''));
      localStorage.setItem('activeShiftId', String(mockOptions.seedShiftId ?? ''));
    }

    const getId = (key: string) => {
      const value = localStorage.getItem(key);
      return value ? Number(value) : null;
    };
    const activeShift = {
      id: 21,
      name: 'First Shift',
      shiftGroupId: 11,
      shiftGroupName: 'Morning Draws',
    };
    const listeners = new Set<() => void>();
    const ok = async () => ({ success: true });

    Object.defineProperty(window, 'api', {
      value: {
        authRestore: async () => {
          if (localStorage.getItem('authenticated') !== 'true') {
            return { success: false, error: 'No stored session' };
          }
          const companyId = getId('activeCompanyId');
          return {
            success: true,
            user: { ...baseUser, activeCompanyId: companyId },
            sessionToken: 'test-token',
            companyName: companyId === 8 ? 'Evening Company' : companyId === 7 ? 'Midnight Lottery' : null,
          };
        },
        authLogin: async () => {
          localStorage.setItem('authenticated', 'true');
          localStorage.setItem('activeCompanyId', '');
          localStorage.setItem('activeShiftId', '');
          return { success: true, user: baseUser, sessionToken: 'test-token' };
        },
        authLogout: ok,
        userGetCompanies: async () => ({
          success: true,
          companies: [
            { id: 7, name: 'Midnight Lottery', status: 'active' },
            { id: 8, name: 'Evening Company', status: 'active' },
          ],
        }),
        userSetActiveCompany: async (_userId: number, companyId: number) => {
          localStorage.setItem('activeCompanyId', String(companyId));
          localStorage.setItem('activeShiftId', '');
          return {
            success: true,
            user: { ...baseUser, activeCompanyId: companyId },
            companyName: companyId === 8 ? 'Evening Company' : 'Midnight Lottery',
          };
        },
        shiftGroupsList: async () => ({
          success: true,
          groups: mockOptions.noShiftGroups
            ? []
            : [
                { id: 11, name: 'Morning Draws', companyId: getId('activeCompanyId') ?? 7 },
                ...(mockOptions.racingShiftGroups
                  ? [{ id: 12, name: 'Evening Draws', companyId: getId('activeCompanyId') ?? 7 }]
                  : []),
              ],
        }),
        shiftsList: async (shiftGroupId: number) => {
          if (mockOptions.racingShiftGroups && shiftGroupId === 11) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
          return {
            success: true,
            shifts: mockOptions.foreignShift
              ? [{ id: 99, name: 'Foreign Shift', shiftGroupId: 11 }]
              : shiftGroupId === 12
                ? [{ id: 22, name: 'Second Shift', shiftGroupId: 12 }]
                : [{ id: 21, name: 'First Shift', shiftGroupId: 11 }],
          };
        },
        shiftsSelect: async (id: number) => {
          if (id === 99) {
            return { success: false, error: 'Shift not found for the active company.' };
          }
          localStorage.setItem('activeShiftId', String(id));
          return { success: true, shift: activeShift };
        },
        shiftsGetActive: async () => {
          if (mockOptions.staleShift) {
            localStorage.setItem('activeShiftId', '');
            return { success: true, shift: null };
          }
          return {
            success: true,
            shift: getId('activeShiftId') === 21 ? activeShift : null,
          };
        },
        dbGetStatus: async () => ({ connected: true }),
        prefsGet: async () => ({ autoBackup: false, lastBackupDate: null, networkMode: 'client' }),
        onDbConnectionLost: (callback: () => void) => {
          listeners.add(callback);
          return () => listeners.delete(callback);
        },
        onDbConnectionRestored: (callback: () => void) => {
          listeners.add(callback);
          return () => listeners.delete(callback);
        },
        onAppLogout: (callback: () => void) => {
          listeners.add(callback);
          return () => listeners.delete(callback);
        },
        onAppNavigate: () => () => undefined,
        sessionHeartbeat: ok,
        sessionActiveCount: async () => ({ success: true, count: 1 }),
        windowSetTitle: async () => undefined,
        reportsSummary: async () => ({
          success: true,
          summary: { drawsToday: 1, sales: 0, purchases: 0, net: 0 },
        }),
        drawsList: async () => ({
          success: true,
          draws: [
            {
              id: 31,
              name: 'Morning 10:00',
              drawDate: '2026-07-17T00:00:00.000Z',
              status: 'open',
              closeTime: null,
            },
          ],
        }),
        buyersList: async () => ({
          success: true,
          buyers: [
            {
              id: 41,
              name: 'Blue Star Agency',
              type: 'seller',
              saleRate: '2.5',
            },
          ],
        }),
        itemsList: async () => ({
          success: true,
          items: [{ id: 51, name: 'Dear 100', code: 'DR' }],
        }),
        transactionsNextMemoId: async () => {
          const saved = localStorage.getItem('transactionsCreatePayload') != null;
          return { success: true, nextMemoId: saved ? 502 : 501 };
        },
        transactionsCreate: async (payload: unknown) => {
          localStorage.setItem('transactionsCreatePayload', JSON.stringify(payload));
          return { success: true, transactionId: 61 };
        },
      },
      configurable: true,
    });
  }, options);
}

async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('Username').fill('admin');
  await page.locator('#password').fill('admin123');
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('shows the shell after login, then opens company and shift without it', async ({ page }) => {
  await installMockApi(page);
  await login(page);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('aside')).toBeVisible();
  await expect(page.getByText('Welcome, Admin User')).toBeVisible();
  await page.locator('aside').getByRole('link', { name: 'Open Company' }).click();

  await expect(page.getByRole('heading', { name: 'Open Company' })).toBeVisible();
  await expect(page.locator('aside')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/open-company-1440x900.png', fullPage: true });
  await page.getByRole('button', { name: /Midnight Lottery/ }).click();

  await expect(page.getByRole('heading', { name: 'Open Shift' })).toBeVisible();
  await expect(page.locator('aside')).toHaveCount(0);
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
  await expect(page.getByText('First Shift')).toBeVisible();
});

test('fresh-login reload remains on the authenticated shell', async ({ page }) => {
  await installMockApi(page);
  await login(page);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.reload();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('aside')).toBeVisible();
  await expect(page.getByText('Welcome, Admin User')).toBeVisible();
});

test('company switch clears the active shift', async ({ page }) => {
  await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });
  await page.goto('/menu');
  await expect(page.getByText('First Shift')).toBeVisible();

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
  await page.locator('aside').getByRole('link', { name: 'Open Company' }).click();
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

    await expect(page.getByRole('heading', { name: 'Company Data' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reports & Analytics' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Open Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Midnight Lottery/ })).toBeVisible();
    await expect(page.getByText('First Shift')).toBeVisible();
    await expect(page.locator('aside')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Add Sale' })).toHaveCSS('font-size', '14px');

    await page.screenshot({ path: 'test-results/menu-admin-1920x1080.png', fullPage: true });
  });

  const roleMatrix = [
    {
      role: 'admin',
      visible: ['Company Owners', 'Companies', 'Backups', 'Diagnostics', 'Audit Logs', 'Users', 'P&L', 'Draw Results'],
    },
    {
      role: 'owner',
      visible: ['Company Owners', 'Companies', 'Backups', 'Audit Logs', 'Users', 'P&L', 'Draw Results'],
    },
    {
      role: 'manager',
      visible: ['Audit Logs', 'Users', 'Draw Results'],
    },
    {
      role: 'supervisor',
      visible: ['Draw Results'],
    },
    {
      role: 'data_entry',
      visible: [],
    },
  ] as const;
  const sensitiveLinks = [
    'Company Owners',
    'Companies',
    'Backups',
    'Diagnostics',
    'Audit Logs',
    'Users',
    'P&L',
    'Draw Results',
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
    await page.getByRole('link', { name: 'Add Sale' }).click();
    await expect(page).toHaveURL(/\/transactions\/sale-entry$/);
  });

  test('enters, edits, saves, and captures the blue sale spreadsheet', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-07-17T07:48:12.000Z'));
    await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });
    await page.goto('/menu');
    await page.getByRole('link', { name: 'Add Sale' }).click();

    await expect(page.getByRole('heading', { name: 'Sales Entry' })).toBeVisible();
    await expect(page.locator('aside')).toHaveCount(0);
    await expect(page.locator('footer')).toHaveCount(0);
    await expect(page.getByLabel('Draw *')).toHaveValue('31');
    await expect(page.getByLabel('Sale To *')).toHaveValue('41');
    await expect(page.getByLabel('Date')).toHaveValue('2026-07-17');
    await expect(page.getByLabel('Memo ID')).toHaveValue('501');

    await page.getByLabel('Row 1 lottery type').selectOption('51');
    await page.getByLabel('Row 1 from ticket').fill('00001');
    await page.getByLabel('Row 1 to ticket').fill('00003');
    await expect(page.getByLabel('Row 1 amount')).toHaveValue('7.50');
    await expect(page.getByRole('row', { name: /Dear 100/ })).toContainText('3');

    await page.getByLabel('Row 1 amount').press('Enter');
    await expect(page.getByLabel('Row 2 lottery type')).toBeVisible();
    await page.getByLabel('Row 2 amount').press('F5');
    await expect(page.getByLabel('Row 2 lottery type')).toHaveCount(0);

    await page.screenshot({
      path: 'test-results/sale-entry-blue-1920x1080.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Save Sale' }).click();

    await expect(page.getByText('3 tickets saved.')).toBeVisible();
    await expect(page.getByLabel('Row 1 lottery type')).toHaveValue('');
    await expect(page.getByLabel('Row 1 amount')).toHaveValue('');
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
