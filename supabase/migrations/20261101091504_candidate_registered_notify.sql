-- إشعارُ المدير الإداريّ بكلّ طلب التحاقٍ جديد (طلب المستخدم 2026-11-01): مشغّلٌ بعد إدراج مرشّحٍ يُشعر المديرين الإداريين
-- النشطين «طلبُ التحاقٍ جديد» باسمه ومنطقة حلقته، ورابطُه صفحةُ المقابلات. التسجيلُ عامٌّ بلا جلسة، فـ`notify` لا يتخطّى أحداً.

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'report_submitted', 'report_approved', 'report_returned', 'alert_issued', 'visit_scheduled',
  'exam_nominated', 'exam_graded', 'transport_paid', 'impersonation_started', 'impersonation_write',
  'statement_returned', 'visit_result', 'visit_unlocked', 'visit_rescheduled', 'quality_month', 'quality_unlocked',
  'halaqa_time_changed', 'booklet_delivered', 'booklet_requested', 'announcement',
  'student_requested', 'student_request_closed', 'off_day_reported', 'off_day_rejected',
  'plan_task_assigned', 'plan_task_due', 'plan_task_overdue', 'plan_weekly_update',
  'booklet_ready', 'booklet_request_cancelled', 'booklet_stock_low', 'candidate_registered'
));

create or replace function private.notify(p_recipient uuid, p_kind text, p_title text, p_body text, p_link text, p_source_table text, p_source_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if p_recipient is null or p_recipient = (select auth.uid()) then
    return;
  end if;
  if p_kind is null or p_kind not in (
    'report_submitted', 'report_approved', 'report_returned',
    'alert_issued', 'visit_scheduled',
    'exam_nominated', 'exam_graded',
    'transport_paid',
    'impersonation_started', 'impersonation_write',
    'statement_returned',
    'visit_result', 'visit_unlocked', 'visit_rescheduled',
    'quality_month', 'quality_unlocked',
    'halaqa_time_changed', 'booklet_delivered', 'booklet_requested',
    'announcement',
    'student_requested', 'student_request_closed',
    'off_day_reported', 'off_day_rejected',
    'plan_task_assigned', 'plan_task_due', 'plan_task_overdue', 'plan_weekly_update',
    'booklet_ready', 'booklet_request_cancelled', 'booklet_stock_low', 'candidate_registered'
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

create or replace function private.notify_candidate_registered()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid;
begin
  for v_admin in select id from public.profiles where role = 'admin_manager' and status = 'active' loop
    perform private.notify(
      v_admin, 'candidate_registered',
      case when new.gender = 'female' then 'طلبُ التحاقٍ جديد من مرشّحة' else 'طلبُ التحاقٍ جديد من مرشّح' end,
      new.full_name || coalesce(' · ' || nullif(btrim(new.halaqa_area), ''), '') || coalesce(' · الحفظ: ' || new.quran_parts, ''),
      '/candidates', 'candidates', new.id);
  end loop;
  return null;
end;
$$;
revoke all on function private.notify_candidate_registered() from public, anon, authenticated;

create trigger candidates_registered_notify after insert on public.candidates
  for each row execute function private.notify_candidate_registered();
