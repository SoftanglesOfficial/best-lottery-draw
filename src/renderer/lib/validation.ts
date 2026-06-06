export const validators = {
  required: (value: unknown) => (!value ? 'This field is required' : null),
  minLength: (min: number) => (value: string) =>
    (value?.length ?? 0) < min ? `Minimum ${min} characters` : null,
  numeric: (value: string) => (Number.isNaN(Number(value)) ? 'Must be a number' : null),
  positiveNumber: (value: string) =>
    Number(value) <= 0 ? 'Must be greater than 0' : null,
  ticketNumber: (value: string) =>
    !/^\d{5}$/.test(value) ? 'Must be exactly 5 digits' : null,
};

type ValidatorFn = (value: unknown) => string | null;

export function validate(value: unknown, rules: ValidatorFn[]): string | null {
  for (const rule of rules) {
    const error = rule(value);
    if (error) return error;
  }
  return null;
}

export function parseMemoIds(input: string): number[] {
  const ids = new Set<number>();
  for (const part of input.split(',').map((s) => s.trim()).filter(Boolean)) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = Number(startStr);
      const end = Number(endStr);
      if (!Number.isNaN(start) && !Number.isNaN(end) && start <= end) {
        for (let i = start; i <= end; i += 1) ids.add(i);
      }
    } else {
      const n = Number(part);
      if (!Number.isNaN(n)) ids.add(n);
    }
  }
  return [...ids].sort((a, b) => a - b);
}
