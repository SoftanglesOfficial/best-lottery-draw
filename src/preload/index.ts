import { contextBridge, ipcRenderer } from 'electron';
import type {
  AuthUser,
  BuyerGroupInput,
  BuyerGroupRecord,
  BuyerInput,
  BuyerRecord,
  CompanyInput,
  CompanyRecord,
  CompanyStatus,
  CompanySummary,
  DbConfig,
  DrawInput,
  DrawRecord,
  DrawResultInput,
  DrawResultRecord,
  AuditLogRecord,
  TicketSearchResult,
  UserRole,
  WinningTicketInput,
  WinningTicketRecord,
  ItemGroupInput,
  ItemGroupRecord,
  ItemInput,
  ItemRecord,
  ItemSchemeInput,
  ItemSchemeRecord,
  ItemSchemeWithPrizes,
  ProviderGroupInput,
  ProviderGroupRecord,
  ProviderInput,
  ProviderRecord,
  ReportsSummary,
  SessionUser,
  ShiftGroupInput,
  ShiftGroupRecord,
  ShiftInput,
  ShiftRecord,
  TransactionInput,
  TransactionRecord,
  TransactionType,
  BuyerSaleSummary,
  ProviderPurchaseSummary,
  TicketValidationResult,
  LedgerListResult,
  LedgerAllSummary,
  AuditLogListRecord,
  AuditLogFilters,
  BackupRecord,
  PnLReport,
  ReportsDashboardData,
  UserInput,
  UserRecord,
} from '../shared/types';

