/**
 * Idempotent demo data for Default Company (id=1).
 * Covers master lists, txn lists, ledgers/P&L, schemes, results, winners.
 * Skips: stock_transfer (no product spec), ledger_entries table (reports use txns).
 */
import pg from 'pg';

const c = new pg.Client({
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
});

await c.connect();

const companyId = 1;
const [{ id: userId }] = (await c.query(`select id from users where username='admin' limit 1`)).rows;
if (!userId) throw new Error('admin user missing — run app DB setup first');

async function one(sql, params = []) {
  const { rows } = await c.query(sql, params);
  return rows[0] ?? null;
}
async function ensure(sqlSelect, paramsSelect, sqlInsert, paramsInsert) {
  const existing = await one(sqlSelect, paramsSelect);
  if (existing) return existing;
  return one(sqlInsert, paramsInsert);
}

// --- groups (setupDb may already have these) ---
const providerGroup = await ensure(
  `select id from provider_groups where company_id=$1 order by id limit 1`,
  [companyId],
  `insert into provider_groups(name, company_id) values('Default Providers', $1) returning id`,
  [companyId],
);
const buyerGroup = await ensure(
  `select id from buyer_groups where company_id=$1 order by id limit 1`,
  [companyId],
  `insert into buyer_groups(name, company_id) values('Default Buyers', $1) returning id`,
  [companyId],
);
const itemGroup = await ensure(
  `select id from item_groups where company_id=$1 order by id limit 1`,
  [companyId],
  `insert into item_groups(name, company_id) values('Default Items', $1) returning id`,
  [companyId],
);
const shiftGroup = await one(
  `select id from shift_groups where company_id=$1 order by id limit 1`,
  [companyId],
);

// --- providers ---
const provider = await ensure(
  `select id, name from providers where company_id=$1 and name='Demo Provider'`,
  [companyId],
  `insert into providers(name, provider_group_id, company_id, purchase_rate, commission, phone)
   values('Demo Provider', $1, $2, 0.80, 5, '0300-1111111') returning id, name`,
  [providerGroup.id, companyId],
);
const provider2 = await ensure(
  `select id, name from providers where company_id=$1 and name='Demo Supplier'`,
  [companyId],
  `insert into providers(name, provider_group_id, company_id, purchase_rate, commission)
   values('Demo Supplier', $1, $2, 0.75, 4) returning id, name`,
  [providerGroup.id, companyId],
);

// --- buyers ---
const buyer = await ensure(
  `select id, name from buyers where company_id=$1 and name='QA Party'`,
  [companyId],
  `insert into buyers(name, buyer_group_id, company_id, sale_rate, commission, phone)
   values('QA Party', $1, $2, 1.00, 3, '0300-2222222') returning id, name`,
  [buyerGroup.id, companyId],
);
const buyer2 = await ensure(
  `select id, name from buyers where company_id=$1 and name='Demo Stockist'`,
  [companyId],
  `insert into buyers(name, buyer_group_id, company_id, sale_rate, commission)
   values('Demo Stockist', $1, $2, 1.10, 2) returning id, name`,
  [buyerGroup.id, companyId],
);

// --- items ---
let item = await one(`select id, name from items where company_id=$1 and code='DEMO1'`, [companyId]);
if (!item) {
  item = await one(
    `insert into items(code, name, rate, item_group_id, company_id, prefix, default_series, shift_group_id, rate_per_100)
     values('DEMO1', 'Demo Lottery Item', 1.00, $1, $2, 'DM', 'A', $3, 100)
     returning id, name`,
    [itemGroup.id, companyId, shiftGroup?.id ?? null],
  );
}
await c.query(
  `update items set rate=1.00, prefix=coalesce(prefix,'PX'), default_series=coalesce(default_series,'SR')
   where company_id=$1 and id=$2`,
  [companyId, item.id],
);
// keep existing QA item usable
await c.query(
  `update items set rate=coalesce(rate,1.00) where company_id=$1 and code='QA1'`,
  [companyId],
);
const qaItem = await one(`select id from items where company_id=$1 and code='QA1'`, [companyId]);
const saleItemId = qaItem?.id ?? item.id;

// --- item scheme + prizes ---
let scheme = await one(`select id from item_schemes where company_id=$1 and item_id=$2 limit 1`, [
  companyId,
  item.id,
]);
if (!scheme) {
  scheme = await one(
    `insert into item_schemes(item_id, scheme_date, draw_no, company_id)
     values($1, CURRENT_DATE, 'DEMO-1', $2) returning id`,
    [item.id, companyId],
  );
  await c.query(
    `insert into item_scheme_prizes
      (item_scheme_id, prize_rank, check_prefix, check_series, prize_no_length, no_of_result, prize_amount)
     values
      ($1, 1, 'DM', 'A', 5, 1, 100000),
      ($1, 2, 'DM', 'A', 5, 1, 25000),
      ($1, 3, 'DM', 'A', 4, 10, 5000)`,
    [scheme.id],
  );
}

// --- today's draws stay open for live entry ---
await c.query(
  `update draws set status='open', close_time='23:59'
   where company_id=$1 and draw_date::date = CURRENT_DATE`,
  [companyId],
);

const evening = await one(
  `select id from draws where company_id=$1 and name='Evening Draw' and draw_date::date=CURRENT_DATE`,
  [companyId],
);
const dayDraw = await one(
  `select id from draws where company_id=$1 and name='Day Draw' and draw_date::date=CURRENT_DATE`,
  [companyId],
);
if (!evening || !dayDraw) throw new Error('today draws missing — open the app once to seed draws');

