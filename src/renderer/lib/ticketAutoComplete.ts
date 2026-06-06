const TICKET_LENGTH = 5;

export type AutoCompleteOptions = {
  /** Pad with leading zeros when there is no valid previous ticket (Enter/blur only). */
  padShort?: boolean;
};

export function autoCompleteTicket(
  previousTicket: string,
  input: string,
  length = TICKET_LENGTH,
  options: AutoCompleteOptions = {},
): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= length) return digits.slice(0, length);

  if (!previousTicket || previousTicket.length !== length || !/^\d+$/.test(previousTicket)) {
    return options.padShort ? digits.padStart(length, '0') : digits;
  }

  const prefixLen = length - digits.length;
  return `${previousTicket.slice(0, prefixLen)}${digits}`;
}

export function isValidTicketNumber(value: string, length = TICKET_LENGTH): boolean {
  return new RegExp(`^\\d{${length}}$`).test(value);
}

export function sanitizeTicketInput(value: string, maxLength = TICKET_LENGTH): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

export const TICKET_NUMBER_LENGTH = TICKET_LENGTH;
