-- المعلّمُ يغيّر موعدَ حلقته من حسابه، ويُشعَر المشرفُ والمديرُ الإداريّ والمديرُ الفنيّ (حلقاتُ البنين) أو
-- المديرةُ الإدارية (حلقاتُ البنات)؛ ويطّلع المعلّمُ على ملازم حلقته المستلَمة (طلب المستخدم 2026-10-25).

-- ١) نوعُ الإشعار الجديد: القيدُ وقائمةُ private.notify معاً (تتطابقان)
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'report_submitted', 'report_approved', 'report_returned', 'alert_issued', 'visit_scheduled',
  'exam_nominated', 'exam_graded', 'transport_paid', 'impersonation_started', 'impersonation_write',
  'statement_returned', 'visit_result', 'visit_unlocked', 'visit_rescheduled', 'quality_month', 'quality_unlocked',
  'halaqa_time_changed'
));

create or replace function private.notify(p_recipient uuid, p_kind text, p_title text, p_body text, p_link text, p_source_table text, p_source_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  -- بلا مستلمٍ لا إشعار، ولا يُشعَر أحدٌ بفعله هو.
  if p_recipient is null or p_recipient = (select auth.uid()) then
    return;
  end if;

  -- التحقّق نفسُه قيودُ الجدول، لكنّه هنا تحذيرٌ لا استثناء: القيدُ كان سيُسقط العمليةَ الأصلية.
  -- (قائمةُ الأنواع تطابق notifications_kind_check — تُحدَّث معه عند إضافة نوع.)
  if p_kind is null or p_kind not in (
    'report_submitted', 'report_approved', 'report_returned',
    'alert_issued', 'visit_scheduled',
    'exam_nominated', 'exam_graded',
    'transport_paid',
    'impersonation_started', 'impersonation_write',
    'statement_returned',
    'visit_result', 'visit_unlocked', 'visit_rescheduled',
    'quality_month', 'quality_unlocked',
    'halaqa_time_changed'
  ) then
    raise warning 'notify: نوعٌ غير معروف %', p_kind;
    return;
  end if;
  if p_link is not null and p_link !~ '^/[A-Za-z0-9/_?=&-]*$' then
    raise warning 'notify: رابطٌ غير مسموح %', p_link;
    return;
  end if;
  if btrim(coalesce(p_title, '')) = '' then
    raise warning 'notify: عنوانٌ فارغ (النوع %)', p_kind;
    return;
  end if;

  begin
    insert into public.notifications (recipient_id, kind, title, body, link, source_table, source_id)
    values (p_recipient, p_kind, left(btrim(p_title), 120), left(nullif(btrim(coalesce(p_body, '')), ''), 400), p_link, p_source_table, p_source_id);

    -- التقليمُ بعد الإدراج وبدفعةٍ محدودة: ما مضى عليه ثلاثة أشهر، وما أقفله غيرُنا يُترك لدورةٍ لاحقة.
    delete from public.notifications
     where id in (select id from public.notifications
                   where created_at < now() - interval '3 months'
                   order by created_at limit 200
                   for update skip locked);
  exception when others then
    raise warning 'notify failed: %', sqlerrm;
  end;
end;
$function$;

-- ٢) تغييرُ الموعد: المعلّمُ لحلقته وحدَها (RLS التحديث للمديرَين، فالدالّةُ هي الطريق)، ولا كتابةَ في نيابة القراءة
create or replace function private.halaqa_time_label(t time)
 returns text language sql immutable set search_path to ''
as $$ select case when t is null then '—' else
  ltrim(to_char(t, 'HH12:MI'), '0') || case when extract(hour from t) < 12 then ' ص' else ' م' end end $$;

create or replace function public.set_my_halaqa_time(p_halaqa uuid, p_time time)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
       and (p.role = 'admin_manager'
            or (p.role = 'technical_manager' and not v_female)
            or (p.role = 'women_admin' and v_female))
  loop
    perform private.notify(
      v_rcpt, 'halaqa_time_changed',
      case when v_female then 'غيّرت المعلّمةُ موعدَ حلقتها' else 'غيّر المعلّمُ موعدَ حلقته' end,
      h.name || ' · ' || private.halaqa_time_label(h.daily_time) || ' ← ' || private.halaqa_time_label(p_time),
      '/halqat/' || h.id::text, 'halaqat', h.id);
  end loop;
end;
$function$;

revoke all on function public.set_my_halaqa_time(uuid, time) from public, anon;
grant execute on function public.set_my_halaqa_time(uuid, time) to authenticated;
revoke all on function private.halaqa_time_label(time) from public, anon, authenticated;

-- ٣) المعلّمُ يقرأ تسليماتِ ملازم حلقته (والقراءةُ الكاملة للمدير الإداري ومشرف المشروع كما كانت)
drop policy booklet_deliveries_select on public.booklet_deliveries;
create policy booklet_deliveries_select on public.booklet_deliveries for select to authenticated
  using (
    public.current_user_role() = any (array['admin_manager', 'project_supervisor']::public.user_role[])
    or (public.current_user_role() = 'teacher'
        and halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]))
  );
