-- مخزونُ الملازم: تاريخٌ لكلّ حركة (طلب المستخدم 2026-10-28) — يُختار عند التوريد والجرد ويُعدَّل بعدهما مع الملاحظة؛
-- وحركةُ التسليم تأخذ تاريخَ التسليم نفسه. والتعديلُ لا يمسّ العدد.

alter table public.booklet_stock_moves
  add column moved_on date not null default ((now() at time zone 'Asia/Gaza')::date);
update public.booklet_stock_moves m set moved_on = d.delivered_on
  from public.booklet_deliveries d where d.id = m.delivery_id;
alter table public.booklet_stock_moves
  add constraint booklet_stock_moves_from_project_start check (moved_on >= date '2026-10-01');

-- حركةُ التسليم بتاريخه
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
      insert into public.booklet_stock_moves (booklet, delta, balance_after, reason, delivery_id, halaqa_id, moved_on)
      values (new.booklet, -new.copies, s.quantity, 'delivery', new.id, new.halaqa_id, new.delivered_on);
    end if;
    return new;
  end if;
  return old;
end;
$$;
revoke all on function private.booklet_stock_on_delivery() from public, anon, authenticated;

-- التاريخُ: لا قبل بداية المشروع ولا في المستقبل
create or replace function private.valid_stock_date(p_day date)
returns date
language plpgsql stable
set search_path = ''
as $$
declare
  v_day date := coalesce(p_day, (now() at time zone 'Asia/Gaza')::date);
begin
  if v_day < date '2026-10-01' or v_day > (now() at time zone 'Asia/Gaza')::date then
    raise exception 'التاريخ لا يكون قبل 1/10/2026 ولا في المستقبل' using errcode = '22023';
  end if;
  return v_day;
end;
$$;
revoke all on function private.valid_stock_date(date) from public, anon, authenticated;

drop function public.set_booklet_stock(smallint, integer, integer, text);
create function public.set_booklet_stock(p_booklet smallint, p_quantity integer, p_alert_at integer, p_note text default null, p_moved_on date default null)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old integer;
  v_day date := private.valid_stock_date(p_moved_on);
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
    insert into public.booklet_stock_moves (booklet, delta, balance_after, reason, note, moved_on)
    values (p_booklet, p_quantity - coalesce(v_old, 0), p_quantity, 'count', left(nullif(btrim(p_note), ''), 300), v_day);
  end if;
  return p_quantity;
end;
$$;
revoke all on function public.set_booklet_stock(smallint, integer, integer, text, date) from public, anon;
grant execute on function public.set_booklet_stock(smallint, integer, integer, text, date) to authenticated;

drop function public.add_booklet_stock(smallint, integer, text);
create function public.add_booklet_stock(p_booklet smallint, p_copies integer, p_note text default null, p_moved_on date default null)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_qty integer;
  v_day date := private.valid_stock_date(p_moved_on);
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
  insert into public.booklet_stock_moves (booklet, delta, balance_after, reason, note, moved_on)
  values (p_booklet, p_copies, v_qty, 'supply', left(nullif(btrim(p_note), ''), 300), v_day);
  return v_qty;
end;
$$;
revoke all on function public.add_booklet_stock(smallint, integer, text, date) from public, anon;
grant execute on function public.add_booklet_stock(smallint, integer, text, date) to authenticated;

-- تعديلُ حركةٍ بعد حفظها: الملاحظةُ لكلّ حركة، والتاريخُ للتوريد والجرد (حركةُ التسليم تتبع تاريخَ التسليم)
drop function public.set_booklet_stock_move_note(uuid, text);
create function public.update_booklet_stock_move(p_move uuid, p_note text, p_moved_on date default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_reason text;
begin
  perform private.assert_session_writable();
  if not public.is_admin_manager() then
    raise exception 'المخزونُ للمدير الإداري' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) > 300 then
    raise exception 'الملاحظة لا تتجاوز 300 حرف' using errcode = '22023';
  end if;
  select reason into v_reason from public.booklet_stock_moves where id = p_move for update;
  if not found then
    raise exception 'الحركة غير موجودة' using errcode = '22023';
  end if;
  update public.booklet_stock_moves
     set note = nullif(btrim(coalesce(p_note, '')), ''),
         moved_on = case when p_moved_on is not null and v_reason in ('supply', 'count')
                         then private.valid_stock_date(p_moved_on) else moved_on end
   where id = p_move;
end;
$$;
revoke all on function public.update_booklet_stock_move(uuid, text, date) from public, anon;
grant execute on function public.update_booklet_stock_move(uuid, text, date) to authenticated;
