import fs from 'node:fs/promises';
import path from 'node:path';
import { app, dialog } from 'electron';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { ensureConnected, getDb } from '../db';
import {
  auditLogs,
  backups,
  buyerGroups,
  buyers,
  companies,
  drawResults,
  draws,
  itemGroups,
  itemSchemePrizes,
  itemSchemes,
  items,
  ledgerEntries,
  providerGroups,
  providers,
  shiftGroups,
  shifts,
  transactions,
  userCompanies,
  users,
  winningTickets,
} from '../schema';
import type { BackupRecord } from '../../shared/types';

const BACKUP_VERSION = 1;

async function exportCompanyData(companyId: number) {
  const db = getDb();

  const [
    company,
    ucRows,
    shiftGroupRows,
    providerGroupRows,
    buyerGroupRows,
    itemGroupRows,
  ] = await Promise.all([
    db.select().from(companies).where(eq(companies.id, companyId)),
    db.select().from(userCompanies).where(eq(userCompanies.companyId, companyId)),
    db.select().from(shiftGroups).where(eq(shiftGroups.companyId, companyId)),
    db.select().from(providerGroups).where(eq(providerGroups.companyId, companyId)),
    db.select().from(buyerGroups).where(eq(buyerGroups.companyId, companyId)),
    db.select().from(itemGroups).where(eq(itemGroups.companyId, companyId)),
  ]);

  const shiftGroupIds = shiftGroupRows.map((row) => row.id);
  const providerGroupIds = providerGroupRows.map((row) => row.id);
  const buyerGroupIds = buyerGroupRows.map((row) => row.id);
  const itemGroupIds = itemGroupRows.map((row) => row.id);

  const [shiftRows, providerRows, buyerRows, itemRows, drawRows, ledgerRows] =
    await Promise.all([
      shiftGroupIds.length
        ? db.select().from(shifts).where(inArray(shifts.shiftGroupId, shiftGroupIds))
        : Promise.resolve([]),
      db.select().from(providers).where(eq(providers.companyId, companyId)),
      db.select().from(buyers).where(eq(buyers.companyId, companyId)),
      itemGroupIds.length
        ? db.select().from(items).where(inArray(items.itemGroupId, itemGroupIds))
        : Promise.resolve([]),
      db.select().from(draws).where(eq(draws.companyId, companyId)),
      db.select().from(ledgerEntries).where(eq(ledgerEntries.companyId, companyId)),
    ]);

  const itemIds = itemRows.map((row) => row.id);
  const drawIds = drawRows.map((row) => row.id);

  const [schemeRows, drawResultRows, txnRows, winningRows] = await Promise.all([
    db.select().from(itemSchemes).where(eq(itemSchemes.companyId, companyId)),
    drawIds.length
      ? db.select().from(drawResults).where(inArray(drawResults.drawId, drawIds))
      : Promise.resolve([]),
    db.select().from(transactions).where(eq(transactions.companyId, companyId)),
    drawIds.length
      ? db.select().from(winningTickets).where(inArray(winningTickets.drawId, drawIds))
      : Promise.resolve([]),
  ]);

  const schemeIds = schemeRows.map((row) => row.id);
  const prizeRows = schemeIds.length
    ? await db.select().from(itemSchemePrizes).where(inArray(itemSchemePrizes.itemSchemeId, schemeIds))
    : [];

  const userIds = ucRows.map((row) => row.userId);
  const userRows =
    userIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, userIds))
      : [];

  const drawAuditRows =
    drawIds.length > 0
      ? await db
          .select()
          .from(auditLogs)
          .where(and(eq(auditLogs.entity, 'draws'), inArray(auditLogs.entityId, drawIds)))
      : [];

  return {
    version: BACKUP_VERSION,
    companyId,
    exportedAt: new Date().toISOString(),
    users: userRows,
    companies: company,
    userCompanies: ucRows,
    shiftGroups: shiftGroupRows,
    shifts: shiftRows,
    providerGroups: providerGroupRows,
    providers: providerRows,
    buyerGroups: buyerGroupRows,
    buyers: buyerRows,
    itemGroups: itemGroupRows,
    items: itemRows,
    itemSchemes: schemeRows,
    itemSchemePrizes: prizeRows,
    draws: drawRows,
    drawResults: drawResultRows,
    transactions: txnRows,
    winningTickets: winningRows,
    ledgerEntries: ledgerRows,
    auditLogs: drawAuditRows,
  };
}

