-- إشعاراتٌ للمعلّمين (طلب المستخدم 2026-10-25): المديرُ يلفت انتباهَ المعلّمين إلى أمرٍ (مثل «أُضيفت ميزةُ طلب الملازم
-- من صفحتك») فيصل إلى جرس كلِّ معلّمٍ ومعلّمةٍ نشطين. المرسِلون كلٌّ لقسمه (قرار المستخدم): المديرُ الإداريّ للكلّ،
-- والمديرُ الفنيّ لمعلّمي البنين، والمديرةُ الإدارية لمعلّمات البنات. والسجلُّ يحفظ ما أُرسل ولمن وعددَ من وصله.

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'report_submitted', 'report_approved', 'report_returned', 'alert_issued', 'visit_scheduled',
  'exam_nominated', 'exam_graded', 'transport_paid', 'impersonation_started', 'impersonation_write',
  'statement_returned', 'visit_result', 'visit_unlocked', 'visit_rescheduled', 'quality_month', 'quality_unlocked',
  'halaqa_time_changed', 'booklet_delivered', 'booklet_requested', 'announcement'
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
    'halaqa_time_changed', 'booklet_delivered', 'booklet_requested',
    'announcement'
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

create table public.teacher_announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  body        text check (body is null or char_length(body) <= 400),
  link        text check (link is null or link ~ '^/[A-Za-z0-9/_?=&-]*$'),
  audience    text not null check (audience in ('all', 'male', 'female')),
  recipients  integer not null default 0,
  sent_by     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index teacher_announcements_created_idx on public.teacher_announcements (created_at desc);

alter table public.teacher_announcements enable row level security;

-- القراءةُ: الإداريُّ ومشرفُ المشروع الكلَّ، والفنيُّ ما وُجّه للبنين أو للكلّ، والمديرةُ ما وُجّه للبنات أو للكلّ.
-- والكتابةُ بالدالّة وحدَها (لا منحَ إدراج).
create policy teacher_announcements_select on public.teacher_announcements for select to authenticated
  using (
    public.current_user_role() in ('admin_manager', 'project_supervisor')
    or (public.current_user_role() = 'technical_manager' and audience in ('all', 'male'))
    or (public.current_user_role() = 'women_admin' and audience in ('all', 'female'))
  );

grant select on public.teacher_announcements to authenticated;

select private.guard_table_for_impersonation('public.teacher_announcements');

-- الإرسال: يُحفظ في السجلّ ثم يُشعَر كلُّ معلّمٍ نشطٍ في الجمهور؛ ويُرجع عددَ من وصله.
create or replace function public.send_teacher_announcement(
  p_title text, p_body text, p_link text, p_audience text
) returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_role text := public.current_user_role();
  v_id uuid;
  v_teacher uuid;
  v_n integer := 0;
begin
  perform private.assert_session_writable();

  if not (v_role = 'admin_manager'
          or (v_role = 'technical_manager' and p_audience = 'male')
          or (v_role = 'women_admin' and p_audience = 'female')) then
    raise exception 'لا صلاحية لإرسال إشعارٍ لهذا الجمهور' using errcode = '42501';
  end if;
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'العنوان مطلوب' using errcode = '22023';
  end if;

  insert into public.teacher_announcements (title, body, link, audience, sent_by)
  values (btrim(p_title), nullif(btrim(coalesce(p_body, '')), ''), nullif(btrim(coalesce(p_link, '')), ''), p_audience, auth.uid())
  returning id into v_id;

  for v_teacher in
    select id from public.profiles
     where role = 'teacher' and status = 'active'
       and (p_audience = 'all' or gender::text = p_audience)
  loop
    perform private.notify(v_teacher, 'announcement', btrim(p_title), p_body,
      nullif(btrim(coalesce(p_link, '')), ''), 'teacher_announcements', v_id);
    v_n := v_n + 1;
  end loop;

  update public.teacher_announcements set recipients = v_n where id = v_id;
  return v_n;
end;
$function$;

revoke all on function public.send_teacher_announcement(text, text, text, text) from public, anon;
grant execute on function public.send_teacher_announcement(text, text, text, text) to authenticated;
