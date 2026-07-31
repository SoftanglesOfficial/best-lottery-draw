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
      verifyPassword: () => false,
      hashPassword: (value) => `hash:${value}`,
      isLegacyPasswordHash: () => false,
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
                    passwordHash: 'hash:changed',
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
  if (id === './sessionContext') {
    return {
      assertAssignableRole: () => null,
      assertCompanyAccess: () => null,
      isAtLeastRole: () => true,
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
assert.match(
  transactionsSource,
  /export async function updateTransaction[\s\S]*?assertCompanyAccess\(ctx,\s*draw\.companyId\)/,
  'updateTransaction must verify draw company',
);
assert.match(
  transactionsSource,
  /export async function deleteTransaction[\s\S]*?assertCompanyAccess\(ctx,\s*draw\.companyId\)/,
  'deleteTransaction must verify draw company',
);
assert.match(
  transactionsSource,
  /data\.type === 'purchase_return'[\s\S]*?Cannot enter return without an existing purchase entry/,
  'purchase_return must reference purchase entry',
);
assert.match(
  transactionsSource,
  /async function resolveDrawId[\s\S]*?await validateDrawOpen\(/,
  'resolveDrawId must validate draw is open',
);
console.log('OK transaction update/delete scoped to active company');
console.log('OK transaction validation hardened');

const registerSource = fs.readFileSync(new URL('../src/main/ipc/register.ts', import.meta.url), 'utf8');
const masterCreateScoped = registerSource.match(
  /ipcMain\.handle\('(?:provider-groups|providers|buyer-groups|buyers|item-groups|items|itemSchemes|draws)-create'[\s\S]*?scopedCompany\(ctx,\s*input\.companyId\)/g,
);
assert.ok(
  masterCreateScoped && masterCreateScoped.length >= 8,
  'all master create handlers must call scopedCompany with input.companyId',
);
console.log('OK master create handlers scoped to session company');

const drawsSource = fs.readFileSync(new URL('../src/main/ipc/draws.ts', import.meta.url), 'utf8');
assert.match(
  registerSource,
  /lockDraw\(\s*id as number,\s*ctx\.userId,\s*ctx\.activeCompanyId/,
  'draws-lock must pass session active company',
);
assert.match(
  drawsSource,
  /export async function lockDraw[\s\S]*?requireCompanyId\(companyId\)[\s\S]*?current\.companyId !== scoped\.companyId/,
  'lockDraw must verify draw belongs to active company',
);
assert.match(
  drawsSource,
  /export async function unlockDraw[\s\S]*?requireCompanyId\(ctx\.activeCompanyId\)[\s\S]*?current\.companyId !== scoped\.companyId/,
  'unlockDraw must verify draw belongs to active company',
);
assert.match(
  drawsSource,
  /export async function lockDraw[\s\S]*?current\.status !== 'open'[\s\S]*?Only open draws can be locked\./,
  'lockDraw must only allow open draws',
);
assert.match(
  drawsSource,
  /export async function unlockDraw[\s\S]*?current\.status !== 'locked'[\s\S]*?Only locked draws can be unlocked\./,
  'unlockDraw must only allow locked draws',
);
assert.match(
  registerSource,
  /createDrawResults\(drawId as number, results as DrawResultInput\[\], ctx\.activeCompanyId\)/,
  'draw-results-create must pass session active company',
);
assert.match(
  registerSource,
  /listDrawAuditLogs\(drawId as number, ctx\.activeCompanyId\)/,
  'draws-audit-list must pass session active company',
);
assert.match(
  registerSource,
  /winning-tickets-delete[\s\S]*?requireCompanyId\(ctx\.activeCompanyId\)[\s\S]*?getDrawById\(ticket\.drawId\)/,
  'winning-tickets-delete must verify draw company before delete',
);
assert.match(
  registerSource,
  /draw-results-list[\s\S]*?listDrawResults\(drawId as number, ctx\.activeCompanyId\)/,
  'draw-results-list must pass session active company to listDrawResults',
);
assert.match(
  drawsSource,
  /export async function listDrawResults[\s\S]*?requireCompanyId\(companyId\)[\s\S]*?draw\.companyId !== scoped\.companyId/,
  'listDrawResults must verify draw belongs to active company',
);
assert.match(
  registerSource,
  /winning-tickets-list[\s\S]*?listWinningTickets\(drawId as number, ctx\.activeCompanyId\)/,
  'winning-tickets-list must pass session active company to listWinningTickets',
);
assert.match(
  drawsSource,
  /export async function listWinningTickets[\s\S]*?requireCompanyId\(companyId\)[\s\S]*?draw\.companyId !== scoped\.companyId/,
  'listWinningTickets must verify draw belongs to active company',
);
console.log('OK draw results and winning tickets reads scoped to active company');
console.log('OK draw lock/unlock/results scoped to active company');

const utilitiesSource = fs.readFileSync(new URL('../src/main/ipc/utilities.ts', import.meta.url), 'utf8');
assert.match(
  utilitiesSource,
  /export async function changeBuyerRate[\s\S]*?assertCompanyAccess\(ctx,\s*buyer\.companyId\)/,
  'changeBuyerRate must verify buyer company',
);
assert.match(
  utilitiesSource,
  /export async function changeProviderRate[\s\S]*?assertCompanyAccess\(ctx,\s*provider\.companyId\)/,
  'changeProviderRate must verify provider company',
);
assert.match(
  utilitiesSource,
  /export async function bulkRateUpdate[\s\S]*?assertCompanyAccess\(ctx,\s*group\.companyId\)/,
  'bulkRateUpdate must verify buyer group company',
);
assert.match(
  utilitiesSource,
  /export async function deleteMemos[\s\S]*?assertCompanyAccess\(ctx,\s*draw\.companyId\)/,
  'deleteMemos must verify draw company',
);
console.log('OK utility rate and memo deletes scoped to session company');

const backupsSource = fs.readFileSync(new URL('../src/main/ipc/backups.ts', import.meta.url), 'utf8');
assert.match(
  backupsSource,
  /export async function restoreBackup[\s\S]*?assertCompanyAccess\(ctx,\s*companyId\)/,
  'restoreBackup must verify backup company against session',
);
console.log('OK backup restore scoped to session company');

const reportsSource = fs.readFileSync(new URL('../src/main/ipc/reports.ts', import.meta.url), 'utf8');
assert.match(
  reportsSource,
  /export async function listAuditLogs[\s\S]*?ctx\.role !== 'admin'[\s\S]*?scopedFilters\.companyId = ctx\.activeCompanyId/,
  'listAuditLogs must force active company for non-admin users',
);
assert.match(
  reportsSource,
  /export async function listAuditLogs[\s\S]*?assertCompanyAccess\(ctx,\s*scopedFilters\.companyId\)/,
  'listAuditLogs must verify company filter against session',
);
console.log('OK audit log listing scoped to session company');

const itemsSource = fs.readFileSync(new URL('../src/main/ipc/items.ts', import.meta.url), 'utf8');
assert.match(
  itemsSource,
  /export async function getItemScheme[\s\S]*?innerJoin\(items[\s\S]*?assertCompanyAccess\(ctx,\s*row\.itemCompanyId\)/,
  'getItemScheme must verify item company via join',
);
console.log('OK item scheme read scoped to session company');

assert.match(
  registerSource,
  /utilities-change-buyer-rate[\s\S]*?changeBuyerRate\(ctx,/,
  'utilities-change-buyer-rate must pass session context',
);
assert.match(
  registerSource,
  /utilities-change-provider-rate[\s\S]*?changeProviderRate\(ctx,/,
  'utilities-change-provider-rate must pass session context',
);
assert.match(
  registerSource,
  /utilities-bulk-rate-update[\s\S]*?bulkRateUpdate\(ctx,/,
  'utilities-bulk-rate-update must pass session context',
);
assert.match(
  registerSource,
  /audit-logs-list[\s\S]*?listAuditLogs\(ctx,/,
  'audit-logs-list must pass session context',
);
assert.match(
  registerSource,
  /itemSchemes-get[\s\S]*?getItemScheme\(ctx,/,
  'itemSchemes-get must pass session context',
);
console.log('OK task 4 handlers pass session context');

const purchaseEntrySource = fs.readFileSync(
  new URL('../src/renderer/pages/transactions/PurchaseEntryPage.tsx', import.meta.url),
  'utf8',
);
assert.match(
  purchaseEntrySource,
  /LegacyTransactionShell/,
  'purchase entry must use LegacyTransactionShell for shared header/draw chrome',
);
assert.doesNotMatch(
  purchaseEntrySource,
  /htmlFor="purchase-draw"/,
  'purchase entry must not use legacy inline purchase-draw markup',
);
const legacyShellSource = fs.readFileSync(
  new URL('../src/renderer/components/transactions/LegacyTransactionShell.tsx', import.meta.url),
  'utf8',
);
assert.match(
  legacyShellSource,
  /aria-label="Draw \*"/,
  'transaction shell draw select must expose Draw * aria-label',
);

const buyerLedgerSource = fs.readFileSync(
  new URL('../src/renderer/pages/reports/BuyerLedgerPage.tsx', import.meta.url),
  'utf8',
);
assert.match(
  buyerLedgerSource,
  /aria-expanded=/,
  'buyer ledger expand controls must expose aria-expanded state',
);
assert.match(
  buyerLedgerSource,
  /PageHeader/,
  'buyer ledger page must use shared PageHeader',
);

const reportsSummarySource = fs.readFileSync(
  new URL('../src/renderer/pages/reports/ReportsSummaryPage.tsx', import.meta.url),
  'utf8',
);
assert.match(
  reportsSummarySource,
  /PageHeader/,
  'reports summary page must use shared PageHeader',
);
console.log('OK phase 3 UI consistency guards');

// Local calendar-day filter (UTC toISOString broke draw dropdowns in UTC+ offsets)
const localDateSource = fs.readFileSync(
  new URL('../src/shared/localDate.ts', import.meta.url),
  'utf8',
);
assert.match(localDateSource, /getFullYear\(\)/, 'toLocalDateString must use local calendar fields');
assert.doesNotMatch(
  localDateSource,
  /toISOString/,
  'localDate helpers must not use UTC toISOString',
);

const saleEntrySource = fs.readFileSync(
  new URL('../src/renderer/pages/transactions/SaleEntryPage.tsx', import.meta.url),
  'utf8',
);
assert.match(
  saleEntrySource,
  /status === 'open'/,
  'sale entry must list open draws (same as purchase)',
);
assert.doesNotMatch(
  saleEntrySource,
  /todayOpenDraws/,
  'sale entry must not use same-day-only draw list',
);

const bookingEntrySource = fs.readFileSync(
  new URL('../src/renderer/pages/transactions/BookingEntryPage.tsx', import.meta.url),
  'utf8',
);
assert.match(
  bookingEntrySource,
  /status === 'open'/,
  'booking entry must list open draws',
);
assert.doesNotMatch(
  bookingEntrySource,
  /todayOpenDraws/,
  'booking entry must not use same-day-only draw list',
);

const saleRangeSource = fs.readFileSync(
  new URL('../src/renderer/components/transactions/SaleRangeTable.tsx', import.meta.url),
  'utf8',
);
assert.match(saleRangeSource, /padTicketDigits/, 'sale range qty must pad short ticket numbers');

const ticketRangeSource = fs.readFileSync(
  new URL('../src/renderer/components/transactions/TicketRangeTable.tsx', import.meta.url),
  'utf8',
);
assert.match(ticketRangeSource, /padTicketDigits/, 'purchase range qty must pad short ticket numbers');

assert.equal(
  '324'.padStart(5, '0'),
  '00324',
  'short tickets pad to 5 digits for qty/amount',
);

const local = new Date(2026, 6, 20, 0, 0, 0);
assert.equal(
  `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`,
  '2026-07-20',
  'local calendar fixture',
);
console.log('OK sale/booking open draws + ticket pad for amount');
