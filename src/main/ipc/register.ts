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
  logout,
  restoreSession,
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
  extendDrawTime,
  findWinners,
  getDrawById,
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
  getShiftForCompany,
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
import { connectDb, ensureConnected, getDb, getStoredConfig, setupDb, getDbStatus, testDbConnection, reconnectDb } from '../db';
import { winningTickets } from '../schema';
import { eq } from 'drizzle-orm';
import { requireCompanyId } from './companyScope';
import { getPreferences, setAutoBackup, setNetworkMode, type NetworkMode } from '../preferences';
import { discoverServer, getBroadcastStatus, startBroadcast, stopBroadcast } from '../lan';
import {
  isSessionSelectionCurrent,
  updateSessionCompany,
  updateSessionShift,
} from '../sessionStore';
import { sessionHeartbeat, sessionActiveCount } from './sessions';
import { getDiagnostics } from './diagnostics';
import {
  assertCompanyAccess,
  popSessionToken,
  redactDbConfig,
  requireRole,
  requireSession,
  withSession,
} from './sessionContext';
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
  WinningTicketInput,
} from '../../shared/types';

const IPC_CHANNELS = [
  'db-get-config', 'db-connect', 'db-setup', 'db-get-status', 'db-test-connection',
  'prefs-get', 'prefs-set-auto-backup', 'prefs-set-network-mode',
  'db-reconnect',
  'lan-get-status', 'lan-set-mode', 'lan-start-broadcast', 'lan-stop-broadcast', 'lan-discover-server',
  'sessions-heartbeat', 'sessions-active-count', 'diagnostics-get',
  'auth-login', 'auth-logout', 'auth-restore', 'auth-create-user', 'auth-change-password',
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
  'shifts-list', 'shifts-create', 'shifts-update', 'shifts-delete', 'shifts-select',
  'shifts-get-active',
  'provider-groups-list', 'provider-groups-create', 'provider-groups-update', 'provider-groups-delete',
  'providers-list', 'providers-create', 'providers-update', 'providers-delete',
  'buyer-groups-list', 'buyer-groups-create', 'buyer-groups-update', 'buyer-groups-delete',
  'buyers-list', 'buyers-create', 'buyers-update', 'buyers-delete',
  'item-groups-list', 'item-groups-create', 'item-groups-update', 'item-groups-delete',
  'items-list', 'items-create', 'items-update', 'items-delete',
  'itemSchemes-list', 'itemSchemes-listByItem', 'itemSchemes-create', 'itemSchemes-get',
  'itemSchemes-getPrizes', 'itemSchemes-update', 'itemSchemes-delete',
  'draws-list', 'draws-create', 'draws-update', 'draws-delete', 'draws-lock', 'draws-unlock',
  'draws-audit-list', 'draws-extend-time', 'draw-results-list', 'draw-results-create',
  'winning-tickets-list', 'winning-tickets-create', 'winning-tickets-delete',
  'winning-tickets-find-winners', 'transactions-search-ticket',
  'transactions-list', 'transactions-next-memo-id', 'transactions-create',
  'transactions-update', 'transactions-delete', 'transactions-validate-tickets-sold',
  'transactions-get-buyer-sale-summary', 'transactions-get-provider-purchase-summary',
] as const;

function scopedCompany(ctx: import('./sessionContext').SessionContext, companyId: number) {
  const denied = assertCompanyAccess(ctx, companyId);
  if (denied) return denied;
  return null;
}

