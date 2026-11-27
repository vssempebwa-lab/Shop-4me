import { Loader2, Phone } from 'lucide-react';
import type { Outlet, UserRoleProfile } from '../types';
import UserAvatar from './UserAvatar';

interface AttendantProfileCardProps {
  attendant: UserRoleProfile | null;
  attendantError?: string | null;
  loading?: boolean;
  outlet: Outlet;
}

export default function AttendantProfileCard({
  attendant,
  loading = false,
  outlet,
}: AttendantProfileCardProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
        Loading active attendant...
      </div>
    );
  }

  if (!attendant) {
    return (
      <div className="rounded-2xl bg-gray-50 p-3">
        <p className="text-sm font-semibold text-gray-800">Your attendant will be assigned</p>
        <p className="mt-0.5 text-xs text-gray-500">
          The next available attendant at {outlet.hub_market || outlet.name} will shop for you and call if anything
          changes.
        </p>
      </div>
    );
  }

  const attendantName = attendant.full_name || attendant.email || 'Market Attendant';
  const attendantPhone = attendant.phone_number?.trim();

  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50 p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <UserAvatar user={attendant} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-extrabold text-gray-900">{attendantName}</p>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700">
              Active Attendant
            </span>
          </div>
          {attendantPhone ? (
            <a
              href={`tel:${attendantPhone.replace(/\s+/g, '')}`}
              className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:text-brand-800"
            >
              <Phone className="h-3.5 w-3.5" />
              {attendantPhone}
            </a>
          ) : (
            <p className="mt-1 text-xs font-medium text-gray-500">Phone number not available</p>
          )}
          <p className="mt-2 text-xs font-semibold text-gray-600">
            {(outlet.hub_market || outlet.name)} / {outlet.division}
          </p>
        </div>
      </div>
    </div>
  );
}
