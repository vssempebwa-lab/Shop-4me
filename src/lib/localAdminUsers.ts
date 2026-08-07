import type { UserRoleProfile } from '../types';

export const LOCAL_ADMIN_USERS_KEY = 'sfm-local-admin-users';
const SHARED_LOCAL_ADMIN_USERS_ENDPOINT = '/local-api/admin-users';

export function readLocalAdminUsers() {
  try {
    const users = JSON.parse(window.localStorage.getItem(LOCAL_ADMIN_USERS_KEY) || '[]') as Array<
      UserRoleProfile & { assigned_depot?: string | null }
    >;

    return users.map(({ assigned_depot, ...user }) => ({
      ...user,
      assigned_outlet: user.assigned_outlet ?? assigned_depot ?? null,
    }));
  } catch {
    return [];
  }
}

export function writeLocalAdminUser(user: UserRoleProfile) {
  const users = readLocalAdminUsers();
  const nextUsers = mergeLocalAdminUsers([user, ...users]);
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

export async function readSharedLocalAdminUsers() {
  const localUsers = readLocalAdminUsers();

  try {
    const response = await fetch(SHARED_LOCAL_ADMIN_USERS_ENDPOINT);
    if (!response.ok) return localUsers;

    const payload = (await response.json()) as { users?: UserRoleProfile[] };
    const sharedUsers = payload.users ?? [];
    const sharedUserIds = new Set(sharedUsers.map((user) => user.user_id));
    const missingLocalUsers = localUsers.filter((user) => !sharedUserIds.has(user.user_id));
    const users = mergeLocalAdminUsers([...sharedUsers, ...localUsers]);

    await Promise.all(
      missingLocalUsers.map((user) =>
        fetch(SHARED_LOCAL_ADMIN_USERS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user }),
        }).catch(() => null),
      ),
    );

    window.localStorage.setItem(LOCAL_ADMIN_USERS_KEY, JSON.stringify(users));
    return users;
  } catch {
    return localUsers;
  }
}

export async function writeSharedLocalAdminUser(user: UserRoleProfile) {
  const localUsers = writeLocalAdminUser(user);

  try {
    const response = await fetch(SHARED_LOCAL_ADMIN_USERS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user }),
    });
    if (!response.ok) return localUsers;

    const payload = (await response.json()) as { users?: UserRoleProfile[] };
    const users = mergeLocalAdminUsers([...(payload.users ?? []), ...localUsers]);
    window.localStorage.setItem(LOCAL_ADMIN_USERS_KEY, JSON.stringify(users));
    return users;
  } catch {
    return localUsers;
  }
}

export async function updateSharedLocalAdminUser(
  userId: string,
  patch: Partial<UserRoleProfile>,
) {
  const localUsers = updateLocalAdminUser(userId, patch);

  try {
    const response = await fetch(SHARED_LOCAL_ADMIN_USERS_ENDPOINT, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, patch }),
    });
    if (!response.ok) return localUsers;

    const payload = (await response.json()) as { users?: UserRoleProfile[] };
    const users = mergeLocalAdminUsers([...(payload.users ?? []), ...localUsers]);
    window.localStorage.setItem(LOCAL_ADMIN_USERS_KEY, JSON.stringify(users));
    return users;
  } catch {
    return localUsers;
  }
}

export function getLatestLocalAttendant() {
  return readLocalAdminUsers().find(
    (user) => user.role === 'attendant' && user.is_active !== false,
  );
}

function mergeLocalAdminUsers(users: UserRoleProfile[]) {
  const byUserId = new Map<string, UserRoleProfile>();

  for (const user of users) {
    byUserId.set(user.user_id, user);
  }

  return Array.from(byUserId.values()).sort((a, b) =>
    String(b.created_at || '').localeCompare(String(a.created_at || '')),
  );
}
