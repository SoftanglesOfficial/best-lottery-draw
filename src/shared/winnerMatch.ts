/** Pure prize-match rules used by findWinners (keep in sync with draws.ts). */
export function isWinningTicket(
  ticketNo: string,
  winningNum: string,
  prizeLevel: number,
  matchLength = 4,
): boolean {
  const normalize = (value: string) => value.replace(/^0+(?=\d)/, '');
  return normalize(ticketNo) === normalize(winningNum);
}
