-- purchases.destination の許可値を現在のアプリ仕様に合わせる修正SQL
-- Supabase SQL Editor でそのまま実行してください。

begin;

-- 念のため、既存データに想定外の販売先が入っている場合は other に寄せます。
update public.purchases
set destination = 'other'
where destination is null
   or destination not in ('catawiki', 'ebay', 'overseas', 'yahoo', 'market', 'both', 'undecided', 'other');

-- 古い purchases_destination_check を削除して、現在のアプリで使う販売先をすべて許可します。
alter table public.purchases
  drop constraint if exists purchases_destination_check;

alter table public.purchases
  add constraint purchases_destination_check
  check (destination in ('catawiki', 'ebay', 'overseas', 'yahoo', 'market', 'both', 'undecided', 'other'));

commit;

-- 確認用: 許可値が反映されているか確認します。
select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.purchases'::regclass
  and conname = 'purchases_destination_check';
