-- طلبُ ملازم من المعلّم (طلب المستخدم 2026-10-25): المعلّمُ يطلب من صفحته ملزمةً بعدد نسخها لحلقته،
-- فيُشعَر المديرُ الإداريّ؛ والمديرُ يُغلق الطلبَ بعد التسليم. يقرؤه المديرُ ومشرفُ المشروع كلَّه، والمعلّمُ طلباتِ حلقته.

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'report_submitted', 'report_approved', 'report_returned', 'alert_issued', 'visit_scheduled',
  'exam_nominated', 'exam_graded', 'transport_paid', 'impersonation_started', 'impersonation_write',
  'statement_returned', 'visit_result', 'visit_unlocked', 'visit_rescheduled', 'quality_month', 'quality_unlocked',
  'halaqa_time_changed', 'booklet_delivered', 'booklet_requested'
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
    'halaqa_time_changed', 'booklet_delivered', 'booklet_requested'
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

create table public.booklet_requests (
  id            uuid primary key default gen_random_uuid(),
  halaqa_id     uuid not null references public.halaqat(id) on delete cascade,
  booklet       smallint not null check (booklet between 1 and 15),
  copies        integer not null check (copies between 1 and 1000),
  note          text check (note is null or char_length(note) <= 300),
  status        text not null default 'open' check (status in ('open', 'done')),
  requested_by  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  closed_at     timestamptz
);

create index booklet_requests_halaqa_idx on public.booklet_requests (halaqa_id, status);

alter table public.booklet_requests enable row level security;

create policy booklet_requests_select on public.booklet_requests for select to authenticated
  using (
    public.current_user_role() in ('admin_manager', 'project_supervisor')
    or (public.current_user_role() = 'teacher'
        and halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]))
  );
-- المعلّمُ يطلب لحلقته وحدَها وباسمه، طلباً مفتوحاً
create policy booklet_requests_insert on public.booklet_requests for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and status = 'open'
    and exists (select 1 from public.halaqat h where h.id = halaqa_id and h.teacher_id = (select auth.uid()))
  );
-- الإغلاقُ والحذفُ للمدير الإداريّ
create policy booklet_requests_update on public.booklet_requests for update to authenticated
  using ((select public.is_admin_manager()))
  with check ((select public.is_admin_manager()));
create policy booklet_requests_delete on public.booklet_requests for delete to authenticated
  using ((select public.is_admin_manager()));

grant select, insert, update, delete on public.booklet_requests to authenticated;

-- حارسُ النيابة (قراءةٌ فقط)
select private.guard_table_for_impersonation('public.booklet_requests');

-- الطلبُ يُشعر المديرين الإداريين النشطين
create or replace function private.notify_booklet_requested()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
$function$;

revoke all on function private.notify_booklet_requested() from public, anon, authenticated;

create trigger booklet_requested_notify
  after insert on public.booklet_requests
  for each row execute function private.notify_booklet_requested();
