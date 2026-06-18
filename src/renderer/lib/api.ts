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
  UserInput,
  UserRecord,
  TransactionInput,
  TransactionRecord,
  TransactionType,
  BuyerSaleSummary,
  ProviderPurchaseSummary,
  TicketValidationResult,
} from '../../shared/types';

export type {
  DbConfig,
  AuthUser,
  SessionUser,
  CompanySummary,
  CompanyRecord,
  CompanyInput,
  CompanyStatus,
  UserRecord,
  UserInput,
  ReportsSummary,
};

export const api = window.api;

export function dbGetConfig() {
  return api.dbGetConfig();
}

export function dbConnect(config: DbConfig) {
  return api.dbConnect(config);
}

export function dbSetup() {
  return api.dbSetup();
}

export function authLogin(username: string, password: string) {
  return api.authLogin(username, password);
}

export function authCreateUser(data: UserInput) {
  return api.authCreateUser(data);
}

export function authGetUsers(companyId: number) {
  return api.authGetUsers(companyId);
}

export function authGetAllUsers() {
  return api.authGetAllUsers();
}

export function authGetOwners() {
  return api.authGetOwners();
}

export function authGetOwnerAdminUsers() {
  return api.authGetOwnerAdminUsers();
}

export function authGetUserCompanyIds(userId: number) {
  return api.authGetUserCompanyIds(userId);
}

export function authUpdateUser(id: number, data: Partial<UserInput>) {
  return api.authUpdateUser(id, data);
}

export function authDeleteUser(id: number, currentUserId: number) {
  return api.authDeleteUser(id, currentUserId);
}

export function userGetCompanies(userId: number) {
  return api.userGetCompanies(userId);
}

export function userSetActiveCompany(userId: number, companyId: number) {
  return api.userSetActiveCompany(userId, companyId);
}

export function userCompaniesAssign(userId: number, companyId: number) {
  return api.userCompaniesAssign(userId, companyId);
}

export function userCompaniesRemove(userId: number, companyId: number) {
  return api.userCompaniesRemove(userId, companyId);
}

export function userCompaniesList(userId: number) {
  return api.userCompaniesList(userId);
}

export function companiesGetAll() {
  return api.companiesGetAll();
}

export function companiesCreate(data: CompanyInput) {
  return api.companiesCreate(data);
}

export function companiesUpdate(id: number, data: CompanyInput) {
  return api.companiesUpdate(id, data);
}

export function companiesClone(id: number) {
  return api.companiesClone(id);
}

export function companiesSetStatus(id: number, status: CompanyStatus) {
  return api.companiesSetStatus(id, status);
}

export function companiesSetBillingLock(id: number, locked: boolean) {
  return api.companiesSetBillingLock(id, locked);
}

export function reportsSummary(companyId: number, dateFrom: string, dateTo: string) {
  return api.reportsSummary(companyId, dateFrom, dateTo);
}

export function reportsDashboard(companyId: number, dateFrom: string, dateTo: string) {
  return api.reportsDashboard(companyId, dateFrom, dateTo);
}

export function reportsPnL(companyId: number, dateFrom: string, dateTo: string) {
  return api.reportsPnL(companyId, dateFrom, dateTo);
}

export function ledgerList(
  companyId: number,
  dateFrom?: string,
  dateTo?: string,
  buyerId?: number,
  providerId?: number,
) {
  return api.ledgerList(companyId, dateFrom, dateTo, buyerId, providerId);
}

export function ledgerAllSummary(companyId: number, dateFrom?: string, dateTo?: string) {
  return api.ledgerAllSummary(companyId, dateFrom, dateTo);
}

export function auditLogsList(filters: import('../../shared/types').AuditLogFilters) {
  return api.auditLogsList(filters);
}

export function backupsCreate(companyId: number, userId: number) {
  return api.backupsCreate(companyId, userId);
}

export function backupsRestore(userId: number, filePath?: string) {
  return api.backupsRestore(userId, filePath);
}

export function backupsList() {
  return api.backupsList();
}

export function dbGetStatus() {
  return api.dbGetStatus();
}

export function dbTestConnection(config: DbConfig) {
  return api.dbTestConnection(config);
}

export function prefsGet() {
  return api.prefsGet();
}

export function prefsSetAutoBackup(enabled: boolean) {
  return api.prefsSetAutoBackup(enabled);
}

export function authChangePassword(userId: number, currentPassword: string, newPassword: string) {
  return api.authChangePassword(userId, currentPassword, newPassword);
}

export function utilitiesChangeBuyerRate(buyerId: number, newRate: number, userId: number) {
  return api.utilitiesChangeBuyerRate(buyerId, newRate, userId);
}

export function utilitiesChangeProviderRate(providerId: number, newRate: number, userId: number) {
  return api.utilitiesChangeProviderRate(providerId, newRate, userId);
}

