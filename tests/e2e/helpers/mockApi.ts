import { type Page } from '@playwright/test';

export type MockOptions = {
  role?: 'admin' | 'owner' | 'manager' | 'supervisor' | 'data_entry';
  seedCompanyId?: number | null;
  seedShiftId?: number | null;
  staleShift?: boolean;
  foreignShift?: boolean;
  noShiftGroups?: boolean;
  racingShiftGroups?: boolean;
  transactionsFailOnce?: boolean;
  /** When true, buyerGroupsList returns empty groups (booking party B04). */
  noBuyerGroups?: boolean;
};

export async function installMockApi(page: Page, options: MockOptions = {}) {
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
    let transactionListAttempts = 0;

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
        authGetOwners: async () =>
          baseUser.role === 'admin'
            ? {
                success: true,
                users: [
                  {
                    id: 2,
                    username: 'owner',
                    fullName: 'Company Owner',
                    role: 'owner',
                    companyId: null,
                    activeCompanyId: null,
                  },
                ],
              }
            : { success: false, error: 'Admin access required.' },
        authGetOwnerAdminUsers: async () =>
          baseUser.role === 'admin'
            ? {
                success: true,
                users: [
                  {
                    id: 1,
                    username: 'admin',
                    fullName: 'Admin User',
                    role: 'admin',
                    companyId: null,
                    activeCompanyId: null,
                  },
                ],
              }
            : { success: false, error: 'Admin access required.' },
        companiesGetAll: async () =>
          baseUser.role === 'admin'
            ? {
                success: true,
                companies: [
                  {
                    id: 7,
                    name: 'Midnight Lottery',
                    ownerId: 2,
                    ownerName: 'Company Owner',
                    status: 'active',
                    billingLocked: false,
                  },
                ],
              }
            : { success: false, error: 'Admin access required.' },
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
        reportsSummary: async () => {
          const calls = Number(localStorage.getItem('reportsSummaryCalls') ?? '0') + 1;
          localStorage.setItem('reportsSummaryCalls', String(calls));
          return {
            success: true,
            summary: { drawsToday: 1, sales: 0, purchases: 0, net: 0 },
          };
        },
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
        transactionsList: async () => {
          transactionListAttempts += 1;
          if (mockOptions.transactionsFailOnce && transactionListAttempts <= 2) {
            return { success: false, error: 'Temporary transaction failure.' };
          }
          return {
            success: true,
            transactions: [503, 508, 501, 506, 502, 507, 504, 505].map((memoId) => ({
              id: memoId - 440,
              type: memoId % 2 === 0 ? 'sale' : 'purchase',
              memoId,
              drawName: 'Morning 10:00',
              providerName: memoId % 2 === 0 ? null : 'Lucky Provider',
              buyerName: memoId % 2 === 0 ? 'Blue Star Agency' : null,
              amount: '1250.00',
              enteredAt: `2026-07-17T${String(memoId - 500).padStart(2, '0')}:00:00.000Z`,
            })),
          };
        },
        buyersList: async () => ({
          success: true,
          buyers: [
            {
              id: 41,
              name: 'Blue Star Agency',
              type: 'seller',
              saleRate: '2.5',
            },
            ...JSON.parse(localStorage.getItem('extraBuyers') ?? '[]'),
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
        // --- mount stubs for master / reports / admin / returns ---
        dbGetConfig: async () => ({
          success: true,
          config: { host: '127.0.0.1', port: 5432, database: 'best12_dev', user: 'postgres' },
        }),
        lanGetStatus: async () => ({ isBroadcasting: false, port: 41234, localIp: '127.0.0.1' }),
        authGetAllUsers: async () => ({
          success: true,
          users: [
            {
              id: 1,
              username: 'admin',
              fullName: 'Admin User',
              role: 'admin',
              companyId: null,
              activeCompanyId: null,
            },
          ],
        }),
        authGetUsers: async () => ({
          success: true,
          users: [{ id: 1, username: 'admin', fullName: 'Admin User', role: 'admin' }],
        }),
        providerGroupsList: async () => ({
          success: true,
          groups: [{ id: 71, name: 'Default Providers', companyId: getId('activeCompanyId') ?? 7 }],
        }),
        providersList: async () => ({
          success: true,
          providers: [{ id: 81, name: 'Lucky Provider', providerGroupId: 71, purchaseRate: '1.5' }],
        }),
        providersCreate: async (payload: {
          name: string;
          providerGroupId: number;
        }) => {
          localStorage.setItem('providersCreatePayload', JSON.stringify(payload));
          return {
            success: true,
            provider: {
              id: 82,
              name: payload.name,
              providerGroupId: payload.providerGroupId,
              purchaseRate: null,
            },
          };
        },
        buyerGroupsList: async () => ({
          success: true,
          groups: mockOptions.noBuyerGroups
            ? []
            : [{ id: 61, name: 'Default Buyers', companyId: getId('activeCompanyId') ?? 7 }],
        }),
        buyersCreate: async (payload: {
          name: string;
          type?: string;
          buyerGroupId: number;
        }) => {
          const calls = Number(localStorage.getItem('buyersCreateCalls') ?? '0') + 1;
          localStorage.setItem('buyersCreateCalls', String(calls));
          localStorage.setItem('buyersCreatePayload', JSON.stringify(payload));
          const buyer = {
            id: 42,
            name: payload.name,
            type: payload.type ?? 'stockist',
            saleRate: '2.5',
            buyerGroupId: payload.buyerGroupId,
          };
          const prev = JSON.parse(localStorage.getItem('extraBuyers') ?? '[]');
          prev.push(buyer);
          localStorage.setItem('extraBuyers', JSON.stringify(prev));
          return { success: true, buyer };
        },
        itemGroupsList: async () => ({
          success: true,
          groups: [{ id: 91, name: 'Default Items', companyId: getId('activeCompanyId') ?? 7 }],
        }),
        itemSchemesList: async () => ({ success: true, schemes: [] }),
        itemSchemesListByItem: async () => ({ success: true, schemes: [] }),
        itemSchemesGet: async () => ({ success: false, error: 'Not found' }),
        drawResultsList: async () => ({ success: true, results: [] }),
        winningTicketsList: async () => ({ success: true, tickets: [] }),
        reportsDashboard: async () => ({
          success: true,
          dashboard: { drawsToday: 1, sales: 0, purchases: 0, net: 0 },
        }),
        auditLogsList: async () => ({ success: true, logs: [] }),
        backupsList: async () => ({ success: true, backups: [] }),
        diagnosticsGet: async () => ({
          success: true,
          data: {
            dbConnected: true,
            dbVersion: 'PostgreSQL 16.0',
            dbConfig: { host: '127.0.0.1', port: 5432, database: 'best12_dev', user: 'postgres' },
            networkMode: 'client',
            broadcast: { isBroadcasting: false, port: 41234, localIp: '127.0.0.1' },
            autoBackup: false,
            lastBackupDate: null,
            lastBackupRecordAt: null,
            tableCounts: { users: 1, companies: 1, transactions: 0, draws: 1 },
            activeSessions: [],
            appVersion: '1.0.0',
            electronVersion: '0.0.0',
            nodeVersion: '20.0.0',
          },
        }),
        transactionsGetBuyerSaleSummary: async () => ({
          success: true,
          summary: { totalSold: 0, totalReturned: 0, net: 0 },
        }),
        transactionsGetProviderPurchaseSummary: async () => ({
          success: true,
          summary: { totalPurchased: 0, totalReturned: 0, net: 0 },
        }),
      },
      configurable: true,
    });
  }, options);
}
