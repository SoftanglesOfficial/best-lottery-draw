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
  TransactionInput,
  TransactionRecord,
  TransactionType,
  BuyerSaleSummary,
  ProviderPurchaseSummary,
  TicketValidationResult,
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
  UserInput,
  UserRecord,
  UserRole,
  WinningTicketInput,
  WinningTicketRecord,
} from '../../shared/types';

interface Api {
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
    { success: true; data: import('../../shared/types').ReportsDashboardData } | { success: false; error: string }
  >;
  reportsPnL: (
    companyId: number,
    dateFrom: string,
    dateTo: string,
  ) => Promise<
    { success: true; report: import('../../shared/types').PnLReport } | { success: false; error: string }
  >;
  ledgerList: (
    companyId: number,
    dateFrom?: string,
    dateTo?: string,
    buyerId?: number,
    providerId?: number,
  ) => Promise<
    { success: true; ledger: import('../../shared/types').LedgerListResult } | { success: false; error: string }
  >;
  ledgerAllSummary: (
    companyId: number,
    dateFrom?: string,
    dateTo?: string,
  ) => Promise<
    { success: true; summary: import('../../shared/types').LedgerAllSummary } | { success: false; error: string }
  >;
  auditLogsList: (
    filters: import('../../shared/types').AuditLogFilters,
  ) => Promise<
    { success: true; logs: import('../../shared/types').AuditLogListRecord[] } | { success: false; error: string }
  >;
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
    { success: true; backups: import('../../shared/types').BackupRecord[] } | { success: false; error: string }
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
  ) => Promise<
    { success: true; buyer: import('../../shared/types').BuyerRecord } | { success: false; error: string }
  >;
  utilitiesChangeProviderRate: (
    providerId: number,
    newRate: number,
    userId: number,
  ) => Promise<
    { success: true; provider: import('../../shared/types').ProviderRecord } | { success: false; error: string }
  >;
  utilitiesChangeCommission: (
    partyType: 'buyer' | 'provider',
    partyId: number,
    newRate: number,
    userId: number,
  ) => Promise<
    | { success: true; party: import('../../shared/types').BuyerRecord | import('../../shared/types').ProviderRecord }
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
  sessionHeartbeat: (
    userId: number,
    companyId: number,
    ipAddress?: string,
  ) => Promise<{ success: true } | { success: false; error: string }>;
  sessionActiveCount: (
    companyId: number,
  ) => Promise<{ success: true; count: number } | { success: false; error: string }>;
  diagnosticsGet: () => Promise<
    | { success: true; data: import('../../shared/types').DiagnosticsData }
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

declare global {
  interface Window {
    api: Api;
  }
}

export type {
  UserRole,
  SessionUser,
  CompanySummary,
  CompanyRecord,
  CompanyInput,
  CompanyStatus,
  ReportsSummary,
  DbConfig,
  AuthUser,
  UserRecord,
  UserInput,
};

export {};
