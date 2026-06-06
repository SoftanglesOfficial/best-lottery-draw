export const ROLES = {
  admin: 5,
  owner: 4,
  manager: 3,
  supervisor: 2,
  data_entry: 1,
} as const;

export function hasPermission(userRole: string, requiredRole: string): boolean {
  return (ROLES[userRole as keyof typeof ROLES] || 0) >= (ROLES[requiredRole as keyof typeof ROLES] || 0);
}

export function canDelete(role: string): boolean {
  return hasPermission(role, 'manager');
}

export function canViewPnL(role: string): boolean {
  return hasPermission(role, 'owner');
}

export function canUnlockDraw(role: string): boolean {
  return hasPermission(role, 'owner');
}

export function canModifyRates(role: string): boolean {
  return hasPermission(role, 'manager');
}
