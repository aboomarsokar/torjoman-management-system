-- مخزونُ الملازم (طلب المستخدم 2026-10-28): رصيدٌ لكلّ ملزمةٍ (1..15) يُدخله المديرُ الإداريّ (جردٌ أوّل) ويضيف إليه
-- كلّما وصلت طبعة، ويُخصم تلقائياً مع كلّ تسليمٍ في `booklet_deliveries` (مباشرةً أو من طلب معلّم) ويعود عند حذفه.
-- التسليمُ يُرفض إن لم يكفِ الرصيد. وحدُّ تنبيهٍ لكلّ ملزمة يظهر في الواجهة (لا إشعار: لا يُشعَر أحدٌ بفعله).
-- ملزمةٌ لم يُدخَل رصيدُها بعدُ لا تُتتبَّع (لا خصمَ ولا منع) — فالتسليماتُ السابقة لا تُمسّ.

create table public.booklet_stock (
  booklet     smallint primary key check (booklet between 1 and 15),
  quantity    integer not null default 0 check (quantity >= 0),
  alert_at    integer not null default 20 check (alert_at between 0 and 10000),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

create table public.booklet_stock_moves (
  id             uuid primary key default gen_random_uuid(),
  booklet        smallint not null check (booklet between 1 and 15),
  delta          integer not null,
  balance_after  integer not null,
  reason         text not null check (reason in ('count', 'supply', 'delivery', 'delivery_removed')),
  -- بلا مفتاحٍ أجنبيّ: التسليمُ المحذوف يبقى أثرُه في السجلّ
  delivery_id    uuid,
  halaqa_id      uuid references public.halaqat(id) on delete set null,
  note           text check (note is null or char_length(note) <= 300),
  created_by     uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index booklet_stock_moves_booklet_idx on public.booklet_stock_moves (booklet, created_at desc);

alter table public.booklet_stock enable row level security;
create policy booklet_stock_select on public.booklet_stock for select to authenticated
  using ((select public.current_user_role()) in ('admin_manager', 'project_supervisor'));
grant select on public.booklet_stock to authenticated;
select private.guard_table_for_impersonation('public.booklet_stock');

alter table public.booklet_stock_moves enable row level security;
create policy booklet_stock_moves_select on public.booklet_stock_moves for select to authenticated
  using ((select public.current_user_role()) in ('admin_manager', 'project_supervisor'));
grant select on public.booklet_stock_moves to authenticated;
select private.guard_table_for_impersonation('public.booklet_stock_moves');

-- «الجزء 29 + 30» من رقم الملزمة
create or replace function private.booklet_label(p_booklet smallint)
returns text
language sql immutable
set search_path = ''
as $$
  select 'الجزء ' || (31 - 2 * p_booklet) || ' + ' || (32 - 2 * p_booklet)
$$;
revoke all on function private.booklet_label(smallint) from public, anon, authenticated;

-- الخصمُ والإرجاع مع التسليم (إدراجاً وحذفاً وتعديلاً للملزمة أو النسخ)
create or replace function private.booklet_stock_on_delivery()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  s public.booklet_stock%rowtype;
  v_out integer;
begin
  if tg_op in ('DELETE', 'UPDATE') then
    -- يعود صافي ما خُصم لهذا التسليم ولم يرجع بعد (تسليمٌ قبل تتبّع ملزمته لم يُخصم فلا يعود)، والسجلُّ يبقى كاملاً
    select coalesce(-sum(delta), 0) into v_out from public.booklet_stock_moves where delivery_id = old.id;
    if v_out > 0 then
      update public.booklet_stock set quantity = quantity + v_out, updated_at = now()
       where booklet = old.booklet returning * into s;
      if found then
        insert into public.booklet_stock_moves (booklet, delta, balance_after, reason, delivery_id, halaqa_id, note)
        values (old.booklet, v_out, s.quantity, 'delivery_removed', old.id, old.halaqa_id,
                case when tg_op = 'DELETE' then 'حُذف التسليم' else 'عُدِّل التسليم' end);
      end if;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select * into s from public.booklet_stock where booklet = new.booklet for update;
    if found then
      if s.quantity < new.copies then
        raise exception 'رصيد ملزمة % لا يكفي: المتبقّي % نسخة والمطلوب %. أضف نسخاً في «المخزون» أولاً.',
          private.booklet_label(new.booklet), s.quantity, new.copies using errcode = '22023';
      end if;
      update public.booklet_stock set quantity = quantity - new.copies, updated_at = now()
       where booklet = new.booklet returning * into s;
      insert into public.booklet_stock_moves (booklet, delta, balance_after, reason, delivery_id, halaqa_id)
      values (new.booklet, -new.copies, s.quantity, 'delivery', new.id, new.halaqa_id);
    end if;
    return new;
  end if;
  return old;
end;
$$;
revoke all on function private.booklet_stock_on_delivery() from public, anon, authenticated;

create trigger booklet_deliveries_stock
  after insert or delete or update of booklet, copies on public.booklet_deliveries
  for each row execute function private.booklet_stock_on_delivery();

-- جردٌ: يضبط الرصيدَ على العدد الفعليّ (وأوّلُه يبدأ تتبّعَ الملزمة) ومعه حدُّ التنبيه
create or replace function public.set_booklet_stock(p_booklet smallint, p_quantity integer, p_alert_at integer, p_note text default null)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old integer;
begin
  perform private.assert_session_writable();
  if not public.is_admin_manager() then
    raise exception 'المخزونُ للمدير الإداري' using errcode = '42501';
  end if;
  if p_booklet is null or p_booklet not between 1 and 15 then
    raise exception 'رقم الملزمة غير صحيح' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity not between 0 and 100000 or p_alert_at is null or p_alert_at not between 0 and 10000 then
    raise exception 'العدد أو حدّ التنبيه غير صحيح' using errcode = '22023';
  end if;
  select quantity into v_old from public.booklet_stock where booklet = p_booklet for update;
  insert into public.booklet_stock (booklet, quantity, alert_at, updated_at, updated_by)
  values (p_booklet, p_quantity, p_alert_at, now(), auth.uid())
  on conflict (booklet) do update
    set quantity = excluded.quantity, alert_at = excluded.alert_at, updated_at = now(), updated_by = auth.uid();
  if v_old is distinct from p_quantity then
    insert into public.booklet_stock_moves (booklet, delta, balance_after, reason, note)
    values (p_booklet, p_quantity - coalesce(v_old, 0), p_quantity, 'count', left(nullif(btrim(p_note), ''), 300));
  end if;
  return p_quantity;
end;
$$;
revoke all on function public.set_booklet_stock(smallint, integer, integer, text) from public, anon;
grant execute on function public.set_booklet_stock(smallint, integer, integer, text) to authenticated;

-- توريدٌ: نسخٌ وصلت تُضاف إلى الرصيد (ويبدأ التتبّعُ إن لم يكن)
create or replace function public.add_booklet_stock(p_booklet smallint, p_copies integer, p_note text default null)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_qty integer;
begin
  perform private.assert_session_writable();
  if not public.is_admin_manager() then
    raise exception 'المخزونُ للمدير الإداري' using errcode = '42501';
  end if;
  if p_booklet is null or p_booklet not between 1 and 15 or p_copies is null or p_copies not between 1 and 100000 then
    raise exception 'الملزمة أو عدد النسخ غير صحيح' using errcode = '22023';
  end if;
  insert into public.booklet_stock (booklet, quantity, updated_at, updated_by)
  values (p_booklet, p_copies, now(), auth.uid())
  on conflict (booklet) do update
    set quantity = public.booklet_stock.quantity + excluded.quantity, updated_at = now(), updated_by = auth.uid()
  returning quantity into v_qty;
  insert into public.booklet_stock_moves (booklet, delta, balance_after, reason, note)
  values (p_booklet, p_copies, v_qty, 'supply', left(nullif(btrim(p_note), ''), 300));
  return v_qty;
end;
$$;
revoke all on function public.add_booklet_stock(smallint, integer, text) from public, anon;
grant execute on function public.add_booklet_stock(smallint, integer, text) to authenticated;