export interface Api {
  dbGetConfig: () => Promise<DbConfig>;
  dbConnect: (config: DbConfig) => Promise<{ success: boolean; error?: string }>;
  dbSetup: () => Promise<{ success: boolean; error?: string }>;
  authLogin: (
    username: string,
    password: string,
  ) => Promise<{ success: true; user: AuthUser } | { success: false; error: string }>;
  authCreateUser: (
    data: UserInput,
  ) => Promise<{ success: true; user: UserRecord } | { success: false; error: string }>;
  authGetUsers: (
    companyId: number,
  ) => Promise<{ success: true; users: UserRecord[] } | { success: false; error: string }>;
  authGetAllUsers: () => Promise<
    { success: true; users: UserRecord[] } | { success: false; error: string }
  >;
  authGetOwners: () => Promise<
    { success: true; users: UserRecord[] } | { success: false; error: string }
  >;
  authGetOwnerAdminUsers: () => Promise<
    { success: true; users: UserRecord[] } | { success: false; error: string }
  >;
  authGetUserCompanyIds: (
    userId: number,
  ) => Promise<{ success: true; companyIds: number[] } | { success: false; error: string }>;
  authUpdateUser: (
    id: number,
    data: Partial<UserInput>,
  ) => Promise<{ success: true; user: UserRecord } | { success: false; error: string }>;
  authDeleteUser: (
    id: number,
    currentUserId: number,
  ) => Promise<{ success: true } | { success: false; error: string }>;
  userGetCompanies: (
    userId: number,
  ) => Promise<
    { success: true; companies: CompanySummary[] } | { success: false; error: string }
  >;
  userSetActiveCompany: (
    userId: number,
    companyId: number,
  ) => Promise<
    | { success: true; user: SessionUser; companyName: string }
    | { success: false; error: string }
  >;
  userCompaniesAssign: (
    userId: number,
    companyId: number,
  ) => Promise<{ success: true } | { success: false; error: string }>;
  userCompaniesRemove: (
    userId: number,
    companyId: number,
  ) => Promise<{ success: true } | { success: false; error: string }>;
  userCompaniesList: (
    userId: number,
  ) => Promise<
    { success: true; companies: CompanySummary[] } | { success: false; error: string }
  >;
  companiesGetAll: () => Promise<
    { success: true; companies: CompanyRecord[] } | { success: false; error: string }
  >;
  companiesCreate: (
    data: CompanyInput,
  ) => Promise<{ success: true; company: CompanyRecord } | { success: false; error: string }>;
  companiesUpdate: (
    id: number,
    data: CompanyInput,
  ) => Promise<{ success: true; company: CompanyRecord } | { success: false; error: string }>;
  companiesClone: (
    id: number,
  ) => Promise<{ success: true; company: CompanyRecord } | { success: false; error: string }>;
  companiesSetStatus: (
    id: number,
    status: CompanyStatus,
  ) => Promise<{ success: true; company: CompanyRecord } | { success: false; error: string }>;
  companiesSetBillingLock: (
    id: number,
    locked: boolean,
  ) => Promise<{ success: true; company: CompanyRecord } | { success: false; error: string }>;
  reportsSummary: (
    companyId: number,
    dateFrom: string,
    dateTo: string,
  ) => Promise<
    { success: true; summary: ReportsSummary } | { success: false; error: string }
  >;
  reportsDashboard: (
    companyId: number,
    dateFrom: string,
    dateTo: string,
  ) => Promise<
    { success: true; data: ReportsDashboardData } | { success: false; error: string }
  >;
  reportsPnL: (
    companyId: number,
    dateFrom: string,
    dateTo: string,
  ) => Promise<{ success: true; report: PnLReport } | { success: false; error: string }>;
  ledgerList: (
    companyId: number,
    dateFrom?: string,
    dateTo?: string,
    buyerId?: number,
    providerId?: number,
  ) => Promise<{ success: true; ledger: LedgerListResult } | { success: false; error: string }>;
  ledgerAllSummary: (
    companyId: number,
    dateFrom?: string,
    dateTo?: string,
  ) => Promise<{ success: true; summary: LedgerAllSummary } | { success: false; error: string }>;
  auditLogsList: (
    filters: AuditLogFilters,
  ) => Promise<{ success: true; logs: AuditLogListRecord[] } | { success: false; error: string }>;
  backupsCreate: (
    companyId: number,
    userId: number,
  ) => Promise<
    | { success: true; filename: string; recordCount: number }
    | { success: false; error?: string }
  >;
  backupsRestore: (
    userId: number,
    filePath?: string,
  ) => Promise<
    | { success: true; message: string }
    | { success: false; error?: string }
  >;
  backupsList: () => Promise<
    { success: true; backups: BackupRecord[] } | { success: false; error: string }
  >;
  dbGetStatus: () => Promise<{
    connected: boolean;
    version?: string;
    config?: DbConfig;
  }>;
  dbTestConnection: (
    config: DbConfig,
  ) => Promise<
    { success: true; version: string } | { success: false; error: string }
  >;
  prefsGet: () => Promise<{
    autoBackup: boolean;
    lastBackupDate: string | null;
    networkMode: 'server' | 'client';
  }>;
  prefsSetAutoBackup: (enabled: boolean) => Promise<{ success: true }>;
  authChangePassword: (
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) => Promise<{ success: true } | { success: false; error: string }>;
  utilitiesChangeBuyerRate: (
    buyerId: number,
    newRate: number,
    userId: number,
  ) => Promise<{ success: true; buyer: BuyerRecord } | { success: false; error: string }>;
  utilitiesChangeProviderRate: (
    providerId: number,
    newRate: number,
    userId: number,
  ) => Promise<{ success: true; provider: ProviderRecord } | { success: false; error: string }>;
  utilitiesChangeCommission: (
    partyType: 'buyer' | 'provider',
    partyId: number,
    newRate: number,
    userId: number,
  ) => Promise<
    | { success: true; party: BuyerRecord | ProviderRecord }
    | { success: false; error: string }
  >;
  utilitiesBulkRateUpdate: (
    buyerGroupId: number,
    newRate: number,
    userId: number,
  ) => Promise<{ success: true; updated: number } | { success: false; error: string }>;
  utilitiesDeleteMemos: (
    drawId: number,
    memoIds: number[],
    userRole: UserRole,
  ) => Promise<{ success: true; deleted: number } | { success: false; error: string }>;
  utilitiesReindex: () => Promise<{ success: true } | { success: false; error: string }>;
  windowSetTitle: (title: string) => Promise<void>;
  appGetVersion: () => Promise<string>;
  onAppNavigate: (callback: (path: string) => void) => () => void;
  onAppLogout: (callback: () => void) => () => void;
  onDbConnectionLost: (callback: () => void) => () => void;
  onDbConnectionRestored: (callback: () => void) => () => void;
  dbReconnect: () => Promise<{ success: boolean; error?: string }>;
  lanGetStatus: () => Promise<{ isBroadcasting: boolean; port: number; localIp: string }>;
  lanSetMode: (mode: 'server' | 'client') => Promise<{ success: boolean; error?: string }>;
  lanStartBroadcast: () => Promise<{ success: boolean; error?: string }>;
  lanStopBroadcast: () => Promise<{ success: true }>;
  lanDiscoverServer: () => Promise<
    | { success: true; host: string; dbPort: number; database: string }
    | { success: false; error: string }
  >;
  prefsSetNetworkMode: (mode: 'server' | 'client') => Promise<{ success: true; mode: string }>;
  sessionHeartbeat: (userId: number, companyId: number, ipAddress?: string) => Promise<{ success: true } | { success: false; error: string }>;
  sessionActiveCount: (companyId: number) => Promise<{ success: true; count: number } | { success: false; error: string }>;
  diagnosticsGet: () => Promise<
    | { success: true; data: import('../shared/types').DiagnosticsData }
    | { success: false; error: string }
  >;
  shiftGroupsList: (
    companyId: number,
  ) => Promise<{ success: true; groups: ShiftGroupRecord[] } | { success: false; error: string }>;
  shiftGroupsCreate: (
    data: ShiftGroupInput,
  ) => Promise<{ success: true; group: ShiftGroupRecord } | { success: false; error: string }>;
  shiftGroupsUpdate: (
    id: number,
    data: ShiftGroupInput,
  ) => Promise<{ success: true; group: ShiftGroupRecord } | { success: false; error: string }>;
  shiftGroupsDelete: (id: number) => Promise<{ success: true } | { success: false; error: string }>;
  shiftsList: (
    shiftGroupId: number,
  ) => Promise<{ success: true; shifts: ShiftRecord[] } | { success: false; error: string }>;
  shiftsCreate: (
    data: ShiftInput,
  ) => Promise<{ success: true; shift: ShiftRecord } | { success: false; error: string }>;
  shiftsUpdate: (
    id: number,
    data: ShiftInput,
  ) => Promise<{ success: true; shift: ShiftRecord } | { success: false; error: string }>;
  shiftsDelete: (id: number) => Promise<{ success: true } | { success: false; error: string }>;
  providerGroupsList: (
    companyId: number,
  ) => Promise<{ success: true; groups: ProviderGroupRecord[] } | { success: false; error: string }>;
  providerGroupsCreate: (
    data: ProviderGroupInput,
  ) => Promise<{ success: true; group: ProviderGroupRecord } | { success: false; error: string }>;
  providerGroupsUpdate: (
    id: number,
    data: ProviderGroupInput,
  ) => Promise<{ success: true; group: ProviderGroupRecord } | { success: false; error: string }>;
  providerGroupsDelete: (id: number) => Promise<{ success: true } | { success: false; error: string }>;
  providersList: (
    companyId: number,
  ) => Promise<{ success: true; providers: ProviderRecord[] } | { success: false; error: string }>;
  providersCreate: (
    data: ProviderInput,
  ) => Promise<{ success: true; provider: ProviderRecord } | { success: false; error: string }>;
  providersUpdate: (
    id: number,
    data: ProviderInput,
  ) => Promise<{ success: true; provider: ProviderRecord } | { success: false; error: string }>;
  providersDelete: (id: number) => Promise<{ success: true } | { success: false; error: string }>;
  buyerGroupsList: (
    companyId: number,
  ) => Promise<{ success: true; groups: BuyerGroupRecord[] } | { success: false; error: string }>;
  buyerGroupsCreate: (
    data: BuyerGroupInput,
  ) => Promise<{ success: true; group: BuyerGroupRecord } | { success: false; error: string }>;
  buyerGroupsUpdate: (
    id: number,
    data: BuyerGroupInput,
  ) => Promise<{ success: true; group: BuyerGroupRecord } | { success: false; error: string }>;
  buyerGroupsDelete: (id: number) => Promise<{ success: true } | { success: false; error: string }>;
  buyersList: (
    companyId: number,
  ) => Promise<{ success: true; buyers: BuyerRecord[] } | { success: false; error: string }>;
  buyersCreate: (
    data: BuyerInput,
  ) => Promise<{ success: true; buyer: BuyerRecord } | { success: false; error: string }>;
  buyersUpdate: (
    id: number,
    data: BuyerInput,
  ) => Promise<{ success: true; buyer: BuyerRecord } | { success: false; error: string }>;
  buyersDelete: (id: number) => Promise<{ success: true } | { success: false; error: string }>;
  itemGroupsList: (
    companyId: number,
  ) => Promise<{ success: true; groups: ItemGroupRecord[] } | { success: false; error: string }>;
  itemGroupsCreate: (
    data: ItemGroupInput,
  ) => Promise<{ success: true; group: ItemGroupRecord } | { success: false; error: string }>;
  itemGroupsUpdate: (
    id: number,
    data: ItemGroupInput,
  ) => Promise<{ success: true; group: ItemGroupRecord } | { success: false; error: string }>;
  itemGroupsDelete: (id: number) => Promise<{ success: true } | { success: false; error: string }>;
  itemsList: (
    companyId: number,
  ) => Promise<{ success: true; items: ItemRecord[] } | { success: false; error: string }>;
  itemsCreate: (
    data: ItemInput,
  ) => Promise<{ success: true; item: ItemRecord } | { success: false; error: string }>;
  itemsUpdate: (
    id: number,
    data: ItemInput,
  ) => Promise<{ success: true; item: ItemRecord } | { success: false; error: string }>;
  itemsDelete: (id: number) => Promise<{ success: true } | { success: false; error: string }>;
  itemSchemesList: (
    companyId: number,
  ) => Promise<{ success: true; schemes: ItemSchemeRecord[] } | { success: false; error: string }>;
  itemSchemesListByItem: (
    itemId: number,
  ) => Promise<{ success: true; schemes: ItemSchemeRecord[] } | { success: false; error: string }>;
  itemSchemesCreate: (
    data: ItemSchemeInput,
  ) => Promise<{ success: true; scheme: ItemSchemeWithPrizes } | { success: false; error: string }>;
  itemSchemesGet: (
    id: number,
  ) => Promise<{ success: true; scheme: ItemSchemeWithPrizes } | { success: false; error: string }>;
  itemSchemesUpdate: (
    id: number,
    data: ItemSchemeInput,
  ) => Promise<{ success: true; scheme: ItemSchemeWithPrizes } | { success: false; error: string }>;
  itemSchemesDelete: (id: number) => Promise<{ success: true } | { success: false; error: string }>;
  drawsList: (
    companyId: number,
  ) => Promise<{ success: true; draws: DrawRecord[] } | { success: false; error: string }>;
  drawsCreate: (
    data: DrawInput,
  ) => Promise<{ success: true; draw: DrawRecord } | { success: false; error: string }>;
  drawsUpdate: (
    id: number,
    data: DrawInput,
  ) => Promise<{ success: true; draw: DrawRecord } | { success: false; error: string }>;
  drawsDelete: (id: number) => Promise<{ success: true } | { success: false; error: string }>;
  drawsLock: (
    id: number,
    userId: number,
    clientUpdatedAt?: number | string | null,
  ) => Promise<{ success: true; draw: DrawRecord } | { success: false; error: string }>;
  drawsUnlock: (
    id: number,
    userId: number,
    userRole: UserRole,
    clientUpdatedAt?: number | string | null,
  ) => Promise<{ success: true; draw: DrawRecord } | { success: false; error: string }>;
  drawsAuditList: (
    drawId: number,
  ) => Promise<{ success: true; logs: AuditLogRecord[] } | { success: false; error: string }>;
  drawResultsList: (
    drawId: number,
  ) => Promise<{ success: true; results: DrawResultRecord[] } | { success: false; error: string }>;
  drawResultsCreate: (
    drawId: number,
    results: DrawResultInput[],
  ) => Promise<{ success: true; draw: DrawRecord } | { success: false; error: string }>;
  winningTicketsList: (
    drawId: number,
  ) => Promise<{ success: true; tickets: WinningTicketRecord[] } | { success: false; error: string }>;
  winningTicketsCreate: (
    drawId: number,
    tickets: WinningTicketInput[],
  ) => Promise<
    { success: true; tickets: WinningTicketRecord[] } | { success: false; error: string }
  >;
  winningTicketsDelete: (id: number) => Promise<{ success: true } | { success: false; error: string }>;
  winningTicketsFindWinners: (
    drawId: number,
  ) => Promise<
    | { success: true; winners: WinningTicketRecord[]; count: number }
    | { success: false; error: string }
  >;
  transactionsSearchTicket: (
    companyId: number,
    ticketNumber: string,
  ) => Promise<
    { success: true; results: TicketSearchResult[] } | { success: false; error: string }
  >;
  transactionsList: (
    companyId: number,
    drawId?: number,
    type?: TransactionType,
  ) => Promise<{ success: true; transactions: TransactionRecord[] } | { success: false; error: string }>;
  transactionsNextMemoId: (
    companyId: number,
  ) => Promise<{ success: true; nextMemoId: number } | { success: false; error: string }>;
  transactionsCreate: (
    data: TransactionInput,
  ) => Promise<{ success: true; transaction: TransactionRecord } | { success: false; error: string }>;
  transactionsUpdate: (
    id: number,
    data: TransactionInput,
    userRole: UserRole,
  ) => Promise<{ success: true; transaction: TransactionRecord } | { success: false; error: string }>;
  transactionsDelete: (
    id: number,
    userId: number,
    userRole: UserRole,
  ) => Promise<{ success: true } | { success: false; error: string }>;
  transactionsValidateTicketsSold: (
    drawId: number,
    ticketNumbers: string[],
  ) => Promise<{ success: true; result: TicketValidationResult } | { success: false; error: string }>;
  transactionsGetBuyerSaleSummary: (
    buyerId: number,
    drawId: number,
  ) => Promise<{ success: true; summary: BuyerSaleSummary } | { success: false; error: string }>;
  transactionsGetProviderPurchaseSummary: (
    providerId: number,
    drawId: number,
  ) => Promise<
    { success: true; summary: ProviderPurchaseSummary } | { success: false; error: string }
  >;
}

