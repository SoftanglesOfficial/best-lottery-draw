import { and, asc, count, desc, eq, lte } from 'drizzle-orm';
import { ensureConnected, getDb } from '../db';
import { formatDbError } from './ipcUtils';
import { insertAuditLog } from './auditLog';
import {
  auditLogs,
  buyers,
  drawResults,
  draws,
  itemSchemePrizes,
  itemSchemes,
  items,
  providers,
  transactions,
  users,
  winningTickets,
} from '../schema';
import { getDrawById } from './drawValidation';
import { requireCompanyId } from './companyScope';
import { extractTicketNumbers } from '../../shared/ticketData';
import type { SessionContext } from './sessionContext';
import type {
  AuditLogRecord,
  DrawInput,
  DrawRecord,
  DrawResultInput,
  DrawResultRecord,
  UserRole,
  WinningTicketInput,
  WinningTicketRecord,
} from '../../shared/types';

function formatDrawDateLabel(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

async function fetchDrawRecord(drawId: number): Promise<DrawRecord | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: draws.id,
      name: draws.name,
      companyId: draws.companyId,
      itemId: draws.itemId,
      itemName: items.name,
      drawDate: draws.drawDate,
      closeTime: draws.closeTime,
      status: draws.status,
      resultImported: draws.resultImported,
      lockedAt: draws.lockedAt,
      lockedBy: draws.lockedBy,
      lockedByName: users.fullName,
      createdAt: draws.createdAt,
      updatedAt: draws.updatedAt,
    })
    .from(draws)
    .leftJoin(items, eq(draws.itemId, items.id))
    .leftJoin(users, eq(draws.lockedBy, users.id))
    .where(eq(draws.id, drawId))
    .limit(1);

  if (!row) return null;

  const [txnCount] = await db
    .select({ count: count() })
    .from(transactions)
    .where(eq(transactions.drawId, drawId));

  return { ...row, transactionCount: Number(txnCount?.count ?? 0) };
}

export async function listDraws(companyId: number) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: draws.id,
        name: draws.name,
        companyId: draws.companyId,
        itemId: draws.itemId,
        itemName: items.name,
        drawDate: draws.drawDate,
        closeTime: draws.closeTime,
        status: draws.status,
        resultImported: draws.resultImported,
        lockedAt: draws.lockedAt,
        lockedBy: draws.lockedBy,
        lockedByName: users.fullName,
        createdAt: draws.createdAt,
        updatedAt: draws.updatedAt,
      })
      .from(draws)
      .leftJoin(items, eq(draws.itemId, items.id))
      .leftJoin(users, eq(draws.lockedBy, users.id))
      .where(eq(draws.companyId, companyId))
      .orderBy(desc(draws.drawDate));

    const drawIds = rows.map((row) => row.id);
    const countMap = new Map<number, number>();
    if (drawIds.length > 0) {
      const counts = await db
        .select({ drawId: transactions.drawId, count: count() })
        .from(transactions)
        .where(eq(transactions.companyId, companyId))
        .groupBy(transactions.drawId);
      for (const entry of counts) {
        if (entry.drawId != null) countMap.set(entry.drawId, Number(entry.count));
      }
    }

    const drawsWithCounts: DrawRecord[] = rows.map((row) => ({
      ...row,
      transactionCount: countMap.get(row.id) ?? 0,
    }));

    return { success: true as const, draws: drawsWithCounts };
  } catch (error) {
    return {
      success: false as const,
      error: formatDbError(error),
    };
  }
}

export async function createDraw(data: DrawInput) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    const [item] = await db.select({ name: items.name }).from(items).where(eq(items.id, data.itemId)).limit(1);
    if (!item) return { success: false as const, error: 'Item not found' };

    const drawDate = new Date(data.drawDate);
    const name =
      data.name?.trim() ||
      `${item.name} Draw - ${formatDrawDateLabel(drawDate)}`;

    const [created] = await db
      .insert(draws)
      .values({
        name,
        companyId: data.companyId,
        itemId: data.itemId,
        drawDate,
        closeTime: data.closeTime ?? null,
        status: 'open',
        resultImported: false,
      })
      .returning();

    if (!created) return { success: false as const, error: 'Failed to create draw' };
    const draw = await fetchDrawRecord(created.id);
    return { success: true as const, draw: draw! };
  } catch (error) {
    return {
      success: false as const,
      error: formatDbError(error),
    };
  }
}

