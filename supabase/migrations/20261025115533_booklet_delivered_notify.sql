-- تسليمُ ملازم لحلقةٍ يُشعر معلّمَها (طلب المستخدم 2026-10-25): «استلمت حلقتك ملازم» بالملزمة وعدد نسخها.
-- الملزمة n = الجزء (31-2n) + (32-2n) كما في `app/constants/booklets.ts`.

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'report_submitted', 'report_approved', 'report_returned', 'alert_issued', 'visit_scheduled',
  'exam_nominated', 'exam_graded', 'transport_paid', 'impersonation_started', 'impersonation_write',
  'statement_returned', 'visit_result', 'visit_unlocked', 'visit_rescheduled', 'quality_month', 'quality_unlocked',
  'halaqa_time_changed', 'booklet_delivered'
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
    'halaqa_time_changed', 'booklet_delivered'
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

create or replace function private.notify_booklet_delivered()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  h record;
begin
  select name, teacher_id, gender into h from public.halaqat where id = new.halaqa_id;
  perform private.notify(
    h.teacher_id, 'booklet_delivered',
    case when h.gender = 'female' then 'استلمت حلقتُكِ ملازم' else 'استلمت حلقتُك ملازم' end,
    'الجزء ' || (31 - 2 * new.booklet) || ' + ' || (32 - 2 * new.booklet) || ' × ' || new.copies
      || ' نسخة · ' || to_char(new.delivered_on, 'DD-MM-YYYY'),
    '/dashboard', 'booklet_deliveries', new.id);
  return null;
end;
$function$;

-- دوالُّ المشغّلات بلا EXECUTE للأدوار (CLAUDE.md)
revoke all on function private.notify_booklet_delivered() from public, anon, authenticated;

create trigger booklet_delivered_notify
  after insert on public.booklet_deliveries
  for each row execute function private.notify_booklet_delivered();
