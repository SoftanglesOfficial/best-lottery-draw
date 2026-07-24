import assert from 'node:assert/strict';
import fs from 'node:fs';

/** Must stay identical to src/shared/winnerMatch.ts */
function isWinningTicket(ticketNo, winningNum, prizeLevel, matchLength = 4) {
  if (prizeLevel === 1 || prizeLevel === 2) {
    return ticketNo === winningNum;
  }
  return ticketNo.slice(-matchLength) === winningNum.slice(-matchLength);
}

assert.equal(isWinningTicket('12345', '12345', 1), true);
assert.equal(isWinningTicket('12345', '99999', 1), false);
assert.equal(isWinningTicket('12345', '12345', 2), true);
assert.equal(isWinningTicket('12345', '92345', 3, 4), true);
assert.equal(isWinningTicket('12345', '92346', 3, 4), false);
assert.equal(isWinningTicket('00099', '99', 4, 2), true);

const src = fs.readFileSync(new URL('../src/shared/winnerMatch.ts', import.meta.url), 'utf8');
assert.match(src, /prizeLevel === 1 \|\| prizeLevel === 2/);
assert.match(src, /slice\(-matchLength\)/);

const draws = fs.readFileSync(new URL('../src/main/ipc/draws.ts', import.meta.url), 'utf8');
assert.match(draws, /isWinningTicket/, 'findWinners must use shared isWinningTicket');

console.log('verify-winner-match: ok');
