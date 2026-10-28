-- مخزونُ الملازم: تعديلُ ملاحظة حركةٍ بعد حفظها (طلب المستخدم 2026-10-28) — للمدير الإداريّ، والعددُ لا يُمسّ.
create or replace function public.set_booklet_stock_move_note(p_move uuid, p_note text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.assert_session_writable();
  if not public.is_admin_manager() then
    raise exception 'المخزونُ للمدير الإداري' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) > 300 then
    raise exception 'الملاحظة لا تتجاوز 300 حرف' using errcode = '22023';
  end if;
  update public.booklet_stock_moves set note = nullif(btrim(coalesce(p_note, '')), '') where id = p_move;
  if not found then
    raise exception 'الحركة غير موجودة' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.set_booklet_stock_move_note(uuid, text) from public, anon;
grant execute on function public.set_booklet_stock_move_note(uuid, text) to authenticated;
