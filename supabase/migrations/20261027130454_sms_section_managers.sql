-- SMS للمدير الفنيّ والمديرة الإدارية (طلب المستخدم 2026-10-27): كلٌّ لكادر قسمه (البنين / البنات) بلا أرقامٍ خارجية،
-- ويريان الرصيدَ وسجلَّ ما أرسلاه هما، ويجدولان تذكيراتِ SMS لقسمهما. الإرسالُ الفوريّ من مسار الخادم
-- (`/api/sms/send`) يتحقّق أن كلَّ رقمٍ لعاملٍ نشطٍ من قسم المرسِل.

-- السجلّ: المديرُ الإداريّ ومشرفُ المشروع كلَّه، والمديران ما أرسلاه
drop policy sms_log_select on public.sms_log;
create policy sms_log_select on public.sms_log for select to authenticated
  using (
    (select public.current_user_role()) in ('admin_manager', 'project_supervisor')
    or ((select public.current_user_role()) in ('technical_manager', 'women_admin') and sent_by = (select auth.uid()))
  );

-- الرسائلُ المجدولة: SMS للمديرين في قسمهما (والقسمُ مفروضٌ في الحارس والسياسة قبلُ)
drop policy scheduled_messages_write on public.scheduled_messages;
create policy scheduled_messages_write on public.scheduled_messages for all to authenticated
  using (
    (select public.is_admin_manager())
    or ((select public.current_user_role()) = 'technical_manager' and section = 'male')
    or ((select public.current_user_role()) = 'women_admin' and section = 'female')
  )
  with check (
    (select public.is_admin_manager())
    or ((select public.current_user_role()) = 'technical_manager' and section = 'male')
    or ((select public.current_user_role()) = 'women_admin' and section = 'female')
  );

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
    if new.sms and v_role not in ('admin_manager', 'technical_manager', 'women_admin') then
      raise exception 'رسائلُ SMS للإدارة وحدها.' using errcode = '42501';
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
