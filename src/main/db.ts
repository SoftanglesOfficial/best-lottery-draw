import crypto from 'node:crypto';
import { BrowserWindow } from 'electron';
import { getConfigValue, setConfigValue } from './configStore';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { DbConfig } from '../shared/types';
import * as schema from './schema';

export type { DbConfig };

const DEFAULT_CONFIG: DbConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '',
  database: 'best12_dev',
};

function normalizeDbConfig(config: DbConfig): DbConfig {
  return {
    ...config,
    password: typeof config.password === 'string' ? config.password : '',
  };
}

let pool: Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;
let connected = false;
let connectionHealthTimer: ReturnType<typeof setInterval> | null = null;
let isHealthy = false;

function notifyConnectionLost() {
  BrowserWindow.getAllWindows()[0]?.webContents.send('db-connection-lost');
}

function notifyConnectionRestored() {
  BrowserWindow.getAllWindows()[0]?.webContents.send('db-connection-restored');
}

export function startHealthCheck(intervalMs = 30000) {
  stopHealthCheck();
  connectionHealthTimer = setInterval(async () => {
    if (!connected || !pool) return;
    try {
      await pool.query('SELECT 1');
      if (!isHealthy) {
        isHealthy = true;
        notifyConnectionRestored();
      }
    } catch {
      if (isHealthy) {
        isHealthy = false;
        connected = false;
        notifyConnectionLost();
      }
    }
  }, intervalMs);
  isHealthy = true;
}

export function stopHealthCheck() {
  if (connectionHealthTimer) {
    clearInterval(connectionHealthTimer);
    connectionHealthTimer = null;
  }
  isHealthy = false;
}

export async function reconnectDb(): Promise<{ success: boolean; error?: string }> {
  return connectDb(getStoredConfig());
}

const ENUM_SQL = `
DO $$ BEGIN CREATE TYPE role AS ENUM ('admin', 'owner', 'manager', 'supervisor', 'data_entry');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE status AS ENUM ('active', 'locked', 'frozen');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE draw_status AS ENUM ('open', 'closed', 'locked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE txn_type AS ENUM ('purchase', 'purchase_return', 'sale', 'sale_return', 'stock_transfer', 'booking');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE buyer_type AS ENUM ('stockist', 'seller');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`;

const TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role role NOT NULL DEFAULT 'data_entry',
  company_id INTEGER,
  active_company_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id INTEGER REFERENCES users(id),
  status status DEFAULT 'active',
  billing_locked BOOLEAN DEFAULT false,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_companies (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shift_groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  shift_group_id INTEGER NOT NULL REFERENCES shift_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS provider_groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS providers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  provider_group_id INTEGER NOT NULL REFERENCES provider_groups(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  purchase_rate NUMERIC(10,2),
  commission NUMERIC(10, 2),
  status status DEFAULT 'active',
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buyer_groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS buyers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  buyer_type buyer_type NOT NULL DEFAULT 'stockist',
  buyer_group_id INTEGER NOT NULL REFERENCES buyer_groups(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sale_rate NUMERIC(10,2),
  commission NUMERIC(10,2),
  status status DEFAULT 'active',
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS item_groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  rate NUMERIC(12,2),
  item_group_id INTEGER NOT NULL REFERENCES item_groups(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  no_of_series INTEGER,
  draw_time TEXT,
  shift_group_id INTEGER REFERENCES shift_groups(id),
  type TEXT,
  mrp NUMERIC(12,2),
  length INTEGER,
  rate_per_100 NUMERIC(12,2),
  default_series TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS item_schemes (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  scheme_date TIMESTAMP NOT NULL,
  draw_no TEXT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS item_scheme_prizes (
  id SERIAL PRIMARY KEY,
  item_scheme_id INTEGER NOT NULL REFERENCES item_schemes(id) ON DELETE CASCADE,
  prize_rank INTEGER NOT NULL,
  check_prefix TEXT,
  check_series TEXT,
  prize_no_length INTEGER,
  no_of_result INTEGER,
  prize_amount NUMERIC(12,2),
  bonus_receivable NUMERIC(12,2),
  bonus_payable NUMERIC(12,2),
  incentive_receivable NUMERIC(12,2),
  incentive_payable NUMERIC(12,2)
);

CREATE TABLE IF NOT EXISTS draws (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES items(id),
  draw_date TIMESTAMP NOT NULL,
  close_time TEXT,
  status draw_status DEFAULT 'open',
  result_imported BOOLEAN DEFAULT false,
  locked_at TIMESTAMP,
  locked_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS draw_results (
  id SERIAL PRIMARY KEY,
  draw_id INTEGER NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  prize_level INTEGER NOT NULL,
  winning_number TEXT NOT NULL,
  prize_amount NUMERIC(12,2)
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  type txn_type NOT NULL,
  draw_id INTEGER NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  provider_id INTEGER REFERENCES providers(id),
  buyer_id INTEGER REFERENCES buyers(id),
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  memo_id INTEGER,
  amount NUMERIC(12,2),
  ticket_count INTEGER,
  ticket_data TEXT,
  voucher_no TEXT,
  entered_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS winning_tickets (
  id SERIAL PRIMARY KEY,
  draw_id INTEGER NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL,
  prize_level INTEGER NOT NULL,
  amount NUMERIC(12,2),
  provider_id INTEGER REFERENCES providers(id),
  buyer_id INTEGER REFERENCES buyers(id),
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id SERIAL PRIMARY KEY,
  provider_id INTEGER REFERENCES providers(id),
  buyer_id INTEGER REFERENCES buyers(id),
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  debit NUMERIC(12,2),
  credit NUMERIC(12,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  details TEXT,
  ip_address TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backups (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  size INTEGER,
  status TEXT DEFAULT 'completed',
  triggered_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL,
  last_seen TIMESTAMP DEFAULT NOW(),
  ip_address TEXT
);
`;

export function getStoredConfig(): DbConfig {
  return normalizeDbConfig(getConfigValue('db', DEFAULT_CONFIG));
}

export function saveConfig(config: DbConfig): void {
  setConfigValue('db', normalizeDbConfig(config));
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const MIGRATION_SQL = `
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'buyers' AND column_name = 'type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'buyers' AND column_name = 'buyer_type'
  ) THEN
    ALTER TABLE buyers RENAME COLUMN type TO buyer_type;
  END IF;
END $$;
DO $$ BEGIN
  ALTER TYPE txn_type ADD VALUE 'purchase_return';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Legacy shifts table included company_id; current schema uses shift_group_id only
ALTER TABLE shifts DROP COLUMN IF EXISTS company_id;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shifts' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE shifts ALTER COLUMN created_at SET DEFAULT NOW();
    UPDATE shifts SET created_at = NOW() WHERE created_at IS NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shifts' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE shifts ALTER COLUMN updated_at SET DEFAULT NOW();
    UPDATE shifts SET updated_at = NOW() WHERE updated_at IS NULL;
  END IF;
END $$;

SELECT setval(
  pg_get_serial_sequence('shifts', 'id'),
  GREATEST(COALESCE((SELECT MAX(id) FROM shifts), 0), 1)
) WHERE pg_get_serial_sequence('shifts', 'id') IS NOT NULL;

-- Align draws table with current application schema
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'draws' AND column_name = 'date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'draws' AND column_name = 'draw_date'
  ) THEN
    ALTER TABLE draws RENAME COLUMN date TO draw_date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'draws' AND column_name = 'item_id'
  ) THEN
    ALTER TABLE draws ADD COLUMN item_id INTEGER REFERENCES items(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'draws' AND column_name = 'draw_date'
  ) THEN
    ALTER TABLE draws ADD COLUMN draw_date TIMESTAMP NOT NULL DEFAULT NOW();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'draws' AND column_name = 'close_time'
  ) THEN
    ALTER TABLE draws ADD COLUMN close_time TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'draws' AND column_name = 'status'
  ) THEN
    ALTER TABLE draws ADD COLUMN status draw_status DEFAULT 'open';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'draws' AND column_name = 'result_imported'
  ) THEN
    ALTER TABLE draws ADD COLUMN result_imported BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'draws' AND column_name = 'locked_at'
  ) THEN
    ALTER TABLE draws ADD COLUMN locked_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'draws' AND column_name = 'locked_by'
  ) THEN
    ALTER TABLE draws ADD COLUMN locked_by INTEGER REFERENCES users(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'draws' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE draws ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'draws' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE draws ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'draws'
      AND column_name = 'status' AND udt_name = 'text'
  ) THEN
    ALTER TABLE draws
      ALTER COLUMN status TYPE draw_status
      USING (
        CASE lower(status::text)
          WHEN 'open' THEN 'open'::draw_status
          WHEN 'closed' THEN 'closed'::draw_status
          WHEN 'locked' THEN 'locked'::draw_status
          ELSE 'open'::draw_status
        END
      );
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

SELECT setval(
  pg_get_serial_sequence('draws', 'id'),
  GREATEST(COALESCE((SELECT MAX(id) FROM draws), 0), 1)
) WHERE pg_get_serial_sequence('draws', 'id') IS NOT NULL;

-- txn_type enum values used by the app
DO $$ BEGIN ALTER TYPE txn_type ADD VALUE 'purchase';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE txn_type ADD VALUE 'sale';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE txn_type ADD VALUE 'sale_return';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE txn_type ADD VALUE 'stock_transfer';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE txn_type ADD VALUE 'booking';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Legacy transactions table may use transaction_type / txn_type instead of type
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'transaction_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'type'
  ) THEN
    ALTER TABLE transactions RENAME COLUMN transaction_type TO type;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'txn_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'type'
  ) THEN
    ALTER TABLE transactions RENAME COLUMN txn_type TO type;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'type'
  ) THEN
    ALTER TABLE transactions ADD COLUMN type txn_type NOT NULL DEFAULT 'purchase';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions'
      AND column_name = 'type' AND udt_name = 'text'
  ) THEN
    ALTER TABLE transactions
      ALTER COLUMN type TYPE txn_type
      USING (
        CASE lower(type::text)
          WHEN 'purchase' THEN 'purchase'::txn_type
          WHEN 'purchase_return' THEN 'purchase_return'::txn_type
          WHEN 'sale' THEN 'sale'::txn_type
          WHEN 'sale_return' THEN 'sale_return'::txn_type
          WHEN 'stock_transfer' THEN 'stock_transfer'::txn_type
          WHEN 'booking' THEN 'booking'::txn_type
          ELSE 'purchase'::txn_type
        END
      );
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'draw_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN draw_id INTEGER REFERENCES draws(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'provider_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN provider_id INTEGER REFERENCES providers(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'buyer_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN buyer_id INTEGER REFERENCES buyers(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'amount'
  ) THEN
    ALTER TABLE transactions ADD COLUMN amount NUMERIC(12,2);
  END IF;