export async function updateDraw(id: number, data: DrawInput, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    const existing = await getDrawById(id);
    if (!existing || existing.companyId !== scoped.companyId) {
      return { success: false as const, error: 'Draw not found' };
    }
    if (existing.status !== 'open') {
      return { success: false as const, error: 'Only open draws can be edited.' };
    }

    const [item] = await db.select({ name: items.name }).from(items).where(eq(items.id, data.itemId)).limit(1);
    if (!item) return { success: false as const, error: 'Item not found' };

    const drawDate = new Date(data.drawDate);
    const name =
      data.name?.trim() ||
      `${item.name} Draw - ${formatDrawDateLabel(drawDate)}`;

    const [updated] = await db
      .update(draws)
      .set({
        name,
        itemId: data.itemId,
        drawDate,
        closeTime: data.closeTime ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(draws.id, id), eq(draws.companyId, scoped.companyId)))
      .returning();

    if (!updated) return { success: false as const, error: 'Draw not found' };
    const draw = await fetchDrawRecord(updated.id);
    return { success: true as const, draw: draw! };
  } catch (error) {
    return {
      success: false as const,
      error: formatDbError(error),
    };
  }
}

export async function deleteDraw(id: number, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    const draw = await getDrawById(id);
    if (!draw || draw.companyId !== scoped.companyId) {
      return { success: false as const, error: 'Draw not found' };
    }
    if (draw.status !== 'open') {
      return { success: false as const, error: 'Only open draws can be deleted.' };
    }

    const [txnCount] = await db
      .select({ count: count() })
      .from(transactions)
      .where(eq(transactions.drawId, id));
    if (Number(txnCount?.count ?? 0) > 0) {
      return { success: false as const, error: 'Cannot delete draw with existing transactions.' };
    }

    const [deleted] = await db
      .delete(draws)
      .where(and(eq(draws.id, id), eq(draws.companyId, scoped.companyId)))
      .returning({ id: draws.id });
    if (!deleted) return { success: false as const, error: 'Draw not found' };
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: formatDbError(error),
    };
  }
}

function assertDrawNotStale(
  currentUpdatedAt: Date | null,
  clientUpdatedAt?: number | string | null,
) {
  if (clientUpdatedAt == null || !currentUpdatedAt) return;
  const clientTime = new Date(clientUpdatedAt).getTime();
  const serverTime = currentUpdatedAt.getTime();
  if (clientTime !== serverTime) {
    throw new Error('Draw was modified by another user. Please refresh and try again.');
  }
}

export async function lockDraw(
  id: number,
  userId: number,
  companyId: number | null,
  clientUpdatedAt?: number | string | null,
) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    const [current] = await db.select().from(draws).where(eq(draws.id, id)).limit(1);
    const scoped = requireCompanyId(companyId);
    if (!scoped.success) return scoped;
    if (!current || current.companyId !== scoped.companyId) {
      return { success: false as const, error: 'Draw not found' };
    }
    assertDrawNotStale(current.updatedAt, clientUpdatedAt);

    const [updated] = await db
      .update(draws)
      .set({
        status: 'locked',
        lockedAt: new Date(),
        lockedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(draws.id, id), eq(draws.companyId, scoped.companyId)))
      .returning();

    if (!updated) return { success: false as const, error: 'Draw not found' };

    await insertAuditLog(userId, 'DRAW_LOCKED', 'draws', id);
    const draw = await fetchDrawRecord(updated.id);
    return { success: true as const, draw: draw! };
  } catch (error) {
    return {
      success: false as const,
      error: formatDbError(error),
    };
  }
}

export async function unlockDraw(
  id: number,
  ctx: SessionContext,
  clientUpdatedAt?: number | string | null,
) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  if (ctx.role !== 'admin' && ctx.role !== 'owner') {
    return { success: false as const, error: 'Only admin or owner can unlock draws.' };
  }
  try {
    const db = getDb();
    const [current] = await db.select().from(draws).where(eq(draws.id, id)).limit(1);
    const scoped = requireCompanyId(ctx.activeCompanyId);
    if (!scoped.success) return scoped;
    if (!current || current.companyId !== scoped.companyId) {
      return { success: false as const, error: 'Draw not found' };
    }
    assertDrawNotStale(current.updatedAt, clientUpdatedAt);

    const [requester] = await db
      .select({ username: users.username, fullName: users.fullName })
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);

    const username = requester?.fullName ?? requester?.username ?? 'Unknown';
    const timestamp = new Date().toISOString();

    const [updated] = await db
      .update(draws)
      .set({
        status: 'open',
        lockedAt: null,
        lockedBy: null,
        updatedAt: new Date(),
      })
      .where(and(eq(draws.id, id), eq(draws.companyId, scoped.companyId)))
      .returning();

    if (!updated) return { success: false as const, error: 'Draw not found' };

    await insertAuditLog(
      ctx.userId,
      'DRAW_UNLOCKED',
      'draws',
      id,
      `Unlocked by ${username} at ${timestamp}`,
    );
    const draw = await fetchDrawRecord(updated.id);
    return { success: true as const, draw: draw! };
  } catch (error) {
    return {
      success: false as const,
      error: formatDbError(error),
    };
  }
}

