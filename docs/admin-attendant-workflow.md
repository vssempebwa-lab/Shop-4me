# Admin and Market Attendant Workflow

## File Structure

- `src/components/MerchantDashboard.tsx`
  - Admin pending queue, share-to-depot modal, depot performance, audit log, account management, attendant depot queue, rider dispatch, and paid/delivered actions.
- `src/components/AttendantWorkspace.tsx`
  - Dedicated Market Attendant workspace for `/attendant/workspace`, with localized queue, attendant identity/session header, status stepper, paid delivery confirmation, and rider dispatch.
- `src/components/AvatarUploader.tsx`
  - Reusable circular avatar picker with drag-and-drop, browse, live preview, remove/replace, type/size validation, and client-side resizing.
- `src/components/UserAvatar.tsx` and `src/lib/avatars.ts`
  - Shared avatar rendering helpers for uploaded photos and initials-based fallbacks.
- `src/hooks/useAuth.ts`
  - Loads `user_roles` metadata, including `assigned_depot`, `is_active`, `is_approved`, and touches `last_login_at`.
- `src/types.ts`
  - Shared TypeScript models for orders, depots, riders, user role profiles, and audit logs.
- `netlify/functions/admin-users.js`
  - Server-side Supabase Auth Admin API wrapper for creating admin/attendant accounts, deactivating access, and resetting passwords.
- `supabase/migrations/20260730143000_depot_attendant_admin_workflow.sql`
  - SQL schema additions, RLS policies, helper functions, seed depots/riders, audit table, and realtime publication enrollment.
- `supabase/migrations/20260730172000_add_user_avatars.sql`
  - Adds `user_roles.avatar_url` and creates the public-read, authenticated-write `avatars` Supabase Storage bucket.

## Depot Source of Truth

Depot data lives in Supabase (`public.depots`), not a static frontend array.
That is the right fit for SFM because attendants, riders, order routing, audit views, and depot performance all need relationally valid depot codes. The frontend loads active depot records once and reuses shared helpers from `src/lib/depots.ts` for labels and matching.

Official Kampala depot seed:

| Division | Hub Market | Depot Code | Distribution Range |
| --- | --- | --- | --- |
| Kawempe Division | Kalerwe Market | `DEPOT-KAW-01` | Kawempe, Mpererwe, Komamboga, Kisaasi |
| Nakawa Division | Nakawa Market | `DEPOT-NAK-02` | Nakawa, Bugolobi, Luzira, Ntinda, Naguru |
| Kampala Central | Nakasero Market | `DEPOT-CEN-03` | Kololo, Nakasero, Kamwokya, Old Kampala |
| Makindye Division | Kibuye Market | `DEPOT-MAK-04` | Kibuye, Katwe, Kansanga, Kabalagala, Ggaba |
| Rubaga Division | Mengo Market | `DEPOT-RUB-05` | Mengo, Lungujja, Rubaga, Kasubi, Ndeeba |

## Added Supabase Tables and Columns

- `orders`
  - `order_status`
  - `payment_status`
  - `is_shared_with_depot`
  - `depot_code`
  - `division`
  - `shared_at`
  - `shared_by`
  - `dispatched_rider_id`
  - `dispatched_rider_name`
  - `dispatched_at`
  - `handled_by_attendant_id`
  - `handled_by_attendant_name`
  - `delivered_at`
- `user_roles`
  - `email`
  - `full_name`
  - `avatar_url`
  - `assigned_depot`
  - `is_active`
  - `invited_by`
  - `last_login_at`
  - `deactivated_at`
  - `updated_at`
- `depots`
  - Depot reference records keyed by `depot_code`, including `hub_market` and `distribution_areas`.
- `depot_riders`
  - Boda-boda rider contacts per depot.
- `admin_audit_logs`
  - Admin/attendant actions with actor, target, metadata, and timestamp.

## RLS Summary

- Clients can select only their own orders.
- Attendants can select/update only shared orders assigned to their `assigned_depot`.
- Admins can select/update/delete all orders.
- `order_items` policies mirror the parent order access.
- Active depot records are public-readable so checkout and temporary free-access dashboard flows can populate depot selectors.
- Admin-only data such as audit logs and account management records is restricted to active approved admins.
- New admin/attendant accounts are created through the Netlify function with the Supabase service role key kept server-side.
- Attendant status and rider-dispatch actions write `attendant_name`, `attendant_user_id`, and `depot_code` into `admin_audit_logs.metadata`, so the Admin Audit tab can trace who handled each order.
- Account avatars are stored in the dedicated `avatars` Storage bucket and referenced by `user_roles.avatar_url`. Tables, audit rows, and the attendant session header all use the same avatar helper, falling back to initials when no uploaded image exists.

## Avatar Storage

Run `supabase/migrations/20260730172000_add_user_avatars.sql` to set up profile pictures:

- Bucket: `avatars`
- Max file size: 2MB
- Allowed types: `image/jpeg`, `image/png`, `image/webp`
- Read policy: public read for avatar display
- Write policy: authenticated users only

The account form compresses selected images before upload and stores them at `avatars/{user_id}/profile.{jpg|png|webp}`. In the temporary free-access mode, avatars are stored locally as resized data URLs because there is no authenticated Storage session.

## Netlify Environment Variables

Set these in Netlify before using account management:

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

For the current temporary no-login dashboard mode, also set:

```text
SFM_ALLOW_FREE_ADMIN_ACCESS=true
```

Remove that flag when you re-enable proper admin login.

The frontend should continue using only:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Realtime

The dashboard subscribes to `public.orders` changes through `merchant-dashboard-orders`.
The migration adds `public.orders` to `supabase_realtime` if it is not already present, so changes to `order_status`, `payment_status`, and `is_shared_with_depot` refresh both Admin and Attendant views live.
