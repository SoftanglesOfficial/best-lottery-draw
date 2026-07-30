import assert from 'node:assert/strict';
import fs from 'node:fs';

/** Must stay identical to src/shared/localDate.ts toLocalDateString */
function toLocalDateString(value = new Date()) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // ponytail: date-only UI strings — skip UTC Date parse (shifts day in UTC-)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

assert.equal(toLocalDateString('2026-07-30'), '2026-07-30');
assert.equal(toLocalDateString(' 2026-07-30 '), '2026-07-30');

const src = fs.readFileSync(new URL('../src/shared/localDate.ts', import.meta.url), 'utf8');
assert.match(
  src,
  /typeof value === 'string'[\s\S]*?\\d\{4\}-\\d\{2\}-\\d\{2\}[\s\S]*?return trimmed/,
  'toLocalDateString must short-circuit exact YYYY-MM-DD strings',
);

console.log('verify-local-date: ok');
