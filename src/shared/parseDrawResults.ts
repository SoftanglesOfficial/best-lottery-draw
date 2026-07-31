import type { DrawResultInput } from './types';

const PRIZE_LABEL_MAP: Record<string, number> = {
  '1st': 1,
  '2nd': 2,
  '3rd': 3,
  '4th': 4,
  '5th': 5,
};

function parsePrizeLevel(header: string): number | null {
  const normalized = header.toLowerCase();
  for (const [key, level] of Object.entries(PRIZE_LABEL_MAP)) {
    if (normalized.includes(key)) return level;
  }
  return null;
}

export function parseResultTxt(content: string): DrawResultInput[] {
  const lines = content.split(/\r?\n/);
  const results: DrawResultInput[] = [];
  let currentLevel: number | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.endsWith(':') || /prize/i.test(line)) {
      currentLevel = parsePrizeLevel(line);
      continue;
    }

    if (currentLevel != null && /^\d+$/.test(line)) {
      results.push({
        prizeLevel: currentLevel,
        winningNumber: line,
        prizeAmount: null,
      });
    }
  }

  return results;
}

export const PRIZE_LABELS: Record<number, string> = {
  1: '1st Prize',
  2: '2nd Prize',
  3: '3rd Prize',
  4: '4th Prize',
  5: '5th Prize',
};

export function formatResultTxt(results: DrawResultInput[]): string {
  const lines: string[] = [];
  for (const level of [1, 2, 3, 4, 5]) {
    const levelResults = results.filter((entry) => entry.prizeLevel === level);
    if (levelResults.length === 0) continue;
    lines.push(`${PRIZE_LABELS[level]}:`);
    for (const entry of levelResults) {
      lines.push(entry.winningNumber);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}
