import type { UserRoleProfile } from '../types';
import { getAvatarInitials, getAvatarTone } from '../lib/avatars';

interface UserAvatarProps {
  user: Pick<UserRoleProfile, 'full_name' | 'email' | 'avatar_url'>;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-14 w-14 text-sm',
};

export default function UserAvatar({ user, size = 'sm' }: UserAvatarProps) {
  const sizeClass = SIZE_CLASSES[size];
  const label = user.full_name || user.email || 'User';

  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={label}
        className={`${sizeClass} shrink-0 rounded-full border border-white bg-gray-50 object-contain object-center p-0.5 shadow-sm ring-1 ring-gray-100`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} inline-grid shrink-0 place-items-center rounded-full border font-extrabold shadow-sm ${getAvatarTone(user)}`}
      aria-label={label}
    >
      {getAvatarInitials(user)}
    </span>
  );
}
