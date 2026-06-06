export async function safeInvoke<T>(
  promise: Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = await promise;
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    if (message.includes('No handler registered')) {
      return {
        ok: false,
        error: 'App needs a restart. Press Ctrl+C, then run npm start again (or type rs in the terminal).',
      };
    }
    return { ok: false, error: message };
  }
}
