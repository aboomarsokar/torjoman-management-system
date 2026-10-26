-- مستلمو إشعارَين (طلب المستخدم 2026-10-25):
-- (١) تغييرُ المعلم موعدَ حلقته ← مشرفُ الحلقة، والمديرُ الفنيّ (البنين) والمديرةُ الإدارية (البنات) — لا المديرُ الإداريّ.
-- (٢) طلبُ الملازم ← المديرُ الإداريّ، والمديرةُ الإدارية لطلبات حلقات البنات — لا المديرُ الفنيّ.

create or replace function public.set_my_halaqa_time(p_halaqa uuid, p_time time)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  h record;
  v_female boolean;
  v_rcpt uuid;
begin
  perform private.assert_session_writable();
  if p_time is null then
    raise exception 'اختر موعدَ الحلقة.' using errcode = '22004';
  end if;
  select id, name, gender, teacher_id, supervisor_id, daily_time into h
    from public.halaqat where id = p_halaqa for update;
  if h.id is null or h.teacher_id is distinct from (select auth.uid()) then
    raise exception 'لا تملك تغييرَ موعد هذه الحلقة.' using errcode = '42501';
  end if;
  if h.daily_time is not distinct from p_time then
    return;
  end if;

  update public.halaqat set daily_time = p_time where id = p_halaqa;

  v_female := h.gender = 'female';
  for v_rcpt in
    select h.supervisor_id where h.supervisor_id is not null
    union
    select p.id from public.profiles p
     where p.status = 'active'
       and ((p.role = 'technical_manager' and not v_female)
            or (p.role = 'women_admin' and v_female))
  loop
    perform private.notify(
      v_rcpt, 'halaqa_time_changed',
      case when v_female then 'غيّرت المعلّمةُ موعدَ حلقتها' else 'غيّر المعلّمُ موعدَ حلقته' end,
      h.name || ' · ' || private.halaqa_time_label(h.daily_time) || ' ← ' || private.halaqa_time_label(p_time),
      '/halqat/' || h.id::text, 'halaqat', h.id);
  end loop;
end;
$$;

create or replace function private.notify_booklet_requested()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  h record;
  v_teacher text;
  v_rcpt uuid;
begin
  select name, gender into h from public.halaqat where id = new.halaqa_id;
  select full_name into v_teacher from public.profiles where id = new.requested_by;
  for v_rcpt in select id from public.profiles
                 where status = 'active'
                   and (role = 'admin_manager' or (role = 'women_admin' and h.gender = 'female')) loop
    perform private.notify(
      v_rcpt, 'booklet_requested',
      case when h.gender = 'female' then 'طلبت معلّمةٌ ملازم' else 'طلب معلّمٌ ملازم' end,
      coalesce(v_teacher, '—') || ' · ' || h.name || ' · الجزء ' || (31 - 2 * new.booklet) || ' + ' || (32 - 2 * new.booklet)
        || ' × ' || new.copies || coalesce(' · ' || nullif(btrim(new.note), ''), ''),
      '/booklets?view=requests', 'booklet_requests', new.id);
  end loop;
  return null;
end;
$$;
revoke all on function private.notify_booklet_requested() from public, anon, authenticated;
