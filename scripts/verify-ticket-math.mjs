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

const {
  resolveTo,
  calculateQuantity,
  calculateAmount,
  validateRange,
  qtyMatchesRange,
  isFiveDigitTicket,
  validateSaleTicketSnapshot,
  matchItemByCode,
} = module.exports;

// — resolveTo diff —
assert.deepEqual(resolveTo('81024', '6', 'diff'), { ok: true, to: '81030' });
assert.deepEqual(resolveTo('81024', '0', 'diff'), { ok: true, to: '81024' });
assert.equal(resolveTo('81024', '', 'diff').ok, false);
assert.equal(resolveTo('81024', 'abc', 'diff').ok, false);
assert.equal(resolveTo('123', '6', 'diff').ok, false, 'no From pad');
assert.equal(resolveTo('99998', '5', 'diff').ok, false, 'overflow');
assert.deepEqual(resolveTo('00000', '0', 'diff'), { ok: true, to: '00000' });
assert.deepEqual(resolveTo('99990', '9', 'diff'), { ok: true, to: '99999' });
assert.equal(resolveTo('99999', '1', 'diff').ok, false);

// — resolveTo absolute —
assert.deepEqual(resolveTo('81024', '81030', 'absolute'), { ok: true, to: '81030' });
assert.equal(resolveTo('81024', '6', 'absolute').ok, false, 'no absolute pad');
assert.equal(resolveTo('81024', '81020', 'absolute').ok, false, 'To < From');
assert.deepEqual(resolveTo('00000', '99999', 'absolute'), { ok: true, to: '99999' });

// — quantity / amount —
assert.equal(calculateQuantity('81024', '81030'), 7);
assert.equal(calculateQuantity('81024', '81024'), 1);
assert.equal(calculateQuantity('00000', '00000'), 1);
assert.equal(calculateQuantity('123', '00123'), 0);
assert.equal(calculateAmount(7, 10), 70);
assert.equal(calculateAmount(0, 10), 0);

// — validateRange —
assert.equal(
  validateRange({ itemId: 1, from: '81024', to: '81030', rate: '1' }),
  null,
);
assert.match(
  validateRange({ itemId: null, from: '81024', to: '81030', rate: '1' }) ?? '',
  /lottery/i,
);
assert.match(
  validateRange({ itemId: 1, from: '123', to: '81030', rate: '1' }) ?? '',
  /From/,
);
assert.equal(qtyMatchesRange('81024', '81030', 7), true);
assert.equal(qtyMatchesRange('81024', '81030', 6), false);
assert.equal(isFiveDigitTicket('81024'), true);
assert.equal(isFiveDigitTicket('123'), false);

assert.equal(
  validateSaleTicketSnapshot([
    { itemId: 1, from: '81024', to: '81030', qty: 7, rate: 1, code: 'A', prefix: 'P', series: 'S' },
  ], new Map([[1, { code: 'A', prefix: 'P', defaultSeries: 'S' }]])),
  null,
);
assert.match(
  validateSaleTicketSnapshot([
    { itemId: 1, from: '81024', to: '81030', qty: 6, rate: 1 },
  ]) ?? '',
  /Quantity/,
);
assert.match(
  validateSaleTicketSnapshot([
    { itemId: 1, from: '81024', to: '81030', qty: 7, rate: 1, code: 'WRONG' },
  ], new Map([[1, { code: 'A', prefix: null, defaultSeries: null }]])) ?? '',
  /Code/,
);

const items = [
  { id: 1, code: 'AB' },
  { id: 2, code: 'cd' },
  { id: 3, code: 'DUP' },
  { id: 4, code: 'dup' },
];
assert.equal(matchItemByCode(items, '').status, 'none');
assert.equal(matchItemByCode(items, '  ').status, 'none');
assert.equal(matchItemByCode(items, 'nope').status, 'none');
assert.deepEqual(matchItemByCode(items, 'ab'), { status: 'unique', item: items[0] });
assert.deepEqual(matchItemByCode(items, '  CD '), { status: 'unique', item: items[1] });
assert.equal(matchItemByCode(items, 'dup').status, 'ambiguous');

console.log('verify-ticket-math: ok');
