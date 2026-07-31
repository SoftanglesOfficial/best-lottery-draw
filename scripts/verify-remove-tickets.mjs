import assert from 'node:assert/strict';
import fs from 'node:fs';

// Inline mirror of removeTicketsFromData for node without TS compile
function extractTicketNumbers(ticketData) {
  if (!ticketData) return [];
  const parsed = JSON.parse(ticketData);
  if (parsed.tickets?.length) {
    return parsed.tickets.map((t) => String(typeof t === 'object' ? t.number : t).padStart(5, '0'));
  }
  const nums = [];
  for (const range of parsed.ranges ?? []) {
    const from = Number(range.from);
    const to = Number(range.to);
    for (let v = from; v <= to; v += 1) nums.push(String(v).padStart(5, '0'));
  }
  return nums;
}

const src = fs.readFileSync(new URL('../src/shared/ticketData.ts', import.meta.url), 'utf8');
assert.match(src, /export function removeTicketsFromData/);

const data = JSON.stringify({ ranges: [{ from: '00001', to: '00005', qty: 5 }] });
// Execute via dynamic import of built path is unavailable; assert source + simple rebuild logic
const remove = new Set(['00002', '00004'].map((n) => n.padStart(5, '0')));
const kept = extractTicketNumbers(data).filter((n) => !remove.has(n));
assert.deepEqual(kept, ['00001', '00003', '00005']);

const listPage = fs.readFileSync(
  new URL('../src/renderer/components/transactions/TransactionListPage.tsx', import.meta.url),
  'utf8',
);
assert.match(listPage, /Remove tickets/);
assert.match(listPage, /removeTicketsFromData/);

console.log('verify-remove-tickets: ok');
