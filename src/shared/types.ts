export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
}

export type UserRole = 'admin' | 'owner' | 'manager' | 'supervisor' | 'data_entry';
export type CompanyStatus = 'active' | 'locked' | 'frozen';

export interface AuthUser {
  id: number;
  username: string;
  fullName: string | null;
  role: UserRole;
  companyId: number | null;
  activeCompanyId: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type LoginSuccess = {
  success: true;
  user: AuthUser;
  sessionToken: string;
  companyName?: string | null;
  /** True when login used the well-known default seed password. */
  mustChangePassword?: boolean;
};

export type LoginFailure = {
  success: false;
  error: string;
};

export type LoginResult = LoginSuccess | LoginFailure;

export interface SessionUser {
  id: number;
  username: string;
  fullName: string | null;
  role: UserRole;
  companyId: number | null;
  activeCompanyId: number | null;
}

export interface UserRecord {
  id: number;
  username: string;
  fullName: string | null;
  role: UserRole;
  companyId: number | null;
  activeCompanyId: number | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface CompanySummary {
  id: number;
  name: string;
  status: CompanyStatus | null;
}

export interface CompanyRecord {
  id: number;
  name: string;
  ownerId: number | null;
  ownerName: string | null;
  status: CompanyStatus | null;
  billingLocked: boolean | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CompanyInput {
  name: string;
  ownerId?: number | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface UserInput {
  fullName: string;
  username: string;
  password?: string;
  role: UserRole;
  companyIds?: number[];
}

export interface ReportsSummary {
  sales: number;
  purchases: number;
  returns: number;
  pwt: number;
  net: number;
  transactionCount: number;
  drawsToday: number;
}

export type IpcResult<T> = { success: true; data: T } | { success: false; error: string };

export type EntityStatus = 'active' | 'locked' | 'frozen';
export type BuyerType = 'stockist' | 'seller';

export interface ShiftGroupRecord {
  id: number;
  name: string;
  companyId: number;
}

export interface ShiftGroupInput {
  name: string;
}

export interface ShiftRecord {
  id: number;
  name: string;
  shiftGroupId: number;
}

export interface ActiveShift extends ShiftRecord {
  shiftGroupName: string;
}

export interface ShiftInput {
  name: string;
  shiftGroupId: number;
}

export interface ProviderGroupRecord {
  id: number;
  name: string;
  companyId: number;
}

export interface ProviderGroupInput {
  name: string;
  companyId: number;
}

export interface ProviderRecord {
  id: number;
  name: string;
  providerGroupId: number;
  groupName: string | null;
  companyId: number;
  purchaseRate: string | null;
  commission: string | null;
  status: EntityStatus | null;
  phone: string | null;
  address: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ProviderInput {
  name: string;
  providerGroupId: number;
  companyId: number;
  purchaseRate?: number | null;
  commission?: number | null;
  status?: EntityStatus;
  phone?: string | null;
  address?: string | null;
}

export interface BuyerGroupRecord {
  id: number;
  name: string;
  companyId: number;
}

export interface BuyerGroupInput {
  name: string;
  companyId: number;
}

export interface BuyerRecord {
  id: number;
  name: string;
  type: BuyerType;
  buyerGroupId: number;
  groupName: string | null;
  companyId: number;
  saleRate: string | null;
  commission: string | null;
  status: EntityStatus | null;
  phone: string | null;
  address: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface BuyerInput {
  name: string;
  buyerGroupId: number;
  companyId: number;
  type?: BuyerType;
  saleRate?: number | null;
  commission?: number | null;
  status?: EntityStatus;
  phone?: string | null;
  address?: string | null;
}

export interface ItemGroupRecord {
  id: number;
  name: string;
  companyId: number;
}

export interface ItemGroupInput {
  name: string;
  companyId: number;
}

export interface ItemRecord {
  id: number;
  code: string | null;
  name: string;
  rate: string | null;
  itemGroupId: number;
  groupName: string | null;
  companyId: number;
  noOfSeries: number | null;
  drawTime: string | null;
  shiftGroupId: number | null;
  type: string | null;
  mrp: string | null;
  length: number | null;
  ratePer100: string | null;
  defaultSeries: string | null;
  prefix: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ItemInput {
  code?: string | null;
  name: string;
  itemGroupId: number;
  companyId: number;
  rate?: number | null;
  noOfSeries?: number | null;
  drawTime?: string | null;
  shiftGroupId?: number | null;
  type?: string | null;
  mrp?: number | null;
  length?: number | null;
  ratePer100?: number | null;
  defaultSeries?: string | null;
  prefix?: string | null;
}

export interface ItemSchemePrizeInput {
  prizeRank: number;
  checkPrefix?: string | null;
  checkSeries?: string | null;
  prizeNoLength?: number | null;
  noOfResult?: number | null;
  prizeAmount?: number | null;
  bonusReceivable?: number | null;
  bonusPayable?: number | null;
  incentiveReceivable?: number | null;
  incentivePayable?: number | null;
}

export interface ItemSchemeRecord {
  id: number;
  itemId: number;
  itemName?: string | null;
  schemeDate: Date;
  drawNo: string | null;
  companyId: number;
  createdAt: Date | null;
  updatedAt: Date | null;
  prizeCount?: number;
}

export interface ItemSchemeInput {
  itemId: number;
  schemeDate: string;
  drawNo?: string | null;
  companyId: number;
  prizes?: ItemSchemePrizeInput[];
}

export interface ItemSchemeWithPrizes extends ItemSchemeRecord {
  prizes: ItemSchemePrizeInput[];
}

export type DrawStatus = 'open' | 'closed' | 'locked';

export interface DrawRecord {
  id: number;
  name: string;
  companyId: number;
  itemId: number | null;
  itemName: string | null;
  drawDate: Date;
  closeTime: string | null;
  status: DrawStatus | null;
  resultImported: boolean | null;
  lockedAt: Date | null;
  lockedBy: number | null;
  lockedByName: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  transactionCount?: number;
}

export interface DrawInput {
  name?: string | null;
  companyId: number;
  itemId: number;
  drawDate: string;
  closeTime?: string | null;
}

export interface DrawResultInput {
  prizeLevel: number;
  winningNumber: string;
  prizeAmount?: number | null;
}

export interface DrawResultRecord {
  id: number;
  drawId: number;
  prizeLevel: number;
  winningNumber: string;
  prizeAmount: string | null;
}

export interface WinningTicketInput {
  ticketNumber: string;
  prizeLevel: number;
  amount?: number | null;
  buyerId?: number | null;
  providerId?: number | null;
  transactionId?: number | null;
}

export interface WinningTicketRecord {
  id: number;
  drawId: number;
  ticketNumber: string;
  prizeLevel: number;
  amount: string | null;
  buyerId: number | null;
  buyerName: string | null;
  providerId: number | null;
  providerName: string | null;
  transactionId: number | null;
  createdAt: Date | null;
}

export interface AuditLogRecord {
  id: number;
  userId: number;
  username: string | null;
  fullName: string | null;
  action: string;
  entity: string;
  entityId: number | null;
  details: string | null;
  timestamp: Date | null;
}

export interface TicketSearchResult {
  id: number;
  drawId: number;
  drawName: string | null;
  drawDate: Date | null;
  type: string;
  amount: string | null;
  buyerName: string | null;
  enteredAt: Date | null;
  ticketNumber: string;
}

export type TransactionType =
  | 'purchase'
  | 'sale'
  | 'sale_return'
  | 'purchase_return'
  | 'stock_transfer'
  | 'booking';

export interface TransactionRecord {
  id: number;
  type: TransactionType;
  drawId: number;
  drawName: string | null;
  providerId: number | null;
  providerName: string | null;
  buyerId: number | null;
  buyerName: string | null;
  companyId: number;
  userId: number;
  username: string | null;
  memoId: number | null;
  amount: string | null;
  ticketCount: number | null;
  ticketData: string | null;
  voucherNo: string | null;
  enteredAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface TransactionInput {
  type: TransactionType;
  companyId: number;
  userId: number;
  drawId?: number;
  itemId?: number;
  entryDate?: string;
  providerId?: number | null;
  buyerId?: number | null;
  memoId?: number | null;
  amount?: number | null;
  ticketCount?: number | null;
  ticketData?: string | null;
  voucherNo?: string | null;
  enteredAt?: string;
}

export interface BuyerSaleSummary {
  totalSold: number;
  totalReturned: number;
  net: number;
}

export interface TicketValidationResult {
  valid: string[];
  invalid: string[];
}

export interface ProviderPurchaseSummary {
  totalPurchased: number;
  totalReturned: number;
  net: number;
}

export interface LedgerDrawBreakdown {
  drawId: number;
  drawName: string | null;
  drawDate: Date | null;
  sold?: number;
  returned?: number;
  net?: number;
  purchased?: number;
  purchaseReturned?: number;
  netPurchase?: number;
  pwt: number;
  balance: number;
}

export interface BuyerLedgerRow {
  buyerId: number;
  buyerName: string;
  groupName: string | null;
  totalSale: number;
  totalSaleReturn: number;
  netSale: number;
  totalPwt: number;
  balance: number;
  drawBreakdown: LedgerDrawBreakdown[];
}

export interface ProviderLedgerRow {
  providerId: number;
  providerName: string;
  groupName: string | null;
  totalPurchase: number;
  totalPurchaseReturn: number;
  netPurchase: number;
  totalPwtPayable: number;
  balance: number;
  drawBreakdown: LedgerDrawBreakdown[];
}

export interface LedgerListResult {
  buyers: BuyerLedgerRow[];
  providers: ProviderLedgerRow[];
}

export interface LedgerAllSummary {
  totalSales: number;
  totalSaleReturns: number;
  netSales: number;
  totalPurchases: number;
  totalPurchaseReturns: number;
  netPurchases: number;
  totalPwtReceivable: number;
  totalPwtPayable: number;
  netReceivable: number;
  netPayable: number;
  grossProfit: number;
}

export interface AuditLogListRecord {
  id: number;
  userId: number;
  username: string | null;
  fullName: string | null;
  action: string;
  entity: string;
  entityId: number | null;
  details: string | null;
  timestamp: Date | null;
}

export interface AuditLogFilters {
  companyId?: number;
  entity?: string;
  entityId?: number;
  dateFrom?: string;
  dateTo?: string;
  userId?: number;
}

export interface BackupRecord {
  id: number;
  filename: string;
  size: number | null;
  status: string | null;
  triggeredBy: number | null;
  triggeredByName: string | null;
  createdAt: Date | null;
}

export interface PnLDrawRow {
  drawId: number;
  drawName: string;
  drawDate: Date | null;
  itemName: string | null;
  sales: number;
  purchases: number;
  pwt: number;
  profit: number;
}

export interface PnLBuyerRow {
  buyerId: number;
  buyerName: string;
  sales: number;
}

export interface PnLReport {
  summary: LedgerAllSummary;
  drawBreakdown: PnLDrawRow[];
  topBuyers: PnLBuyerRow[];
}

export interface DailyChartPoint {
  date: string;
  sales: number;
  purchases: number;
}

export interface ReportsDashboardData {
  summary: ReportsSummary;
  chartData: DailyChartPoint[];
  recentTransactions: TransactionRecord[];
}

export interface UserSessionRecord {
  id: number;
  userId: number;
  companyId: number;
  lastSeen: Date | null;
  ipAddress: string | null;
}

export interface DiagnosticsData {
  dbConnected: boolean;
  dbVersion: string | null;
  dbConfig: DbConfig;
  networkMode: 'server' | 'client';
  broadcast: {
    isBroadcasting: boolean;
    port: number;
    localIp: string;
  };
  autoBackup: boolean;
  lastBackupDate: string | null;
  lastBackupRecordAt?: Date | null;
  tableCounts: {
    users: number;
    companies: number;
    transactions: number;
    draws: number;
  } | null;
  activeSessions: UserSessionRecord[];
  appVersion: string;
  electronVersion: string;
  nodeVersion: string;
}
