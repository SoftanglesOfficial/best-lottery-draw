/** Pure prize-match rules used by findWinners (keep in sync with draws.ts). */
export function isWinningTicket(
  ticketNo: string,
  winningNum: string,
  prizeLevel: number,
  matchLength = 4,
): boolean {
  if (prizeLevel === 1 || prizeLevel === 2) {
    return ticketNo === winningNum;
  }
  return ticketNo.slice(-matchLength) === winningNum.slice(-matchLength);
}