export function utilitiesChangeCommission(
  partyType: 'buyer' | 'provider',
  partyId: number,
  newRate: number,
  userId: number,
) {
  return api.utilitiesChangeCommission(partyType, partyId, newRate, userId);
}

export function utilitiesBulkRateUpdate(buyerGroupId: number, newRate: number, userId: number) {
  return api.utilitiesBulkRateUpdate(buyerGroupId, newRate, userId);
}

export function utilitiesDeleteMemos(
  drawId: number,
  memoIds: number[],
  userRole: import('../../shared/types').UserRole,
) {
  return api.utilitiesDeleteMemos(drawId, memoIds, userRole);
}

export function utilitiesReindex() {
  return api.utilitiesReindex();
}

export function dbReconnect() {
  return api.dbReconnect();
}

export function lanGetStatus() {
  return api.lanGetStatus();
}

export function lanSetMode(mode: 'server' | 'client') {
  return api.lanSetMode(mode);
}

export function lanStartBroadcast() {
  return api.lanStartBroadcast();
}

export function lanStopBroadcast() {
  return api.lanStopBroadcast();
}

export function lanDiscoverServer() {
  return api.lanDiscoverServer();
}

export function prefsSetNetworkMode(mode: 'server' | 'client') {
  return api.prefsSetNetworkMode(mode);
}

export function sessionHeartbeat(userId: number, companyId: number, ipAddress?: string) {
  return api.sessionHeartbeat(userId, companyId, ipAddress);
}

export function sessionActiveCount(companyId: number) {
  return api.sessionActiveCount(companyId);
}

export function diagnosticsGet() {
  return api.diagnosticsGet();
}

export function shiftGroupsList(companyId: number) {
  return api.shiftGroupsList(companyId);
}

export function shiftGroupsCreate(data: ShiftGroupInput) {
  return api.shiftGroupsCreate(data);
}

export function shiftGroupsUpdate(id: number, data: ShiftGroupInput) {
  return api.shiftGroupsUpdate(id, data);
}

export function shiftGroupsDelete(id: number) {
  return api.shiftGroupsDelete(id);
}

export function shiftsList(shiftGroupId: number) {
  return api.shiftsList(shiftGroupId);
}

export function shiftsCreate(data: ShiftInput) {
  return api.shiftsCreate(data);
}

export function shiftsUpdate(id: number, data: ShiftInput) {
  return api.shiftsUpdate(id, data);
}

export function shiftsDelete(id: number) {
  return api.shiftsDelete(id);
}

export function providerGroupsList(companyId: number) {
  return api.providerGroupsList(companyId);
}

export function providerGroupsCreate(data: ProviderGroupInput) {
  return api.providerGroupsCreate(data);
}

export function providerGroupsUpdate(id: number, data: ProviderGroupInput) {
  return api.providerGroupsUpdate(id, data);
}

export function providerGroupsDelete(id: number) {
  return api.providerGroupsDelete(id);
}

export function providersList(companyId: number) {
  return api.providersList(companyId);
}

export function providersCreate(data: ProviderInput) {
  return api.providersCreate(data);
}

export function providersUpdate(id: number, data: ProviderInput) {
  return api.providersUpdate(id, data);
}

export function providersDelete(id: number) {
  return api.providersDelete(id);
}

export function buyerGroupsList(companyId: number) {
  return api.buyerGroupsList(companyId);
}

export function buyerGroupsCreate(data: BuyerGroupInput) {
  return api.buyerGroupsCreate(data);
}

export function buyerGroupsUpdate(id: number, data: BuyerGroupInput) {
  return api.buyerGroupsUpdate(id, data);
}

export function buyerGroupsDelete(id: number) {
  return api.buyerGroupsDelete(id);
}

export function buyersList(companyId: number) {
  return api.buyersList(companyId);
}

export function buyersCreate(data: BuyerInput) {
  return api.buyersCreate(data);
}

export function buyersUpdate(id: number, data: BuyerInput) {
  return api.buyersUpdate(id, data);
}

export function buyersDelete(id: number) {
  return api.buyersDelete(id);
}

export function itemGroupsList(companyId: number) {
  return api.itemGroupsList(companyId);
}

export function itemGroupsCreate(data: ItemGroupInput) {
  return api.itemGroupsCreate(data);
}

export function itemGroupsUpdate(id: number, data: ItemGroupInput) {
  return api.itemGroupsUpdate(id, data);
}

export function itemGroupsDelete(id: number) {
  return api.itemGroupsDelete(id);
}

export function itemsList(companyId: number) {
  return api.itemsList(companyId);
}

export function itemsCreate(data: ItemInput) {
  return api.itemsCreate(data);
}

