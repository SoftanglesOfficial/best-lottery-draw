#!/usr/bin/env node
/**
 * ponytail: drift guard for triple schema — not a full merge.
 * Fails if txn_type / draw_status / role enum values diverge across sources.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function extractPgEnum(source, enumName) {
  const re = new RegExp(
    `pgEnum\\(['"]${enumName}['"],\\s*\\[([^\\]]+)\\]`,
  );
  const match = source.match(re);
  if (!match) throw new Error(`pgEnum ${enumName} not found in schema.ts`);
  return match[1]
    .split(',')
    .map((v) => v.trim().replace(/['"]/g, ''))
    .filter(Boolean);
}

function extractSqlEnum(source, enumName) {
  const re = new RegExp(
    `CREATE TYPE ${enumName} AS ENUM \\(([^)]+)\\)`,
    'i',
  );
  const match = source.match(re);
  if (!match) throw new Error(`CREATE TYPE ${enumName} not found in db.ts`);
  return match[0]
    .match(/'([^']+)'/g)
    .map((v) => v.slice(1, -1));
}

function extractTypeUnion(source, typeName) {
  const re = new RegExp(
    `export type ${typeName} =([^;]+);`,
    's',
  );
  const match = source.match(re);
  if (!match) throw new Error(`${typeName} union not found in types.ts`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function assertSame(label, ...lists) {
  const normalized = lists.map((list) => [...list].sort().join('|'));
  const first = normalized[0];
  for (let i = 1; i < normalized.length; i += 1) {
    if (first !== normalized[i]) {
      console.error(`MISMATCH ${label}:`);
      for (const list of lists) console.error(`  - ${list.join(', ')}`);
      process.exitCode = 1;
      return;
    }
  }
  console.log(`OK ${label} (${lists[0].length} values)`);
}

const schema = read('src/main/schema.ts');
const db = read('src/main/db.ts');
const types = read('src/shared/types.ts');

assertSame(
  'txn_type',
  extractPgEnum(schema, 'txn_type'),
  extractSqlEnum(db, 'txn_type'),
  extractTypeUnion(types, 'TransactionType'),
);

assertSame(
  'draw_status',
  extractPgEnum(schema, 'draw_status'),
  extractSqlEnum(db, 'draw_status'),
);

assertSame(
  'role',
  extractPgEnum(schema, 'role'),
  extractSqlEnum(db, 'role'),
);

if (process.exitCode) {
  console.error('\nSchema sync check failed. Update schema.ts, db.ts ENUM_SQL, and types.ts together.');
  process.exit(1);
}

console.log('\nAll schema enum checks passed.');
