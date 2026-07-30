import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { ensureConnected, getDb } from '../db';
import {
  auditLogs,
  buyerGroups,
  buyers,
  draws,
  items,
  providerGroups,
  providers,
  transactions,
  users,
  winningTickets,
} from '../schema';
import { assertCompanyAccess, type SessionContext } from './sessionContext';
import type {
  AuditLogFilters,
  AuditLogListRecord,
  BuyerLedgerRow,
  LedgerAllSummary,
  LedgerDrawBreakdown,
  LedgerListResult,
  PnLBuyerRow,
  PnLDrawRow,
  PnLReport,
  ProviderLedgerRow,
  ReportsDashboardData,
  ReportsSummary,
} from '../../shared/types';
import { endOfLocalDay, startOfLocalDay, toLocalDateString } from '../../shared/localDate';

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value) || 0;
}

function txnDateFilter(dateFrom?: string, dateTo?: string) {
  const parts = [];
  if (dateFrom) parts.push(gte(transactions.enteredAt, startOfLocalDay(dateFrom)));
  if (dateTo) parts.push(lte(transactions.enteredAt, endOfLocalDay(dateTo)));
  return parts.length ? and(...parts) : undefined;
}

function pwtDateFilter(dateFrom?: string, dateTo?: string) {
  const parts = [];
  if (dateFrom) parts.push(gte(winningTickets.createdAt, startOfLocalDay(dateFrom)));
  if (dateTo) parts.push(lte(winningTickets.createdAt, endOfLocalDay(dateTo)));
  return parts.length ? and(...parts) : undefined;
}

