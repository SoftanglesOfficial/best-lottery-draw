import assert from 'node:assert/strict';
import fs from 'node:fs';

const txSource = fs.readFileSync(new URL('../src/main/ipc/transactions.ts', import.meta.url), 'utf8');

assert.match(
  txSource,
  /async function assertBuyerCanTransact\(buyerId: number/,
  'assertBuyerCanTransact must exist next to assertCompanyCanTransact',
);
assert.match(
  txSource,
  /async function assertBuyerCanTransact[\s\S]*?\.select\(\{ status: buyers\.status \}\)/,
  'assertBuyerCanTransact must load buyers.status',
);
assert.match(
  txSource,
  /async function assertBuyerCanTransact[\s\S]*?Buyer not found\./,
  'assertBuyerCanTransact must throw when buyer is missing',
);
assert.match(
  txSource,
  /async function assertBuyerCanTransact[\s\S]*?status !== 'active'[\s\S]*?Buyer is not active\./,
  'assertBuyerCanTransact must reject locked/frozen buyers',
);

assert.match(
  txSource,
  /async function validateTransactionCreate[\s\S]*?data\.type === 'sale' \|\| data\.type === 'sale_return' \|\| data\.type === 'booking'[\s\S]*?assertBuyerCanTransact\(data\.buyerId,\s*db\)/,
  'validateTransactionCreate must call assertBuyerCanTransact for sale/sale_return/booking',
);

console.log('verify-buyer-active-gate: ok');
