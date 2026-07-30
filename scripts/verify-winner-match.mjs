import assert from 'node:assert/strict';
import fs from 'node:fs';

/** Must stay identical to src/shared/winnerMatch.ts */
function isWinningTicket(ticketNo, winningNum, prizeLevel, matchLength = 4) {
  const normalize = (value) => value.replace(/^0+(?=\d)/, '');
  return normalize(ticketNo) === normalize(winningNum);
}

assert.equal(isWinningTicket('12345', '12345', 1), true);
assert.equal(isWinningTicket('12345', '99999', 1), false);
assert.equal(isWinningTicket('12345', '12345', 2), true);

// L3: suffix-only match must not win (full-number rule)
assert.equal(isWinningTicket('12345', '92345', 3, 4), false);
assert.equal(isWinningTicket('12345', '12345', 3), true);
assert.equal(isWinningTicket('12345', '92346', 3, 4), false);

assert.equal(isWinningTicket('00099', '00099', 4), true);
assert.equal(isWinningTicket('00099', '99', 4, 2), true);
assert.equal(isWinningTicket('99', '00099', 4, 2), true);
assert.equal(isWinningTicket('00099', '00199', 4, 2), false);

assert.equal(isWinningTicket('54321', '54321', 5), true);
assert.equal(isWinningTicket('54321', '99921', 5, 3), false);

const src = fs.readFileSync(new URL('../src/shared/winnerMatch.ts', import.meta.url), 'utf8');
assert.match(src, /replace\(\/\^0\+\(\?=\\d\)\/, ''\)/);
assert.doesNotMatch(src, /slice\(-matchLength\)/);

const draws = fs.readFileSync(new URL('../src/main/ipc/draws.ts', import.meta.url), 'utf8');
assert.match(draws, /isWinningTicket/, 'findWinners must use shared isWinningTicket');

console.log('verify-winner-match: ok');
