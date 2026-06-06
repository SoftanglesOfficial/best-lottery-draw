import { ipcMain } from 'electron';
import {
  createUser,
  changePassword,
  deleteUser,
  getAllUsers,
  getOwnerAdminUsers,
  getOwners,
  getUserCompanyIds,
  getUsersByCompany,
  login,
  updateUser,
} from './auth';
import {
  cloneCompany,
  createCompany,
  getAllCompanies,
  setCompanyBillingLock,
  setCompanyStatus,
  updateCompany,
} from './companies';
import {
  createBuyer,
  createBuyerGroup,
  deleteBuyer,
  deleteBuyerGroup,
  listBuyerGroups,
  listBuyers,
  updateBuyer,
  updateBuyerGroup,
} from './buyers';
import {
  createItem,
  createItemGroup,
  createItemScheme,
  deleteItem,
  deleteItemGroup,
  deleteItemScheme,
  getItemScheme,
  getItemSchemePrizes,
  listItemGroups,
  listItemSchemes,
  listItemSchemesByItem,
  listItems,
  updateItem,
  updateItemGroup,
  updateItemScheme,
} from './items';
import {
  createProvider,
  createProviderGroup,
  deleteProvider,
  deleteProviderGroup,
  listProviderGroups,
  listProviders,
  updateProvider,
  updateProviderGroup,
} from './providers';
import { getReportsSummary, getLedgerList, getLedgerAllSummary, getPnLReport, getReportsDashboard, listAuditLogs } from './reports';
import { createBackup, restoreBackup, listBackups } from './backups';
import {
  bulkRateUpdate,
  changeBuyerRate,
  changeCommission,
  changeProviderRate,
  deleteMemos,
  reindexDatabase,
} from './utilities';
import {
  createDraw,
  createDrawResults,
  createWinningTickets,
  deleteDraw,
  deleteWinningTicket,
  findWinners,
  listDrawAuditLogs,
  listDrawResults,
  listDraws,
  listWinningTickets,
  lockDraw,
  unlockDraw,
  updateDraw,
} from './draws';
import {
  createTransaction,
  deleteTransaction,
  getBuyerSaleSummary,
  getProviderPurchaseSummary,
  listTransactions,
  nextMemoId,
  searchTicket,
  updateTransaction,
  validateTicketsSold,
} from './transactions';
import {
  createShift,
  createShiftGroup,
  deleteShift,
  deleteShiftGroup,
  listShiftGroups,
  listShifts,
  updateShift,
  updateShiftGroup,
} from './shifts';
import {
  assignUserCompany,
  getUserCompanies,
  listUserCompanies,
  removeUserCompany,
  setActiveCompany,
} from './users';
import { connectDb, getStoredConfig, setupDb, getDbStatus, testDbConnection, reconnectDb } from '../db';
import { getPreferences, setAutoBackup, setNetworkMode, type NetworkMode } from '../preferences';
import { discoverServer, getBroadcastStatus, startBroadcast, stopBroadcast } from '../lan';
import { sessionHeartbeat, sessionActiveCount } from './sessions';
import { getDiagnostics } from './diagnostics';
import type {
  BuyerGroupInput,
  BuyerInput,
  CompanyInput,
  CompanyStatus,
  DbConfig,
  DrawInput,
  DrawResultInput,
  ItemGroupInput,
  ItemInput,
  ItemSchemeInput,
  ProviderGroupInput,
  ProviderInput,
  ShiftGroupInput,
  ShiftInput,
  TransactionInput,
  UserInput,
  AuditLogFilters,
  UserRole,
  WinningTicketInput,
} from '../../shared/types';

