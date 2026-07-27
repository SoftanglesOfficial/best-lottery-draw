import assert from 'node:assert/strict';
import fs from 'node:fs';

const items = fs.readFileSync(new URL('../src/main/ipc/items.ts', import.meta.url), 'utf8');
const register = fs.readFileSync(new URL('../src/main/ipc/register.ts', import.meta.url), 'utf8');
const sessionCtx = fs.readFileSync(new URL('../src/main/ipc/sessionContext.ts', import.meta.url), 'utf8');

assert.match(sessionCtx, /export function assertCompanyAccess/);
assert.match(items, /export async function listItemSchemesByItem\(ctx: SessionContext/);
assert.match(items, /export async function getItemSchemePrizes\(ctx: SessionContext/);
assert.match(items, /export async function getItemScheme\(ctx: SessionContext/);
assert.match(items, /export async function createItemScheme\(ctx: SessionContext/);

// Each ID-by-resource scheme path must call assertCompanyAccess
for (const fn of ['listItemSchemesByItem', 'getItemSchemePrizes', 'getItemScheme', 'createItemScheme']) {
  const start = items.indexOf(`export async function ${fn}`);
  assert.ok(start >= 0, `${fn} missing`);
  const next = items.indexOf('export async function', start + 1);
  const body = items.slice(start, next === -1 ? undefined : next);
  assert.match(body, /assertCompanyAccess/, `${fn} must assert company access`);
}

assert.match(register, /listItemSchemesByItem\(ctx,/);
assert.match(register, /getItemSchemePrizes\(ctx,/);
assert.match(register, /createItemScheme\(ctx,/);

console.log('verify-company-isolation: ok');
