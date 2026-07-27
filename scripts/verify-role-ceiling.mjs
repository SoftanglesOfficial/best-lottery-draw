import assert from 'node:assert/strict';
import fs from 'node:fs';

const roles = fs.readFileSync(new URL('../src/main/ipc/sessionContext.ts', import.meta.url), 'utf8');
const auth = fs.readFileSync(new URL('../src/main/ipc/auth.ts', import.meta.url), 'utf8');
const register = fs.readFileSync(new URL('../src/main/ipc/register.ts', import.meta.url), 'utf8');

assert.match(roles, /ROLE_RANK[\s\S]*admin:\s*4/);
assert.match(roles, /Cannot assign a role above your own/);

// create + update must both ceiling-check
assert.equal(
  (auth.match(/assertAssignableRole\(ctx\.role/g) ?? []).length >= 2,
  true,
  'createUser and updateUser must both call assertAssignableRole',
);

// Privileged channels still require min roles server-side
assert.match(register, /auth-create-user[\s\S]*'owner'/);
assert.match(register, /reports-pnl[\s\S]*'owner'/);
assert.match(register, /diagnostics-get[\s\S]*'admin'/);
assert.match(register, /draws-unlock[\s\S]*'owner'/);

console.log('verify-role-ceiling: ok');
