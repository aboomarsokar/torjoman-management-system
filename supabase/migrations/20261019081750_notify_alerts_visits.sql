-- أوّلُ مُنتِجَين للإشعارات (2026-10-19): تنبيهٌ إداريّ للمعلّم، وزيارةٌ جُدولت للمشرف الميداني.

-- ⓪ تقليمُ النصّ داخل notify: نصٌّ أطول من القيد يُقصّ ولا يُسقط العمليةَ الأصلية
--    (تنبيهٌ إداريّ نوعُ مخالفته طويل ما كان ليُدرَج لو رفض القيدُ إشعارَه).
create or replace function private.notify(
  p_recipient uuid, p_kind text, p_title text, p_body text,
  p_link text, p_source_table text, p_source_id uuid
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  -- بلا مستلمٍ لا إشعار (وإلا أسقط القيدُ العمليةَ الأصلية)، ولا يُشعَر أحدٌ بفعله هو.
  if p_recipient is null or p_recipient = (select auth.uid()) then
    return;
  end if;

  insert into public.notifications (recipient_id, kind, title, body, link, source_table, source_id)
  values (p_recipient, p_kind, left(btrim(p_title), 120), left(nullif(btrim(coalesce(p_body, '')), ''), 400), p_link, p_source_table, p_source_id);

  -- التقليمُ بعد الإدراج وبدفعةٍ محدودة: ما مضى عليه ثلاثة أشهر.
  delete from public.notifications
   where id in (select id from public.notifications
                 where created_at < now() - interval '3 months'
                 order by created_at limit 200);
end;
$$;
revoke all on function private.notify(uuid, text, text, text, text, text, uuid) from public, anon, authenticated;

-- ① تنبيهٌ إداريّ جديد ← المعلّمُ المعنيّ.
create or replace function private.notify_alert_issued()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform private.notify(
    new.teacher_id, 'alert_issued', 'تنبيهٌ إداريّ جديد',
    new.violation_type, '/alerts', 'admin_alerts', new.id);
  return null;
end;
$$;
revoke all on function private.notify_alert_issued() from public, anon, authenticated;

create trigger admin_alerts_notify
  after insert on public.admin_alerts
  for each row execute function private.notify_alert_issued();

-- ② زيارةٌ جُدولت ← المشرفُ الميداني (ولا شيء إن جدولها لنفسه — يمنعه notify).
create or replace function private.notify_visit_scheduled()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_halaqa text;
begin
  select h.name into v_halaqa from public.halaqat h where h.id = new.halaqa_id;
  perform private.notify(
    new.supervisor_id, 'visit_scheduled', 'جُدولت لك زيارةٌ إشرافية',
    coalesce(v_halaqa, 'حلقة') || ' · ' ||
      to_char(new.scheduled_at at time zone 'Asia/Gaza', 'DD-MM-YYYY HH24:MI'),
    '/visits', 'supervision_visits', new.id);
  return null;
end;
$$;
revoke all on function private.notify_visit_scheduled() from public, anon, authenticated;

create trigger supervision_visits_notify
  after insert on public.supervision_visits
  for each row execute function private.notify_visit_scheduled();

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'admin_alerts_notify' and not tgisinternal) then
    raise exception 'admin_alerts_notify غير موجود';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'supervision_visits_notify' and not tgisinternal) then
    raise exception 'supervision_visits_notify غير موجود';
  end if;
  if has_function_privilege('authenticated', 'private.notify_alert_issued()', 'execute')
     or has_function_privilege('authenticated', 'private.notify_visit_scheduled()', 'execute')
     or has_function_privilege('authenticated', 'private.notify(uuid, text, text, text, text, text, uuid)', 'execute') then
    raise exception 'دوالّ الإشعار مكشوفةٌ للعميل';
  end if;
end $$;