END $$;

-- Purchases omit buyer_id; sales omit provider_id — both must be nullable
DO $$ BEGIN
  ALTER TABLE transactions ALTER COLUMN buyer_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE transactions ALTER COLUMN provider_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'memo_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN memo_id INTEGER;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'ticket_count'
  ) THEN
    ALTER TABLE transactions ADD COLUMN ticket_count INTEGER;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'ticket_data'
  ) THEN
    ALTER TABLE transactions ADD COLUMN ticket_data TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'voucher_no'
  ) THEN
    ALTER TABLE transactions ADD COLUMN voucher_no TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'entered_at'
  ) THEN
    ALTER TABLE transactions ADD COLUMN entered_at TIMESTAMP DEFAULT NOW();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE transactions ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE transactions ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
  END IF;
END $$;

SELECT setval(
  pg_get_serial_sequence('transactions', 'id'),
  GREATEST(COALESCE((SELECT MAX(id) FROM transactions), 0), 1)
) WHERE pg_get_serial_sequence('transactions', 'id') IS NOT NULL;

INSERT INTO provider_groups (name, company_id)
SELECT 'Default Providers', c.id FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM provider_groups g WHERE g.company_id = c.id);

INSERT INTO buyer_groups (name, company_id)
SELECT 'Default Buyers', c.id FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM buyer_groups g WHERE g.company_id = c.id);

INSERT INTO item_groups (name, company_id)
SELECT 'Default Items', c.id FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM item_groups g WHERE g.company_id = c.id);

CREATE UNIQUE INDEX IF NOT EXISTS transactions_company_memo_unique
  ON transactions (company_id, memo_id)
  WHERE memo_id IS NOT NULL;
