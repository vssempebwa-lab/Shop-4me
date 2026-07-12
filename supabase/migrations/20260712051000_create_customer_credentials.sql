create table if not exists customer_credentials (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

insert into customer_credentials (full_name, email, password_hash)
values ('Demo Customer', 'customer@shop4me.com', 'shop4me2026')
on conflict (email) do nothing;

alter table customer_credentials enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_credentials'
      and policyname = 'allow_read_customer_credentials'
  ) then
    create policy "allow_read_customer_credentials"
      on public.customer_credentials
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_credentials'
      and policyname = 'allow_insert_customer_credentials'
  ) then
    create policy "allow_insert_customer_credentials"
      on public.customer_credentials
      for insert
      with check (true);
  end if;
end $$;
