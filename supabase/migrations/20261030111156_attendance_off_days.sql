-- «لم تنعقد الحلقة» والإجازاتُ العامة (طلب المستخدم 2026-10-30 — docs/superpowers/specs/2026-10-30-halaqa-off-day-design.md).
--   • attendance_off_days: بلاغُ المعلّم أنّ حلقته لم تنعقد يوماً بعذر، ويعتمده المشرفُ الميدانيّ أو المديرُ الإداريّ أو المديرُ
--     الفنيّ (حلقات البنين) أو المديرةُ الإدارية (حلقات البنات). لا يُستثنى يومٌ من «الناقص» إلا بعد اعتماده.
--     الكتابةُ كلُّها عبر الدوالّ (report_off_day / withdraw_off_day / review_off_day)، ولا سياساتِ كتابةٍ على الجدول.
--   • attendance_holidays: يومُ إجازةٍ عامٍّ للشبكة كلّها يعيّنه المديرُ الإداريّ مسبقاً؛ لا يُسجَّل فيه حضور ولا يُعدّ يومَ دوام.
--   • «يومٌ واحد = حضورٌ أو بلاغ» في كلّ الطرق: البلاغُ يمحو حضورَ يومه، وإدراجُ الحضور (save_attendance_day أو /attendance)
--     يمحو البلاغَ المعلّق أو المرفوض ويُرفض على المعتمَد — في حارس attendance_days، فلا تتغيّر save_attendance_day.
--   • guard_attendance_days وقيدُ الإشعارات وhalaqat_recording_status مبنيّةٌ على نسخ الإنتاج الحيّة (قُرئت 2026-10-30).
--     الأنواعُ الستّة الجديدة دخلت الإنتاجَ قبل هذه الهجرة بهجرة 20261030084203_department_plan (جلسةٌ أخرى أضافتها كلَّها
--     إلى القيد وإلى private.notify)، فإعادةُ القيد هنا لا تغيّر شيئاً حيّاً وتُبقي ملفّات هذا المستودع مطابقةً.

-- ═══════════════════════════════ أنواعُ الإشعار ═══════════════════════════════

alter table public.notifications drop constraint notifications_kind_check,
  add constraint notifications_kind_check check (kind in (
  'report_submitted', 'report_approved', 'report_returned', 'alert_issued', 'visit_scheduled',
  'exam_nominated', 'exam_graded', 'transport_paid', 'impersonation_started', 'impersonation_write',
  'statement_returned', 'visit_result', 'visit_unlocked', 'visit_rescheduled', 'quality_month', 'quality_unlocked',
  'halaqa_time_changed', 'booklet_delivered', 'booklet_requested', 'announcement',
  'student_requested', 'student_request_closed',
  'off_day_reported', 'off_day_rejected',
  'plan_task_assigned', 'plan_task_due', 'plan_task_overdue', 'plan_weekly_update'
));

-- private.notify لا يُعاد تعريفُها هنا: قائمتُها البيضاء في الإنتاج تحوي الأنواعَ الستّة بهذا الترتيب منذ هجرة
-- 20261030084203_department_plan (جلسة «خطة القسم»، ليست في هذا الفرع). والفحصُ الذاتيّ آخرَ الملفّ يتأكّد من ذلك.
-- القيدُ أعلاه يُعاد بالقائمة الكاملة (مطابقاً للإنتاج) لأنّ اختبار app/constants/notifications.test.ts يقرأ آخر هجرةٍ فيه.

-- ═══════════════════════════════ الجدولان ═══════════════════════════════

create table public.attendance_off_days (
  id           uuid primary key default gen_random_uuid(),
  halaqa_id    uuid not null references public.halaqat(id) on delete cascade,
  day          date not null,
  reason       text not null check (reason in ('official_holiday', 'security', 'teacher_sick', 'other')),
  note         text check (char_length(note) <= 300),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reported_by  uuid references public.profiles(id),
  reported_at  timestamptz not null default now(),
  reviewed_by  uuid references public.profiles(id),
  reviewed_at  timestamptz,
  review_note  text check (char_length(review_note) <= 300),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint attendance_off_days_halaqa_day_key unique (halaqa_id, day),
  constraint attendance_off_days_other_has_note check (reason <> 'other' or btrim(coalesce(note, '')) <> '')
);

