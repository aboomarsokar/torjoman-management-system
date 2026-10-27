-- الموقوفةُ (أو المنتهيةُ بعد مرّتها الواحدة) بلا موعدٍ تالٍ — كي لا تُعرض كأنها قادمة.
create or replace function private.guard_scheduled_message()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_role text := public.current_user_role();
begin
  if auth.uid() is not null then
    if v_role = 'technical_manager' and new.section <> 'male' then
      raise exception 'المدير الفنيّ يجدول لقسم البنين.' using errcode = '42501';
    elsif v_role = 'women_admin' and new.section <> 'female' then
      raise exception 'المديرة الإدارية تجدول لقسم البنات.' using errcode = '42501';
    end if;
    if new.sms and v_role is distinct from 'admin_manager' then
      raise exception 'رسائلُ SMS للمدير الإداريّ وحده.' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'INSERT'
     or (new.recurrence, new.run_at, new.weekday, new.month_day, new.time_of_day, new.active)
        is distinct from (old.recurrence, old.run_at, old.weekday, old.month_day, old.time_of_day, old.active) then
    new.next_run_at := private.scheduled_next_run(new.recurrence, new.run_at, new.weekday, new.month_day, new.time_of_day, now());
    if new.active and new.next_run_at is null then
      raise exception 'الموعد في الماضي — اختر موعداً قادماً.' using errcode = '22023';
    end if;
  end if;
  if not new.active then
    new.next_run_at := null;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_scheduled_message() from public, anon, authenticated;