export async function getLedgerList(
  companyId: number,
  dateFrom?: string,
  dateTo?: string,
  buyerId?: number,
  providerId?: number,
): Promise<{ success: true; ledger: LedgerListResult } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    const dateTxn = txnDateFilter(dateFrom, dateTo);
    const datePwt = pwtDateFilter(dateFrom, dateTo);

    const buyerRows = await db
      .select({
        id: buyers.id,
        name: buyers.name,
        groupName: buyerGroups.name,
      })
      .from(buyers)
      .leftJoin(buyerGroups, eq(buyers.buyerGroupId, buyerGroups.id))
      .where(
        and(
          eq(buyers.companyId, companyId),
          buyerId != null ? eq(buyers.id, buyerId) : undefined,
        ),
      )
      .orderBy(buyers.name);

    const providerRows = await db
      .select({
        id: providers.id,
        name: providers.name,
        groupName: providerGroups.name,
      })
      .from(providers)
      .leftJoin(providerGroups, eq(providers.providerGroupId, providerGroups.id))
      .where(
        and(
          eq(providers.companyId, companyId),
          providerId != null ? eq(providers.id, providerId) : undefined,
        ),
      )
      .orderBy(providers.name);

    const buyerIds = buyerRows.map((row) => row.id);
    const providerIds = providerRows.map((row) => row.id);

    const txnAgg =
      buyerIds.length || providerIds.length
        ? await db
            .select({
              buyerId: transactions.buyerId,
              providerId: transactions.providerId,
              drawId: transactions.drawId,
              type: transactions.type,
              total: sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)`,
              drawName: draws.name,
              drawDate: draws.drawDate,
            })
            .from(transactions)
            .leftJoin(draws, eq(transactions.drawId, draws.id))
            .where(
              and(
                eq(transactions.companyId, companyId),
                dateTxn,
                buyerId != null ? eq(transactions.buyerId, buyerId) : undefined,
                providerId != null ? eq(transactions.providerId, providerId) : undefined,
              ),
            )
            .groupBy(
              transactions.buyerId,
              transactions.providerId,
              transactions.drawId,
              transactions.type,
              draws.name,
              draws.drawDate,
            )
        : [];

    const pwtAgg = await db
      .select({
        buyerId: winningTickets.buyerId,
        providerId: winningTickets.providerId,
        drawId: winningTickets.drawId,
        total: sql<string>`COALESCE(SUM(${winningTickets.amount}::numeric), 0)`,
        drawName: draws.name,
        drawDate: draws.drawDate,
      })
      .from(winningTickets)
      .innerJoin(draws, eq(winningTickets.drawId, draws.id))
      .where(
        and(
          eq(draws.companyId, companyId),
          datePwt,
          buyerId != null ? eq(winningTickets.buyerId, buyerId) : undefined,
          providerId != null ? eq(winningTickets.providerId, providerId) : undefined,
        ),
      )
      .groupBy(
        winningTickets.buyerId,
        winningTickets.providerId,
        winningTickets.drawId,
        draws.name,
        draws.drawDate,
      );

    const buyersResult: BuyerLedgerRow[] = buyerRows.map((buyer) => {
      const buyerTxns = txnAgg.filter((row) => row.buyerId === buyer.id);
      const buyerPwts = pwtAgg.filter((row) => row.buyerId === buyer.id);

      const totalSale = buyerTxns
        .filter((row) => row.type === 'sale')
        .reduce((sum, row) => sum + toNumber(row.total), 0);
      const totalSaleReturn = buyerTxns
        .filter((row) => row.type === 'sale_return')
        .reduce((sum, row) => sum + toNumber(row.total), 0);
      const netSale = totalSale - totalSaleReturn;
      const totalPwt = buyerPwts.reduce((sum, row) => sum + toNumber(row.total), 0);

      const drawIds = new Set<number>();
      for (const row of buyerTxns) if (row.drawId) drawIds.add(row.drawId);
      for (const row of buyerPwts) if (row.drawId) drawIds.add(row.drawId);

      const drawBreakdown: LedgerDrawBreakdown[] = Array.from(drawIds).map((drawId) => {
        const drawTxns = buyerTxns.filter((row) => row.drawId === drawId);
        const drawPwt = buyerPwts.find((row) => row.drawId === drawId);
        const sold = drawTxns
          .filter((row) => row.type === 'sale')
          .reduce((sum, row) => sum + toNumber(row.total), 0);
        const returned = drawTxns
          .filter((row) => row.type === 'sale_return')
          .reduce((sum, row) => sum + toNumber(row.total), 0);
        const net = sold - returned;
        const pwt = toNumber(drawPwt?.total);
        const sample = drawTxns[0] ?? drawPwt;
        return {
          drawId,
          drawName: sample?.drawName ?? null,
          drawDate: sample?.drawDate ?? null,
          sold,
          returned,
          net,
          pwt,
          balance: net - pwt,
        };
      });

      return {
        buyerId: buyer.id,
        buyerName: buyer.name,
        groupName: buyer.groupName,
        totalSale,
        totalSaleReturn,
        netSale,
        totalPwt,
        balance: netSale - totalPwt,
        drawBreakdown,
      };
    });

    const providersResult: ProviderLedgerRow[] = providerRows.map((provider) => {
      const providerTxns = txnAgg.filter((row) => row.providerId === provider.id);
      const providerPwts = pwtAgg.filter((row) => row.providerId === provider.id);

      const totalPurchase = providerTxns
        .filter((row) => row.type === 'purchase')
        .reduce((sum, row) => sum + toNumber(row.total), 0);
      const totalPurchaseReturn = providerTxns
        .filter((row) => row.type === 'purchase_return')
        .reduce((sum, row) => sum + toNumber(row.total), 0);
      const netPurchase = totalPurchase - totalPurchaseReturn;
      const totalPwtPayable = providerPwts.reduce((sum, row) => sum + toNumber(row.total), 0);

      const drawIds = new Set<number>();
      for (const row of providerTxns) if (row.drawId) drawIds.add(row.drawId);
      for (const row of providerPwts) if (row.drawId) drawIds.add(row.drawId);

      const drawBreakdown: LedgerDrawBreakdown[] = Array.from(drawIds).map((drawId) => {
        const drawTxns = providerTxns.filter((row) => row.drawId === drawId);
        const drawPwt = providerPwts.find((row) => row.drawId === drawId);
        const purchased = drawTxns
          .filter((row) => row.type === 'purchase')
          .reduce((sum, row) => sum + toNumber(row.total), 0);
        const purchaseReturned = drawTxns
          .filter((row) => row.type === 'purchase_return')
          .reduce((sum, row) => sum + toNumber(row.total), 0);
        const net = purchased - purchaseReturned;
        const pwt = toNumber(drawPwt?.total);
        const sample = drawTxns[0] ?? drawPwt;
        return {
          drawId,
          drawName: sample?.drawName ?? null,
          drawDate: sample?.drawDate ?? null,
          purchased,
          purchaseReturned,
          netPurchase: net,
          pwt,
          balance: net - pwt,
        };
      });

      return {
        providerId: provider.id,
        providerName: provider.name,
        groupName: provider.groupName,
        totalPurchase,
        totalPurchaseReturn,
        netPurchase,
        totalPwtPayable,
        balance: netPurchase - totalPwtPayable,
        drawBreakdown,
      };
    });

    return {
      success: true,
      ledger: { buyers: buyersResult, providers: providersResult },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load ledger',
    };
  }
}

export async function getLedgerAllSummary(
  companyId: number,
  dateFrom?: string,
  dateTo?: string,
): Promise<{ success: true; summary: LedgerAllSummary } | { success: false; error: string }> {
  const result = await getLedgerList(companyId, dateFrom, dateTo);
  if (!result.success) return result;

  const { buyers, providers } = result.ledger;
  const totalSales = buyers.reduce((sum, row) => sum + row.totalSale, 0);
  const totalSaleReturns = buyers.reduce((sum, row) => sum + row.totalSaleReturn, 0);
  const netSales = buyers.reduce((sum, row) => sum + row.netSale, 0);
  const totalPurchases = providers.reduce((sum, row) => sum + row.totalPurchase, 0);
  const totalPurchaseReturns = providers.reduce((sum, row) => sum + row.totalPurchaseReturn, 0);
  const netPurchases = providers.reduce((sum, row) => sum + row.netPurchase, 0);
  const totalPwtReceivable = buyers.reduce((sum, row) => sum + row.totalPwt, 0);
  const totalPwtPayable = providers.reduce((sum, row) => sum + row.totalPwtPayable, 0);
  const netReceivable = buyers.reduce((sum, row) => sum + row.balance, 0);
  const netPayable = providers.reduce((sum, row) => sum + row.balance, 0);
  const grossProfit = netSales - netPurchases - totalPwtReceivable;

  return {
    success: true,
    summary: {
      totalSales,
      totalSaleReturns,
      netSales,
      totalPurchases,
      totalPurchaseReturns,
      netPurchases,
      totalPwtReceivable,
      totalPwtPayable,
      netReceivable,
      netPayable,
      grossProfit,
    },
  };
}

export async function getPnLReport(
  companyId: number,
  dateFrom: string,
  dateTo: string,
): Promise<{ success: true; report: PnLReport } | { success: false; error: string }> {
  const summaryResult = await getLedgerAllSummary(companyId, dateFrom, dateTo);
  if (!summaryResult.success) return summaryResult;

  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    const dateTxn = txnDateFilter(dateFrom, dateTo);
    const datePwt = pwtDateFilter(dateFrom, dateTo);

    const drawRows = await db
      .select({
        drawId: draws.id,
        drawName: draws.name,
        drawDate: draws.drawDate,
        itemName: items.name,
        sales: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'sale' THEN ${transactions.amount}::numeric WHEN ${transactions.type} = 'sale_return' THEN -${transactions.amount}::numeric ELSE 0 END), 0)`,
        purchases: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'purchase' THEN ${transactions.amount}::numeric WHEN ${transactions.type} = 'purchase_return' THEN -${transactions.amount}::numeric ELSE 0 END), 0)`,
      })
      .from(draws)
      .leftJoin(items, eq(draws.itemId, items.id))
      .leftJoin(transactions, eq(transactions.drawId, draws.id))
      .where(and(eq(draws.companyId, companyId), dateTxn))
      .groupBy(draws.id, draws.name, draws.drawDate, items.name);

    const pwtByDraw = await db
      .select({
        drawId: winningTickets.drawId,
        pwt: sql<string>`COALESCE(SUM(${winningTickets.amount}::numeric), 0)`,
      })
      .from(winningTickets)
      .innerJoin(draws, eq(winningTickets.drawId, draws.id))
      .where(and(eq(draws.companyId, companyId), datePwt))
      .groupBy(winningTickets.drawId);

    const pwtMap = new Map(pwtByDraw.map((row) => [row.drawId, toNumber(row.pwt)]));

    const drawBreakdown: PnLDrawRow[] = drawRows.map((row) => {
      const sales = toNumber(row.sales);
      const purchases = toNumber(row.purchases);
      const pwt = pwtMap.get(row.drawId) ?? 0;
      return {
        drawId: row.drawId,
        drawName: row.drawName,
        drawDate: row.drawDate,
        itemName: row.itemName,
        sales,
        purchases,
        pwt,
        profit: sales - purchases - pwt,
      };
    });

    const topBuyersRows = await db
      .select({
        buyerId: buyers.id,
        buyerName: buyers.name,
        sales: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'sale' THEN ${transactions.amount}::numeric WHEN ${transactions.type} = 'sale_return' THEN -${transactions.amount}::numeric ELSE 0 END), 0)`,
      })
      .from(buyers)
      .leftJoin(transactions, eq(transactions.buyerId, buyers.id))
      .where(and(eq(buyers.companyId, companyId), dateTxn))
      .groupBy(buyers.id, buyers.name)
      .orderBy(sql`COALESCE(SUM(CASE WHEN ${transactions.type} = 'sale' THEN ${transactions.amount}::numeric WHEN ${transactions.type} = 'sale_return' THEN -${transactions.amount}::numeric ELSE 0 END), 0) DESC`)
      .limit(10);

    const topBuyers: PnLBuyerRow[] = topBuyersRows.map((row) => ({
      buyerId: row.buyerId,
      buyerName: row.buyerName,
      sales: toNumber(row.sales),
    }));

    return {
      success: true,
      report: {
        summary: summaryResult.summary,
        drawBreakdown,
        topBuyers,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load P&L report',
    };
  }
}