comment on table public.attendance_off_days is
  'بلاغُ المعلّم أنّ الحلقة لم تنعقد يوماً بعذر. المعتمَدُ (approved) يُخرج اليومَ من الأيام الناقصة؛ المعلّقُ يبقى ناقصاً. الكتابةُ عبر report_off_day/withdraw_off_day/review_off_day وحدها.';
comment on column public.attendance_off_days.reported_at is
  'وقتُ البلاغ على جهاز المعلّم (بلا إنترنت قد يسبق الرفع)، ولا يتجاوز وقتَ الرفع.';

create index attendance_off_days_status_day_idx on public.attendance_off_days (status, day);

create trigger attendance_off_days_updated_at
  before update on public.attendance_off_days
  for each row execute function public.set_updated_at();

alter table public.attendance_off_days enable row level security;

-- القراءةُ لكلّ من يرى الحلقة؛ ولا سياساتِ كتابة — الدوالُّ definer تكتب.
create policy attendance_off_days_read on public.attendance_off_days for select to authenticated
  using (halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]));

revoke all on public.attendance_off_days from public, anon, authenticated;
grant select on public.attendance_off_days to authenticated;

select private.guard_table_for_impersonation('public.attendance_off_days');


create table public.attendance_holidays (
  day         date primary key,
  reason      text not null check (btrim(reason) <> '' and char_length(reason) <= 80),
  created_by  uuid default auth.uid() references public.profiles(id),
  created_at  timestamptz not null default now()
);

comment on table public.attendance_holidays is
  'إجازةٌ عامة للشبكة كلّها يعيّنها المديرُ الإداريّ (مسبقاً): لا يُسجَّل فيها حضور، ولا تُعدّ يومَ دوام، ولا يُبلَّغ عنها. تُحذف ولا تُعدَّل.';

alter table public.attendance_holidays enable row level security;

create policy attendance_holidays_read on public.attendance_holidays for select to authenticated
  using (true);
create policy attendance_holidays_insert on public.attendance_holidays for insert to authenticated
  with check ((select public.current_user_role()) = 'admin_manager');
create policy attendance_holidays_delete on public.attendance_holidays for delete to authenticated
  using ((select public.current_user_role()) = 'admin_manager');

revoke all on public.attendance_holidays from public, anon, authenticated;
grant select, insert, delete on public.attendance_holidays to authenticated;

select private.guard_table_for_impersonation('public.attendance_holidays');

-- حارسُ الإجازة: لا جمعة (عطلةٌ أصلاً)، ولا ما قبل بداية المشروع. والمستقبلُ مفتوح (التعيينُ استباقيّ).
create or replace function private.guard_attendance_holidays()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if extract(isodow from new.day) = 5 then
    raise exception 'الجمعة عطلةٌ أصلاً — لا تُعيَّن إجازة';
  end if;
  if new.day < date '2026-10-01' then
    raise exception 'قبل بداية المشروع';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();   -- المعيِّنُ هو المستدعي، لا ما يُرسَل
  end if;
  new.reason := btrim(new.reason);
  return new;
end;
$function$;
revoke all on function private.guard_attendance_holidays() from public, anon, authenticated;

create trigger attendance_holidays_guard
  before insert or update on public.attendance_holidays
  for each row execute function private.guard_attendance_holidays();

