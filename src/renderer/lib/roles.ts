import type { UserRole } from '../../shared/types';

const ROLE_RANK: Record<UserRole, number> = {
  data_entry: 0,
  supervisor: 1,
  manager: 2,
  owner: 3,
  admin: 4,
};

export function isAtLeastRole(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function isAdminOrOwner(role: UserRole): boolean {
  return role === 'admin' || role === 'owner';
}

export function canViewPnL(role: UserRole): boolean {
  return isAtLeastRole(role, 'owner');
}

export function canDeleteTransactions(role: UserRole): boolean {
  return isAtLeastRole(role, 'supervisor');
}

export function canUnlockDraw(role: UserRole): boolean {
  return isAdminOrOwner(role);
}

export function canModifyRates(role: UserRole): boolean {
  return isAtLeastRole(role, 'manager');
}

export const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-700',
  owner: 'bg-orange-100 text-orange-700',
  manager: 'bg-blue-100 text-blue-700',
  supervisor: 'bg-green-100 text-green-700',
  data_entry: 'bg-gray-100 text-gray-700',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  owner: 'Owner',
  manager: 'Manager',
  supervisor: 'Supervisor',
  data_entry: 'Data Entry',
};