function countRecords(payload: Record<string, unknown>) {
  return Object.entries(payload).reduce((sum, [key, value]) => {
    if (key === 'version' || key === 'companyId' || key === 'exportedAt') return sum;
    if (Array.isArray(value)) return sum + value.length;
    return sum;
  }, 0);
}

export async function createBackup(companyId: number, userId: number) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }

  const saveResult = await dialog.showSaveDialog({
    title: 'Save Backup',
    defaultPath: `best12-backup-${companyId}-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON Backup', extensions: ['json'] }],
  });

  if (saveResult.canceled || !saveResult.filePath) {
    return { success: false as const, error: 'Backup cancelled.' };
  }

  try {
    const payload = await exportCompanyData(companyId);
    const json = JSON.stringify(payload, null, 2);
    await fs.writeFile(saveResult.filePath, json, 'utf8');
    const stat = await fs.stat(saveResult.filePath);
    const filename = path.basename(saveResult.filePath);
    const recordCount = countRecords(payload as unknown as Record<string, unknown>);

    const db = getDb();
    await db.insert(backups).values({
      filename,
      size: stat.size,
      status: 'completed',
      triggeredBy: userId,
    });

    return { success: true as const, filename, recordCount };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Backup failed',
    };
  }
}

async function deleteCompanyData(companyId: number) {
  const db = getDb();
  const drawRows = await db.select({ id: draws.id }).from(draws).where(eq(draws.companyId, companyId));
  const drawIds = drawRows.map((row) => row.id);
  const schemeRows = await db
    .select({ id: itemSchemes.id })
    .from(itemSchemes)
    .where(eq(itemSchemes.companyId, companyId));
  const schemeIds = schemeRows.map((row) => row.id);
  const shiftGroupRows = await db
    .select({ id: shiftGroups.id })
    .from(shiftGroups)
    .where(eq(shiftGroups.companyId, companyId));
  const shiftGroupIds = shiftGroupRows.map((row) => row.id);

  if (drawIds.length) {
    await db.delete(winningTickets).where(inArray(winningTickets.drawId, drawIds));
    await db.delete(drawResults).where(inArray(drawResults.drawId, drawIds));
    await db.delete(transactions).where(eq(transactions.companyId, companyId));
    await db.delete(draws).where(eq(draws.companyId, companyId));
  } else {
    await db.delete(transactions).where(eq(transactions.companyId, companyId));
  }

  if (schemeIds.length) {
    await db.delete(itemSchemePrizes).where(inArray(itemSchemePrizes.itemSchemeId, schemeIds));
  }
  await db.delete(itemSchemes).where(eq(itemSchemes.companyId, companyId));
  await db.delete(items).where(eq(items.companyId, companyId));
  await db.delete(itemGroups).where(eq(itemGroups.companyId, companyId));
  await db.delete(buyers).where(eq(buyers.companyId, companyId));
  await db.delete(buyerGroups).where(eq(buyerGroups.companyId, companyId));
  await db.delete(providers).where(eq(providers.companyId, companyId));
  await db.delete(providerGroups).where(eq(providerGroups.companyId, companyId));
  if (shiftGroupIds.length) {
    await db.delete(shifts).where(inArray(shifts.shiftGroupId, shiftGroupIds));
  }
  await db.delete(shiftGroups).where(eq(shiftGroups.companyId, companyId));
  await db.delete(ledgerEntries).where(eq(ledgerEntries.companyId, companyId));
  await db.delete(userCompanies).where(eq(userCompanies.companyId, companyId));
}

function validateBackup(data: unknown): data is Record<string, unknown> {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  const required = [
    'version',
    'companyId',
    'companies',
    'shiftGroups',
    'providerGroups',
    'buyerGroups',
    'itemGroups',
    'draws',
    'transactions',
  ];
  return required.every((key) => key in record);
}

export async function restoreBackup(userId: number, filePath?: string) {
  void userId;
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }

  let targetPath = filePath;
  if (!targetPath) {
    const openResult = await dialog.showOpenDialog({
      title: 'Restore Backup',
      filters: [{ name: 'JSON Backup', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (openResult.canceled || !openResult.filePaths[0]) {
      return { success: false as const, error: 'Restore cancelled.' };
    }
    targetPath = openResult.filePaths[0];
  }

  try {
    const raw = await fs.readFile(targetPath, 'utf8');
    const data = JSON.parse(raw) as unknown;
    if (!validateBackup(data)) {
      return { success: false as const, error: 'Invalid backup file structure.' };
    }

    const companyId = Number(data.companyId);
    const db = getDb();

    await db.transaction(async (tx) => {
      await deleteCompanyData(companyId);

      const insertIfAny = async (table: Parameters<typeof tx.insert>[0], rows: unknown) => {
        if (Array.isArray(rows) && rows.length > 0) {
          await tx.insert(table).values(rows as never[]);
        }
      };

      await insertIfAny(userCompanies, data.userCompanies);
      await insertIfAny(shiftGroups, data.shiftGroups);
      await insertIfAny(shifts, data.shifts);
      await insertIfAny(providerGroups, data.providerGroups);
      await insertIfAny(providers, data.providers);
      await insertIfAny(buyerGroups, data.buyerGroups);
      await insertIfAny(buyers, data.buyers);
      await insertIfAny(itemGroups, data.itemGroups);
      await insertIfAny(items, data.items);
      await insertIfAny(itemSchemes, data.itemSchemes);
      await insertIfAny(itemSchemePrizes, data.itemSchemePrizes);
      await insertIfAny(draws, data.draws);
      await insertIfAny(drawResults, data.drawResults);
      await insertIfAny(transactions, data.transactions);
      await insertIfAny(winningTickets, data.winningTickets);
      await insertIfAny(ledgerEntries, data.ledgerEntries);
      await insertIfAny(auditLogs, data.auditLogs);
    });

    return { success: true as const, message: 'Restore completed' };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Restore failed',
    };
  }
}

export async function listBackups() {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: backups.id,
        filename: backups.filename,
        size: backups.size,
        status: backups.status,
        triggeredBy: backups.triggeredBy,
        triggeredByName: users.fullName,
        createdAt: backups.createdAt,
      })
      .from(backups)
      .leftJoin(users, eq(backups.triggeredBy, users.id))
      .orderBy(desc(backups.createdAt))
      .limit(50);

    return { success: true as const, backups: rows as BackupRecord[] };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load backups',
    };
  }
}

async function writeBackupFile(companyId: number, userId: number, filePath: string) {
  const payload = await exportCompanyData(companyId);
  const json = JSON.stringify(payload, null, 2);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, json, 'utf8');
  const stat = await fs.stat(filePath);
  const filename = path.basename(filePath);
  const recordCount = countRecords(payload as unknown as Record<string, unknown>);

  const db = getDb();
  await db.insert(backups).values({
    filename,
    size: stat.size,
    status: 'completed',
    triggeredBy: userId,
  });

  return { filename, recordCount, size: stat.size };
}

export async function createAutoBackup(companyId: number, userId: number) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const dateStr = new Date().toISOString().slice(0, 10);
    const backupDir = path.join(app.getPath('userData'), 'backups');
    const filePath = path.join(backupDir, `best12-auto-backup-${companyId}-${dateStr}.json`);
    const result = await writeBackupFile(companyId, userId, filePath);
    return { success: true as const, ...result };
  } catch (error) {
    try {
      const db = getDb();
      await db.insert(backups).values({
        filename: `auto-backup-${Date.now()}.json`,
        size: 0,
        status: 'failed',
        triggeredBy: userId,
      });
    } catch {
      // ignore logging failure
    }
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Auto backup failed',
    };
  }
}

export async function runScheduledAutoBackup(): Promise<void> {
  const connection = await ensureConnected();
  if (!connection.success) return;

  try {
    const db = getDb();
    const [user] = await db
      .select({
        id: users.id,
        activeCompanyId: users.activeCompanyId,
      })
      .from(users)
      .where(and(eq(users.role, 'admin'), isNotNull(users.activeCompanyId)))
      .limit(1);

    if (!user?.activeCompanyId) return;
    await createAutoBackup(user.activeCompanyId, user.id);
  } catch {
    // scheduled backup failures are non-fatal
  }
}
