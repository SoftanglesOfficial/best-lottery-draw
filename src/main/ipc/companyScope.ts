export function requireCompanyId(
  companyId: number | null | undefined,
): { success: true; companyId: number } | { success: false; error: string } {
  if (companyId == null) {
    return { success: false, error: 'No active company selected.' };
  }
  return { success: true, companyId };
}