-- ═══════════════════════════════ حارسُ الحضور ═══════════════════════════════
-- نسخةُ الإنتاج الحيّة كما هي، ويُزاد في فرع INSERT وحده بعد الفحوص القائمة:
--   الإجازةُ العامة ترفض (إلا يوماً سُجّل قبل تعيينها فيُعاد حفظُه — «حضورٌ سُجّل قبلها يبقى»)،
--   والبلاغُ المعتمَد يرفض، والمعلّقُ أو المرفوضُ يُحذف (حفظُ الحضور يعني أنّ الحلقة انعقدت).
create or replace function private.guard_attendance_days()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_holiday text;
  v_off_status text;
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then return old; end if;
    if private.attendance_month_approved(old.halaqa_id, old.day) then
      raise exception 'الشهر معتمَد — يُعيده المعتمِد أوّلاً';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
     and (new.halaqa_id, new.day, new.created_at) is not distinct from (old.halaqa_id, old.day, old.created_at) then
    return new;   -- تغيّر recorded_by وحده (تفريغٌ تتابعيّ أو تصحيح)
  end if;

  if new.day > private.attendance_today() then
    raise exception 'لا يُسجَّل يومٌ لم يأتِ';
  end if;
  if extract(isodow from new.day) = 5 then
    raise exception 'الجمعة عطلة — لا يُسجَّل فيها حضور';
  end if;
  if tg_op = 'UPDATE' and private.attendance_month_approved(old.halaqa_id, old.day) then
    raise exception 'الشهر معتمَد — يُعيده المعتمِد أوّلاً';
  end if;
  if private.attendance_month_approved(new.halaqa_id, new.day) then
    raise exception 'الشهر معتمَد — يُعيده المعتمِد أوّلاً';
  end if;

  if tg_op = 'INSERT' then
    select h.reason into v_holiday from public.attendance_holidays h where h.day = new.day;
    if v_holiday is not null
       and not exists (select 1 from public.attendance_days a where a.halaqa_id = new.halaqa_id and a.day = new.day) then
      raise exception 'هذا اليوم إجازةٌ عامة: % — لا يُسجَّل فيه حضور', v_holiday;
    end if;

    select o.status into v_off_status from public.attendance_off_days o
     where o.halaqa_id = new.halaqa_id and o.day = new.day
     for update;
    if v_off_status = 'approved' then
      raise exception 'اعتُمد أنّ الحلقة لم تنعقد في هذا اليوم — يُلغيه المعتمِد أوّلاً';
    elsif v_off_status in ('pending', 'rejected') then
      delete from public.attendance_off_days o where o.halaqa_id = new.halaqa_id and o.day = new.day;
    end if;
  end if;

  return new;
end;
$function$;
revoke all on function private.guard_attendance_days() from public, anon, authenticated;

-- ═══════════════════════════════ الدوالُّ المساعدة ═══════════════════════════════