export async function getReportsSummary(
  companyId: number,
  dateFrom: string,
  dateTo: string,
): Promise<{ success: true; summary: ReportsSummary } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    const from = startOfLocalDay(dateFrom);
    const to = endOfLocalDay(dateTo);

    const [txnSummary] = await db
      .select({
        sales: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'sale' THEN ${transactions.amount}::numeric ELSE 0 END), 0)`,
        saleReturns: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'sale_return' THEN ${transactions.amount}::numeric ELSE 0 END), 0)`,
        purchases: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'purchase' THEN ${transactions.amount}::numeric WHEN ${transactions.type} = 'purchase_return' THEN -${transactions.amount}::numeric ELSE 0 END), 0)`,
        transactionCount: sql<string>`COUNT(*)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.companyId, companyId),
          gte(transactions.enteredAt, from),
          lte(transactions.enteredAt, to),
        ),
      );

    const [pwtSummary] = await db
      .select({
        pwt: sql<string>`COALESCE(SUM(${winningTickets.amount}::numeric), 0)`,
      })
      .from(winningTickets)
      .innerJoin(draws, eq(winningTickets.drawId, draws.id))
      .where(
        and(
          eq(draws.companyId, companyId),
          gte(winningTickets.createdAt, from),
          lte(winningTickets.createdAt, to),
        ),
      );

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [drawsTodayResult] = await db
      .select({ count: sql<string>`COUNT(*)` })
      .from(draws)
      .where(
        and(
          eq(draws.companyId, companyId),
          gte(draws.drawDate, todayStart),
          lte(draws.drawDate, todayEnd),
        ),
      );

    const saleTotal = toNumber(txnSummary?.sales);
    const saleReturns = toNumber(txnSummary?.saleReturns);
    const purchaseTotal = toNumber(txnSummary?.purchases);
    const sales = saleTotal - saleReturns;
    const pwt = toNumber(pwtSummary?.pwt);
    const net = sales - purchaseTotal - pwt;

    return {
      success: true,
      summary: {
        sales,
        purchases: purchaseTotal,
        returns: saleReturns,
        pwt,
        net,
        transactionCount: toNumber(txnSummary?.transactionCount),
        drawsToday: toNumber(drawsTodayResult?.count),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load report summary',
    };
  }
}

