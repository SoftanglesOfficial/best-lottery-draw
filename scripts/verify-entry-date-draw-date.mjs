import assert from 'node:assert/strict';
import fs from 'node:fs';

const txSource = fs.readFileSync(new URL('../src/main/ipc/transactions.ts', import.meta.url), 'utf8');
const reportsSource = fs.readFileSync(new URL('../src/main/ipc/reports.ts', import.meta.url), 'utf8');
const listSource = fs.readFileSync(
  new URL('../src/renderer/components/transactions/TransactionListPage.tsx', import.meta.url),
  'utf8',
);
const localDateSource = fs.readFileSync(new URL('../src/shared/localDate.ts', import.meta.url), 'utf8');

assert.match(
  txSource,
  /async function resolveTransactionEntryDate\([\s\S]*?drawDate: draws\.drawDate[\s\S]*?toLocalDateString\(draw\.drawDate\)/,
  'entry date validation must load and normalize the resolved draw date',
);
assert.match(
  txSource,
  /const entryDate = data\.entryDate \?\? data\.enteredAt[\s\S]*?toLocalDateString\(entryDate\) !== drawDate[\s\S]*?Entry date must match draw date\./,
  'provided entryDate/enteredAt must match the draw calendar date',
);
assert.match(
  txSource,
  /return new Date\(`\$\{drawDate\}T00:00:00`\)/,
  'omitted entry date must persist the draw date',
);
assert.equal(
  txSource.match(/resolveTransactionEntryDate\(data, drawId, tx\)/g)?.length,
  2,
  'create and update must both resolve entry date from the draw',
);
assert.match(
  txSource,
  /\.values\(\{[\s\S]*?enteredAt,\r?\n\s*\}\)/,
  'create must persist the resolved entry date',
);
assert.match(
  txSource,
  /\.set\(\{[\s\S]*?enteredAt,\r?\n\s*updatedAt:/,
  'update must persist the resolved entry date',
);
assert.match(
  localDateSource,
  /export function startOfLocalDay[\s\S]*?new Date\(`\$\{dateStr\}T00:00:00`\)/,
  'date-only filter lower bounds must parse at local midnight',
);
assert.match(
  localDateSource,
  /export function endOfLocalDay[\s\S]*?setHours\(23, 59, 59, 999\)/,
  'date-only filter upper bounds must end on the same local day',
);
assert.match(
  reportsSource,
  /startOfLocalDay\(dateFrom\)/,
  'report lower bounds must use local-day parsing',
);
assert.match(
  reportsSource,
  /endOfLocalDay\(dateTo\)/,
  'report upper bounds must use local-day parsing',
);
assert.match(
  listSource,
  /startOfLocalDay\(dateFrom\)/,
  'transaction-list lower bounds must use local-day parsing',
);
assert.match(
  listSource,
  /endOfLocalDay\(dateTo\)/,
  'transaction-list upper bounds must use local-day parsing',
);
assert.match(
  txSource,
  /\.orderBy\(desc\(transactions\.enteredAt\), desc\(transactions\.id\)\)/,
  'transaction lists must break entered-at ties by descending id',
);
assert.match(
  reportsSource,
  /\.orderBy\(desc\(transactions\.enteredAt\), desc\(transactions\.id\)\)/,
  'recent transactions must break entered-at ties by descending id',
);

console.log('verify-entry-date-draw-date: ok');
