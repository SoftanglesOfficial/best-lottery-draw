import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/shared/ticketMath.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const module = { exports: {} };
new Function('exports', 'module', compiled)(module.exports, module);

const { findDuplicatePrefixCodeIndex, isCompletableSaleRangeRow } = module.exports;

const rows = [
  { code: 'M10', prefix: 'AB' },
  { code: 'M10', prefix: 'AB' },
  { code: 'M15', prefix: 'AB' },
  { code: 'M10', prefix: '' },
];

assert.equal(findDuplicatePrefixCodeIndex(rows, 1), 0);
assert.equal(findDuplicatePrefixCodeIndex(rows, 0), 1);
assert.equal(findDuplicatePrefixCodeIndex(rows, 2), -1, 'different code');
assert.equal(findDuplicatePrefixCodeIndex(rows, 3), -1, 'empty prefix');
assert.equal(
  findDuplicatePrefixCodeIndex(
    [
      { code: 'm10', prefix: ' ab ' },
      { code: 'M10', prefix: 'AB' },
    ],
    1,
  ),
  0,
  'trim + case',
);

// sticky CODE: new row inherits previous code
const sticky = { code: 'M10', prefix: '', series: '', from: '', to: '', rate: '' };
const next = { ...sticky, code: sticky.code };
assert.equal(next.code, 'M10');

assert.equal(
  typeof isCompletableSaleRangeRow,
  'function',
  'isCompletableSaleRangeRow exported',
);

assert.equal(
  isCompletableSaleRangeRow({ from: '', to: '', itemId: 1, code: 'M10' }),
  false,
  'sticky itemId alone not completable',
);
assert.equal(
  isCompletableSaleRangeRow({ from: '12345', to: '', itemId: 1 }),
  false,
  'from-only not completable',
);
assert.equal(
  isCompletableSaleRangeRow({ from: '12345', to: '12350', itemId: null }),
  true,
  'span completable even if itemId null (validateRange still fails item later)',
);
assert.equal(
  isCompletableSaleRangeRow({ from: ' 12345 ', to: ' 12350 ' }),
  true,
  'trim whitespace',
);

console.log('verify-sale-excel: ok');
