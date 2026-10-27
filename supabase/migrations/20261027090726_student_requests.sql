-- طلبُ إضافة طالب (طلب المستخدم 2026-10-27): المعلّمُ يطلب من صفحته إضافةَ طالبٍ لحلقته ببياناته، فيُشعَر المديرُ الإداريّ
-- (والمديرةُ الإدارية في طلبات حلقات البنات — اطّلاعاً)، والمديرُ يُنشئ الحسابَ من الطلب (مسارُ الخادم
-- `/api/student-requests/:id/approve`) أو يرفضه بسبب، فيُشعَر المعلّم. الهويةُ تُفحص بخانة التحقّق، ولا تُقبل هويةٌ مسجّلة
-- لطالبٍ أو مطلوبةٌ في طلبٍ مفتوح.

-- خانةُ التحقّق في رقم الهوية (تسع خانات، الأوزان 1،2 بالتناوب ومجموعُ أرقام النواتج من مضاعفات العشرة)
create or replace function private.valid_national_id(p text)
returns boolean
language sql immutable
set search_path = ''
as $$
  select p ~ '^\d{9}$' and (
    select sum((d / 10) + (d % 10)) % 10 = 0
      from (select substr(p, i, 1)::int * (case when i % 2 = 1 then 1 else 2 end) as d
              from generate_series(1, 9) as i) x
  )
$$;
revoke all on function private.valid_national_id(text) from public, anon, authenticated;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'report_submitted', 'report_approved', 'report_returned', 'alert_issued', 'visit_scheduled',
  'exam_nominated', 'exam_graded', 'transport_paid', 'impersonation_started', 'impersonation_write',
  'statement_returned', 'visit_result', 'visit_unlocked', 'visit_rescheduled', 'quality_month', 'quality_unlocked',
  'halaqa_time_changed', 'booklet_delivered', 'booklet_requested', 'announcement',
  'student_requested', 'student_request_closed'
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
    'announcement',
    'student_requested', 'student_request_closed'
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

create table public.student_requests (
  id              uuid primary key default gen_random_uuid(),
  halaqa_id       uuid not null references public.halaqat(id) on delete cascade,
  full_name       text not null check (char_length(btrim(full_name)) between 6 and 120),
  national_id     text not null check (national_id ~ '^\d{9}$'),
  birth_date      date,
  guardian_phone  text check (guardian_phone is null or guardian_phone ~ '^05\d{8}$'),
  tajweed_level   text check (tajweed_level is null or char_length(tajweed_level) <= 40),
  residence       text check (residence is null or char_length(residence) <= 120),
  nearest_mosque  text check (nearest_mosque is null or char_length(nearest_mosque) <= 120),
  note            text check (note is null or char_length(note) <= 300),
  status          text not null default 'open' check (status in ('open', 'added', 'rejected')),
  reject_note     text check (reject_note is null or char_length(reject_note) <= 300),
  student_id      uuid references public.students(id) on delete set null,
  requested_by    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  closed_at       timestamptz,
  closed_by       uuid references public.profiles(id) on delete set null,
  constraint student_requests_reject_has_note check (status <> 'rejected' or char_length(btrim(coalesce(reject_note, ''))) >= 3)
);

create index student_requests_halaqa_idx on public.student_requests (halaqa_id, status);
-- هويةٌ واحدة في طلبٍ مفتوحٍ واحد
create unique index student_requests_open_identity on public.student_requests (national_id) where status = 'open';

alter table public.student_requests enable row level security;

-- القراءة: المديرُ الإداريّ ومشرفُ المشروع الكلَّ، والمديرةُ الإدارية طلباتِ حلقات البنات، والمعلّمُ طلباتِ حلقته
create policy student_requests_select on public.student_requests for select to authenticated
  using (
    (select public.current_user_role()) in ('admin_manager', 'project_supervisor')
    or ((select public.current_user_role()) in ('women_admin', 'teacher')
        and halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]))
  );
-- المعلّمُ يطلب لحلقته وحدَها وباسمه، طلباً مفتوحاً
create policy student_requests_insert on public.student_requests for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and status = 'open'
    and exists (select 1 from public.halaqat h where h.id = halaqa_id and h.teacher_id = (select auth.uid()))
  );
-- الإغلاقُ والحذفُ للمدير الإداريّ (والإضافةُ الفعلية من مسار الخادم بعميل الخدمة)
create policy student_requests_update on public.student_requests for update to authenticated
  using ((select public.is_admin_manager()))
  with check ((select public.is_admin_manager()));
create policy student_requests_delete on public.student_requests for delete to authenticated
  using ((select public.is_admin_manager()));

grant select, insert, update, delete on public.student_requests to authenticated;

select private.guard_table_for_impersonation('public.student_requests');

-- حارسُ الإدراج: الهويةُ صحيحةُ خانة التحقّق، وليست لطالبٍ مسجّل
create or replace function private.guard_student_request()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  new.full_name := regexp_replace(btrim(new.full_name), '\s+', ' ', 'g');
  if not private.valid_national_id(new.national_id) then
    raise exception 'رقم الهوية غير صحيح — تحقّق من خاناته التسع.' using errcode = '23514';
  end if;
  if exists (select 1 from public.students s where s.national_id = new.national_id) then
    raise exception 'رقم الهوية مسجّلٌ لطالبٍ على المنصّة.' using errcode = '23505';
  end if;
  return new;
end;
$function$;
revoke all on function private.guard_student_request() from public, anon, authenticated;

create trigger student_requests_guard
  before insert on public.student_requests
  for each row execute function private.guard_student_request();

-- الطلبُ يُشعر المديرَ الإداريّ، والمديرةَ الإدارية إن كانت الحلقةُ للبنات
create or replace function private.notify_student_requested()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
      v_rcpt, 'student_requested',
      case when h.gender = 'female' then 'طلبت معلّمةٌ إضافةَ طالبة' else 'طلب معلّمٌ إضافةَ طالب' end,
      coalesce(v_teacher, '—') || ' · ' || h.name || ' · ' || new.full_name,
      '/student-requests', 'student_requests', new.id);
  end loop;
  return null;
end;
$function$;
revoke all on function private.notify_student_requested() from public, anon, authenticated;

create trigger student_requests_notify
  after insert on public.student_requests
  for each row execute function private.notify_student_requested();

-- الإضافةُ أو الرفضُ يُشعر المعلّمَ صاحبَ الطلب
create or replace function private.notify_student_request_closed()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_female boolean;
begin
  select h.gender = 'female' into v_female from public.halaqat h where h.id = new.halaqa_id;
  perform private.notify(
    new.requested_by, 'student_request_closed',
    case
      when new.status = 'added' then case when v_female then 'أُضيفت الطالبةُ التي طلبتِها' else 'أُضيف الطالبُ الذي طلبتَه' end
      else case when v_female then 'رُفض طلبُ إضافة الطالبة' else 'رُفض طلبُ إضافة الطالب' end
    end,
    new.full_name || case when new.status = 'rejected' then ' · ' || coalesce(new.reject_note, '') else '' end,
    '/student-requests', 'student_requests', new.id);
  return null;
end;
$function$;
revoke all on function private.notify_student_request_closed() from public, anon, authenticated;

create trigger student_requests_notify_closed
  after update of status on public.student_requests
  for each row when (old.status = 'open' and new.status in ('added', 'rejected'))
  execute function private.notify_student_request_closed();
