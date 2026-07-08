-- Sales dashboard extension for existing Supabase projects.
-- Run this in the Supabase SQL Editor after the initial schema has been applied.

alter table public.purchases
  add column if not exists manufacturer text,
  add column if not exists item_price integer,
  add column if not exists shipping_fee_total integer not null default 0,
  add column if not exists destination text not null default 'undecided';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchases_shipping_fee_total_check'
      and conrelid = 'public.purchases'::regclass
  ) then
    alter table public.purchases
      add constraint purchases_shipping_fee_total_check check (shipping_fee_total >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchases_destination_check'
      and conrelid = 'public.purchases'::regclass
  ) then
    alter table public.purchases
      add constraint purchases_destination_check check (destination in ('catawiki', 'ebay', 'both', 'undecided', 'other'));
  end if;
end;
$$;

update public.purchases
set item_price = amount
where item_price is null;

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  destination text not null check (destination in ('catawiki', 'ebay', 'other')),
  status text not null default 'not_listed'
    check (status in ('not_listed', 'preparing', 'listed', 'sold', 'cancelled', 'returned', 'on_hold')),
  listing_id text,
  sku text,
  listed_at date,
  sold_at date,
  sale_price integer not null default 0 check (sale_price >= 0),
  currency text not null default 'JPY',
  exchange_rate numeric(12, 4),
  sale_price_jpy integer,
  platform_fee integer not null default 0 check (platform_fee >= 0),
  payment_fee integer not null default 0 check (payment_fee >= 0),
  domestic_shipping_fee integer not null default 0 check (domestic_shipping_fee >= 0),
  international_shipping_fee integer not null default 0 check (international_shipping_fee >= 0),
  other_fee integer not null default 0 check (other_fee >= 0),
  buyer_country text,
  memo text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_purchases_destination on public.purchases(destination);
create index if not exists idx_sales_purchase_id on public.sales(purchase_id);
create index if not exists idx_sales_destination on public.sales(destination);
create index if not exists idx_sales_status on public.sales(status);
create index if not exists idx_sales_sold_at on public.sales(sold_at);
create index if not exists idx_sales_deleted_at on public.sales(deleted_at);

drop trigger if exists sales_set_updated_at on public.sales;
create trigger sales_set_updated_at
before update on public.sales
for each row execute function public.set_updated_at();

alter table public.sales enable row level security;

drop policy if exists "sales_select_staff_admin" on public.sales;
create policy "sales_select_staff_admin"
on public.sales
for select
using (
  public.current_role() in ('admin', 'staff')
  and deleted_at is null
);

drop policy if exists "sales_insert_staff_admin" on public.sales;
create policy "sales_insert_staff_admin"
on public.sales
for insert
with check (public.is_staff_or_admin());

drop policy if exists "sales_update_staff_admin" on public.sales;
create policy "sales_update_staff_admin"
on public.sales
for update
using (
  public.is_admin()
  or (public.current_role() = 'staff' and deleted_at is null)
)
with check (
  public.is_admin()
  or (public.current_role() = 'staff' and deleted_at is null)
);

drop policy if exists "sales_delete_admin" on public.sales;
create policy "sales_delete_admin"
on public.sales
for delete
using (public.is_admin());