-- من يعتمد بلاغاتِ الحلقة: مشرفُها الميدانيّ، والمديرُ الإداريّ، والمديرُ الفنيّ لحلقات البنين، والمديرةُ الإدارية لحلقات البنات.
create or replace function private.can_review_off_day(p_halaqa uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select exists (
    select 1 from public.halaqat h
     where h.id = p_halaqa
       and (   public.is_halaqa_supervisor(h.id)
            or public.current_user_role() = 'admin_manager'
            or (public.current_user_role() = 'technical_manager' and h.gender = 'male')
            or (public.current_user_role() = 'women_admin' and h.gender = 'female')));
$function$;
revoke all on function private.can_review_off_day(uuid) from public, anon;
grant execute on function private.can_review_off_day(uuid) to authenticated;

-- نافذةُ البلاغ: نصُّ الرفض العربيّ أو null. للبلاغ وحده (لا للسحب ولا للاعتماد).
create or replace function private.off_day_window_ok(p_halaqa uuid, p_day date)
 returns text
 language plpgsql
 stable
 set search_path to ''
as $function$
declare
  v_today date := private.attendance_today();
begin
  if extract(isodow from p_day) = 5 then
    return 'الجمعة عطلة — لا بلاغ فيها';
  end if;
  if p_day < date '2026-10-01' then
    return 'قبل بداية المشروع';
  end if;
  if p_day > v_today then
    return 'لا بلاغ عن يومٍ لم يأتِ';
  end if;
  if p_day < (date_trunc('month', v_today) - interval '1 month')::date then
    return 'البلاغُ لأيام هذا الشهر والذي قبله';
  end if;
  if private.attendance_month_approved(p_halaqa, p_day) then
    return 'الشهر معتمَد — لا بلاغ بعد اعتماده';
  end if;
  if exists (select 1 from public.attendance_holidays h where h.day = p_day) then
    return 'هذا اليوم إجازةٌ عامة — لا يحتاج بلاغاً';
  end if;
  return null;
end;
$function$;
revoke all on function private.off_day_window_ok(uuid, date) from public, anon, authenticated;

-- ═══════════════════════════════ دوالُّ الكتابة ═══════════════════════════════

-- البلاغ: للمعلّم الحاليّ للحلقة. يمحو حضورَ اليوم (وتتبعه غياباتُه)، ويُعيد البلاغَ المعلّقَ أو المرفوضَ معلّقاً بسببه الجديد.
create or replace function public.report_off_day(
  p_halaqa uuid, p_day date, p_reason text, p_note text, p_reported_at timestamptz default null
) returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_err text;
  v_id uuid;
  v_status text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_name text;
  v_gender text;
  v_supervisor uuid;
  v_label text;
  v_rcpt uuid;
begin
  perform private.assert_session_writable();

  select h.name, h.gender::text, h.supervisor_id into v_name, v_gender, v_supervisor
    from public.halaqat h
   where h.id = p_halaqa and h.teacher_id = v_uid;
  if not found or public.current_user_role() is null then
    raise exception 'هذه الحلقة ليست حلقتك' using errcode = '42501';
  end if;

  if p_day is null then
    raise exception 'اليومُ مطلوب' using errcode = '22023';
  end if;
  if p_reason is null or p_reason not in ('official_holiday', 'security', 'teacher_sick', 'other') then
    raise exception 'سببٌ غير معروف' using errcode = '22023';
  end if;
  if p_reason = 'other' and v_note is null then
    raise exception 'اكتب السببَ في الملاحظة' using errcode = '22023';
  end if;
  if char_length(v_note) > 300 then
    raise exception 'الملاحظةُ أطولُ من 300 حرف' using errcode = '22023';
  end if;

  -- إعادةُ رفعٍ بعد ردٍّ ضائع: البلاغُ قائمٌ بالسبب والملاحظة أنفسهما (معلّقاً أو معتمَداً) ← يُردّ كما هو بلا كتابةٍ ولا إشعار.
  -- قبل فحص النافذة وفحص «اعتُمد البلاغ»، فلا يُرفض ما قُبل أصلاً لأنّ الشهرَ اعتُمد أو اليومَ صار إجازةً بعده.
  select o.id, o.status into v_id, v_status
    from public.attendance_off_days o
   where o.halaqa_id = p_halaqa and o.day = p_day
     and o.reason = p_reason and o.note is not distinct from v_note
     and o.status in ('pending', 'approved')
   for update;
  if found then
    return jsonb_build_object('id', v_id, 'status', v_status);
  end if;

  v_err := private.off_day_window_ok(p_halaqa, p_day);
  if v_err is not null then
    raise exception '%', v_err using errcode = 'P0001';
  end if;

  -- (والسباقُ مع اعتمادٍ متزامن يمسكه شرطُ on conflict أدناه)
  if exists (select 1 from public.attendance_off_days o
              where o.halaqa_id = p_halaqa and o.day = p_day and o.status = 'approved') then
    raise exception 'اعتُمد البلاغُ عن هذا اليوم' using errcode = 'P0001';
  end if;

  -- يومٌ واحد = حضورٌ أو بلاغ: حضورُ اليوم يُمحى، وغياباتُه تتبعه تتابعاً.
  delete from public.attendance_days a where a.halaqa_id = p_halaqa and a.day = p_day;

  insert into public.attendance_off_days as o (halaqa_id, day, reason, note, status, reported_by, reported_at)
  values (p_halaqa, p_day, p_reason, v_note, 'pending', v_uid, least(coalesce(p_reported_at, now()), now()))
  on conflict (halaqa_id, day) do update
     set reason = excluded.reason,
         note = excluded.note,
         status = 'pending',
         reported_by = excluded.reported_by,
         reported_at = excluded.reported_at,
         reviewed_by = null,
         reviewed_at = null,
         review_note = null
   where o.status <> 'approved'
  returning o.id into v_id;

  if v_id is null then
    raise exception 'اعتُمد البلاغُ عن هذا اليوم' using errcode = 'P0001';
  end if;

  v_label := case p_reason
               when 'official_holiday' then 'عطلة رسمية'
               when 'security' then 'ظرف أمني'
               when 'teacher_sick' then 'مرض المعلم أو عذر طارئ'
               else 'سبب آخر' end;

  -- المشرفُ الميدانيّ للحلقة، ثمّ المديرُ الفنيّ (البنين) أو المديرةُ الإدارية (البنات) — النشطون وحدهم.
  for v_rcpt in
    select v_supervisor where v_supervisor is not null
    union
    select p.id from public.profiles p
     where p.status = 'active'
       and ((p.role = 'technical_manager' and v_gender = 'male')
         or (p.role = 'women_admin' and v_gender = 'female'))
  loop
    perform private.notify(
      v_rcpt, 'off_day_reported',
      'لم تنعقد حلقة ' || v_name || ' يوم ' || to_char(p_day, 'DD/MM'),
      v_label || coalesce(' — ' || v_note, ''),
      '/attendance?h=' || p_halaqa::text || '&d=' || to_char(p_day, 'YYYY-MM-DD'),
      'attendance_off_days', v_id);
  end loop;

  return jsonb_build_object('id', v_id, 'status', 'pending');
end;
$function$;
revoke all on function public.report_off_day(uuid, date, text, text, timestamptz) from public, anon;
grant execute on function public.report_off_day(uuid, date, text, text, timestamptz) to authenticated;

-- «تراجع — الحلقة انعقدت»: يحذف البلاغَ المعلّق أو المرفوض. لا بلاغ = نجاحٌ صامت (إعادةُ الرفع آمنة).
create or replace function public.withdraw_off_day(p_halaqa uuid, p_day date)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_status text;
begin
  perform private.assert_session_writable();

  if not exists (select 1 from public.halaqat h where h.id = p_halaqa and h.teacher_id = auth.uid())
     or public.current_user_role() is null then
    raise exception 'هذه الحلقة ليست حلقتك' using errcode = '42501';
  end if;

  select o.status into v_status from public.attendance_off_days o
   where o.halaqa_id = p_halaqa and o.day = p_day
   for update;
  if not found then
    return jsonb_build_object('withdrawn', false);
  end if;
  if v_status = 'approved' then
    raise exception 'اعتُمد البلاغ — لا يُسحب' using errcode = 'P0001';
  end if;

  delete from public.attendance_off_days o where o.halaqa_id = p_halaqa and o.day = p_day;
  return jsonb_build_object('withdrawn', true);
end;
$function$;
revoke all on function public.withdraw_off_day(uuid, date) from public, anon;
grant execute on function public.withdraw_off_day(uuid, date) to authenticated;

-- الاعتمادُ أو الرفض. المعتمِدُ يغيّر قرارَه ما دام الشهرُ غيرَ معتمَد؛ وبعد اعتماده يُقبل المعلّقُ وحده.
-- الرفضُ يُشعر المعلّمَ الحاليّ؛ والقبولُ لا يُشعر.
create or replace function public.review_off_day(p_id uuid, p_approve boolean, p_note text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_row public.attendance_off_days%rowtype;
  v_status text;
  v_note text;
  v_teacher uuid;
begin
  perform private.assert_session_writable();

  if p_approve is null then
    raise exception 'القرارُ مطلوب: قبولٌ أو رفض' using errcode = '22023';
  end if;

  select * into v_row from public.attendance_off_days o where o.id = p_id for update;
  if not found then
    raise exception 'البلاغ غير موجود' using errcode = 'P0002';
  end if;

  if not private.can_review_off_day(v_row.halaqa_id) then
    raise exception 'لا صلاحيةَ لك في اعتماد بلاغات هذه الحلقة' using errcode = '42501';
  end if;

  v_status := case when p_approve then 'approved' else 'rejected' end;
  v_note := case when p_approve then null else nullif(btrim(coalesce(p_note, '')), '') end;
  if char_length(v_note) > 300 then
    raise exception 'سببُ الرفض أطولُ من 300 حرف' using errcode = '22023';
  end if;

  -- رفضٌ مكرَّر بالملاحظة نفسها (نقرةٌ ثانية أو ردٌّ ضائع): لا كتابةَ ولا إشعارَ ثانٍ. وبملاحظةٍ أخرى يُحدَّث ويُشعَر.
  if not p_approve and v_row.status = 'rejected' and v_row.review_note is not distinct from v_note then
    return jsonb_build_object('status', v_row.status);
  end if;

  if v_row.status <> 'pending' and private.attendance_month_approved(v_row.halaqa_id, v_row.day) then
    raise exception 'الشهر معتمَد — لا يُغيَّر قرارٌ سابق' using errcode = 'P0001';
  end if;

  update public.attendance_off_days o
     set status = v_status,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = v_note
   where o.id = p_id;

  if not p_approve then
    select h.teacher_id into v_teacher from public.halaqat h where h.id = v_row.halaqa_id;
    perform private.notify(
      v_teacher, 'off_day_rejected',
      'لم يُعتمد بلاغُ ' || to_char(v_row.day, 'DD/MM'),
      v_note,
      '/t', 'attendance_off_days', p_id);
  end if;

  return jsonb_build_object('status', v_status);
end;
$function$;
revoke all on function public.review_off_day(uuid, boolean, text) from public, anon;
grant execute on function public.review_off_day(uuid, boolean, text) to authenticated;

-- ═══════════════════════════════ متابعةُ الرصد ═══════════════════════════════
-- نسخةُ الإنتاج الحيّة (تطابق 20261022111454) بالتوقيع وأعمدة الردّ نفسها، ويُزاد:
--   لكلّ يومٍ holiday (إجازةٌ عامة) وoff_status (حالةُ البلاغ)؛ واليومُ الإجازةُ أو المعتمَدُ بلاغُه يخرج من expected_days
--   ومن missed_days إلا أن يكون منعقداً؛ والمعلّقُ يبقى ناقصاً. والحالةُ في recent بالأسبقية:
--   before ← held ← holiday ← off (معتمَد) ← off_pending ← today ← missed.
create or replace function public.halaqat_recording_status(p_year integer default null, p_month integer default null)
 returns table (
   halaqa_id uuid, halaqa_name text, gender text,
   teacher_name text, teacher_phone text, teacher_whatsapp text,
   today date, recorded_today boolean, expected_days integer, recorded_days integer, missed_days date[],
   recent jsonb, report_year integer, report_month integer, report_status text, report_deadline date)
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  with t as (select private.attendance_today() as d),
  sel as (
    select coalesce(case when p_year is not null and p_month is not null then make_date(p_year, p_month, 1) end,
                    date_trunc('month', t.d)::date) as m,
           (p_year is not null and p_month is not null) as picked
      from t
  ),
  win as (
    select sel.m, least(t.d, (sel.m + interval '1 month' - interval '1 day')::date) as anchor, sel.picked, t.d as today
      from sel, t
  ),
  due as (
    select case
             when win.picked then win.m
             when win.today >= private.report_opening_day(extract(year from win.today)::int, extract(month from win.today)::int)
               then date_trunc('month', win.today)::date
             else (date_trunc('month', win.today) - interval '1 month')::date end as m
      from win
  ),
  h as (
    select h.id, h.name, h.gender::text as gender, h.teacher_id,
           (h.created_at at time zone 'Asia/Gaza')::date as created_d,
           greatest(win.m, (h.created_at at time zone 'Asia/Gaza')::date) as since, win.anchor, win.today
      from public.halaqat h, win
     where h.status = 'active'
       and h.id = any ((select public.visible_halaqa_ids())::uuid[])
  ),
  days as (
    select h.id as hid, g::date as day, (g::date = h.today) as is_today,
           exists (select 1 from public.attendance_days a where a.halaqa_id = h.id and a.day = g::date) as held,
           exists (select 1 from public.attendance_holidays x where x.day = g::date) as holiday,
           (select o.status from public.attendance_off_days o where o.halaqa_id = h.id and o.day = g::date) as off_status
      from h, generate_series(h.since, h.anchor, interval '1 day') g
     where extract(isodow from g) <> 5
  ),
  recent15 as (
    select h.id as hid, g::date as day, (g::date = h.today) as is_today,
           exists (select 1 from public.attendance_days a where a.halaqa_id = h.id and a.day = g::date) as held,
           g::date < h.created_d as before_start,
           exists (select 1 from public.attendance_holidays x where x.day = g::date) as holiday,
           (select o.status from public.attendance_off_days o where o.halaqa_id = h.id and o.day = g::date) as off_status
      from h, generate_series(h.anchor - 24, h.anchor, interval '1 day') g
     where extract(isodow from g) <> 5
  )
  select h.id, h.name, h.gender, t.full_name, t.phone, t.whatsapp,
         h.today,
         coalesce((select d.held from days d where d.hid = h.id and d.is_today), false),
         (select count(*) from days d
           where d.hid = h.id and not d.is_today
             and (d.held or not (d.holiday or d.off_status is not distinct from 'approved')))::integer
           + (case when coalesce((select d.held from days d where d.hid = h.id and d.is_today), false) then 1 else 0 end),
         (select count(*) from days d where d.hid = h.id and d.held)::integer,
         coalesce((select array_agg(d.day order by d.day) from days d
                    where d.hid = h.id and not d.held and not d.is_today
                      and not d.holiday and d.off_status is distinct from 'approved'), '{}'),
         (select coalesce(jsonb_agg(jsonb_build_object('day', r.day,
                   'state', case when r.before_start then 'before'
                                 when r.held then 'held'
                                 when r.holiday then 'holiday'
                                 when r.off_status = 'approved' then 'off'
                                 when r.off_status = 'pending' then 'off_pending'
                                 when r.is_today then 'today'
                                 else 'missed' end)
                   order by r.day), '[]'::jsonb)
            from (select * from recent15 x where x.hid = h.id order by x.day desc limit 15) r),
         extract(year from due.m)::integer, extract(month from due.m)::integer,
         (select r.status::text from public.monthly_reports r
           where r.halaqa_id = h.id and r.report_year = extract(year from due.m) and r.report_month = extract(month from due.m)),
         private.report_opening_day(extract(year from due.m)::int, extract(month from due.m)::int) + 3
    from h
    cross join due
    left join public.profiles t on t.id = h.teacher_id
   order by h.name;
$function$;
revoke all on function public.halaqat_recording_status(integer, integer) from public, anon;
grant execute on function public.halaqat_recording_status(integer, integer) to authenticated;

-- ═══════════════════════════════ فحصٌ ذاتيّ ═══════════════════════════════
do $$
declare
  v_fn regprocedure;
  v_def text := pg_get_functiondef('private.guard_attendance_days()'::regprocedure);
  v_tbl regclass;
  v_trg record;
begin
  -- الدوالُّ العامّة الأربع: لـauthenticated، لا لـanon ولا لـPUBLIC، وكلُّها definer بمسارٍ فارغ
  foreach v_fn in array array[
    'public.report_off_day(uuid,date,text,text,timestamptz)'::regprocedure,
    'public.withdraw_off_day(uuid,date)'::regprocedure,
    'public.review_off_day(uuid,boolean,text)'::regprocedure,
    'public.halaqat_recording_status(integer,integer)'::regprocedure
  ] loop
    if not has_function_privilege('authenticated', v_fn::oid, 'EXECUTE') then
      raise exception '% بلا EXECUTE لـauthenticated', v_fn;
    end if;
    if has_function_privilege('anon', v_fn::oid, 'EXECUTE') then
      raise exception '% قابلةٌ للتنفيذ من anon', v_fn;
    end if;
    if exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = v_fn and a.grantee = 0) then
      raise exception '% ممنوحةٌ لـPUBLIC', v_fn;
    end if;
    if not exists (select 1 from pg_proc where oid = v_fn and prosecdef and proconfig @> array['search_path=""']) then
      raise exception '% فقدت security definer أو search_path', v_fn;
    end if;
  end loop;

  -- الدالّةُ الداخلية والمشغّلات بلا EXECUTE لأحد؛ وcan_review_off_day لـauthenticated وحده
  foreach v_fn in array array[
    'private.off_day_window_ok(uuid,date)'::regprocedure,
    'private.guard_attendance_days()'::regprocedure,
    'private.guard_attendance_holidays()'::regprocedure
  ] loop
    if has_function_privilege('authenticated', v_fn::oid, 'EXECUTE') or has_function_privilege('anon', v_fn::oid, 'EXECUTE') then
      raise exception '% قابلةٌ للتنفيذ من authenticated أو anon', v_fn;
    end if;
  end loop;
  if not has_function_privilege('authenticated', 'private.can_review_off_day(uuid)'::regprocedure, 'EXECUTE')
     or has_function_privilege('anon', 'private.can_review_off_day(uuid)'::regprocedure, 'EXECUTE') then
    raise exception 'can_review_off_day: المنحُ لـauthenticated وحده';
  end if;

  -- الحارسُ يعرف الإجازةَ والبلاغ، وبقي definer بمسارٍ فارغ
  if position('attendance_holidays' in v_def) = 0 or position('attendance_off_days' in v_def) = 0 then
    raise exception 'guard_attendance_days لا يعرف attendance_holidays أو attendance_off_days';
  end if;
  if position('isodow from new.day) = 5' in v_def) = 0 then
    raise exception 'guard_attendance_days فقد فحصَ الجمعة';
  end if;
  if not exists (select 1 from pg_proc where oid = 'private.guard_attendance_days()'::regprocedure
                 and prosecdef and proconfig @> array['search_path=""']) then
    raise exception 'guard_attendance_days فقد security definer أو search_path';
  end if;

  -- المُشغِّلات فعّالة
  for v_trg in
    select * from (values
      ('public.attendance_days'::regclass, 'attendance_days_guard'),
      ('public.attendance_holidays'::regclass, 'attendance_holidays_guard'),
      ('public.attendance_holidays'::regclass, 'log_impersonation_write'),
      ('public.attendance_off_days'::regclass, 'attendance_off_days_updated_at'),
      ('public.attendance_off_days'::regclass, 'log_impersonation_write')
    ) x(rel, name)
  loop
    if not exists (select 1 from pg_trigger where tgrelid = v_trg.rel and tgname = v_trg.name and tgenabled <> 'D') then
      raise exception 'المُشغِّل % على % غائبٌ أو معطَّل', v_trg.name, v_trg.rel;
    end if;
  end loop;

  -- الجدولان بـRLS مفعّلة، وanon بلا صلاحيات، وattendance_off_days بلا كتابةٍ مباشرة لـauthenticated
  foreach v_tbl in array array['public.attendance_off_days'::regclass, 'public.attendance_holidays'::regclass] loop
    if not (select relrowsecurity from pg_class where oid = v_tbl) then
      raise exception 'RLS غير مفعّلة على %', v_tbl;
    end if;
    if has_table_privilege('anon', v_tbl::oid, 'SELECT') or has_table_privilege('anon', v_tbl::oid, 'INSERT')
       or has_table_privilege('anon', v_tbl::oid, 'UPDATE') or has_table_privilege('anon', v_tbl::oid, 'DELETE') then
      raise exception 'لـanon صلاحيةٌ على %', v_tbl;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.attendance_off_days', 'INSERT')
     or has_table_privilege('authenticated', 'public.attendance_off_days', 'UPDATE')
     or has_table_privilege('authenticated', 'public.attendance_off_days', 'DELETE') then
    raise exception 'attendance_off_days: كتابةٌ مباشرة لـauthenticated';
  end if;
  if has_table_privilege('authenticated', 'public.attendance_holidays', 'UPDATE') then
    raise exception 'attendance_holidays: تعديلٌ لـauthenticated';
  end if;

  -- الأنواعُ الجديدة في القائمة البيضاء والقيد معاً
  if position('off_day_rejected' in pg_get_functiondef(
       'private.notify(uuid,text,text,text,text,text,uuid)'::regprocedure)) = 0
     or position('off_day_rejected' in (select pg_get_constraintdef(oid) from pg_constraint
                                        where conname = 'notifications_kind_check'
                                          and conrelid = 'public.notifications'::regclass)) = 0 then
    raise exception 'off_day_* غائبةٌ عن private.notify أو notifications_kind_check';
  end if;
end;
$$;
