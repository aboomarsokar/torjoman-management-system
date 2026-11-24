-- سقفُ طلبات الملازم بحاجة الحلقة (طلب المستخدم 2026-11-24): لا يطلب المعلّمُ من ملزمةٍ ما يجعل مجموعَ ما استلمته حلقتُه
-- منها وطلباتِها القائمة أكثرَ من عدد طلابها النشطين — والرفضُ في القاعدة لا في الشاشة وحدها. الطلباتُ القائمة قبل هذا
-- تبقى (لا يمسّها الحارسُ إلا إن زِيدت)، والمديرُ الإداريُّ يعالجها: شارةُ «يتجاوز الحاجة» وتخفيضُ النسخ بسببٍ يصل المعلّم.

-- ١) أثرُ التخفيض على الطلب
alter table public.booklet_requests
  add column reduced_from  integer check (reduced_from is null or reduced_from > 0),
  add column reduce_reason text check (reduce_reason is null or char_length(reduce_reason) <= 200);

-- ٢) نوعُ الإشعار الجديد
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'report_submitted', 'report_approved', 'report_returned', 'alert_issued', 'visit_scheduled',
  'exam_nominated', 'exam_graded', 'transport_paid', 'impersonation_started', 'impersonation_write',
  'statement_returned', 'visit_result', 'visit_unlocked', 'visit_rescheduled', 'quality_month', 'quality_unlocked',
  'halaqa_time_changed', 'booklet_delivered', 'booklet_requested', 'announcement',
  'student_requested', 'student_request_closed', 'off_day_reported', 'off_day_rejected',
  'plan_task_assigned', 'plan_task_due', 'plan_task_overdue', 'plan_weekly_update',
  'booklet_ready', 'booklet_request_cancelled', 'booklet_stock_low', 'candidate_registered',
  'track_requested', 'track_decided', 'below_quota', 'payout_account_changed',
  'quran_mid_due', 'quran_mid_submitted', 'quran_mid_missing', 'booklet_request_reduced'
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
    'booklet_ready', 'booklet_request_cancelled', 'booklet_stock_low', 'candidate_registered',
    'track_requested', 'track_decided', 'below_quota', 'payout_account_changed',
    'quran_mid_due', 'quran_mid_submitted', 'quran_mid_missing', 'booklet_request_reduced'
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

-- ٣) حاجةُ الحلقة من ملزمة: طلابُها النشطون، وما استلمته، ونسخُ طلباتها القائمة (بلا الطلب المستثنى).
create or replace function private.booklet_room(p_halaqa uuid, p_booklet smallint, p_except uuid default null)
 returns table (students integer, received integer, pending integer)
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select
    (select count(*) from public.students s where s.halaqa_id = p_halaqa and s.status = 'active')::integer,
    (select coalesce(sum(d.copies), 0) from public.booklet_deliveries d
      where d.halaqa_id = p_halaqa and d.booklet = p_booklet)::integer,
    (select coalesce(sum(r.copies), 0) from public.booklet_requests r
      where r.halaqa_id = p_halaqa and r.booklet = p_booklet and r.status in ('open', 'ready')
        and r.id is distinct from p_except)::integer
$function$;
revoke all on function private.booklet_room(uuid, smallint, uuid) from public, anon, authenticated;

-- ٤) الحارس: طلبٌ جديد، أو زيادةٌ في النسخ أو تغييرُ الملزمة، لا يتجاوز المتاحَ (الطلاب − المستلَم − القائم لغيره).
-- المديرُ الإداريُّ خارجه (يخفّض ويعالج)، والتخفيضُ وتعديلُ الملاحظة لا يُفحصان فتبقى الطلباتُ القائمة كما هي.
create or replace function private.booklet_request_cap()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v record;
  v_left integer;
  v_female boolean;
begin
  if new.status not in ('open', 'ready') or public.is_admin_manager() then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.booklet = old.booklet and new.copies <= old.copies then
    return new;
  end if;
  -- طلبان متزامنان للحلقة والملزمة نفسيهما لا يتخطّيان الحدَّ معاً
  perform pg_advisory_xact_lock(hashtextextended('booklet_cap:' || new.halaqa_id::text || ':' || new.booklet::text, 0));
  select * into v from private.booklet_room(new.halaqa_id, new.booklet, new.id);
  v_left := v.students - v.received - v.pending;
  if new.copies <= v_left then
    return new;
  end if;
  select h.gender = 'female' into v_female from public.halaqat h where h.id = new.halaqa_id;
  if v_left <= 0 then
    raise exception 'لا تحتاج % نسخاً إضافية من %: % %، واستلمت % نسخة% — للحالات الخاصة %.',
      case when v_female then 'حلقتُكِ' else 'حلقتُك' end, private.booklet_label(new.booklet),
      case when v_female then 'طالباتُها' else 'طلابُها' end, v.students, v.received,
      case when v.pending > 0 then ' وطلباتُها القائمة ' || v.pending else '' end,
      case when v_female then 'تواصلي مع المدير الإداري' else 'تواصل مع المدير الإداري' end
      using errcode = '22023';
  end if;
  raise exception 'عددُ النسخ (%) أكبر من حاجة الحلقة من %: % %، واستلمت % نسخة% — المتاحُ % نسخة.',
    new.copies, private.booklet_label(new.booklet),
    case when v_female then 'طالباتُها' else 'طلابُها' end, v.students, v.received,
    case when v.pending > 0 then ' وطلباتُها القائمة ' || v.pending else '' end, v_left
    using errcode = '22023';