export async function getReportsDashboard(
  companyId: number,
  dateFrom: string,
  dateTo: string,
): Promise<{ success: true; data: ReportsDashboardData } | { success: false; error: string }> {
  const summaryResult = await getReportsSummary(companyId, dateFrom, dateTo);
  if (!summaryResult.success) return summaryResult;

  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    const end = endOfLocalDay(dateTo);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const dailyRows = await db
      .select({
        day: sql<string>`DATE(${transactions.enteredAt})`,
        sales: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'sale' THEN ${transactions.amount}::numeric WHEN ${transactions.type} = 'sale_return' THEN -${transactions.amount}::numeric ELSE 0 END), 0)`,
        purchases: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'purchase' THEN ${transactions.amount}::numeric WHEN ${transactions.type} = 'purchase_return' THEN -${transactions.amount}::numeric ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.companyId, companyId),
          gte(transactions.enteredAt, start),
          lte(transactions.enteredAt, end),
        ),
      )
      .groupBy(sql`DATE(${transactions.enteredAt})`)
      .orderBy(sql`DATE(${transactions.enteredAt})`);

    const chartMap = new Map(dailyRows.map((row) => [row.day, row]));
    const chartData = [];
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const key = toLocalDateString(day);
      const row = chartMap.get(key);
      chartData.push({
        date: `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`,
        sales: toNumber(row?.sales),
        purchases: toNumber(row?.purchases),
      });
    }

    const recentRows = await db
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
      .where(eq(transactions.companyId, companyId))
      .orderBy(desc(transactions.enteredAt), desc(transactions.id))
      .limit(10);

    return {
      success: true,
      data: {
        summary: summaryResult.summary,
        chartData,
        recentTransactions: recentRows,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load dashboard',
    };
  }
}

export async function listAuditLogs(
  ctx: SessionContext,
  filters: AuditLogFilters = {},
): Promise<{ success: true; logs: AuditLogListRecord[] } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const scopedFilters = { ...filters };
    if (ctx.role !== 'admin') {
      scopedFilters.companyId = ctx.activeCompanyId ?? undefined;
      if (scopedFilters.companyId == null) {
        return { success: false, error: 'Open a company before viewing audit logs.' };
      }
    }
    if (scopedFilters.companyId != null) {
      const denied = assertCompanyAccess(ctx, scopedFilters.companyId);
      if (denied) return denied;
    }

    const db = getDb();
    const conditions = [];

    if (scopedFilters.entity) conditions.push(eq(auditLogs.entity, scopedFilters.entity));
    if (scopedFilters.entityId != null) conditions.push(eq(auditLogs.entityId, scopedFilters.entityId));
    if (scopedFilters.userId != null) conditions.push(eq(auditLogs.userId, scopedFilters.userId));
    if (scopedFilters.dateFrom) conditions.push(gte(auditLogs.timestamp, startOfLocalDay(scopedFilters.dateFrom)));
    if (scopedFilters.dateTo) conditions.push(lte(auditLogs.timestamp, endOfLocalDay(scopedFilters.dateTo)));

    if (scopedFilters.companyId != null) {
      const companyDraws = await db
        .select({ id: draws.id })
        .from(draws)
        .where(eq(draws.companyId, scopedFilters.companyId));
      const drawIds = companyDraws.map((row) => row.id);
      if (drawIds.length === 0) {
        return { success: true, logs: [] };
      }
      conditions.push(
        and(eq(auditLogs.entity, 'draws'), inArray(auditLogs.entityId, drawIds)),
      );
    }

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
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.timestamp))
      .limit(500);

    return { success: true, logs: rows as AuditLogListRecord[] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load audit logs',
    };
  }
}
