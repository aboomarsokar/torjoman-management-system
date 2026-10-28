-- مخزونُ الملازم: يبقى سجلُّ الحركات كاملاً (خصمُ التسليم وإرجاعُه معاً) — الإرجاعُ بصافي ما خُصم للتسليم.
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