export function itemsUpdate(id: number, data: ItemInput) {
  return api.itemsUpdate(id, data);
}

export function itemsDelete(id: number) {
  return api.itemsDelete(id);
}

export function itemSchemesList(companyId: number) {
  return api.itemSchemesList(companyId);
}

export function itemSchemesListByItem(itemId: number) {
  return api.itemSchemesListByItem(itemId);
}

export function itemSchemesCreate(data: ItemSchemeInput) {
  return api.itemSchemesCreate(data);
}

export function itemSchemesGet(id: number) {
  return api.itemSchemesGet(id);
}

export function itemSchemesUpdate(id: number, data: ItemSchemeInput) {
  return api.itemSchemesUpdate(id, data);
}

export function itemSchemesDelete(id: number) {
  return api.itemSchemesDelete(id);
}

export function drawsList(companyId: number) {
  return api.drawsList(companyId);
}

export function drawsCreate(data: DrawInput) {
  return api.drawsCreate(data);
}

export function drawsUpdate(id: number, data: DrawInput) {
  return api.drawsUpdate(id, data);
}

export function drawsDelete(id: number) {
  return api.drawsDelete(id);
}

export function drawsLock(id: number, userId: number, clientUpdatedAt?: number | string | null) {
  return api.drawsLock(id, userId, clientUpdatedAt);
}

export function drawsUnlock(
  id: number,
  userId: number,
  userRole: UserRole,
  clientUpdatedAt?: number | string | null,
) {
  return api.drawsUnlock(id, userId, userRole, clientUpdatedAt);
}

export function drawsAuditList(drawId: number) {
  return api.drawsAuditList(drawId);
}

export function drawsExtendTime(
  drawId: number,
  userId: number,
  userRole: UserRole,
  newCloseTime: string,
  reason: string,
) {
  return api.drawsExtendTime(drawId, userId, userRole, newCloseTime, reason);
}

export function drawResultsList(drawId: number) {
  return api.drawResultsList(drawId);
}

export function drawResultsCreate(drawId: number, results: DrawResultInput[]) {
  return api.drawResultsCreate(drawId, results);
}

export function winningTicketsList(drawId: number) {
  return api.winningTicketsList(drawId);
}

export function winningTicketsCreate(drawId: number, tickets: WinningTicketInput[]) {
  return api.winningTicketsCreate(drawId, tickets);
}

export function winningTicketsDelete(id: number) {
  return api.winningTicketsDelete(id);
}

export function winningTicketsFindWinners(drawId: number) {
  return api.winningTicketsFindWinners(drawId);
}

export function transactionsSearchTicket(companyId: number, ticketNumber: string) {
  return api.transactionsSearchTicket(companyId, ticketNumber);
}

export function transactionsList(companyId: number, drawId?: number, type?: TransactionType) {
  return api.transactionsList(companyId, drawId, type);
}

export function transactionsNextMemoId(companyId: number) {
  return api.transactionsNextMemoId(companyId);
}

export function transactionsCreate(data: TransactionInput) {
  return api.transactionsCreate(data);
}

export function transactionsUpdate(id: number, data: TransactionInput, userRole: UserRole) {
  return api.transactionsUpdate(id, data, userRole);
}

export function transactionsDelete(id: number, userId: number, userRole: UserRole) {
  return api.transactionsDelete(id, userId, userRole);
}

export function transactionsValidateTicketsSold(drawId: number, ticketNumbers: string[]) {
  return api.transactionsValidateTicketsSold(drawId, ticketNumbers);
}

export function transactionsGetBuyerSaleSummary(buyerId: number, drawId: number) {
  return api.transactionsGetBuyerSaleSummary(buyerId, drawId);
}

export function transactionsGetProviderPurchaseSummary(providerId: number, drawId: number) {
  return api.transactionsGetProviderPurchaseSummary(providerId, drawId);
}

export type {
  ShiftGroupRecord,
  ShiftGroupInput,
  ShiftRecord,
  ShiftInput,
  ProviderGroupRecord,
  ProviderGroupInput,
  ProviderRecord,
  ProviderInput,
  BuyerGroupRecord,
  BuyerGroupInput,
  BuyerRecord,
  BuyerInput,
  ItemGroupRecord,
  ItemGroupInput,
  ItemRecord,
  ItemInput,
  ItemSchemeRecord,
  ItemSchemeInput,
  ItemSchemeWithPrizes,
  DrawRecord,
  DrawInput,
  DrawResultRecord,
  DrawResultInput,
  WinningTicketRecord,
  WinningTicketInput,
  AuditLogRecord,
  TicketSearchResult,
  TransactionRecord,
  TransactionInput,
  TransactionType,
  BuyerSaleSummary,
  ProviderPurchaseSummary,
  TicketValidationResult,
};
