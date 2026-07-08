-- 仕入れ還付管理 Version 2 Supabase initial schema
-- Run this file in the Supabase SQL Editor after creating the project.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('admin', 'staff', 'tax_accountant')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_date date not null,
  branch_id uuid references public.branches(id),
  channel_id uuid references public.channels(id),
  category_id uuid references public.categories(id),
  staff_id uuid references public.profiles(id),
  name text not null,
  manufacturer text,
  quantity integer not null default 1 check (quantity >= 1),
  item_price integer,
  shipping_fee_total integer not null default 0 check (shipping_fee_total >= 0),
  amount integer not null check (amount >= 0),
  destination text not null default 'undecided' check (destination in ('catawiki', 'ebay', 'both', 'undecided', 'other')),
  tax_rate integer not null default 10 check (tax_rate in (8, 10)),
  kind text not null check (kind in ('kobutsu', 'jun', 'other')),
  stock text not null check (stock in ('yes', 'no')),
  qualified text not null check (qualified in ('yes', 'no', 'unknown')),
  transaction_type text not null check (transaction_type in ('anon', 'named')),
  seller_name text,
  seller_address text,
  memo text,
  deduction_kind text,
  deduction_ratio numeric(5, 2),
  deduction_tax integer,
  classification_note text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.purchase_evidence (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  storage_bucket text not null default 'evidence',
  storage_path text not null unique,
  file_name text not null,
  label text,
  mime_type text not null,
  file_size bigint,
  sort_order integer not null default 0,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.monthly_packages (
  id uuid primary key default gen_random_uuid(),
  target_month date not null,
  storage_bucket text not null default 'tax-packages',
  storage_path text not null unique,
  file_name text not null,
  purchase_count integer not null default 0,
  total_amount integer not null default 0,
  total_deduction_tax integer not null default 0,
  generated_by uuid references public.profiles(id),
  generated_at timestamptz not null default now(),
  unique (target_month, storage_path)
);

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

create table if not exists public.audit_logs (
  id bigint primary key generated always as identity,
  actor_id uuid references public.profiles(id),
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_purchases_purchase_date on public.purchases(purchase_date);
create index if not exists idx_purchases_deleted_at on public.purchases(deleted_at);
create index if not exists idx_purchases_staff_id on public.purchases(staff_id);
create index if not exists idx_purchases_branch_id on public.purchases(branch_id);
create index if not exists idx_purchases_channel_id on public.purchases(channel_id);
create index if not exists idx_purchases_category_id on public.purchases(category_id);
create index if not exists idx_purchases_destination on public.purchases(destination);
create index if not exists idx_purchase_evidence_purchase_id on public.purchase_evidence(purchase_id);
create index if not exists idx_monthly_packages_target_month on public.monthly_packages(target_month);
create index if not exists idx_sales_purchase_id on public.sales(purchase_id);
create index if not exists idx_sales_destination on public.sales(destination);
create index if not exists idx_sales_status on public.sales(status);
create index if not exists idx_sales_sold_at on public.sales(sold_at);
create index if not exists idx_sales_deleted_at on public.sales(deleted_at);
create index if not exists idx_audit_logs_actor_id on public.audit_logs(actor_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists branches_set_updated_at on public.branches;
create trigger branches_set_updated_at
before update on public.branches
for each row execute function public.set_updated_at();

drop trigger if exists channels_set_updated_at on public.channels;
create trigger channels_set_updated_at
before update on public.channels
for each row execute function public.set_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists purchases_set_updated_at on public.purchases;
create trigger purchases_set_updated_at
before update on public.purchases
for each row execute function public.set_updated_at();

drop trigger if exists sales_set_updated_at on public.sales;
create trigger sales_set_updated_at
before update on public.sales
for each row execute function public.set_updated_at();

create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active = true
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_role() = 'admin'
$$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_role() in ('admin', 'staff')
$$;

create or replace function public.can_read_app_data()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_role() in ('admin', 'staff', 'tax_accountant')
$$;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.id <> auth.uid() then
    raise exception 'profile_update_forbidden';
  end if;

  if new.role <> old.role or new.is_active <> old.is_active then
    raise exception 'profile_role_update_forbidden';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_privilege_escalation on public.profiles;
create trigger profiles_prevent_privilege_escalation
before update on public.profiles
for each row execute function public.prevent_profile_privilege_escalation();

alter table public.profiles enable row level security;
alter table public.branches enable row level security;
alter table public.channels enable row level security;
alter table public.categories enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_evidence enable row level security;
alter table public.monthly_packages enable row level security;
alter table public.sales enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
on public.profiles
for select
using (public.is_admin() or id = auth.uid());

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
on public.profiles
for insert
with check (public.is_admin());

drop policy if exists "profiles_update_admin_or_self_name" on public.profiles;
create policy "profiles_update_admin_or_self_name"
on public.profiles
for update
using (public.is_admin() or id = auth.uid())
with check (public.is_admin() or id = auth.uid());

drop policy if exists "branches_select" on public.branches;
create policy "branches_select"
on public.branches
for select
using (public.can_read_app_data());

drop policy if exists "branches_select_public_master" on public.branches;
create policy "branches_select_public_master"
on public.branches
for select
to anon, authenticated
using (true);

drop policy if exists "branches_insert_admin" on public.branches;
create policy "branches_insert_admin"
on public.branches
for insert
with check (public.is_admin());

drop policy if exists "branches_update_admin" on public.branches;
create policy "branches_update_admin"
on public.branches
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "branches_delete_admin" on public.branches;
create policy "branches_delete_admin"
on public.branches
for delete
using (public.is_admin());

drop policy if exists "channels_select" on public.channels;
create policy "channels_select"
on public.channels
for select
using (public.can_read_app_data());

drop policy if exists "channels_select_public_master" on public.channels;
create policy "channels_select_public_master"
on public.channels
for select
to anon, authenticated
using (true);

drop policy if exists "channels_insert_admin" on public.channels;
create policy "channels_insert_admin"
on public.channels
for insert
with check (public.is_admin());

drop policy if exists "channels_update_admin" on public.channels;
create policy "channels_update_admin"
on public.channels
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "channels_delete_admin" on public.channels;
create policy "channels_delete_admin"
on public.channels
for delete
using (public.is_admin());

drop policy if exists "categories_select" on public.categories;
create policy "categories_select"
on public.categories
for select
using (public.can_read_app_data());

drop policy if exists "categories_select_public_master" on public.categories;
create policy "categories_select_public_master"
on public.categories
for select
to anon, authenticated
using (true);

drop policy if exists "categories_insert_admin" on public.categories;
create policy "categories_insert_admin"
on public.categories
for insert
with check (public.is_admin());

drop policy if exists "categories_update_admin" on public.categories;
create policy "categories_update_admin"
on public.categories
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "categories_delete_admin" on public.categories;
create policy "categories_delete_admin"
on public.categories
for delete
using (public.is_admin());

drop policy if exists "purchases_select" on public.purchases;
create policy "purchases_select"
on public.purchases
for select
using (
  public.is_admin()
  or (public.current_role() in ('staff', 'tax_accountant') and deleted_at is null)
);

drop policy if exists "purchases_insert_staff_admin" on public.purchases;
create policy "purchases_insert_staff_admin"
on public.purchases
for insert
with check (public.is_staff_or_admin());

drop policy if exists "purchases_update_staff_admin" on public.purchases;
create policy "purchases_update_staff_admin"
on public.purchases
for update
using (
  public.is_admin()
  or (public.current_role() = 'staff' and deleted_at is null)
)
with check (
  public.is_admin()
  or (public.current_role() = 'staff' and deleted_at is null)
);

drop policy if exists "purchases_delete_admin" on public.purchases;
create policy "purchases_delete_admin"
on public.purchases
for delete
using (public.is_admin());

drop policy if exists "purchase_evidence_select" on public.purchase_evidence;
create policy "purchase_evidence_select"
on public.purchase_evidence
for select
using (public.can_read_app_data());

drop policy if exists "purchase_evidence_insert_staff_admin" on public.purchase_evidence;
create policy "purchase_evidence_insert_staff_admin"
on public.purchase_evidence
for insert
with check (public.is_staff_or_admin());

drop policy if exists "purchase_evidence_update_staff_admin" on public.purchase_evidence;
create policy "purchase_evidence_update_staff_admin"
on public.purchase_evidence
for update
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

drop policy if exists "purchase_evidence_delete_admin" on public.purchase_evidence;
create policy "purchase_evidence_delete_admin"
on public.purchase_evidence
for delete
using (public.is_admin());

drop policy if exists "monthly_packages_select" on public.monthly_packages;
create policy "monthly_packages_select"
on public.monthly_packages
for select
using (public.can_read_app_data());

drop policy if exists "monthly_packages_insert_staff_admin" on public.monthly_packages;
create policy "monthly_packages_insert_staff_admin"
on public.monthly_packages
for insert
with check (public.is_staff_or_admin());

drop policy if exists "monthly_packages_update_admin" on public.monthly_packages;
create policy "monthly_packages_update_admin"
on public.monthly_packages
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "monthly_packages_delete_admin" on public.monthly_packages;
create policy "monthly_packages_delete_admin"
on public.monthly_packages
for delete
using (public.is_admin());

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

drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin"
on public.audit_logs
for select
using (public.is_admin());

drop policy if exists "audit_logs_insert_app_users" on public.audit_logs;
create policy "audit_logs_insert_app_users"
on public.audit_logs
for insert
with check (public.can_read_app_data());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('evidence', 'evidence', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('tax-packages', 'tax-packages', false, 104857600, array['application/zip', 'application/x-zip-compressed']),
  ('imports', 'imports', false, 104857600, array['application/json', 'text/csv', 'application/zip', 'application/x-zip-compressed'])
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storage_evidence_select" on storage.objects;
create policy "storage_evidence_select"
on storage.objects
for select
using (bucket_id = 'evidence' and public.can_read_app_data());

drop policy if exists "storage_evidence_insert" on storage.objects;
create policy "storage_evidence_insert"
on storage.objects
for insert
with check (bucket_id = 'evidence' and public.is_staff_or_admin());

drop policy if exists "storage_evidence_update" on storage.objects;
create policy "storage_evidence_update"
on storage.objects
for update
using (bucket_id = 'evidence' and public.is_staff_or_admin())
with check (bucket_id = 'evidence' and public.is_staff_or_admin());

drop policy if exists "storage_evidence_delete" on storage.objects;
create policy "storage_evidence_delete"
on storage.objects
for delete
using (bucket_id = 'evidence' and public.is_admin());

drop policy if exists "storage_tax_packages_select" on storage.objects;
create policy "storage_tax_packages_select"
on storage.objects
for select
using (bucket_id = 'tax-packages' and public.can_read_app_data());

drop policy if exists "storage_tax_packages_insert" on storage.objects;
create policy "storage_tax_packages_insert"
on storage.objects
for insert
with check (bucket_id = 'tax-packages' and public.is_staff_or_admin());

drop policy if exists "storage_tax_packages_update" on storage.objects;
create policy "storage_tax_packages_update"
on storage.objects
for update
using (bucket_id = 'tax-packages' and public.is_admin())
with check (bucket_id = 'tax-packages' and public.is_admin());

drop policy if exists "storage_tax_packages_delete" on storage.objects;
create policy "storage_tax_packages_delete"
on storage.objects
for delete
using (bucket_id = 'tax-packages' and public.is_admin());

drop policy if exists "storage_imports_select" on storage.objects;
create policy "storage_imports_select"
on storage.objects
for select
using (bucket_id = 'imports' and public.is_admin());

drop policy if exists "storage_imports_insert" on storage.objects;
create policy "storage_imports_insert"
on storage.objects
for insert
with check (bucket_id = 'imports' and public.is_admin());

drop policy if exists "storage_imports_delete" on storage.objects;
create policy "storage_imports_delete"
on storage.objects
for delete
using (bucket_id = 'imports' and public.is_admin());

insert into public.branches (name, sort_order)
values
  ('札幌', 10),
  ('千葉', 20),
  ('東京', 30),
  ('福岡', 40)
on conflict (name) do update set sort_order = excluded.sort_order;

insert into public.channels (name, sort_order)
values
  ('ヤフオク', 10),
  ('メルカリ', 20),
  ('ラクマ', 30),
  ('市場（古物市場）', 40),
  ('業者オークション', 50),
  ('店頭買取', 60),
  ('その他', 70)
on conflict (name) do update set sort_order = excluded.sort_order;

insert into public.categories (name, sort_order)
values
  ('時計', 10),
  ('バッグ', 20),
  ('貴金属・宝飾', 30),
  ('カメラ', 40),
  ('コイン・切手', 50),
  ('美術品・骨董', 60),
  ('道具類', 70),
  ('衣類', 80),
  ('その他', 90)
on conflict (name) do update set sort_order = excluded.sort_order;

-- Bootstrap note:
-- Create Auth users first, then insert the first admin profile with the service role
-- or from the Supabase SQL Editor:
--
-- insert into public.profiles (id, display_name, role)
-- values ('AUTH_USER_UUID_HERE', '管理者', 'admin');
