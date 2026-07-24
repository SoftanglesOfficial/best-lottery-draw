export type TicketRange = {
  from: string | number;
  to: string | number;
  count?: number;
  qty?: number;
  itemId?: number;
  code?: string;
  prefix?: string;
  series?: string;
  rate?: number;
  amount?: number;
};
export type TicketEntry = { number: string };

export function parseTicketData(ticketData: string | null | undefined): {
  ranges: TicketRange[];
  tickets: TicketEntry[];
} {
  if (!ticketData) return { ranges: [], tickets: [] };
  try {
    const parsed = JSON.parse(ticketData) as {
      ranges?: TicketRange[];
      tickets?: Array<{ number?: string } | string>;
    };
    if (parsed.ranges?.length) {
      return { ranges: parsed.ranges, tickets: [] };
    }
    if (parsed.tickets?.length) {
      return {
        ranges: [],
        tickets: parsed.tickets.map((ticket) => ({
          number: String(
            typeof ticket === 'object' && ticket != null && 'number' in ticket
              ? ticket.number
              : ticket,
          ),
        })),
      };
    }
    if (Array.isArray(parsed)) {
      return {
        ranges: [],
        tickets: (parsed as unknown[]).map((ticket) => ({ number: String(ticket) })),
      };
    }
  } catch {
    return { ranges: [], tickets: [] };
  }
  return { ranges: [], tickets: [] };
}

export function countFromTicketData(ticketData: string | null | undefined): number {
  const { ranges, tickets } = parseTicketData(ticketData);
  if (ranges.length > 0) {
    return ranges.reduce((sum, range) => {
      if (range.qty != null) return sum + range.qty;
      if (range.count != null) return sum + range.count;
      const from = Number(range.from);
      const to = Number(range.to);
      if (Number.isNaN(from) || Number.isNaN(to)) return sum;
      return sum + Math.max(0, to - from + 1);
    }, 0);
  }
  return tickets.length;
}

export function extractTicketNumbers(ticketData: string | null | undefined): string[] {
  const { ranges, tickets } = parseTicketData(ticketData);
  const numbers: string[] = [];

  for (const ticket of tickets) {
    numbers.push(String(ticket.number).padStart(5, '0'));
  }

  for (const range of ranges) {
    const from = Number(range.from);
    const to = Number(range.to);
    if (Number.isNaN(from) || Number.isNaN(to)) continue;
    const padLen = Math.max(String(range.from).length, String(range.to).length, 5);
    for (let value = from; value <= to; value += 1) {
      numbers.push(String(value).padStart(padLen, '0'));
    }
  }

  return numbers;
}
