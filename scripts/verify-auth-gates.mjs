import assert from 'node:assert/strict';
import fs from 'node:fs';

const preload = fs.readFileSync(new URL('../src/preload/index.ts', import.meta.url), 'utf8');
const auth = fs.readFileSync(new URL('../src/main/ipc/auth.ts', import.meta.url), 'utf8');
const sessionCtx = fs.readFileSync(new URL('../src/main/ipc/sessionContext.ts', import.meta.url), 'utf8');
const register = fs.readFileSync(new URL('../src/main/ipc/register.ts', import.meta.url), 'utf8');
const forceUi = fs.readFileSync(
  new URL('../src/renderer/components/ForceChangePassword.tsx', import.meta.url),
  'utf8',
);

const publicBlock = preload.match(/PUBLIC_CHANNELS = new Set\(\[([\s\S]*?)\]\)/);
assert.ok(publicBlock, 'PUBLIC_CHANNELS must exist');
const publicChannels = [...publicBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

for (const banned of ['lan-set-mode', 'lan-start-broadcast', 'lan-stop-broadcast']) {
  assert.ok(!publicChannels.includes(banned), `${banned} must not be public`);
}
for (const required of ['lan-get-status', 'lan-discover-server', 'auth-login', 'auth-restore']) {
  assert.ok(publicChannels.includes(required), `${required} must stay public for setup/login`);
}

assert.match(auth, /DEFAULT_SEED_PASSWORD\s*=\s*'admin123'/);
assert.match(auth, /mustChangePassword:\s*trimmedPassword === DEFAULT_SEED_PASSWORD/);
assert.match(auth, /newPassword === DEFAULT_SEED_PASSWORD/);
assert.match(forceUi, /mustChangePassword/);
assert.match(sessionCtx, /assertAssignableRole/);
assert.match(auth, /assertAssignableRole\(ctx\.role/);
assert.match(register, /lan-set-mode[\s\S]*withSession[\s\S]*'manager'/);
assert.match(register, /changePassword\(ctx\.userId/);

console.log('verify-auth-gates: ok');
