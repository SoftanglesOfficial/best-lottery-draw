import assert from 'node:assert/strict';
import fs from 'node:fs';

const txSource = fs.readFileSync(new URL('../src/main/ipc/transactions.ts', import.meta.url), 'utf8');
const schemaSource = fs.readFileSync(new URL('../src/main/schema.ts', import.meta.url), 'utf8');
const typesSource = fs.readFileSync(new URL('../src/shared/types.ts', import.meta.url), 'utf8');
const dbSource = fs.readFileSync(new URL('../src/main/db.ts', import.meta.url), 'utf8');

assert.doesNotMatch(
  txSource,
  /Stock transfer is not available\./,
  'stock_transfer reject must be removed from validateTransactionCreate',
);

assert.match(
  txSource,
  /data\.type === 'stock_transfer'[\s\S]*?From and to providers are required for stock transfer\./,
  'stock_transfer must require from and to providers',
);
assert.match(
  txSource,
  /data\.type === 'stock_transfer'[\s\S]*?Cannot transfer to the same provider\./,
  'stock_transfer must reject same from/to provider',
);
assert.match(
  txSource,
  /assertProviderCanTransact/,
  'transactions.ts must validate provider active + company',
);
assert.match(
  txSource,
  /\/\/ ponytail: no ledger posts until ledger spec/,
  'stock_transfer path must document no ledger posts',
);
assert.doesNotMatch(
  txSource,
  /stock_transfer[\s\S]*?ledgerEntries/,
  'stock_transfer must not insert ledger rows',
);

assert.match(
  schemaSource,
  /toProviderId: integer\('to_provider_id'\)/,
  'schema.ts must define to_provider_id on transactions',
);
assert.match(
  typesSource,
  /toProviderId\?: number \| null/,
  'types.ts must include toProviderId on TransactionInput',
);
assert.match(
  dbSource,
  /to_provider_id INTEGER REFERENCES providers\(id\)/,
  'db.ts must migrate to_provider_id column',
);

const uiSource = fs.readFileSync(
  new URL('../src/renderer/pages/transactions/StockTransferPage.tsx', import.meta.url),
  'utf8',
);
assert.match(
  uiSource,
  /type: 'stock_transfer'/,
  'StockTransferPage must submit stock_transfer type',
);
assert.match(
  uiSource,
  /toProviderId/,
  'StockTransferPage must send toProviderId',
);

console.log('verify-stock-transfer: ok');