export function registerIpcHandlers(): void {
  for (const channel of IPC_CHANNELS) ipcMain.removeHandler(channel);

  ipcMain.handle('db-get-config', () => redactDbConfig(getStoredConfig()));
  ipcMain.handle('db-connect', async (_e, config: DbConfig) => connectDb(config));
  ipcMain.handle('db-setup', async () => setupDb());
  ipcMain.handle('db-get-status', async () => getDbStatus());
  ipcMain.handle('db-test-connection', async (_e, config: DbConfig) => testDbConnection(config));
  ipcMain.handle('prefs-get', () => getPreferences());
  ipcMain.handle('prefs-set-auto-backup', async (_e, ...args) =>
    withSession(args, (_ctx, enabled) => {
      setAutoBackup(enabled as boolean);
      return { success: true };
    }, 'manager'),
  );
  ipcMain.handle('db-reconnect', async () => reconnectDb());
  ipcMain.handle('prefs-set-network-mode', async (_e, ...args) =>
    withSession(args, (_ctx, mode: NetworkMode) => {
      setNetworkMode(mode);
      return { success: true, mode };
    }, 'manager'),
  );
  ipcMain.handle('lan-get-status', () => getBroadcastStatus());
  ipcMain.handle('lan-set-mode', (_e, mode: NetworkMode) => {
    setNetworkMode(mode);
    if (mode === 'server') return startBroadcast();
    stopBroadcast();
    return { success: true };
  });
  ipcMain.handle('lan-start-broadcast', () => startBroadcast());
  ipcMain.handle('lan-stop-broadcast', () => {
    stopBroadcast();
    return { success: true };
  });
  ipcMain.handle('lan-discover-server', async () => discoverServer());
  ipcMain.handle('auth-login', async (_e, u: string, p: string) => login(u, p));
  ipcMain.handle('auth-restore', async () => restoreSession());
  ipcMain.handle('auth-logout', async (_e, sessionToken: string) => logout(sessionToken));

  ipcMain.handle('sessions-heartbeat', async (_e, ...args) =>
    withSession(args, (ctx, _userId, companyId, ip) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return sessionHeartbeat(ctx.userId, companyId as number, ip as string | undefined);
    }),
  );
  ipcMain.handle('sessions-active-count', async (_e, ...args) =>
    withSession(args, (ctx, companyId) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return sessionActiveCount(companyId as number);
    }),
  );
  ipcMain.handle('diagnostics-get', async (_e, ...args) =>
    withSession(args, async (ctx) => {
      const roleCheck = requireRole(ctx, 'admin');
      if (!roleCheck.success) return roleCheck;
      const result = await getDiagnostics();
      if (result.success && result.data.dbConfig) {
        result.data.dbConfig = redactDbConfig(result.data.dbConfig);
      }
      return result;
    }, 'admin'),
  );

  ipcMain.handle('auth-change-password', async (_e, ...args) =>
    withSession(args, (ctx, _userId, current, newPass) =>
      changePassword(ctx.userId, current as string, newPass as string),
    ),
  );
  ipcMain.handle('auth-create-user', async (_e, ...args) =>
    withSession(args, (_ctx, data) => createUser(data as UserInput), 'owner'),
  );
  ipcMain.handle('auth-get-users', async (_e, ...args) =>
    withSession(args, (ctx, companyId) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return getUsersByCompany(companyId as number);
    }),
  );
  ipcMain.handle('auth-get-all-users', async (_e, ...args) =>
    withSession(args, () => getAllUsers(), 'admin'),
  );
  ipcMain.handle('auth-get-owners', async (_e, ...args) =>
    withSession(args, () => getOwners(), 'admin'),
  );
  ipcMain.handle('auth-get-owner-admin-users', async (_e, ...args) =>
    withSession(args, () => getOwnerAdminUsers(), 'admin'),
  );
  ipcMain.handle('auth-get-user-company-ids', async (_e, ...args) =>
    withSession(args, (_ctx, userId) => getUserCompanyIds(userId as number), 'manager'),
  );
  ipcMain.handle('auth-update-user', async (_e, ...args) =>
    withSession(args, (_ctx, id, data) => updateUser(id as number, data as Partial<UserInput>), 'owner'),
  );
  ipcMain.handle('auth-delete-user', async (_e, ...args) =>
    withSession(args, (ctx, id) => deleteUser(id as number, ctx.userId), 'owner'),
  );
  ipcMain.handle('user-get-companies', async (_e, ...args) =>
    withSession(args, (ctx, _userId) => getUserCompanies(ctx.userId)),
  );
  ipcMain.handle('user-set-active-company', async (_e, ...args) => {
    const { token, rest } = popSessionToken(args);
    const session = requireSession(token);
    if (!session.success) return session;
    const companyId = rest[1] as number;
    const result = await setActiveCompany(session.ctx.userId, companyId, session.ctx);
    if (result.success && token && !updateSessionCompany(token, companyId)) {
      return { success: false, error: 'Failed to securely save the active company.' };
    }
    return result;
  });
  ipcMain.handle('user-companies-assign', async (_e, ...args) =>
    withSession(args, (_ctx, userId, companyId) =>
      assignUserCompany(userId as number, companyId as number), 'owner'),
  );
  ipcMain.handle('user-companies-remove', async (_e, ...args) =>
    withSession(args, (_ctx, userId, companyId) =>
      removeUserCompany(userId as number, companyId as number), 'owner'),
  );
  ipcMain.handle('user-companies-list', async (_e, ...args) =>
    withSession(args, (_ctx, userId) => listUserCompanies(userId as number), 'manager'),
  );
  ipcMain.handle('companies-get-all', async (_e, ...args) =>
    withSession(args, () => getAllCompanies()),
  );
  ipcMain.handle('companies-create', async (_e, ...args) =>
    withSession(args, (_ctx, data) => createCompany(data as CompanyInput), 'admin'),
  );
  ipcMain.handle('companies-update', async (_e, ...args) =>
    withSession(args, (_ctx, id, data) => updateCompany(id as number, data as CompanyInput), 'admin'),
  );
  ipcMain.handle('companies-clone', async (_e, ...args) =>
    withSession(args, (_ctx, id) => cloneCompany(id as number), 'admin'),
  );
  ipcMain.handle('companies-set-status', async (_e, ...args) =>
    withSession(args, (_ctx, id, status) => setCompanyStatus(id as number, status as CompanyStatus), 'admin'),
  );
  ipcMain.handle('companies-set-billing-lock', async (_e, ...args) =>
    withSession(args, (_ctx, id, locked) => setCompanyBillingLock(id as number, locked as boolean), 'admin'),
  );
  ipcMain.handle('reports-summary', async (_e, ...args) =>
    withSession(args, (ctx, companyId, from, to) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return getReportsSummary(companyId as number, from as string, to as string);
    }, 'manager'),
  );
  ipcMain.handle('reports-dashboard', async (_e, ...args) =>
    withSession(args, (ctx, companyId, from, to) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return getReportsDashboard(companyId as number, from as string, to as string);
    }, 'manager'),
  );
  ipcMain.handle('reports-pnl', async (_e, ...args) =>
    withSession(args, (ctx, companyId, from, to) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return getPnLReport(companyId as number, from as string, to as string);
    }, 'owner'),
  );
  ipcMain.handle('ledger-list', async (_e, ...args) =>
    withSession(args, (ctx, companyId, dateFrom, dateTo, buyerId, providerId) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return getLedgerList(
        companyId as number,
        dateFrom as string | undefined,
        dateTo as string | undefined,
        buyerId as number | undefined,
        providerId as number | undefined,
      );
    }, 'manager'),
  );
  ipcMain.handle('ledger-all-summary', async (_e, ...args) =>
    withSession(args, (ctx, companyId, dateFrom, dateTo) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return getLedgerAllSummary(companyId as number, dateFrom as string | undefined, dateTo as string | undefined);
    }, 'manager'),
  );
  ipcMain.handle('audit-logs-list', async (_e, ...args) =>
    withSession(args, (_ctx, filters) => listAuditLogs(filters as AuditLogFilters), 'manager'),
  );
  ipcMain.handle('backups-create', async (_e, ...args) =>
    withSession(args, (ctx, companyId) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return createBackup(companyId as number, ctx.userId);
    }, 'owner'),
  );
  ipcMain.handle('backups-restore', async (_e, ...args) =>
    withSession(args, (ctx, filePath) => restoreBackup(ctx, filePath as string | undefined), 'owner'),
  );
  ipcMain.handle('backups-list', async (_e, ...args) =>
    withSession(args, () => listBackups(), 'owner'),
  );
  ipcMain.handle('utilities-change-buyer-rate', async (_e, ...args) =>
    withSession(args, (ctx, buyerId, newRate) =>
      changeBuyerRate(buyerId as number, newRate as number, ctx.userId), 'manager'),
  );
  ipcMain.handle('utilities-change-provider-rate', async (_e, ...args) =>
    withSession(args, (ctx, providerId, newRate) =>
      changeProviderRate(providerId as number, newRate as number, ctx.userId), 'manager'),
  );
  ipcMain.handle('utilities-change-commission', async (_e, ...args) =>
    withSession(args, (ctx, partyType, partyId, newRate) =>
      changeCommission(
        partyType as 'buyer' | 'provider',
        partyId as number,
        newRate as number,
        ctx.userId,
      ), 'manager'),
  );
  ipcMain.handle('utilities-bulk-rate-update', async (_e, ...args) =>
    withSession(args, (ctx, buyerGroupId, newRate) =>
      bulkRateUpdate(buyerGroupId as number, newRate as number, ctx.userId), 'manager'),
  );
  ipcMain.handle('utilities-delete-memos', async (_e, ...args) =>
    withSession(args, (ctx, drawId, memoIds) =>
      deleteMemos(drawId as number, memoIds as number[], ctx), 'admin'),
  );
  ipcMain.handle('utilities-reindex', async (_e, ...args) =>
    withSession(args, () => reindexDatabase(), 'admin'),
  );

  ipcMain.handle('shift-groups-list', async (_e, ...args) =>
    withSession(args, (ctx) => listShiftGroups(ctx.activeCompanyId)),
  );
  ipcMain.handle('shift-groups-create', async (_e, ...args) =>
    withSession(args, (ctx, data) =>
      createShiftGroup(data as ShiftGroupInput, ctx.activeCompanyId), 'manager'),
  );
  ipcMain.handle('shift-groups-update', async (_e, ...args) =>
    withSession(args, (ctx, id, data) => updateShiftGroup(id as number, data as ShiftGroupInput, ctx.activeCompanyId), 'manager'),
  );
  ipcMain.handle('shift-groups-delete', async (_e, ...args) =>
    withSession(args, (ctx, id) => deleteShiftGroup(id as number, ctx.activeCompanyId), 'manager'),
  );
  ipcMain.handle('shifts-list', async (_e, ...args) =>
    withSession(args, (ctx, shiftGroupId) =>
      listShifts(shiftGroupId as number, ctx.activeCompanyId)),
  );
  ipcMain.handle('shifts-create', async (_e, ...args) =>
    withSession(args, (ctx, data) =>
      createShift(data as ShiftInput, ctx.activeCompanyId), 'manager'),
  );
  ipcMain.handle('shifts-update', async (_e, ...args) =>
    withSession(args, (ctx, id, data) => updateShift(id as number, data as ShiftInput, ctx.activeCompanyId), 'manager'),
  );
  ipcMain.handle('shifts-delete', async (_e, ...args) =>
    withSession(args, (ctx, id) => deleteShift(id as number, ctx.activeCompanyId), 'manager'),
  );
  ipcMain.handle('shifts-select', async (_e, ...args) => {
    const { token, rest } = popSessionToken(args);
    const session = requireSession(token);
    if (!session.success) return session;
    const companyId = session.ctx.activeCompanyId;
    const result = await getShiftForCompany(rest[0] as number, companyId);
    if (!result.success) return result;
    if (!result.shift) return { success: false, error: 'Shift not found for the active company.' };
    if (token && !updateSessionShift(token, result.shift.id, companyId)) {
      return { success: false, error: 'The active company changed. Select the shift again.' };
    }
    return result;
  });
  ipcMain.handle('shifts-get-active', async (_e, ...args) => {
    const { token } = popSessionToken(args);
    const session = requireSession(token);
    if (!session.success) return session;
    if (session.ctx.activeShiftId == null) return { success: true, shift: null };
    const companyId = session.ctx.activeCompanyId;
    const shiftId = session.ctx.activeShiftId;
    const result = await getShiftForCompany(
      shiftId,
      companyId,
    );
    if (token && !isSessionSelectionCurrent(token, companyId, shiftId)) {
      return { success: false, error: 'The active company or shift changed. Retry.' };
    }
    if (
      result.success
      && !result.shift
      && token
      && !updateSessionShift(token, null, companyId)
    ) {
      return { success: false, error: 'Failed to securely clear the active shift.' };
    }
    return result;
  });

  ipcMain.handle('provider-groups-list', async (_e, ...args) =>
    withSession(args, (ctx, companyId) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return listProviderGroups(companyId as number);
    }),
  );
  ipcMain.handle('provider-groups-create', async (_e, ...args) =>
    withSession(args, (ctx, data) => {
      const input = data as ProviderGroupInput;
      const denied = scopedCompany(ctx, input.companyId);
      if (denied) return denied;
      return createProviderGroup(input);
    }, 'manager'),
  );
  ipcMain.handle('provider-groups-update', async (_e, ...args) =>
    withSession(args, (ctx, id, data) => updateProviderGroup(id as number, data as ProviderGroupInput, ctx.activeCompanyId), 'manager'),
  );
  ipcMain.handle('provider-groups-delete', async (_e, ...args) =>
    withSession(args, (ctx, id) => deleteProviderGroup(id as number, ctx.activeCompanyId), 'manager'),
  );
  ipcMain.handle('providers-list', async (_e, ...args) =>
    withSession(args, (ctx, companyId) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return listProviders(companyId as number);
    }),
  );
  ipcMain.handle('providers-create', async (_e, ...args) =>
    withSession(args, (ctx, data) => {
      const input = data as ProviderInput;
      const denied = scopedCompany(ctx, input.companyId);
      if (denied) return denied;
      return createProvider(input);
    }, 'manager'),
  );
  ipcMain.handle('providers-update', async (_e, ...args) =>
    withSession(args, (ctx, id, data) => updateProvider(id as number, data as ProviderInput, ctx.activeCompanyId), 'manager'),
  );
  ipcMain.handle('providers-delete', async (_e, ...args) =>
    withSession(args, (ctx, id) => deleteProvider(id as number, ctx.activeCompanyId), 'manager'),
  );

  ipcMain.handle('buyer-groups-list', async (_e, ...args) =>
    withSession(args, (ctx, companyId) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return listBuyerGroups(companyId as number);
    }),
  );
  ipcMain.handle('buyer-groups-create', async (_e, ...args) =>
    withSession(args, (ctx, data) => {
      const input = data as BuyerGroupInput;
      const denied = scopedCompany(ctx, input.companyId);
      if (denied) return denied;
      return createBuyerGroup(input);
    }, 'manager'),
  );
  ipcMain.handle('buyer-groups-update', async (_e, ...args) =>
    withSession(args, (ctx, id, data) => updateBuyerGroup(id as number, data as BuyerGroupInput, ctx.activeCompanyId), 'manager'),
  );
  ipcMain.handle('buyer-groups-delete', async (_e, ...args) =>
    withSession(args, (ctx, id) => deleteBuyerGroup(id as number, ctx.activeCompanyId), 'manager'),
  );
  ipcMain.handle('buyers-list', async (_e, ...args) =>
    withSession(args, (ctx, companyId) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return listBuyers(companyId as number);
    }),
  );
  ipcMain.handle('buyers-create', async (_e, ...args) =>
    withSession(args, (ctx, data) => {
      const input = data as BuyerInput;
      const denied = scopedCompany(ctx, input.companyId);
      if (denied) return denied;
      return createBuyer(input);
    }, 'manager'),
  );
  ipcMain.handle('buyers-update', async (_e, ...args) =>
    withSession(args, (ctx, id, data) => updateBuyer(id as number, data as BuyerInput, ctx.activeCompanyId), 'manager'),
  );
  ipcMain.handle('buyers-delete', async (_e, ...args) =>
    withSession(args, (ctx, id) => deleteBuyer(id as number, ctx.activeCompanyId), 'manager'),
  );

  ipcMain.handle('item-groups-list', async (_e, ...args) =>
    withSession(args, (ctx, companyId) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return listItemGroups(companyId as number);
    }),
  );
  ipcMain.handle('item-groups-create', async (_e, ...args) =>
    withSession(args, (ctx, data) => {
      const input = data as ItemGroupInput;
      const denied = scopedCompany(ctx, input.companyId);
      if (denied) return denied;
      return createItemGroup(input);
    }, 'manager'),
  );
  ipcMain.handle('item-groups-update', async (_e, ...args) =>
    withSession(args, (ctx, id, data) => updateItemGroup(id as number, data as ItemGroupInput, ctx.activeCompanyId), 'manager'),
  );
  ipcMain.handle('item-groups-delete', async (_e, ...args) =>
    withSession(args, (ctx, id) => deleteItemGroup(id as number, ctx.activeCompanyId), 'manager'),
  );
  ipcMain.handle('items-list', async (_e, ...args) =>
    withSession(args, (ctx, companyId) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return listItems(companyId as number);
    }),
  );
  ipcMain.handle('items-create', async (_e, ...args) =>
    withSession(args, (ctx, data) => {
      const input = data as ItemInput;
      const denied = scopedCompany(ctx, input.companyId);
      if (denied) return denied;
      return createItem(input);
    }, 'manager'),
  );
  ipcMain.handle('items-update', async (_e, ...args) =>
    withSession(args, (ctx, id, data) => updateItem(id as number, data as ItemInput, ctx.activeCompanyId), 'manager'),
  );
  ipcMain.handle('items-delete', async (_e, ...args) =>
    withSession(args, (ctx, id) => deleteItem(id as number, ctx.activeCompanyId), 'manager'),
  );
  ipcMain.handle('itemSchemes-list', async (_e, ...args) =>
    withSession(args, (ctx, companyId) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return listItemSchemes(companyId as number);
    }),
  );
  ipcMain.handle('itemSchemes-listByItem', async (_e, ...args) =>
    withSession(args, (_ctx, itemId) => listItemSchemesByItem(itemId as number)),
  );
  ipcMain.handle('itemSchemes-create', async (_e, ...args) =>
    withSession(args, (ctx, data) => {
      const input = data as ItemSchemeInput;
      const denied = scopedCompany(ctx, input.companyId);
      if (denied) return denied;
      return createItemScheme(input);
    }, 'manager'),
  );
  ipcMain.handle('itemSchemes-get', async (_e, ...args) =>
    withSession(args, (_ctx, id) => getItemScheme(id as number)),
  );
  ipcMain.handle('itemSchemes-getPrizes', async (_e, ...args) =>
    withSession(args, (_ctx, itemSchemeId) => getItemSchemePrizes(itemSchemeId as number)),
  );
  ipcMain.handle('itemSchemes-update', async (_e, ...args) =>
    withSession(args, (ctx, id, data) => updateItemScheme(id as number, data as ItemSchemeInput, ctx.activeCompanyId), 'manager'),
  );
  ipcMain.handle('itemSchemes-delete', async (_e, ...args) =>
    withSession(args, (ctx, id) => deleteItemScheme(id as number, ctx.activeCompanyId), 'manager'),
  );

  ipcMain.handle('draws-list', async (_e, ...args) =>
    withSession(args, (ctx, companyId) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return listDraws(companyId as number);
    }),
  );
  ipcMain.handle('draws-create', async (_e, ...args) =>
    withSession(args, (ctx, data) => {
      const input = data as DrawInput;
      const denied = scopedCompany(ctx, input.companyId);
      if (denied) return denied;
      return createDraw(input);
    }, 'manager'),
  );
  ipcMain.handle('draws-update', async (_e, ...args) =>
    withSession(args, (ctx, id, data) => updateDraw(id as number, data as DrawInput, ctx.activeCompanyId), 'manager'),
  );
  ipcMain.handle('draws-delete', async (_e, ...args) =>
    withSession(args, (ctx, id) => deleteDraw(id as number, ctx.activeCompanyId), 'manager'),
  );
  ipcMain.handle('draws-lock', async (_e, ...args) =>
    withSession(args, (ctx, id, clientUpdatedAt) =>
      lockDraw(
        id as number,
        ctx.userId,
        ctx.activeCompanyId,
        clientUpdatedAt as number | string | null | undefined,
      ), 'supervisor'),
  );
  ipcMain.handle('draws-unlock', async (_e, ...args) =>
    withSession(args, (ctx, id, clientUpdatedAt) =>
      unlockDraw(id as number, ctx, clientUpdatedAt as number | string | null | undefined), 'owner'),
  );
  ipcMain.handle('draws-audit-list', async (_e, ...args) =>
    withSession(args, (ctx, drawId) => listDrawAuditLogs(drawId as number, ctx.activeCompanyId)),
  );
  ipcMain.handle('draws-extend-time', async (_e, ...args) =>
    withSession(args, (ctx, drawId, _userId, _userRole, newCloseTime, reason) =>
      extendDrawTime(
        drawId as number,
        ctx.userId,
        ctx.role,
        newCloseTime as string,
        reason as string,
      ), 'manager'),
  );
  ipcMain.handle('draw-results-list', async (_e, ...args) =>
    withSession(args, (_ctx, drawId) => listDrawResults(drawId as number)),
  );
  ipcMain.handle('draw-results-create', async (_e, ...args) =>
    withSession(args, (ctx, drawId, results) =>
      createDrawResults(drawId as number, results as DrawResultInput[], ctx.activeCompanyId), 'supervisor'),
  );
  ipcMain.handle('winning-tickets-list', async (_e, ...args) =>
    withSession(args, (_ctx, drawId) => listWinningTickets(drawId as number)),
  );
  ipcMain.handle('winning-tickets-create', async (_e, ...args) =>
    withSession(args, (_ctx, drawId, tickets) =>
      createWinningTickets(drawId as number, tickets as WinningTicketInput[]), 'manager'),
  );
  ipcMain.handle('winning-tickets-delete', async (_e, ...args) =>
    withSession(args, async (ctx, id) => {
      const scoped = requireCompanyId(ctx.activeCompanyId);
      if (!scoped.success) return scoped;
      const connection = await ensureConnected();
      if (!connection.success) {
        return { success: false as const, error: connection.error ?? 'Database is not connected' };
      }
      const db = getDb();
      const [ticket] = await db
        .select({ drawId: winningTickets.drawId })
        .from(winningTickets)
        .where(eq(winningTickets.id, id as number))
        .limit(1);
      if (!ticket) return { success: false as const, error: 'Winning ticket not found' };
      const draw = await getDrawById(ticket.drawId);
      if (!draw || draw.companyId !== scoped.companyId) {
        return { success: false as const, error: 'Winning ticket not found' };
      }
      return deleteWinningTicket(id as number);
    }, 'manager'),
  );
  ipcMain.handle('winning-tickets-find-winners', async (_e, ...args) =>
    withSession(args, (_ctx, drawId) => findWinners(drawId as number)),
  );
  ipcMain.handle('transactions-search-ticket', async (_e, ...args) =>
    withSession(args, (ctx, companyId, ticketNumber) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return searchTicket(companyId as number, ticketNumber as string);
    }),
  );
  ipcMain.handle('transactions-list', async (_e, ...args) =>
    withSession(args, (ctx, companyId, drawId, type) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return listTransactions(
        companyId as number,
        drawId as number | undefined,
        type as import('../../shared/types').TransactionType | undefined,
      );
    }),
  );
  ipcMain.handle('transactions-next-memo-id', async (_e, ...args) =>
    withSession(args, (ctx, companyId) => {
      const denied = scopedCompany(ctx, companyId as number);
      if (denied) return denied;
      return nextMemoId(companyId as number);
    }),
  );
  ipcMain.handle('transactions-create', async (_e, ...args) =>
    withSession(args, (ctx, data) => createTransaction(data as TransactionInput, ctx)),
  );
  ipcMain.handle('transactions-update', async (_e, ...args) =>
    withSession(args, (ctx, id, data, _userRole) =>
      updateTransaction(id as number, data as TransactionInput, ctx), 'supervisor'),
  );
  ipcMain.handle('transactions-delete', async (_e, ...args) =>
    withSession(args, (ctx, id) => deleteTransaction(id as number, ctx), 'supervisor'),
  );
  ipcMain.handle('transactions-validate-tickets-sold', async (_e, ...args) =>
    withSession(args, (_ctx, drawId, ticketNumbers) =>
      validateTicketsSold(drawId as number, ticketNumbers as string[])),
  );
  ipcMain.handle('transactions-get-buyer-sale-summary', async (_e, ...args) =>
    withSession(args, (_ctx, buyerId, drawId) =>
      getBuyerSaleSummary(buyerId as number, drawId as number)),
  );
  ipcMain.handle('transactions-get-provider-purchase-summary', async (_e, ...args) =>
    withSession(args, (_ctx, providerId, drawId) =>
      getProviderPurchaseSummary(providerId as number, drawId as number)),
  );
}