end;
$function$;
revoke all on function private.booklet_request_cap() from public, anon, authenticated;

create trigger booklet_request_cap
  before insert or update of booklet, copies on public.booklet_requests
  for each row execute function private.booklet_request_cap();

-- ٥) الحاجةُ للواجهة: لحلقةٍ (معلّمُها أو الإدارة) لكلّ الملازم، وبلا حلقةٍ (الإدارة) لأزواج الطلبات القائمة وحدها.
create or replace function public.booklet_rooms(p_halaqa uuid default null)
 returns table (halaqa_id uuid, booklet smallint, students integer, received integer, pending integer, female boolean)
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
#variable_conflict use_column
begin
  if p_halaqa is null then
    if not (public.is_admin_manager() or public.is_project_supervisor()) then
      raise exception 'حاجةُ الحلقات كلِّها للإدارة' using errcode = '42501';
    end if;
    return query
      select k.halaqa_id, k.booklet, r.students, r.received, r.pending, h.gender = 'female'
        from (select distinct q.halaqa_id, q.booklet from public.booklet_requests q
               where q.status in ('open', 'ready')) k
        join public.halaqat h on h.id = k.halaqa_id
        cross join lateral private.booklet_room(k.halaqa_id, k.booklet) r;
    return;
  end if;
  if not (public.is_admin_manager() or public.is_project_supervisor()
          or exists (select 1 from public.halaqat h where h.id = p_halaqa and h.teacher_id = (select auth.uid()))) then
    raise exception 'لا تملك الاطّلاعَ على هذه الحلقة' using errcode = '42501';
  end if;
  return query
    select p_halaqa, b.n::smallint, r.students, r.received, r.pending, h.gender = 'female'
      from generate_series(1, 15) as b(n)
      join public.halaqat h on h.id = p_halaqa
      cross join lateral private.booklet_room(p_halaqa, b.n::smallint) r;
end;
$function$;
revoke all on function public.booklet_rooms(uuid) from public, anon;
grant execute on function public.booklet_rooms(uuid) to authenticated;

-- ٦) تخفيضُ الطلب — المديرُ الإداريُّ ما لم يُسلَّم، إلى عددٍ أقلّ (والصفرُ إلغاء)، ويُشعَر المعلّمُ بالعددين والسبب.
create or replace function public.reduce_booklet_request(p_request uuid, p_copies integer, p_reason text default null)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  r public.booklet_requests%rowtype;
  h record;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform private.assert_session_writable();
  if not public.is_admin_manager() then
    raise exception 'تخفيضُ الطلب للمدير الإداري' using errcode = '42501';
  end if;
  select * into r from public.booklet_requests where id = p_request for update;
  if not found then
    raise exception 'الطلبُ غير موجود' using errcode = '22023';
  end if;
  if r.status not in ('open', 'ready') then
    raise exception 'لا يُخفَّض طلبٌ سُلِّم أو أُلغي' using errcode = '22023';
  end if;
  if r.copies = 1 then
    raise exception 'طلبٌ بنسخةٍ واحدة لا يُخفَّض — ألغِه إن لم يلزم.' using errcode = '22023';
  end if;
  if p_copies is null or p_copies < 1 or p_copies >= r.copies then
    raise exception 'العددُ الجديد من 1 إلى % (أقلُّ من المطلوب) — ولإسقاطه كلِّه ألغِ الطلب.', r.copies - 1 using errcode = '22023';
  end if;
  if char_length(coalesce(v_reason, '')) > 200 then
    raise exception 'السببُ لا يتجاوز 200 حرف' using errcode = '22023';
  end if;

  update public.booklet_requests
     set copies = p_copies, reduced_from = coalesce(r.reduced_from, r.copies), reduce_reason = v_reason, updated_at = now()
   where id = p_request;

  select name, teacher_id, gender into h from public.halaqat where id = r.halaqa_id;
  perform private.notify(
    h.teacher_id, 'booklet_request_reduced',
    case when h.gender = 'female' then 'خُفّض طلبُكِ للملازم' else 'خُفّض طلبُك للملازم' end,
    private.booklet_label(r.booklet) || ': من ' || r.copies || ' إلى ' || p_copies || ' نسخة'
      || coalesce(' · السبب: ' || v_reason, ''),
    '/my-booklets', 'booklet_requests', r.id);
end;
$function$;
revoke all on function public.reduce_booklet_request(uuid, integer, text) from public, anon;
grant execute on function public.reduce_booklet_request(uuid, integer, text) to authenticated;
