import type { UserRoleProfile } from '../types';

const AVATAR_COLORS = [
  'bg-brand-100 text-brand-800 border-brand-200',
  'bg-gold-100 text-gold-800 border-gold-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-sky-100 text-sky-800 border-sky-200',
  'bg-rose-100 text-rose-800 border-rose-200',
];

export function getAvatarInitials(user: Pick<UserRoleProfile, 'full_name' | 'email'>) {
  const source = user.full_name?.trim() || user.email?.split('@')[0] || 'User';
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function getAvatarTone(user: Pick<UserRoleProfile, 'full_name' | 'email'>) {
  const source = `${user.full_name ?? ''}${user.email ?? ''}`;
  const sum = source.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export function renderAvatar(user: UserRoleProfile, sizeClass = 'h-8 w-8') {
  if (user.avatar_url) {
    return `<img src="${escapeHtml(user.avatar_url)}" alt="${escapeHtml(user.full_name || user.email || 'User')}" class="${escapeHtml(sizeClass)} shrink-0 rounded-full border border-white bg-gray-50 object-contain object-center p-0.5 shadow-sm" />`;
  }

  return `<span class="${escapeHtml(sizeClass)} inline-grid place-items-center rounded-full border text-xs font-extrabold ${getAvatarTone(user)}">${escapeHtml(getAvatarInitials(user))}</span>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char] ?? char;
  });
}
