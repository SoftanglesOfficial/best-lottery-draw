import { and, desc, eq, sql } from 'drizzle-orm';
import { ensureConnected, getDb } from '../db';
import { buyers, draws, providers, transactions, users } from '../schema';
import { formatDbError } from './ipcUtils';
import { validateDrawOpen } from './drawValidation';
import { countFromTicketData, extractTicketNumbers } from './transactionUtils';
import type {
  BuyerSaleSummary,
  ProviderPurchaseSummary,
  TicketSearchResult,
  TicketValidationResult,
  TransactionInput,
  TransactionRecord,
  TransactionType,
  UserRole,
} from '../../shared/types';

export { validateDrawOpen } from './drawValidation';

async function fetchTransactionRecord(id: number): Promise<TransactionRecord | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      drawId: transactions.drawId,
      drawName: draws.name,
      providerId: transactions.providerId,
      providerName: providers.name,
      buyerId: transactions.buyerId,
      buyerName: buyers.name,
      companyId: transactions.companyId,
      userId: transactions.userId,
      username: users.username,
      memoId: transactions.memoId,
      amount: transactions.amount,
      ticketCount: transactions.ticketCount,
      ticketData: transactions.ticketData,
      voucherNo: transactions.voucherNo,
      enteredAt: transactions.enteredAt,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
    })
    .from(transactions)
    .leftJoin(draws, eq(transactions.drawId, draws.id))
    .leftJoin(providers, eq(transactions.providerId, providers.id))
    .leftJoin(buyers, eq(transactions.buyerId, buyers.id))
    .leftJoin(users, eq(transactions.userId, users.id))
    .where(eq(transactions.id, id))
    .limit(1);

  return (row as TransactionRecord | undefined) ?? null;
}

async function resolveDrawId(data: TransactionInput): Promise<number> {
  if (data.drawId) return data.drawId;
  if (!data.itemId) {
    throw new Error('Draw or item is required.');
  }

  const db = getDb();
  const entryDate = data.entryDate ?? data.enteredAt ?? new Date().toISOString().slice(0, 10);
  const dayStart = new Date(entryDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(entryDate);
  dayEnd.setHours(23, 59, 59, 999);

  const [draw] = await db
    .select({ id: draws.id })
    .from(draws)
    .where(
      and(
        eq(draws.companyId, data.companyId),
        eq(draws.itemId, data.itemId),
        eq(draws.status, 'open'),
        sql`${draws.drawDate} >= ${dayStart}`,
        sql`${draws.drawDate} <= ${dayEnd}`,
      ),
    )
    .orderBy(desc(draws.drawDate))
    .limit(1);

  if (!draw) {
    throw new Error('No open draw found for this item on the selected date.');
  }
  return draw.id;
}

async function getSoldTicketNumbers(drawId: number): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ ticketData: transactions.ticketData })
    .from(transactions)
    .where(and(eq(transactions.drawId, drawId), eq(transactions.type, 'sale')));

  const sold = new Set<string>();
  for (const row of rows) {
    for (const number of extractTicketNumbers(row.ticketData)) {
      sold.add(number);
    }
  }
  return sold;
}

async function getBuyerTicketNumbers(
  buyerId: number,
  drawId: number,
  type: 'sale' | 'sale_return',
): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ ticketData: transactions.ticketData })
    .from(transactions)
    .where(
      and(
        eq(transactions.drawId, drawId),
        eq(transactions.buyerId, buyerId),
        eq(transactions.type, type),
      ),
    );

  const numbers = new Set<string>();
  for (const row of rows) {
    for (const number of extractTicketNumbers(row.ticketData)) {
      numbers.add(number);
    }
  }
  return numbers;
}

async function sumTicketCounts(
  drawId: number,
  filter: { buyerId?: number; providerId?: number; types: TransactionType[] },
): Promise<number> {
  const db = getDb();
  const conditions = [eq(transactions.drawId, drawId)];
  if (filter.buyerId != null) conditions.push(eq(transactions.buyerId, filter.buyerId));
  if (filter.providerId != null) conditions.push(eq(transactions.providerId, filter.providerId));

  const rows = await db
    .select({ ticketCount: transactions.ticketCount, type: transactions.type })
    .from(transactions)
    .where(and(...conditions));

  return rows
    .filter((row) => filter.types.includes(row.type as TransactionType))
    .reduce((sum, row) => sum + (row.ticketCount ?? 0), 0);
}