export async function listDrawResults(drawId: number) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(drawResults)
      .where(eq(drawResults.drawId, drawId))
      .orderBy(asc(drawResults.prizeLevel), asc(drawResults.winningNumber));
    return { success: true as const, results: rows as DrawResultRecord[] };
  } catch (error) {
    return {
      success: false as const,
      error: formatDbError(error),
    };
  }
}

export async function createDrawResults(
  drawId: number,
  results: DrawResultInput[],
  companyId: number | null,
) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  if (results.length === 0) {
    return { success: false as const, error: 'No results to import.' };
  }
  try {
    const db = getDb();
    const draw = await getDrawById(drawId);
    if (!draw || draw.companyId !== scoped.companyId) {
      return { success: false as const, error: 'Draw not found' };
    }

    await db.transaction(async (tx) => {
      await tx.delete(drawResults).where(eq(drawResults.drawId, drawId));
      await tx.insert(drawResults).values(
        results.map((result) => ({
          drawId,
          prizeLevel: result.prizeLevel,
          winningNumber: result.winningNumber.trim(),
          prizeAmount: result.prizeAmount != null ? String(result.prizeAmount) : null,
        })),
      );
      await tx
        .update(draws)
        .set({
          resultImported: true,
          status: 'locked',
          lockedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(draws.id, drawId), eq(draws.companyId, scoped.companyId)));
    });

    const updatedDraw = await fetchDrawRecord(drawId);
    return { success: true as const, draw: updatedDraw! };
  } catch (error) {
    return {
      success: false as const,
      error: formatDbError(error),
    };
  }
}

export async function listWinningTickets(drawId: number) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: winningTickets.id,
        drawId: winningTickets.drawId,
        ticketNumber: winningTickets.ticketNumber,
        prizeLevel: winningTickets.prizeLevel,
        amount: winningTickets.amount,
        buyerId: winningTickets.buyerId,
        buyerName: buyers.name,
        providerId: winningTickets.providerId,
        providerName: providers.name,
        transactionId: winningTickets.transactionId,
        createdAt: winningTickets.createdAt,
      })
      .from(winningTickets)
      .leftJoin(buyers, eq(winningTickets.buyerId, buyers.id))
      .leftJoin(providers, eq(winningTickets.providerId, providers.id))
      .where(eq(winningTickets.drawId, drawId))
      .orderBy(asc(winningTickets.prizeLevel), asc(winningTickets.ticketNumber));

    return { success: true as const, tickets: rows as WinningTicketRecord[] };
  } catch (error) {
    return {
      success: false as const,
      error: formatDbError(error),
    };
  }
}

export async function createWinningTickets(drawId: number, tickets: WinningTicketInput[]) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    if (tickets.length === 0) {
      return { success: true as const, tickets: [] as WinningTicketRecord[] };
    }

    await db.insert(winningTickets).values(
      tickets.map((ticket) => ({
        drawId,
        ticketNumber: ticket.ticketNumber,
        prizeLevel: ticket.prizeLevel,
        amount: ticket.amount != null ? String(ticket.amount) : null,
        buyerId: ticket.buyerId ?? null,
        providerId: ticket.providerId ?? null,
        transactionId: ticket.transactionId ?? null,
      })),
    );

    return listWinningTickets(drawId);
  } catch (error) {
    return {
      success: false as const,
      error: formatDbError(error),
    };
  }
}

export async function deleteWinningTicket(id: number) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    const [deleted] = await db
      .delete(winningTickets)
      .where(eq(winningTickets.id, id))
      .returning({ id: winningTickets.id });
    if (!deleted) return { success: false as const, error: 'Winning ticket not found' };
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: formatDbError(error),
    };
  }
}

