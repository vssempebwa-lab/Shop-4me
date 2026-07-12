create table if not exists admin_credentials (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

insert into admin_credentials (username, password_hash, role)
values ('admin', 'shop4me2026', 'admin')
on conflict (username) do nothing;

alter table admin_credentials enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_credentials'
      and policyname = 'allow_read_admin_credentials'
  ) then
    create policy "allow_read_admin_credentials"
      on public.admin_credentials
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_credentials'
      and policyname = 'allow_insert_admin_credentials'
  ) then
    create policy "allow_insert_admin_credentials"
      on public.admin_credentials
      for insert
      with check (true);
  end if;
end $$;
