-- طلبُ الملازم يصل للمدير الإداريّ وحده — لا المديرة الإدارية ولا المدير الفنيّ (طلب المستخدم 2026-10-25).
create or replace function private.notify_booklet_requested()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  h record;
  v_teacher text;
  v_admin uuid;
begin
  select name, gender into h from public.halaqat where id = new.halaqa_id;
  select full_name into v_teacher from public.profiles where id = new.requested_by;
  for v_admin in select id from public.profiles where role = 'admin_manager' and status = 'active' loop
    perform private.notify(
      v_admin, 'booklet_requested',
      case when h.gender = 'female' then 'طلبت معلّمةٌ ملازم' else 'طلب معلّمٌ ملازم' end,
      coalesce(v_teacher, '—') || ' · ' || h.name || ' · الجزء ' || (31 - 2 * new.booklet) || ' + ' || (32 - 2 * new.booklet)
        || ' × ' || new.copies || coalesce(' · ' || nullif(btrim(new.note), ''), ''),
      '/booklets?view=requests', 'booklet_requests', new.id);
  end loop;
  return null;
end;
$$;
revoke all on function private.notify_booklet_requested() from public, anon, authenticated;
