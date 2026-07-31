import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/shared/unsoldTickets.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const module = { exports: {} };
new Function('exports', 'module', compiled)(module.exports, module);

const { unsoldCounts, unsoldTicketNumbers, numbersToRanges } = module.exports;

function expand(from, to) {
  const out = [];
  for (let n = Number(from); n <= Number(to); n += 1) {
    out.push(String(n).padStart(5, '0'));
  }
  return out;
}

const purchased = expand('00001', '00010');
const sold = expand('00003', '00005');
const unsold = unsoldCounts(purchased, sold, []);
assert.deepEqual(unsold, [...expand('00001', '00002'), ...expand('00006', '00010')]);

assert.deepEqual(
  unsoldTicketNumbers(purchased, sold, []),
  unsold,
  'unsoldTicketNumbers matches unsoldCounts',
);

assert.deepEqual(numbersToRanges(unsold), [
  { from: '00001', to: '00002', qty: 2 },
  { from: '00006', to: '00010', qty: 5 },
]);

// multiset: duplicate purchase, one sale
assert.deepEqual(unsoldCounts(['00001', '00001'], ['00001'], []), ['00001']);

// returns reduce remainder
assert.deepEqual(unsoldCounts(purchased, sold, ['00001']), [
  '00002',
  ...expand('00006', '00010'),
]);

// sale_return nets sold coverage: purchase 1-5, sale 1-5, sale_return 4-5 → unsold 4-5
const purchase15 = expand('00001', '00005');
const sale15 = expand('00001', '00005');
const saleReturn45 = expand('00004', '00005');
assert.deepEqual(unsoldCounts(purchase15, sale15, [], saleReturn45), saleReturn45);

console.log('verify-unsold-tickets: ok');
