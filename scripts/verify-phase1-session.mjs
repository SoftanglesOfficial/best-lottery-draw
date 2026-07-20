import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/main/sessionStore.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const config = new Map();
let failConfigWrites = false;
const module = { exports: {} };
const requireMock = (id) => {
  if (id === 'crypto') return awaitImportCrypto;
  if (id === 'electron') {
    return {
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(value, 'utf8'),
        decryptString: (value) => value.toString('utf8'),
      },
    };
  }
  if (id === './configStore') {
    return {
      getConfigValue: (key, fallback) => config.get(key) ?? fallback,
      setConfig: (data) => {
        if (failConfigWrites) throw new Error('Config write failed');
        for (const [key, value] of Object.entries(data)) config.set(key, value);
      },
      setConfigValue: (key, value) => {
        if (failConfigWrites) throw new Error('Config write failed');
        config.set(key, value);
      },
    };
  }
  throw new Error(`Unexpected import: ${id}`);
};
const awaitImportCrypto = await import('node:crypto');

new Function('require', 'exports', 'module', compiled)(requireMock, module.exports, module);

const {
  createSession,
  isSessionSelectionCurrent,
  refreshSessionAuthorization,
  revokeSession,
  updateSessionCompany,
  updateSessionShift,
  validateSession,
} = module.exports;

const token = createSession(1, 'admin');
assert.equal(typeof config.get('session'), 'string', 'persisted session claims must be encrypted');
assert.deepEqual(
  {
    activeCompanyId: validateSession(token).activeCompanyId,
    activeShiftId: validateSession(token).activeShiftId,
  },
  { activeCompanyId: null, activeShiftId: null },
  'fresh sessions must not inherit a persisted user company or shift',
);

updateSessionCompany(token, 7);
updateSessionShift(token, 21);
assert.equal(validateSession(token).activeShiftId, 21);
assert.equal(updateSessionShift(token, 22, 8), false);
assert.equal(validateSession(token).activeShiftId, 21, 'a stale company request must not change shift');

updateSessionCompany(token, 8);
assert.deepEqual(
  {
    activeCompanyId: validateSession(token).activeCompanyId,
    activeShiftId: validateSession(token).activeShiftId,
  },
  { activeCompanyId: 8, activeShiftId: null },
  'changing companies must clear the selected shift',
);
updateSessionShift(token, 21, 8);
failConfigWrites = true;
assert.equal(updateSessionShift(token, 22, 8), false);
assert.equal(validateSession(token).activeShiftId, 21, 'failed persistence must not mutate memory');
failConfigWrites = false;
assert.equal(isSessionSelectionCurrent(token, 8, 21), true);
assert.equal(refreshSessionAuthorization(token, 'admin', 7, 7), false);
assert.equal(validateSession(token).activeCompanyId, 8, 'stale restore must not replace company');
failConfigWrites = true;
assert.equal(revokeSession(token), false);
assert.equal(validateSession(token), null, 'logout must invalidate memory when disk clearing fails');
failConfigWrites = false;

console.log('OK fresh session selection and company-switch clearing');

const authSource = fs.readFileSync(new URL('../src/main/ipc/auth.ts', import.meta.url), 'utf8');
const authCompiled = ts.transpileModule(authSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
let selectCall = 0;
const authPredicates = [];
const authModule = { exports: {} };
const authRequireMock = (id) => {
  if (id === 'drizzle-orm') {
    return {
      and: (...conditions) => conditions,
      eq: (field, value) => {
        authPredicates.push([field, value]);
        return { field, value };
      },
      inArray: () => ({}),
    };
  }
  if (id === '../db') {
    return {
      ensureConnected: async () => ({ success: true }),
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => {
                selectCall += 1;
                if (selectCall === 1) {
                  return [{
                    id: 1,
                    username: 'admin',
                    fullName: 'Admin',
                    role: 'manager',
                    companyId: null,
                    activeCompanyId: 99,
                    createdAt: null,
                    updatedAt: null,
                  }];
                }
                if (selectCall === 2) return [{ id: 1 }];
                return [{ name: 'Session Company' }];
              },
            }),
          }),
        }),
      }),
    };
  }
  if (id === '../sessionStore') {
    return {
      getPersistedSessionToken: () => 'restore-token',
      validateSession: () => ({
        userId: 1,
        role: 'manager',
        activeCompanyId: 7,
        activeShiftId: 21,
        expiresAt: Date.now() + 60_000,
      }),
      touchSession: () => undefined,
      refreshSessionAuthorization: () => true,
      revokeSession: () => true,
    };
  }
  if (id === '../schema') {
    return {
      companies: { id: 'companies.id', name: 'companies.name' },
      userCompanies: {
        id: 'user_companies.id',
        userId: 'user_companies.user_id',
        companyId: 'user_companies.company_id',
      },
      users: { id: 'users.id' },
    };
  }
  throw new Error(`Unexpected auth import: ${id}`);
};

