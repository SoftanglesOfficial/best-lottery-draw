import { desc, sql } from 'drizzle-orm';
import { ensureConnected, getDb, getDbStatus, getStoredConfig } from '../db';
import { getBroadcastStatus } from '../lan';
import { getAutoBackupEnabled, getLastBackupDate, getNetworkMode } from '../preferences';
import { backups, companies, draws, transactions, userSessions, users } from '../schema';

export async function getDiagnostics() {
  const dbStatus = await getDbStatus();
  const broadcast = getBroadcastStatus();

  if (!dbStatus.connected) {
    return {
      success: true as const,
      data: {
        dbConnected: false,
        dbVersion: null,
        dbConfig: getStoredConfig(),
        networkMode: getNetworkMode(),
        broadcast,
        autoBackup: getAutoBackupEnabled(),
        lastBackupDate: getLastBackupDate(),
        tableCounts: null,
        activeSessions: [],
        appVersion: process.env.npm_package_version ?? '1.0.0',
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
      },
    };
  }

  try {
    await ensureConnected();
    const db = getDb();

    const [usersCount] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(users);
    const [companiesCount] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(companies);
    const [transactionsCount] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(transactions);
    const [drawsCount] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(draws);
    const sessions = await db.select().from(userSessions);
    const [lastBackup] = await db
      .select({ createdAt: backups.createdAt })
      .from(backups)
      .orderBy(desc(backups.createdAt))
      .limit(1);

    return {
      success: true as const,
      data: {
        dbConnected: true,
        dbVersion: dbStatus.version ?? null,
        dbConfig: getStoredConfig(),
        networkMode: getNetworkMode(),
        broadcast,
        autoBackup: getAutoBackupEnabled(),
        lastBackupDate: getLastBackupDate(),
        lastBackupRecordAt: lastBackup?.createdAt ?? null,
        tableCounts: {
          users: Number(usersCount?.count ?? 0),
          companies: Number(companiesCount?.count ?? 0),
          transactions: Number(transactionsCount?.count ?? 0),
          draws: Number(drawsCount?.count ?? 0),
        },
        activeSessions: sessions,
        appVersion: process.env.npm_package_version ?? '1.0.0',
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
      },
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load diagnostics',
    };
  }
}
