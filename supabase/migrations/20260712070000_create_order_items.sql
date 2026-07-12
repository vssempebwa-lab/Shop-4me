create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null,
  name text not null,
  price integer not null,
  unit text not null,
  quantity integer not null default 1,
  created_at timestamptz default now()
);

alter table public.order_items enable row level security;

drop policy if exists "anon_select_order_items" on public.order_items;
create policy "anon_select_order_items" on public.order_items
for select to anon, authenticated using (true);

drop policy if exists "anon_insert_order_items" on public.order_items;
create policy "anon_insert_order_items" on public.order_items
for insert to anon, authenticated with check (true);

drop policy if exists "anon_update_order_items" on public.order_items;
create policy "anon_update_order_items" on public.order_items
for update to anon, authenticated using (true) with check (true);

drop policy if exists "anon_delete_order_items" on public.order_items;
create policy "anon_delete_order_items" on public.order_items
for delete to anon, authenticated using (true);
