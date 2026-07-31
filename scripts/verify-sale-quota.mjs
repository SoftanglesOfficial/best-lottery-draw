import assert from 'node:assert/strict';
import fs from 'node:fs';

function assertWithinQuota(maxQty, usedQty, addingQty) {
  if (usedQty + addingQty > maxQty) {
    throw new Error(
      `Sale quota exceeded (max ${maxQty}, used ${usedQty}, adding ${addingQty}).`,
    );
  }
}

assertWithinQuota(5, 3, 2);
assert.throws(() => assertWithinQuota(5, 3, 3), /Sale quota exceeded/);

const sharedSource = fs.readFileSync(new URL('../src/shared/saleQuota.ts', import.meta.url), 'utf8');
assert.match(
  sharedSource,
  /export function assertWithinQuota\(maxQty: number, usedQty: number, addingQty: number\)/,
  'saleQuota.ts must export assertWithinQuota',
);
assert.match(
  sharedSource,
  /export function qtyByItemId/,
  'saleQuota.ts must export qtyByItemId',
);

const txSource = fs.readFileSync(new URL('../src/main/ipc/transactions.ts', import.meta.url), 'utf8');
assert.match(
  txSource,
  /assertWithinQuota/,
  'transactions.ts must call assertWithinQuota',
);
assert.match(
  txSource,
  /data\.type === 'sale' \|\| data\.type === 'booking'[\s\S]*?assertWithinQuota|assertSaleQuotas[\s\S]*?data\.type === 'sale' \|\| data\.type === 'booking'/,
  'quota gate must apply to sale and booking',
);
assert.match(
  txSource,
  /saleQuotas/,
  'transactions.ts must query saleQuotas',
);

const quotaSource = fs.readFileSync(new URL('../src/main/ipc/saleQuotas.ts', import.meta.url), 'utf8');
assert.match(
  quotaSource,
  /assertQuotaDrawItemMatch/,
  'saleQuotas.ts must validate draw item match on create/update',
);
assert.match(
  quotaSource,
  /draw\.itemId != null && itemId !== draw\.itemId/,
  'saleQuotas.ts must reject item when draw has a fixed item',
);

console.log('verify-sale-quota: ok');