const IPC_CHANNELS = [
  'db-get-config', 'db-connect', 'db-setup', 'db-get-status', 'db-test-connection',
  'prefs-get', 'prefs-set-auto-backup', 'prefs-set-network-mode',
  'db-reconnect',
  'lan-get-status', 'lan-set-mode', 'lan-start-broadcast', 'lan-stop-broadcast', 'lan-discover-server',
  'sessions-heartbeat', 'sessions-active-count', 'diagnostics-get',
  'auth-login', 'auth-create-user', 'auth-change-password',
  'auth-get-users', 'auth-get-all-users', 'auth-get-owners', 'auth-get-owner-admin-users',
  'auth-get-user-company-ids', 'auth-update-user', 'auth-delete-user',
  'user-get-companies', 'user-set-active-company', 'user-companies-assign',
  'user-companies-remove', 'user-companies-list',
  'companies-get-all', 'companies-create', 'companies-update', 'companies-clone',
  'companies-set-status', 'companies-set-billing-lock', 'reports-summary',
  'reports-dashboard', 'reports-pnl', 'ledger-list', 'ledger-all-summary', 'audit-logs-list',
  'backups-create', 'backups-restore', 'backups-list',
  'utilities-change-buyer-rate', 'utilities-change-provider-rate', 'utilities-change-commission',
  'utilities-bulk-rate-update', 'utilities-delete-memos', 'utilities-reindex',
  'shift-groups-list', 'shift-groups-create', 'shift-groups-update', 'shift-groups-delete',
  'shifts-list', 'shifts-create', 'shifts-update', 'shifts-delete',
  'provider-groups-list', 'provider-groups-create', 'provider-groups-update', 'provider-groups-delete',
  'providers-list', 'providers-create', 'providers-update', 'providers-delete',
  'buyer-groups-list', 'buyer-groups-create', 'buyer-groups-update', 'buyer-groups-delete',
  'buyers-list', 'buyers-create', 'buyers-update', 'buyers-delete',
  'item-groups-list', 'item-groups-create', 'item-groups-update', 'item-groups-delete',
  'items-list', 'items-create', 'items-update', 'items-delete',
  'itemSchemes-list', 'itemSchemes-listByItem', 'itemSchemes-create', 'itemSchemes-get',
  'itemSchemes-getPrizes', 'itemSchemes-update', 'itemSchemes-delete',
  'draws-list', 'draws-create', 'draws-update', 'draws-delete', 'draws-lock', 'draws-unlock',
  'draws-audit-list', 'draw-results-list', 'draw-results-create',
  'winning-tickets-list', 'winning-tickets-create', 'winning-tickets-delete',
  'winning-tickets-find-winners', 'transactions-search-ticket',
  'transactions-list', 'transactions-next-memo-id', 'transactions-create',
  'transactions-update', 'transactions-delete', 'transactions-validate-tickets-sold',
  'transactions-get-buyer-sale-summary', 'transactions-get-provider-purchase-summary',
] as const;

