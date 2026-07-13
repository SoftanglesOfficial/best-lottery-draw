export function logIpcError(channel: string, error: unknown): void {
  const message = formatDbError(error);
  console.error(`[IPC ${channel}]`, message, error);
}

export function formatDbError(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause instanceof Error && cause.message) {
      return cause.message;
    }
    return error.message;
  }
  return String(error);
}