export async function findWinners(drawId: number) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    const draw = await getDrawById(drawId);
    if (!draw) return { success: false as const, error: 'Draw not found' };
    if (!draw.itemId) return { success: false as const, error: 'Draw has no item assigned.' };

    const [scheme] = await db
      .select()
      .from(itemSchemes)
      .where(
        and(
          eq(itemSchemes.itemId, draw.itemId),
          lte(itemSchemes.schemeDate, draw.drawDate),
        ),
      )
      .orderBy(desc(itemSchemes.schemeDate))
      .limit(1);

    const prizes = scheme
      ? await db
          .select()
          .from(itemSchemePrizes)
          .where(eq(itemSchemePrizes.itemSchemeId, scheme.id))
      : [];

    const results = await db
      .select()
      .from(drawResults)
      .where(eq(drawResults.drawId, drawId))
      .orderBy(asc(drawResults.prizeLevel));

    if (results.length === 0) {
      return { success: false as const, error: 'No results for this draw' };
    }

    const saleTransactions = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.drawId, drawId), eq(transactions.type, 'sale')));

    const winners: Array<{
      drawId: number;
      ticketNumber: string;
      prizeLevel: number;
      amount: string | null;
      buyerId: number | null;
      providerId: number | null;
      transactionId: number;
    }> = [];

    for (const result of results) {
      const prize = prizes.find((entry) => entry.prizeRank === result.prizeLevel);
      const winningNum = result.winningNumber;

      for (const txn of saleTransactions) {
        const ticketNumbers = extractTicketNumbers(txn.ticketData);

        for (const ticketNo of ticketNumbers) {
          let isWinner = false;

          if (result.prizeLevel === 1 || result.prizeLevel === 2) {
            isWinner = ticketNo === winningNum;
          } else {
            const matchLength = prize?.prizeNoLength ?? 4;
            isWinner = ticketNo.slice(-matchLength) === winningNum.slice(-matchLength);
          }

          if (isWinner) {
            winners.push({
              drawId,
              ticketNumber: ticketNo,
              prizeLevel: result.prizeLevel,
              amount:
                result.prizeAmount ??
                prize?.prizeAmount ??
                null,
              buyerId: txn.buyerId,
              providerId: txn.providerId,
              transactionId: txn.id,
            });
          }
        }
      }
    }

    if (winners.length > 0) {
      await db.transaction(async (tx) => {
        await tx.delete(winningTickets).where(eq(winningTickets.drawId, drawId));
        await tx.insert(winningTickets).values(winners);
      });
    }

    return {
      success: true as const,
      winners: winners as WinningTicketRecord[],
      count: winners.length,
    };
  } catch (error) {
    return {
      success: false as const,
      error: formatDbError(error),
    };
  }
}

export async function extendDrawTime(
  drawId: number,
  userId: number,
  userRole: UserRole,
  newCloseTime: string,
  reason: string,
) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  if (userRole !== 'admin') {
    return { success: false as const, error: 'Only admin can extend draw time.' };
  }
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    return { success: false as const, error: 'Reason is required.' };
  }
  const trimmedTime = newCloseTime.trim();
  if (!trimmedTime) {
    return { success: false as const, error: 'New close time is required.' };
  }

  try {
    const db = getDb();
    const existing = await getDrawById(drawId);
    if (!existing) return { success: false as const, error: 'Draw not found' };
    if (existing.status !== 'open') {
      return { success: false as const, error: 'Only open draws can have their close time extended.' };
    }

    const oldCloseTime = existing.closeTime ?? '';
    const [updated] = await db
      .update(draws)
      .set({ closeTime: trimmedTime, updatedAt: new Date() })
      .where(eq(draws.id, drawId))
      .returning();

    if (!updated) return { success: false as const, error: 'Failed to update draw.' };

    await insertAuditLog(
      userId,
      'DRAW_TIME_EXTENDED',
      'draws',
      drawId,
      JSON.stringify({ from: oldCloseTime, to: trimmedTime, reason: trimmedReason }),
    );

    const draw = await fetchDrawRecord(drawId);
    return { success: true as const, draw: draw! };
  } catch (error) {
    return {
      success: false as const,
      error: formatDbError(error),
    };
  }
}

export async function listDrawAuditLogs(drawId: number, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const draw = await getDrawById(drawId);
    if (!draw || draw.companyId !== scoped.companyId) {
      return { success: false as const, error: 'Draw not found' };
    }
    const db = getDb();
    const rows = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        username: users.username,
        fullName: users.fullName,
        action: auditLogs.action,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        details: auditLogs.details,
        timestamp: auditLogs.timestamp,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(and(eq(auditLogs.entity, 'draws'), eq(auditLogs.entityId, drawId)))
      .orderBy(desc(auditLogs.timestamp));

    return { success: true as const, logs: rows as AuditLogRecord[] };
  } catch (error) {
    return {
      success: false as const,
      error: formatDbError(error),
    };
  }
}

export { validateDrawOpen, getDrawById } from './drawValidation';