const api: Api = {
  dbGetConfig: () => ipcRenderer.invoke('db-get-config'),
  dbConnect: (config) => ipcRenderer.invoke('db-connect', config),
  dbSetup: () => ipcRenderer.invoke('db-setup'),
  authLogin: (username, password) => ipcRenderer.invoke('auth-login', username, password),
  authCreateUser: (data) => ipcRenderer.invoke('auth-create-user', data),
  authGetUsers: (companyId) => ipcRenderer.invoke('auth-get-users', companyId),
  authGetAllUsers: () => ipcRenderer.invoke('auth-get-all-users'),
  authGetOwners: () => ipcRenderer.invoke('auth-get-owners'),
  authGetOwnerAdminUsers: () => ipcRenderer.invoke('auth-get-owner-admin-users'),
  authGetUserCompanyIds: (userId) => ipcRenderer.invoke('auth-get-user-company-ids', userId),
  authUpdateUser: (id, data) => ipcRenderer.invoke('auth-update-user', id, data),
  authDeleteUser: (id, currentUserId) =>
    ipcRenderer.invoke('auth-delete-user', id, currentUserId),
  userGetCompanies: (userId) => ipcRenderer.invoke('user-get-companies', userId),
  userSetActiveCompany: (userId, companyId) =>
    ipcRenderer.invoke('user-set-active-company', userId, companyId),
  userCompaniesAssign: (userId, companyId) =>
    ipcRenderer.invoke('user-companies-assign', userId, companyId),
  userCompaniesRemove: (userId, companyId) =>
    ipcRenderer.invoke('user-companies-remove', userId, companyId),
  userCompaniesList: (userId) => ipcRenderer.invoke('user-companies-list', userId),
  companiesGetAll: () => ipcRenderer.invoke('companies-get-all'),
  companiesCreate: (data) => ipcRenderer.invoke('companies-create', data),
  companiesUpdate: (id, data) => ipcRenderer.invoke('companies-update', id, data),
  companiesClone: (id) => ipcRenderer.invoke('companies-clone', id),
  companiesSetStatus: (id, status) => ipcRenderer.invoke('companies-set-status', id, status),
  companiesSetBillingLock: (id, locked) =>
    ipcRenderer.invoke('companies-set-billing-lock', id, locked),
  reportsSummary: (companyId, dateFrom, dateTo) =>
    ipcRenderer.invoke('reports-summary', companyId, dateFrom, dateTo),
  reportsDashboard: (companyId, dateFrom, dateTo) =>
    ipcRenderer.invoke('reports-dashboard', companyId, dateFrom, dateTo),
  reportsPnL: (companyId, dateFrom, dateTo) =>
    ipcRenderer.invoke('reports-pnl', companyId, dateFrom, dateTo),
  ledgerList: (companyId, dateFrom, dateTo, buyerId, providerId) =>
    ipcRenderer.invoke('ledger-list', companyId, dateFrom, dateTo, buyerId, providerId),
  ledgerAllSummary: (companyId, dateFrom, dateTo) =>
    ipcRenderer.invoke('ledger-all-summary', companyId, dateFrom, dateTo),
  auditLogsList: (filters) => ipcRenderer.invoke('audit-logs-list', filters),
  backupsCreate: (companyId, userId) => ipcRenderer.invoke('backups-create', companyId, userId),
  backupsRestore: (userId, filePath) => ipcRenderer.invoke('backups-restore', userId, filePath),
  backupsList: () => ipcRenderer.invoke('backups-list'),
  dbGetStatus: () => ipcRenderer.invoke('db-get-status'),
  dbTestConnection: (config) => ipcRenderer.invoke('db-test-connection', config),
  prefsGet: () => ipcRenderer.invoke('prefs-get'),
  prefsSetAutoBackup: (enabled) => ipcRenderer.invoke('prefs-set-auto-backup', enabled),
  authChangePassword: (userId, currentPassword, newPassword) =>
    ipcRenderer.invoke('auth-change-password', userId, currentPassword, newPassword),
  utilitiesChangeBuyerRate: (buyerId, newRate, userId) =>
    ipcRenderer.invoke('utilities-change-buyer-rate', buyerId, newRate, userId),
  utilitiesChangeProviderRate: (providerId, newRate, userId) =>
    ipcRenderer.invoke('utilities-change-provider-rate', providerId, newRate, userId),
  utilitiesChangeCommission: (partyType, partyId, newRate, userId) =>
    ipcRenderer.invoke('utilities-change-commission', partyType, partyId, newRate, userId),
  utilitiesBulkRateUpdate: (buyerGroupId, newRate, userId) =>
    ipcRenderer.invoke('utilities-bulk-rate-update', buyerGroupId, newRate, userId),
  utilitiesDeleteMemos: (drawId, memoIds, userRole) =>
    ipcRenderer.invoke('utilities-delete-memos', drawId, memoIds, userRole),
  utilitiesReindex: () => ipcRenderer.invoke('utilities-reindex'),
  windowSetTitle: (title) => ipcRenderer.invoke('window-set-title', title),
  appGetVersion: () => ipcRenderer.invoke('app-get-version'),
  onAppNavigate: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, path: string) => callback(path);
    ipcRenderer.on('app:navigate', handler);
    return () => ipcRenderer.removeListener('app:navigate', handler);
  },
  onAppLogout: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('app:logout', handler);
    return () => ipcRenderer.removeListener('app:logout', handler);
  },
  onDbConnectionLost: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('db-connection-lost', handler);
    return () => ipcRenderer.removeListener('db-connection-lost', handler);
  },
  onDbConnectionRestored: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('db-connection-restored', handler);
    return () => ipcRenderer.removeListener('db-connection-restored', handler);
  },
  dbReconnect: () => ipcRenderer.invoke('db-reconnect'),
  lanGetStatus: () => ipcRenderer.invoke('lan-get-status'),
  lanSetMode: (mode) => ipcRenderer.invoke('lan-set-mode', mode),
  lanStartBroadcast: () => ipcRenderer.invoke('lan-start-broadcast'),
  lanStopBroadcast: () => ipcRenderer.invoke('lan-stop-broadcast'),
  lanDiscoverServer: () => ipcRenderer.invoke('lan-discover-server'),
  prefsSetNetworkMode: (mode) => ipcRenderer.invoke('prefs-set-network-mode', mode),
  sessionHeartbeat: (userId, companyId, ipAddress) =>
    ipcRenderer.invoke('sessions-heartbeat', userId, companyId, ipAddress),
  sessionActiveCount: (companyId) => ipcRenderer.invoke('sessions-active-count', companyId),
  diagnosticsGet: () => ipcRenderer.invoke('diagnostics-get'),
  shiftGroupsList: (companyId) => ipcRenderer.invoke('shift-groups-list', companyId),
  shiftGroupsCreate: (data) => ipcRenderer.invoke('shift-groups-create', data),
  shiftGroupsUpdate: (id, data) => ipcRenderer.invoke('shift-groups-update', id, data),
  shiftGroupsDelete: (id) => ipcRenderer.invoke('shift-groups-delete', id),
  shiftsList: (shiftGroupId) => ipcRenderer.invoke('shifts-list', shiftGroupId),
  shiftsCreate: (data) => ipcRenderer.invoke('shifts-create', data),
  shiftsUpdate: (id, data) => ipcRenderer.invoke('shifts-update', id, data),
  shiftsDelete: (id) => ipcRenderer.invoke('shifts-delete', id),
  providerGroupsList: (companyId) => ipcRenderer.invoke('provider-groups-list', companyId),
  providerGroupsCreate: (data) => ipcRenderer.invoke('provider-groups-create', data),
  providerGroupsUpdate: (id, data) => ipcRenderer.invoke('provider-groups-update', id, data),
  providerGroupsDelete: (id) => ipcRenderer.invoke('provider-groups-delete', id),
  providersList: (companyId) => ipcRenderer.invoke('providers-list', companyId),
  providersCreate: (data) => ipcRenderer.invoke('providers-create', data),
  providersUpdate: (id, data) => ipcRenderer.invoke('providers-update', id, data),
  providersDelete: (id) => ipcRenderer.invoke('providers-delete', id),
  buyerGroupsList: (companyId) => ipcRenderer.invoke('buyer-groups-list', companyId),
  buyerGroupsCreate: (data) => ipcRenderer.invoke('buyer-groups-create', data),
  buyerGroupsUpdate: (id, data) => ipcRenderer.invoke('buyer-groups-update', id, data),
  buyerGroupsDelete: (id) => ipcRenderer.invoke('buyer-groups-delete', id),
  buyersList: (companyId) => ipcRenderer.invoke('buyers-list', companyId),
  buyersCreate: (data) => ipcRenderer.invoke('buyers-create', data),
  buyersUpdate: (id, data) => ipcRenderer.invoke('buyers-update', id, data),
  buyersDelete: (id) => ipcRenderer.invoke('buyers-delete', id),
  itemGroupsList: (companyId) => ipcRenderer.invoke('item-groups-list', companyId),
  itemGroupsCreate: (data) => ipcRenderer.invoke('item-groups-create', data),
  itemGroupsUpdate: (id, data) => ipcRenderer.invoke('item-groups-update', id, data),
  itemGroupsDelete: (id) => ipcRenderer.invoke('item-groups-delete', id),
  itemsList: (companyId) => ipcRenderer.invoke('items-list', companyId),
  itemsCreate: (data) => ipcRenderer.invoke('items-create', data),
  itemsUpdate: (id, data) => ipcRenderer.invoke('items-update', id, data),
  itemsDelete: (id) => ipcRenderer.invoke('items-delete', id),
  itemSchemesList: (companyId) => ipcRenderer.invoke('itemSchemes-list', companyId),
  itemSchemesListByItem: (itemId) => ipcRenderer.invoke('itemSchemes-listByItem', itemId),
  itemSchemesCreate: (data) => ipcRenderer.invoke('itemSchemes-create', data),
  itemSchemesGet: (id) => ipcRenderer.invoke('itemSchemes-get', id),
  itemSchemesUpdate: (id, data) => ipcRenderer.invoke('itemSchemes-update', id, data),
  itemSchemesDelete: (id) => ipcRenderer.invoke('itemSchemes-delete', id),
  drawsList: (companyId) => ipcRenderer.invoke('draws-list', companyId),
  drawsCreate: (data) => ipcRenderer.invoke('draws-create', data),
  drawsUpdate: (id, data) => ipcRenderer.invoke('draws-update', id, data),
  drawsDelete: (id) => ipcRenderer.invoke('draws-delete', id),
  drawsLock: (id, userId, clientUpdatedAt) =>
    ipcRenderer.invoke('draws-lock', id, userId, clientUpdatedAt),
  drawsUnlock: (id, userId, userRole, clientUpdatedAt) =>
    ipcRenderer.invoke('draws-unlock', id, userId, userRole, clientUpdatedAt),
  drawsAuditList: (drawId) => ipcRenderer.invoke('draws-audit-list', drawId),
  drawResultsList: (drawId) => ipcRenderer.invoke('draw-results-list', drawId),
  drawResultsCreate: (drawId, results) => ipcRenderer.invoke('draw-results-create', drawId, results),
  winningTicketsList: (drawId) => ipcRenderer.invoke('winning-tickets-list', drawId),
  winningTicketsCreate: (drawId, tickets) =>
    ipcRenderer.invoke('winning-tickets-create', drawId, tickets),
  winningTicketsDelete: (id) => ipcRenderer.invoke('winning-tickets-delete', id),
  winningTicketsFindWinners: (drawId) =>
    ipcRenderer.invoke('winning-tickets-find-winners', drawId),
  transactionsSearchTicket: (companyId, ticketNumber) =>
    ipcRenderer.invoke('transactions-search-ticket', companyId, ticketNumber),
  transactionsList: (companyId, drawId, type) =>
    ipcRenderer.invoke('transactions-list', companyId, drawId, type),
  transactionsNextMemoId: (companyId) => ipcRenderer.invoke('transactions-next-memo-id', companyId),
  transactionsCreate: (data) => ipcRenderer.invoke('transactions-create', data),
  transactionsUpdate: (id, data, userRole) =>
    ipcRenderer.invoke('transactions-update', id, data, userRole),
  transactionsDelete: (id, userId, userRole) =>
    ipcRenderer.invoke('transactions-delete', id, userId, userRole),
  transactionsValidateTicketsSold: (drawId, ticketNumbers) =>
    ipcRenderer.invoke('transactions-validate-tickets-sold', drawId, ticketNumbers),
  transactionsGetBuyerSaleSummary: (buyerId, drawId) =>
    ipcRenderer.invoke('transactions-get-buyer-sale-summary', buyerId, drawId),
  transactionsGetProviderPurchaseSummary: (providerId, drawId) =>
    ipcRenderer.invoke('transactions-get-provider-purchase-summary', providerId, drawId),
};

contextBridge.exposeInMainWorld('api', api);
