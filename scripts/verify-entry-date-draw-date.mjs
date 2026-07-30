import assert from 'node:assert/strict';
import fs from 'node:fs';

const txSource = fs.readFileSync(new URL('../src/main/ipc/transactions.ts', import.meta.url), 'utf8');

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

console.log('verify-entry-date-draw-date: ok');
