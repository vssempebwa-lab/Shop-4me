import type { UserRoleProfile } from '../types';

export const LOCAL_ADMIN_USERS_KEY = 'sfm-local-admin-users';

export function readLocalAdminUsers() {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_ADMIN_USERS_KEY) || '[]') as UserRoleProfile[];
  } catch {
    return [];
  }
}

export function writeLocalAdminUser(user: UserRoleProfile) {
  const users = readLocalAdminUsers();
  const nextUsers = [user, ...users];
  window.localStorage.setItem(LOCAL_ADMIN_USERS_KEY, JSON.stringify(nextUsers));
  return nextUsers;
}

export function updateLocalAdminUser(userId: string, patch: Partial<UserRoleProfile>) {
  const users = readLocalAdminUsers();
  const nextUsers = users.map((user) =>
    user.user_id === userId
      ? {
          ...user,
          ...patch,
        }
      : user,
  );
  window.localStorage.setItem(LOCAL_ADMIN_USERS_KEY, JSON.stringify(nextUsers));
  return nextUsers;
}

export function getLatestLocalAttendant() {
  return readLocalAdminUsers().find(
    (user) => user.role === 'attendant' && user.is_active !== false,
  );
}
