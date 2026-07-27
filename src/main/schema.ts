import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', [
  'admin',
  'owner',
  'manager',
  'supervisor',
  'data_entry',
]);

export const statusEnum = pgEnum('status', ['active', 'locked', 'frozen']);

export const drawStatusEnum = pgEnum('draw_status', ['open', 'closed', 'locked']);

export const txnTypeEnum = pgEnum('txn_type', [
  'purchase',
  'purchase_return',
  'sale',
  'sale_return',
  'stock_transfer',
  'booking',
]);

export const buyerTypeEnum = pgEnum('buyer_type', ['stockist', 'seller']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name'),
  role: roleEnum('role').notNull().default('data_entry'),
  companyId: integer('company_id'),
  activeCompanyId: integer('active_company_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: integer('owner_id').references(() => users.id),
  status: statusEnum('status').default('active'),
  billingLocked: boolean('billing_locked').default(false),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const userCompanies = pgTable('user_companies', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
});

export const shiftGroups = pgTable('shift_groups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
});

export const shifts = pgTable('shifts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  shiftGroupId: integer('shift_group_id')
    .notNull()
    .references(() => shiftGroups.id, { onDelete: 'cascade' }),
});

export const providerGroups = pgTable('provider_groups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
});

export const providers = pgTable('providers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  providerGroupId: integer('provider_group_id')
    .notNull()
    .references(() => providerGroups.id, { onDelete: 'cascade' }),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  purchaseRate: numeric('purchase_rate', { precision: 10, scale: 2 }),
  commission: numeric('commission', { precision: 10, scale: 2 }),
  status: statusEnum('status').default('active'),
  phone: text('phone'),
  address: text('address'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const buyerGroups = pgTable('buyer_groups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
});

export const buyers = pgTable('buyers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: buyerTypeEnum('buyer_type').notNull().default('stockist'),
  buyerGroupId: integer('buyer_group_id')
    .notNull()
    .references(() => buyerGroups.id, { onDelete: 'cascade' }),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  saleRate: numeric('sale_rate', { precision: 10, scale: 2 }),
  commission: numeric('commission', { precision: 10, scale: 2 }),
  status: statusEnum('status').default('active'),
  phone: text('phone'),
  address: text('address'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const itemGroups = pgTable('item_groups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
});

export const items = pgTable('items', {
  id: serial('id').primaryKey(),
  code: text('code'),
  name: text('name').notNull(),
  rate: numeric('rate', { precision: 12, scale: 2 }),
  itemGroupId: integer('item_group_id')
    .notNull()
    .references(() => itemGroups.id, { onDelete: 'cascade' }),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  noOfSeries: integer('no_of_series'),
  drawTime: text('draw_time'),
  shiftGroupId: integer('shift_group_id').references(() => shiftGroups.id),
  type: text('type'),
  mrp: numeric('mrp', { precision: 12, scale: 2 }),
  length: integer('length'),
  ratePer100: numeric('rate_per_100', { precision: 12, scale: 2 }),
  defaultSeries: text('default_series'),
  prefix: text('prefix'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const itemSchemes = pgTable('item_schemes', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id')
    .notNull()
    .references(() => items.id, { onDelete: 'cascade' }),
  schemeDate: timestamp('scheme_date').notNull(),
  drawNo: text('draw_no'),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const itemSchemePrizes = pgTable('item_scheme_prizes', {
  id: serial('id').primaryKey(),
  itemSchemeId: integer('item_scheme_id')
    .notNull()
    .references(() => itemSchemes.id, { onDelete: 'cascade' }),
  prizeRank: integer('prize_rank').notNull(),
  checkPrefix: text('check_prefix'),
  checkSeries: text('check_series'),
  prizeNoLength: integer('prize_no_length'),
  noOfResult: integer('no_of_result'),
  prizeAmount: numeric('prize_amount', { precision: 12, scale: 2 }),
  bonusReceivable: numeric('bonus_receivable', { precision: 12, scale: 2 }),
  bonusPayable: numeric('bonus_payable', { precision: 12, scale: 2 }),
  incentiveReceivable: numeric('incentive_receivable', { precision: 12, scale: 2 }),
  incentivePayable: numeric('incentive_payable', { precision: 12, scale: 2 }),
});

export const draws = pgTable('draws', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  itemId: integer('item_id').references(() => items.id),
  drawDate: timestamp('draw_date').notNull(),
  closeTime: text('close_time'),
  status: drawStatusEnum('status').default('open'),
  resultImported: boolean('result_imported').default(false),
  lockedAt: timestamp('locked_at'),
  lockedBy: integer('locked_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const drawResults = pgTable('draw_results', {
  id: serial('id').primaryKey(),
  drawId: integer('draw_id')
    .notNull()
    .references(() => draws.id, { onDelete: 'cascade' }),
  prizeLevel: integer('prize_level').notNull(),
  winningNumber: text('winning_number').notNull(),
  prizeAmount: numeric('prize_amount', { precision: 12, scale: 2 }),
});

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  type: txnTypeEnum('type').notNull(),
  drawId: integer('draw_id')
    .notNull()
    .references(() => draws.id, { onDelete: 'cascade' }),
  providerId: integer('provider_id').references(() => providers.id),
  buyerId: integer('buyer_id').references(() => buyers.id),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  memoId: integer('memo_id'),
  amount: numeric('amount', { precision: 12, scale: 2 }),
  ticketCount: integer('ticket_count'),
  ticketData: text('ticket_data'),
  voucherNo: text('voucher_no'),
  enteredAt: timestamp('entered_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const winningTickets = pgTable('winning_tickets', {
  id: serial('id').primaryKey(),
  drawId: integer('draw_id')
    .notNull()
    .references(() => draws.id, { onDelete: 'cascade' }),
  ticketNumber: text('ticket_number').notNull(),
  prizeLevel: integer('prize_level').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }),
  providerId: integer('provider_id').references(() => providers.id),
  buyerId: integer('buyer_id').references(() => buyers.id),
  transactionId: integer('transaction_id').references(() => transactions.id, {
    onDelete: 'cascade',
  }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const ledgerEntries = pgTable('ledger_entries', {
  id: serial('id').primaryKey(),
  providerId: integer('provider_id').references(() => providers.id),
  buyerId: integer('buyer_id').references(() => buyers.id),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  debit: numeric('debit', { precision: 12, scale: 2 }),
  credit: numeric('credit', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: integer('entity_id'),
  details: text('details'),
  ipAddress: text('ip_address'),
  timestamp: timestamp('timestamp').defaultNow(),
});

export const backups = pgTable('backups', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  size: integer('size'),
  status: text('status').default('completed'),
  triggeredBy: integer('triggered_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userSessions = pgTable('user_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  companyId: integer('company_id').notNull(),
  lastSeen: timestamp('last_seen').defaultNow(),
  ipAddress: text('ip_address'),
});