// --- demo txns (idempotent via voucher_no) ---
async function ensureTxn({
  voucherNo,
  type,
  drawId,
  providerId,
  buyerId,
  ticketData,
  ticketCount,
  amount,
  memoId,
}) {
  const existing = await one(`select id from transactions where company_id=$1 and voucher_no=$2`, [
    companyId,
    voucherNo,
  ]);
  if (existing) return existing;
  return one(
    `insert into transactions
      (type, draw_id, provider_id, buyer_id, company_id, user_id, memo_id, amount, ticket_count, ticket_data, voucher_no, entered_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW())
     returning id`,
    [
      type,
      drawId,
      providerId ?? null,
      buyerId ?? null,
      companyId,
      userId,
      memoId,
      amount,
      ticketCount,
      ticketData,
      voucherNo,
    ],
  );
}

const range = (from, to, itemId, rate = 1) => {
  const qty = Number(to) - Number(from) + 1;
  return {
    from: String(from),
    to: String(to),
    qty,
    itemId,
    code: 'DEMO1',
    prefix: 'DM',
    series: 'A',
    rate,
    amount: qty * rate,
  };
};

const purchaseTickets = JSON.stringify({
  ranges: [range('10001', '10050', item.id, 0.8)],
});
const purchase = await ensureTxn({
  voucherNo: 'DEMO-PURCHASE-1',
  type: 'purchase',
  drawId: evening.id,
  providerId: provider.id,
  ticketData: purchaseTickets,
  ticketCount: 50,
  amount: 40,
  memoId: 9001,
});

await ensureTxn({
  voucherNo: 'DEMO-PURCHASE-RET-1',
  type: 'purchase_return',
  drawId: evening.id,
  providerId: provider.id,
  ticketData: JSON.stringify({ ranges: [range('10001', '10005', item.id, 0.8)] }),
  ticketCount: 5,
  amount: 4,
  memoId: 9002,
});

const saleTickets = JSON.stringify({
  ranges: [range('20001', '20020', saleItemId, 1)],
});
const sale = await ensureTxn({
  voucherNo: 'DEMO-SALE-1',
  type: 'sale',
  drawId: evening.id,
  buyerId: buyer.id,
  ticketData: saleTickets,
  ticketCount: 20,
  amount: 20,
  memoId: 9003,
});

await ensureTxn({
  voucherNo: 'DEMO-SALE-2',
  type: 'sale',
  drawId: evening.id,
  buyerId: buyer2.id,
  ticketData: JSON.stringify({ ranges: [range('20100', '20109', saleItemId, 1.1)] }),
  ticketCount: 10,
  amount: 11,
  memoId: 9004,
});

await ensureTxn({
  voucherNo: 'DEMO-SALE-RET-1',
  type: 'sale_return',
  drawId: evening.id,
  buyerId: buyer.id,
  ticketData: JSON.stringify({ ranges: [range('20001', '20002', saleItemId, 1)] }),
  ticketCount: 2,
  amount: 2,
  memoId: 9005,
});

await ensureTxn({
  voucherNo: 'DEMO-BOOKING-1',
  type: 'booking',
  drawId: evening.id,
  buyerId: buyer2.id,
  ticketData: JSON.stringify({ tickets: [{ number: '30001' }, { number: '30002' }, { number: '30003' }] }),
  ticketCount: 3,
  amount: 3,
  memoId: 9006,
});

// --- results + winners on Day Draw (locks it; Evening stays open for entry) ---
const dayHasResults = await one(`select id from draw_results where draw_id=$1 limit 1`, [dayDraw.id]);
if (!dayHasResults) {
  // sale on day draw that includes the winning number
  const daySale = await ensureTxn({
    voucherNo: 'DEMO-SALE-DAY-WIN',
    type: 'sale',
    drawId: dayDraw.id,
    buyerId: buyer.id,
    ticketData: JSON.stringify({ ranges: [range('21001', '21010', saleItemId, 1)] }),
    ticketCount: 10,
    amount: 10,
    memoId: 9010,
  });
  await c.query(
    `insert into draw_results(draw_id, prize_level, winning_number, prize_amount) values
      ($1, 1, '21005', 100000),
      ($1, 3, '1005', 5000)`,
    [dayDraw.id],
  );
  await c.query(
    `update draws set result_imported=true, status='locked', locked_at=NOW(), locked_by=$2 where id=$1`,
    [dayDraw.id, userId],
  );
  const winExists = await one(
    `select id from winning_tickets where draw_id=$1 and ticket_number='21005'`,
    [dayDraw.id],
  );
  if (!winExists) {
    await c.query(
      `insert into winning_tickets(draw_id, ticket_number, prize_level, amount, buyer_id, transaction_id)
       values ($1, '21005', 1, 100000, $2, $3), ($1, '21005', 3, 5000, $2, $3)`,
      [dayDraw.id, buyer.id, daySale.id],
    );
  }
}

// --- summary ---
const counts = {};
for (const t of [
  'providers',
  'buyers',
  'items',
  'item_schemes',
  'item_scheme_prizes',
  'transactions',
  'draw_results',
  'winning_tickets',
]) {
  counts[t] = (await one(`select count(*)::int as n from ${t} where ${
    t === 'item_scheme_prizes'
      ? `item_scheme_id in (select id from item_schemes where company_id=${companyId})`
      : t === 'draw_results' || t === 'winning_tickets'
        ? `draw_id in (select id from draws where company_id=${companyId})`
        : `company_id=${companyId}`
  }`)).n;
}
console.log('Demo seed OK for company', companyId);
console.log({
  provider: provider.name,
  provider2: provider2.name,
  buyer: buyer.name,
  buyer2: buyer2.name,
  item: item.name,
  eveningDrawId: evening.id,
  dayDrawId: dayDraw.id,
  purchaseId: purchase.id,
  saleId: sale.id,
  counts,
});

await c.end();