new Function('require', 'exports', 'module', authCompiled)(
  authRequireMock,
  authModule.exports,
  authModule,
);
const restored = await authModule.exports.restoreSession();
assert.equal(restored.success, true);
assert.equal(restored.user.activeCompanyId, 7);
assert.equal(restored.companyName, 'Session Company');
assert.ok(
  authPredicates.some(([field, value]) => field === 'companies.id' && value === 7),
  'restore must load the company selected by the session',
);
assert.ok(
  authPredicates.some(([field, value]) => field === 'user_companies.user_id' && value === 1),
  'restore must revalidate company membership',
);
console.log('OK restore uses session company authority');

const shiftsSource = fs.readFileSync(new URL('../src/main/ipc/shifts.ts', import.meta.url), 'utf8');
const shiftsCompiled = ts.transpileModule(shiftsSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const predicates = [];
const shiftsModule = { exports: {} };
const shiftSchema = {
  shiftGroups: { id: 'shift_groups.id', companyId: 'shift_groups.company_id', name: 'shift_groups.name' },
  shifts: { id: 'shifts.id', shiftGroupId: 'shifts.shift_group_id', name: 'shifts.name' },
};
const shiftsRequireMock = (id) => {
  if (id === 'drizzle-orm') {
    return {
      and: (...conditions) => conditions,
      asc: (value) => value,
      eq: (field, value) => {
        predicates.push([field, value]);
        return { field, value };
      },
    };
  }
  if (id === '../db') {
    return {
      ensureConnected: async () => ({ success: true }),
      getDb: () => ({
        select: () => ({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: async () => [],
              }),
            }),
          }),
        }),
      }),
    };
  }
  if (id === '../schema') return shiftSchema;
  if (id === './companyScope') {
    return {
      requireCompanyId: (companyId) => (
        companyId == null
          ? { success: false, error: 'No active company selected.' }
          : { success: true, companyId }
      ),
    };
  }
  if (id === './ipcUtils') return { formatDbError: String };
  throw new Error(`Unexpected shifts import: ${id}`);
};

new Function('require', 'exports', 'module', shiftsCompiled)(
  shiftsRequireMock,
  shiftsModule.exports,
  shiftsModule,
);
const rejectedShift = await shiftsModule.exports.getShiftForCompany(99, 7);
assert.deepEqual(rejectedShift, { success: true, shift: null });
assert.ok(predicates.some(([field, value]) => field === 'shifts.id' && value === 99));
assert.ok(predicates.some(([field, value]) => field === 'shift_groups.company_id' && value === 7));
assert.deepEqual(
  await shiftsModule.exports.requireActiveShiftForCompany(null, 7),
  { success: false, error: 'Select an active shift before creating transactions.' },
);
assert.deepEqual(
  await shiftsModule.exports.requireActiveShiftForCompany(99, 7),
  { success: false, error: 'The selected shift is no longer valid for the active company.' },
);
assert.equal((await shiftsModule.exports.createShiftGroup({ name: '   ' }, 7)).success, false);
assert.equal((await shiftsModule.exports.updateShiftGroup(1, { name: '   ' }, 7)).success, false);
assert.equal(
  (await shiftsModule.exports.updateShift(1, { name: '   ', shiftGroupId: 11 }, 7)).success,
  false,
);
console.log('OK shift lookup binds ID to active company');

const transactionsSource = fs.readFileSync(new URL('../src/main/ipc/transactions.ts', import.meta.url), 'utf8');
assert.match(
  transactionsSource,
  /requireActiveShiftForCompany\(ctx\.activeShiftId,\s*ctx\.activeCompanyId\)/,
  'transaction creation must validate the session shift against the active company',
);

const registerSource = fs.readFileSync(new URL('../src/main/ipc/register.ts', import.meta.url), 'utf8');
const masterCreateScoped = registerSource.match(
  /ipcMain\.handle\('(?:provider-groups|providers|buyer-groups|buyers|item-groups|items|itemSchemes|draws)-create'[\s\S]*?scopedCompany\(ctx,\s*input\.companyId\)/g,
);
assert.ok(
  masterCreateScoped && masterCreateScoped.length >= 8,
  'all master create handlers must call scopedCompany with input.companyId',
);
console.log('OK master create handlers scoped to session company');
