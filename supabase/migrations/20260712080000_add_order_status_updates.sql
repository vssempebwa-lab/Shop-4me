alter table public.orders
  alter column status set default 'Dispatched to Doorstep';

create index if not exists idx_orders_status on public.orders(status);