export function registerIpcHandlers(): void {
  for (const channel of IPC_CHANNELS) ipcMain.removeHandler(channel);

  ipcMain.handle('db-get-config', () => getStoredConfig());
  ipcMain.handle('db-connect', async (_e, config: DbConfig) => connectDb(config));
  ipcMain.handle('db-setup', async () => setupDb());
  ipcMain.handle('db-get-status', async () => getDbStatus());
  ipcMain.handle('db-test-connection', async (_e, config: DbConfig) => testDbConnection(config));
  ipcMain.handle('prefs-get', () => getPreferences());
  ipcMain.handle('db-reconnect', async () => reconnectDb());
  ipcMain.handle('prefs-set-network-mode', (_e, mode: NetworkMode) => {
    setNetworkMode(mode);
    return { success: true, mode };
  });
  ipcMain.handle('lan-get-status', () => getBroadcastStatus());
  ipcMain.handle('lan-set-mode', (_e, mode: NetworkMode) => {
    setNetworkMode(mode);
    if (mode === 'server') {
      return startBroadcast();
    }
    stopBroadcast();
    return { success: true };
  });
  ipcMain.handle('lan-start-broadcast', () => startBroadcast());
  ipcMain.handle('lan-stop-broadcast', () => {
    stopBroadcast();
    return { success: true };
  });
  ipcMain.handle('lan-discover-server', async () => discoverServer());
  ipcMain.handle('sessions-heartbeat', async (_e, userId: number, companyId: number, ip?: string) =>
    sessionHeartbeat(userId, companyId, ip),
  );
  ipcMain.handle('sessions-active-count', async (_e, companyId: number) =>
    sessionActiveCount(companyId),
  );
  ipcMain.handle('diagnostics-get', async () => getDiagnostics());
  ipcMain.handle('auth-login', async (_e, u: string, p: string) => login(u, p));
  ipcMain.handle('auth-change-password', async (_e, userId: number, current: string, newPass: string) =>
    changePassword(userId, current, newPass),
  );
  ipcMain.handle('auth-create-user', async (_e, data: UserInput) => createUser(data));
  ipcMain.handle('auth-get-users', async (_e, companyId: number) => getUsersByCompany(companyId));
  ipcMain.handle('auth-get-all-users', async () => getAllUsers());
  ipcMain.handle('auth-get-owners', async () => getOwners());
  ipcMain.handle('auth-get-owner-admin-users', async () => getOwnerAdminUsers());
  ipcMain.handle('auth-get-user-company-ids', async (_e, userId: number) => getUserCompanyIds(userId));
  ipcMain.handle('auth-update-user', async (_e, id: number, data: Partial<UserInput>) => updateUser(id, data));
  ipcMain.handle('auth-delete-user', async (_e, id: number, currentUserId: number) => deleteUser(id, currentUserId));
  ipcMain.handle('user-get-companies', async (_e, userId: number) => getUserCompanies(userId));
  ipcMain.handle('user-set-active-company', async (_e, userId: number, companyId: number) => setActiveCompany(userId, companyId));
  ipcMain.handle('user-companies-assign', async (_e, userId: number, companyId: number) => assignUserCompany(userId, companyId));
  ipcMain.handle('user-companies-remove', async (_e, userId: number, companyId: number) => removeUserCompany(userId, companyId));
  ipcMain.handle('user-companies-list', async (_e, userId: number) => listUserCompanies(userId));
  ipcMain.handle('companies-get-all', async () => getAllCompanies());
  ipcMain.handle('companies-create', async (_e, data: CompanyInput) => createCompany(data));
  ipcMain.handle('companies-update', async (_e, id: number, data: CompanyInput) => updateCompany(id, data));
  ipcMain.handle('companies-clone', async (_e, id: number) => cloneCompany(id));
  ipcMain.handle('companies-set-status', async (_e, id: number, status: CompanyStatus) => setCompanyStatus(id, status));
  ipcMain.handle('companies-set-billing-lock', async (_e, id: number, locked: boolean) => setCompanyBillingLock(id, locked));
  ipcMain.handle('reports-summary', async (_e, companyId: number, from: string, to: string) => getReportsSummary(companyId, from, to));
  ipcMain.handle('reports-dashboard', async (_e, companyId: number, from: string, to: string) =>
    getReportsDashboard(companyId, from, to),
  );
  ipcMain.handle('reports-pnl', async (_e, companyId: number, from: string, to: string) =>
    getPnLReport(companyId, from, to),
  );
  ipcMain.handle(
    'ledger-list',
    async (_e, companyId: number, dateFrom?: string, dateTo?: string, buyerId?: number, providerId?: number) =>
      getLedgerList(companyId, dateFrom, dateTo, buyerId, providerId),
  );
  ipcMain.handle('ledger-all-summary', async (_e, companyId: number, dateFrom?: string, dateTo?: string) =>
    getLedgerAllSummary(companyId, dateFrom, dateTo),
  );
  ipcMain.handle('audit-logs-list', async (_e, filters: AuditLogFilters) => listAuditLogs(filters));
  ipcMain.handle('backups-create', async (_e, companyId: number, userId: number) =>
    createBackup(companyId, userId),
  );
  ipcMain.handle('backups-restore', async (_e, userId: number, filePath?: string) =>
    restoreBackup(userId, filePath),
  );
  ipcMain.handle('backups-list', async () => listBackups());
  ipcMain.handle('utilities-change-buyer-rate', async (_e, buyerId: number, newRate: number, userId: number) =>
    changeBuyerRate(buyerId, newRate, userId),
  );
  ipcMain.handle(
    'utilities-change-provider-rate',
    async (_e, providerId: number, newRate: number, userId: number) =>
      changeProviderRate(providerId, newRate, userId),
  );
  ipcMain.handle(
    'utilities-change-commission',
    async (_e, partyType: 'buyer' | 'provider', partyId: number, newRate: number, userId: number) =>
      changeCommission(partyType, partyId, newRate, userId),
  );
  ipcMain.handle('utilities-bulk-rate-update', async (_e, buyerGroupId: number, newRate: number, userId: number) =>
    bulkRateUpdate(buyerGroupId, newRate, userId),
  );
  ipcMain.handle(
    'utilities-delete-memos',
    async (_e, drawId: number, memoIds: number[], userRole: UserRole) =>
      deleteMemos(drawId, memoIds, userRole),
  );
  ipcMain.handle('utilities-reindex', async () => reindexDatabase());

  ipcMain.handle('shift-groups-list', async (_e, companyId: number) => listShiftGroups(companyId));
  ipcMain.handle('shift-groups-create', async (_e, data: ShiftGroupInput) => createShiftGroup(data));
  ipcMain.handle('shift-groups-update', async (_e, id: number, data: ShiftGroupInput) => updateShiftGroup(id, data));
  ipcMain.handle('shift-groups-delete', async (_e, id: number) => deleteShiftGroup(id));
  ipcMain.handle('shifts-list', async (_e, shiftGroupId: number) => listShifts(shiftGroupId));
  ipcMain.handle('shifts-create', async (_e, data: ShiftInput) => createShift(data));
  ipcMain.handle('shifts-update', async (_e, id: number, data: ShiftInput) => updateShift(id, data));
  ipcMain.handle('shifts-delete', async (_e, id: number) => deleteShift(id));

  ipcMain.handle('provider-groups-list', async (_e, companyId: number) => listProviderGroups(companyId));
  ipcMain.handle('provider-groups-create', async (_e, data: ProviderGroupInput) => createProviderGroup(data));
  ipcMain.handle('provider-groups-update', async (_e, id: number, data: ProviderGroupInput) => updateProviderGroup(id, data));
  ipcMain.handle('provider-groups-delete', async (_e, id: number) => deleteProviderGroup(id));
  ipcMain.handle('providers-list', async (_e, companyId: number) => listProviders(companyId));
  ipcMain.handle('providers-create', async (_e, data: ProviderInput) => createProvider(data));
  ipcMain.handle('providers-update', async (_e, id: number, data: ProviderInput) => updateProvider(id, data));
  ipcMain.handle('providers-delete', async (_e, id: number) => deleteProvider(id));

  ipcMain.handle('buyer-groups-list', async (_e, companyId: number) => listBuyerGroups(companyId));
  ipcMain.handle('buyer-groups-create', async (_e, data: BuyerGroupInput) => createBuyerGroup(data));
  ipcMain.handle('buyer-groups-update', async (_e, id: number, data: BuyerGroupInput) => updateBuyerGroup(id, data));
  ipcMain.handle('buyer-groups-delete', async (_e, id: number) => deleteBuyerGroup(id));
  ipcMain.handle('buyers-list', async (_e, companyId: number) => listBuyers(companyId));
  ipcMain.handle('buyers-create', async (_e, data: BuyerInput) => createBuyer(data));
  ipcMain.handle('buyers-update', async (_e, id: number, data: BuyerInput) => updateBuyer(id, data));
  ipcMain.handle('buyers-delete', async (_e, id: number) => deleteBuyer(id));

  ipcMain.handle('item-groups-list', async (_e, companyId: number) => listItemGroups(companyId));
  ipcMain.handle('item-groups-create', async (_e, data: ItemGroupInput) => createItemGroup(data));
  ipcMain.handle('item-groups-update', async (_e, id: number, data: ItemGroupInput) => updateItemGroup(id, data));
  ipcMain.handle('item-groups-delete', async (_e, id: number) => deleteItemGroup(id));
  ipcMain.handle('items-list', async (_e, companyId: number) => listItems(companyId));
  ipcMain.handle('items-create', async (_e, data: ItemInput) => createItem(data));
  ipcMain.handle('items-update', async (_e, id: number, data: ItemInput) => updateItem(id, data));
  ipcMain.handle('items-delete', async (_e, id: number) => deleteItem(id));
  ipcMain.handle('itemSchemes-list', async (_e, companyId: number) => listItemSchemes(companyId));
  ipcMain.handle('itemSchemes-listByItem', async (_e, itemId: number) => listItemSchemesByItem(itemId));
  ipcMain.handle('itemSchemes-create', async (_e, data: ItemSchemeInput) => createItemScheme(data));
  ipcMain.handle('itemSchemes-get', async (_e, id: number) => getItemScheme(id));
  ipcMain.handle('itemSchemes-getPrizes', async (_e, itemSchemeId: number) => getItemSchemePrizes(itemSchemeId));
  ipcMain.handle('itemSchemes-update', async (_e, id: number, data: ItemSchemeInput) => updateItemScheme(id, data));
  ipcMain.handle('itemSchemes-delete', async (_e, id: number) => deleteItemScheme(id));

  ipcMain.handle('draws-list', async (_e, companyId: number) => listDraws(companyId));
  ipcMain.handle('draws-create', async (_e, data: DrawInput) => createDraw(data));
  ipcMain.handle('draws-update', async (_e, id: number, data: DrawInput) => updateDraw(id, data));
  ipcMain.handle('draws-delete', async (_e, id: number) => deleteDraw(id));
  ipcMain.handle(
    'draws-lock',
    async (_e, id: number, userId: number, clientUpdatedAt?: number | string | null) =>
      lockDraw(id, userId, clientUpdatedAt),
  );
  ipcMain.handle(
    'draws-unlock',
    async (_e, id: number, userId: number, userRole: UserRole, clientUpdatedAt?: number | string | null) =>
      unlockDraw(id, userId, userRole, clientUpdatedAt),
  );
  ipcMain.handle('draws-audit-list', async (_e, drawId: number) => listDrawAuditLogs(drawId));
  ipcMain.handle('draw-results-list', async (_e, drawId: number) => listDrawResults(drawId));
  ipcMain.handle('draw-results-create', async (_e, drawId: number, results: DrawResultInput[]) =>
    createDrawResults(drawId, results),
  );
  ipcMain.handle('winning-tickets-list', async (_e, drawId: number) => listWinningTickets(drawId));
  ipcMain.handle('winning-tickets-create', async (_e, drawId: number, tickets: WinningTicketInput[]) =>
    createWinningTickets(drawId, tickets),
  );
  ipcMain.handle('winning-tickets-delete', async (_e, id: number) => deleteWinningTicket(id));
  ipcMain.handle('winning-tickets-find-winners', async (_e, drawId: number) => findWinners(drawId));
  ipcMain.handle('transactions-search-ticket', async (_e, companyId: number, ticketNumber: string) =>
    searchTicket(companyId, ticketNumber),
  );
  ipcMain.handle('transactions-list', async (_e, companyId: number, drawId?: number, type?: string) =>
    listTransactions(companyId, drawId, type as import('../../shared/types').TransactionType | undefined),
  );
  ipcMain.handle('transactions-next-memo-id', async (_e, companyId: number) => nextMemoId(companyId));
  ipcMain.handle('transactions-create', async (_e, data: TransactionInput) => createTransaction(data));
  ipcMain.handle('transactions-update', async (_e, id: number, data: TransactionInput, userRole: UserRole) =>
    updateTransaction(id, data, userRole),
  );
  ipcMain.handle('transactions-delete', async (_e, id: number, userId: number, userRole: UserRole) =>
    deleteTransaction(id, userId, userRole),
  );
  ipcMain.handle('transactions-validate-tickets-sold', async (_e, drawId: number, ticketNumbers: string[]) =>
    validateTicketsSold(drawId, ticketNumbers),
  );
  ipcMain.handle('transactions-get-buyer-sale-summary', async (_e, buyerId: number, drawId: number) =>
    getBuyerSaleSummary(buyerId, drawId),
  );
  ipcMain.handle('transactions-get-provider-purchase-summary', async (_e, providerId: number, drawId: number) =>
    getProviderPurchaseSummary(providerId, drawId),
  );
}