async function validateTransactionCreate(data: TransactionInput, drawId: number) {
  await validateDrawOpen(drawId);

  if (data.type === 'purchase' || data.type === 'purchase_return') {
    if (data.providerId == null) {
      throw new Error('Provider is required for purchase entries.');
    }
  }

  if (data.type === 'sale' || data.type === 'sale_return') {
    if (data.buyerId == null) {
      throw new Error('Buyer is required for sale entries.');
    }
  }

  const ticketCount =
    data.ticketCount ?? (data.ticketData ? countFromTicketData(data.ticketData) : 0);

  if (data.type === 'sale') {
    const newTickets = extractTicketNumbers(data.ticketData ?? '');
    if (newTickets.length === 0) {
      throw new Error('At least one ticket is required for a sale.');
    }
    const sold = await getSoldTicketNumbers(drawId);
    for (const number of newTickets) {
      if (sold.has(number)) {
        throw new Error(`Ticket ${number} already sold in this draw`);
      }
    }
  }

  if (data.type === 'sale_return') {
    if (data.buyerId == null) {
      throw new Error('Buyer is required for sale return.');
    }
    const soldCount = await sumTicketCounts(drawId, {
      buyerId: data.buyerId,
      types: ['sale'],
    });
    if (soldCount <= 0) {
      throw new Error('Cannot enter return without an existing sale entry');
    }

    const returnedCount = await sumTicketCounts(drawId, {
      buyerId: data.buyerId,
      types: ['sale_return'],
    });
    if (returnedCount + ticketCount > soldCount) {
      throw new Error('Return quantity exceeds sold quantity for this buyer in this draw.');
    }

    const soldTickets = await getBuyerTicketNumbers(data.buyerId, drawId, 'sale');
    const returnTickets = extractTicketNumbers(data.ticketData ?? '');
    for (const number of returnTickets) {
      if (!soldTickets.has(number)) {
        throw new Error(`Ticket ${number} was not sold to this buyer in this draw.`);
      }
    }
  }

  if (data.type === 'purchase_return') {
    if (data.providerId == null) {
      throw new Error('Provider is required for purchase return.');
    }
    const purchasedCount = await sumTicketCounts(drawId, {
      providerId: data.providerId,
      types: ['purchase'],
    });
    if (purchasedCount <= 0) {
      throw new Error('Cannot enter return without an existing sale entry');
    }

    const returnedCount = await sumTicketCounts(drawId, {
      providerId: data.providerId,
      types: ['purchase_return'],
    });
    if (returnedCount + ticketCount > purchasedCount) {
      throw new Error('Return quantity exceeds purchased quantity for this provider in this draw.');
    }
  }
}

export async function listTransactions(
  companyId: number,
  drawId?: number,
  type?: TransactionType,
) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    const conditions = [eq(transactions.companyId, companyId)];
    if (drawId != null) conditions.push(eq(transactions.drawId, drawId));
    if (type != null) conditions.push(eq(transactions.type, type));

    const rows = await db
      .select({
        id: transactions.id,
        type: transactions.type,
        drawId: transactions.drawId,
        drawName: draws.name,
        providerId: transactions.providerId,
        providerName: providers.name,
        buyerId: transactions.buyerId,
        buyerName: buyers.name,
        companyId: transactions.companyId,
        userId: transactions.userId,
        username: users.username,
        memoId: transactions.memoId,
        amount: transactions.amount,
        ticketCount: transactions.ticketCount,
        ticketData: transactions.ticketData,
        voucherNo: transactions.voucherNo,
        enteredAt: transactions.enteredAt,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
      })
      .from(transactions)
      .leftJoin(draws, eq(transactions.drawId, draws.id))
      .leftJoin(providers, eq(transactions.providerId, providers.id))
      .leftJoin(buyers, eq(transactions.buyerId, buyers.id))
      .leftJoin(users, eq(transactions.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(transactions.enteredAt));

    return { success: true as const, transactions: rows as TransactionRecord[] };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load transactions',
    };
  }
}

export async function nextMemoId(companyId: number) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    const [row] = await db
      .select({ nextMemoId: sql<number>`COALESCE(MAX(${transactions.memoId}), 0) + 1` })
      .from(transactions)
      .where(eq(transactions.companyId, companyId));
    return { success: true as const, nextMemoId: Number(row?.nextMemoId ?? 1) };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to get next memo ID',
    };
  }
}

