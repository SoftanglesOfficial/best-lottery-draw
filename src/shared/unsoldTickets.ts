/** Multiset ticket remainder: purchases − purchase_returns − (sales/bookings − sale_returns). O(n); huge schemes may need streaming. */
function ticketFreq(nums: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const raw of nums) {
    const key = String(raw).padStart(5, '0');
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  return freq;
}

export function unsoldCounts(
  purchaseNums: string[],
  saleNums: string[],
  returnNums: string[],
  saleReturnNums: string[] = [],
): string[] {
  const remaining = ticketFreq(purchaseNums);
  for (const raw of returnNums) {
    const key = String(raw).padStart(5, '0');
    remaining.set(key, (remaining.get(key) ?? 0) - 1);
  }
  for (const raw of saleNums) {
    const key = String(raw).padStart(5, '0');
    remaining.set(key, (remaining.get(key) ?? 0) - 1);
  }
  for (const raw of saleReturnNums) {
    const key = String(raw).padStart(5, '0');
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }

  const out: string[] = [];
  const keys = [...remaining.keys()].sort((a, b) => Number(a) - Number(b));
  for (const key of keys) {
    const count = remaining.get(key) ?? 0;
    for (let i = 0; i < count; i += 1) {
      out.push(key);
    }
  }
  return out;
}

export function unsoldTicketNumbers(
  purchased: string[],
  soldOrBooked: string[],
  alreadyReturned: string[],
  saleReturned: string[] = [],
): string[] {
  return unsoldCounts(purchased, soldOrBooked, alreadyReturned, saleReturned);
}

export function numbersToRanges(
  numbers: string[],
): Array<{ from: string; to: string; qty: number }> {
  if (numbers.length === 0) return [];

  const freq = ticketFreq(numbers);
  const sorted = [...freq.keys()].sort((a, b) => Number(a) - Number(b));
  const ranges: Array<{ from: string; to: string; qty: number }> = [];

  let index = 0;
  while (index < sorted.length) {
    const from = sorted[index];
    let to = from;
    let qty = freq.get(from) ?? 1;
    index += 1;

    while (index < sorted.length) {
      const next = sorted[index];
      if (Number(next) === Number(to) + 1) {
        qty += freq.get(next) ?? 1;
        to = next;
        index += 1;
      } else {
        break;
      }
    }

    ranges.push({ from, to, qty });
  }

  return ranges;
}
