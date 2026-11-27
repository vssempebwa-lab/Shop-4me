# Admin and Market Attendant Workflow

## File Structure

- `src/components/MerchantDashboard.tsx`
  - Admin pending queue, share-to-outlet modal, outlet performance, audit log, account management, attendant outlet queue, rider dispatch, and paid/delivered actions.
- `src/components/AttendantWorkspace.tsx`
  - Dedicated Market Attendant workspace for `/attendant/workspace`, with localized queue, attendant identity/session header, status stepper, paid delivery confirmation, and rider dispatch.
- `src/components/AvatarUploader.tsx`
  - Reusable circular avatar picker with drag-and-drop, browse, live preview, remove/replace, type/size validation, and client-side resizing.
- `src/components/UserAvatar.tsx` and `src/lib/avatars.ts`
  - Shared avatar rendering helpers for uploaded photos and initials-based fallbacks.
- `src/hooks/useAuth.ts`
  - Loads `user_roles` metadata, including `assigned_outlet`, `is_active`, `is_approved`, and touches `last_login_at`.
- `src/types.ts`
  - Shared TypeScript models for orders, outlets, riders, user role profiles, and audit logs.
- `netlify/functions/admin-users.js`
  - Server-side Supabase Auth Admin API wrapper for creating admin/attendant accounts, deactivating access, and resetting passwords.
- `supabase/migrations/20260730143000_depot_attendant_admin_workflow.sql`
  - Historical SQL schema additions, seed data, RLS policies, and realtime publication enrollment.
- `supabase/migrations/20260730210000_rename_depot_to_outlet.sql`
  - Safe Outlet rename migration for existing databases; renames tables/columns/functions/policies without dropping data.
- `supabase/migrations/20260730172000_add_user_avatars.sql`
  - Adds `user_roles.avatar_url` and creates the public-read, authenticated-write `avatars` Supabase Storage bucket.

## Outlet Source of Truth

Outlet data lives in Supabase (`public.outlets`), not a static frontend array.
That is the right fit for SFM because attendants, riders, order routing, audit views, and outlet performance all need relationally valid outlet codes. The frontend loads active outlet records once and reuses shared helpers from `src/lib/outlets.ts` for labels and matching.

Official Kampala outlet seed:

Decision note: SFM still stores and displays existing outlet code values such as `DEPOT-KAW-01`.
Those are real identifiers in existing order/user records and should only become `OUTLET-KAW-01` through a deliberate value migration.

| Division | Hub Market | Outlet Code | Distribution Range |
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
  - `is_shared_with_outlet`
  - `outlet_code`
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
  - `assigned_outlet`
  - `is_active`
  - `invited_by`
  - `last_login_at`
  - `deactivated_at`
  - `updated_at`
- `outlets`
  - Outlet reference records keyed by `outlet_code`, including `hub_market` and `distribution_areas`.
- `outlet_riders`
  - Boda-boda rider contacts per outlet.
- `admin_audit_logs`
  - Admin/attendant actions with actor, target, metadata, and timestamp.

## RLS Summary

- Clients can select only their own orders.
- Attendants can select/update only shared orders assigned to their `assigned_outlet`.
- Admins can select/update/delete all orders.
- `order_items` policies mirror the parent order access.
- Active outlet records are public-readable so checkout can populate outlet selectors.
- Customer and guest order inserts are repriced from `products` by a trigger; status, payment and outlet-sharing fields are reset so only staff can set them (`20261127120000_enforce_order_integrity.sql`).
- Final bills (`final_items`, `final_total`, `bill_status`) are computed by the `orders_compute_final_bill` trigger; customers approve or query through the `respond_to_final_bill` RPC (`20261127100000_add_final_bill_flow.sql`).
- Admin-only data such as audit logs and account management records is restricted to active approved admins.
- New admin/attendant accounts are created through the Netlify function with the Supabase service role key kept server-side.
- Attendant status and rider-dispatch actions write `attendant_name`, `attendant_user_id`, and `outlet_code` into `admin_audit_logs.metadata`, so the Admin Audit tab can trace who handled each order.
- Account avatars are stored in the dedicated `avatars` Storage bucket and referenced by `user_roles.avatar_url`. Tables, audit rows, and the attendant session header all use the same avatar helper, falling back to initials when no uploaded image exists.

## Avatar Storage

Run `supabase/migrations/20260730172000_add_user_avatars.sql` to set up profile pictures:

- Bucket: `avatars`
- Max file size: 2MB
- Allowed types: `image/jpeg`, `image/png`, `image/webp`
- Read policy: public read for avatar display
- Write policy: admins, or the signed-in user in their own `{user_id}/` folder

The account form compresses selected images before upload and stores them at `avatars/{user_id}/profile.{jpg|png|webp}`. In the local dev free-access mode (`npm run dev:admin` / `dev:attendant`, see below), avatars are stored locally as resized data URLs because there is no authenticated Storage session.

## Netlify Environment Variables

Set these in Netlify before using account management:

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Do **not** set `SFM_ALLOW_FREE_ADMIN_ACCESS` on Netlify. The no-login bypass
header is only honoured under `netlify dev` (`NETLIFY_DEV=true`), so on a
deployed site the flag has no effect, and staff must sign in with a real
Supabase account. Create the first admin with `npm run create-admin`.

## Local dev free-access workspaces

`npm run dev:admin` (port 5176) and `npm run dev:attendant` (port 5174) open
pre-filled local workspaces for testing without a Supabase login. They exist
only in `vite dev`: production builds strip the credentials, and `/admin`,
`/merchant` and `/attendant` go through real Supabase auth.

The frontend should continue using only:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Realtime

The dashboard subscribes to `public.orders` changes through `merchant-dashboard-orders`.
The migration adds `public.orders` to `supabase_realtime` if it is not already present, so changes to `order_status`, `payment_status`, and `is_shared_with_outlet` refresh both Admin and Attendant views live.
