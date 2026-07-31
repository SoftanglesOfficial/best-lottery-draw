import assert from 'node:assert/strict';
import fs from 'node:fs';

const register = fs.readFileSync(new URL('../src/main/ipc/register.ts', import.meta.url), 'utf8');
assert.match(
  register,
  /draw-results-create[\s\S]*?createDrawResults[\s\S]*?'owner'/,
  'plain draw-results-create must require owner+',
);
assert.match(
  register,
  /draw-results-import-encrypted[\s\S]*?'manager'/,
  'encrypted import stays manager+',
);

const draws = fs.readFileSync(new URL('../src/main/ipc/draws.ts', import.meta.url), 'utf8');
assert.match(
  draws,
  /if \(!draw\.resultImported\)/,
  'findWinners must require resultImported',
);

const page = fs.readFileSync(
  new URL('../src/renderer/pages/DrawResultsPage.tsx', import.meta.url),
  'utf8',
);
assert.match(page, /canPlainImport/);
assert.match(page, /isAdminOrOwner/);

console.log('verify-result-import-gate: ok');