export async function createTransaction(data: TransactionInput) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const drawId = await resolveDrawId(data);
    await validateTransactionCreate(data, drawId);

    const db = getDb();
    const ticketCount =
      data.ticketCount ?? (data.ticketData ? countFromTicketData(data.ticketData) : 0);

    const created = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${data.companyId})`);

      let memoId = data.memoId;
      if (memoId == null) {
        const [row] = await tx
          .select({ nextMemoId: sql<number>`COALESCE(MAX(${transactions.memoId}), 0) + 1` })
          .from(transactions)
          .where(eq(transactions.companyId, data.companyId));
        memoId = Number(row?.nextMemoId ?? 1);
      }

      const [inserted] = await tx
        .insert(transactions)
        .values({
          type: data.type,
          drawId,
          providerId: data.providerId ?? null,
          buyerId: data.buyerId ?? null,
          companyId: data.companyId,
          userId: data.userId,
          memoId,
          amount: data.amount != null ? String(data.amount) : null,
          ticketCount,
          ticketData: data.ticketData ?? null,
          voucherNo: data.voucherNo ?? null,
          enteredAt: data.enteredAt ? new Date(data.enteredAt) : new Date(),
        })
        .returning();

      return inserted;
    });

    if (!created) return { success: false as const, error: 'Failed to create transaction' };
    const record = await fetchTransactionRecord(created.id);
    return { success: true as const, transaction: record! };
  } catch (error) {
    return {
      success: false as const,
      error: formatDbError(error),
    };
  }
}

export async function updateTransaction(
  id: number,
  data: TransactionInput,
  userRole: UserRole,
) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  if (userRole === 'data_entry') {
    return { success: false as const, error: 'You do not have permission to update transactions' };
  }
  try {
    const db = getDb();
    const [existing] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
    if (!existing) return { success: false as const, error: 'Transaction not found' };

    const drawId = data.drawId ?? existing.drawId;
    await validateDrawOpen(drawId);
    await validateTransactionCreate({ ...data, drawId }, drawId);

    const ticketCount =
      data.ticketCount ??
      (data.ticketData ? countFromTicketData(data.ticketData) : existing.ticketCount);

    const [updated] = await db
      .update(transactions)
      .set({
        type: data.type,
        drawId,
        providerId: data.providerId ?? null,
        buyerId: data.buyerId ?? null,
        memoId: data.memoId ?? existing.memoId,
        amount: data.amount != null ? String(data.amount) : existing.amount,
        ticketCount,
        ticketData: data.ticketData ?? existing.ticketData,
        voucherNo: data.voucherNo ?? existing.voucherNo,
        enteredAt: data.enteredAt ? new Date(data.enteredAt) : existing.enteredAt,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, id))
      .returning();

    if (!updated) return { success: false as const, error: 'Transaction not found' };
    const record = await fetchTransactionRecord(updated.id);
    return { success: true as const, transaction: record! };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to update transaction',
    };
  }
}

export async function deleteTransaction(id: number, userId: number, userRole: UserRole) {
  void userId;
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  if (userRole === 'data_entry') {
    return {
      success: false as const,
      error: 'You do not have permission to delete transactions',
    };
  }
  try {
    const db = getDb();
    const [existing] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
    if (!existing) return { success: false as const, error: 'Transaction not found' };

    await validateDrawOpen(existing.drawId);

    const [deleted] = await db
      .delete(transactions)
      .where(eq(transactions.id, id))
      .returning({ id: transactions.id });
    if (!deleted) return { success: false as const, error: 'Transaction not found' };
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to delete transaction',
    };
  }
}

export async function validateTicketsSold(drawId: number, ticketNumbers: string[]) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const sold = await getSoldTicketNumbers(drawId);
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const raw of ticketNumbers) {
      const number = String(raw).padStart(5, '0');
      if (sold.has(number)) valid.push(number);
      else invalid.push(number);
    }
    const result: TicketValidationResult = { valid, invalid };
    return { success: true as const, result };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to validate tickets',
    };
  }
}

export async function getBuyerSaleSummary(buyerId: number, drawId: number) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const totalSold = await sumTicketCounts(drawId, { buyerId, types: ['sale'] });
    const totalReturned = await sumTicketCounts(drawId, { buyerId, types: ['sale_return'] });
    const summary: BuyerSaleSummary = {
      totalSold,
      totalReturned,
      net: totalSold - totalReturned,
    };
    return { success: true as const, summary };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load buyer summary',
    };
  }
}

export async function getProviderPurchaseSummary(providerId: number, drawId: number) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const totalPurchased = await sumTicketCounts(drawId, {
      providerId,
      types: ['purchase'],
    });
    const totalReturned = await sumTicketCounts(drawId, {
      providerId,
      types: ['purchase_return'],
    });
    const summary: ProviderPurchaseSummary = {
      totalPurchased,
      totalReturned,
      net: totalPurchased - totalReturned,
    };
    return { success: true as const, summary };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load provider summary',
    };
  }
}

export async function searchTicket(companyId: number, ticketNumber: string) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  const query = ticketNumber.trim();
  if (!query) {
    return { success: false as const, error: 'Enter a ticket number to search.' };
  }
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: transactions.id,
        drawId: transactions.drawId,
        drawName: draws.name,
        drawDate: draws.drawDate,
        type: transactions.type,
        amount: transactions.amount,
        buyerName: buyers.name,
        enteredAt: transactions.enteredAt,
        ticketData: transactions.ticketData,
      })
      .from(transactions)
      .leftJoin(draws, eq(transactions.drawId, draws.id))
      .leftJoin(buyers, eq(transactions.buyerId, buyers.id))
      .where(eq(transactions.companyId, companyId));

    const matches: TicketSearchResult[] = [];

    for (const row of rows) {
      for (const ticketNo of extractTicketNumbers(row.ticketData)) {
        if (ticketNo.includes(query) || ticketNo === query) {
          matches.push({
            id: row.id,
            drawId: row.drawId,
            drawName: row.drawName,
            drawDate: row.drawDate,
            type: row.type,
            amount: row.amount,
            buyerName: row.buyerName,
            enteredAt: row.enteredAt,
            ticketNumber: ticketNo,
          });
        }
      }
    }

    return { success: true as const, results: matches };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to search tickets',
    };
  }
}

export async function assertDrawOpenForTransaction(drawId: number) {
  await validateDrawOpen(drawId);
}