`;

async function ensureSchema(client: Pool): Promise<void> {
  await client.query(ENUM_SQL);
  await client.query(TABLES_SQL);
  await client.query(MIGRATION_SQL);
}

async function runMigrations(): Promise<void> {
  if (!pool) return;
  await pool.query(MIGRATION_SQL);
}

export async function ensureConnected(): Promise<{ success: boolean; error?: string }> {
  if (isConnected()) {
    await runMigrations().catch(() => undefined);
    return { success: true };
  }
  return connectDb(getStoredConfig());
}

export async function connectDb(config: DbConfig): Promise<{ success: boolean; error?: string }> {
  const normalized = normalizeDbConfig(config);
  try {
    if (pool) {
      stopHealthCheck();
      await pool.end();
      pool = null;
      db = null;
      connected = false;
    }

    saveConfig(normalized);

    pool = new Pool({
      host: normalized.host,
      port: normalized.port,
      user: normalized.user,
      password: normalized.password,
      database: normalized.database,
    });

    await pool.query('SELECT 1');
    await ensureSchema(pool);

    db = drizzle(pool, { schema });
    connected = true;
    startHealthCheck();

    return { success: true };
  } catch (error) {
    connected = false;
    db = null;
    if (pool) {
      await pool.end().catch(() => undefined);
      pool = null;
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown connection error',
    };
  }
}

export async function setupDb(): Promise<{ success: boolean; error?: string }> {
  if (!pool || !connected) {
    const config = getStoredConfig();
    const result = await connectDb(config);
    if (!result.success) {
      return result;
    }
  }

  try {
    const adminHash = hashPassword('admin123');
    await pool!.query(
      `INSERT INTO users (username, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         full_name = EXCLUDED.full_name,
         role = EXCLUDED.role`,
      ['admin', adminHash, 'System Administrator', 'admin'],
    );

    await pool!.query(
      `INSERT INTO companies (name, status)
       SELECT $1, 'active'
       WHERE NOT EXISTS (SELECT 1 FROM companies)`,
      ['Default Company'],
    );

    const companyResult = await pool!.query<{ id: number }>(
      `SELECT id FROM companies ORDER BY id LIMIT 1`,
    );
    const companyId = companyResult.rows[0]?.id;
    if (companyId != null) {
      await pool!.query(
        `INSERT INTO shift_groups (name, company_id)
         SELECT $1, $2
         WHERE NOT EXISTS (
           SELECT 1 FROM shift_groups WHERE company_id = $2 AND name = $1
         )`,
        ['Daily Draws', companyId],
      );

      const shiftGroupResult = await pool!.query<{ id: number }>(
        `SELECT id FROM shift_groups WHERE company_id = $1 AND name = $2 LIMIT 1`,
        [companyId, 'Daily Draws'],
      );
      const shiftGroupId = shiftGroupResult.rows[0]?.id;
      if (shiftGroupId != null) {
        for (const shiftName of ['Morning', 'Day', 'Evening']) {
          await pool!.query(
            `INSERT INTO shifts (name, shift_group_id)
             SELECT $1, $2
             WHERE NOT EXISTS (
               SELECT 1 FROM shifts WHERE shift_group_id = $2 AND name = $1
             )`,
            [shiftName, shiftGroupId],
          );
        }
      }

      for (const [groupName, table] of [
        ['Default Providers', 'provider_groups'],
        ['Default Buyers', 'buyer_groups'],
        ['Default Items', 'item_groups'],
      ] as const) {
        await pool!.query(
          `INSERT INTO ${table} (name, company_id)
           SELECT $1, $2
           WHERE NOT EXISTS (
             SELECT 1 FROM ${table} WHERE company_id = $2 AND name = $1
           )`,
          [groupName, companyId],
        );
      }

      const defaultDraws = [
        { name: 'Morning Draw', closeTime: '13:00' },
        { name: 'Day Draw', closeTime: '18:00' },
        { name: 'Evening Draw', closeTime: '20:00' },
      ];
      for (const draw of defaultDraws) {
        await pool!.query(
          `INSERT INTO draws (name, company_id, draw_date, close_time, status)
           SELECT $1, $2, CURRENT_DATE, $3, 'open'
           WHERE NOT EXISTS (
             SELECT 1 FROM draws
             WHERE company_id = $2
               AND name = $1
               AND draw_date::date = CURRENT_DATE
           )`,
          [draw.name, companyId, draw.closeTime],
        );
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Setup failed',
    };
  }
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!db || !connected) {
    throw new Error('Database is not connected');
  }
  return db;
}

export function isConnected(): boolean {
  return connected;
}

export function getPool(): Pool {
  if (!pool || !connected) {
    throw new Error('Database is not connected');
  }
  return pool;
}

export async function getPostgresVersion(): Promise<string | null> {
  if (!pool || !connected) return null;
  try {
    const result = await pool.query('SELECT version() AS version');
    return (result.rows[0] as { version?: string })?.version ?? null;
  } catch {
    return null;
  }
}

export async function getDbStatus(): Promise<{
  connected: boolean;
  version?: string;
  config?: DbConfig;
}> {
  if (!connected) {
    return { connected: false, config: getStoredConfig() };
  }
  const version = await getPostgresVersion();
  return { connected: true, version: version ?? undefined, config: getStoredConfig() };
}

export async function testDbConnection(
  config: DbConfig,
): Promise<{ success: true; version: string } | { success: false; error: string }> {
  const normalized = normalizeDbConfig(config);
  const testPool = new Pool({
    host: normalized.host,
    port: normalized.port,
    user: normalized.user,
    password: normalized.password,
    database: normalized.database,
  });
  try {
    await testPool.query('SELECT 1');
    const versionResult = await testPool.query('SELECT version() AS version');
    const version = (versionResult.rows[0] as { version?: string })?.version ?? 'Unknown';
    return { success: true, version };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed',
    };
  } finally {
    await testPool.end().catch(() => undefined);
  }
}
