-- سجلُّ تقييم الجودة الشهريّ للمعلم (قرارات المستخدم 2026-10-21) — المرحلة ٢ من «نموذج الزيارة وسجلّ الجودة»:
-- • الزيارات: متوسّطُ زيارات الشهر (المنفّذة بالنموذج) × 2 ← من 84؛ بلا زيارةٍ ← «ناقص» ولا يُحسب تقييم الجودة.
-- • تسليمُ التقارير في وقتها (آليّ): الإنجازُ القرآنيّ 5 + كشفُ الحوافز 3، إن أُرسل خلال 3 أيامٍ من يوم فتح الإرسال.
-- • حضورُ الاجتماعات الدورية: يرصده المشرف 0–8.
-- • تقييمُ الجودة من 50 = (الزيارات + التقارير + الاجتماعات) ÷ 2.
-- • إنجازُ الحلقة من 50 = 50 × أنجز ÷ (أنجز + مقصّر + لم يُرصد) — بحساب شاشة «الإنجاز القرآني» نفسِه.
-- • التقييمُ النهائيّ من 100 = الجودة + الإنجاز.
-- المشرفُ يحفظ فيُقفل (وتُثبَّت الأرقامُ لحظتَها)، والمديرُ الإداريّ والفنيّ يفتحان، والمعلمُ يُشعَر ويُقرّ،
-- والمديرُ الفنيّ يكتب «ملاحظات الإدارة». الكتابةُ كلُّها بدوالّ؛ لا سياسةَ كتابةٍ على الجدول.

create table public.teacher_quality_months (
  id uuid primary key default gen_random_uuid(),
  halaqa_id uuid not null references public.halaqat(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  supervisor_id uuid references public.profiles(id) on delete set null,
  year integer not null check (year between 2024 and 2100),
  month integer not null check (month between 1 and 12),
  meetings_score smallint not null check (meetings_score between 0 and 8),
  supervisor_notes text check (supervisor_notes is null or char_length(supervisor_notes) <= 2000),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 2000),
  admin_notes_by uuid references public.profiles(id) on delete set null,
  admin_notes_at timestamptz,
  numbers jsonb not null,
  quality numeric(5, 2),
  achievement numeric(5, 2),
  final numeric(5, 2),
  locked_at timestamptz,
  teacher_ack_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (halaqa_id, year, month)
);
create index teacher_quality_months_teacher_idx on public.teacher_quality_months (teacher_id);
create index teacher_quality_months_supervisor_idx on public.teacher_quality_months (supervisor_id);
create index teacher_quality_months_admin_notes_by_idx on public.teacher_quality_months (admin_notes_by);

alter table public.teacher_quality_months enable row level security;
-- القراءة: من يرى الحلقة (المشرفُ والإدارةُ والمديرةُ للبنات ومعلّمُها)، والمعلمُ سجلَّه ولو تغيّرت حلقته
create policy quality_months_read on public.teacher_quality_months for select to authenticated
  using (halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]) or teacher_id = (select auth.uid()));
revoke all on public.teacher_quality_months from anon, public;
grant select on public.teacher_quality_months to authenticated;
select private.guard_table_for_impersonation('public.teacher_quality_months'::regclass, true);

create trigger trg_teacher_quality_months_updated_at before update on public.teacher_quality_months
  for each row execute function public.set_updated_at();

-- ── الحساب (مرآةُ buildStudentRows/proratePlan/outcomeOf للإنجاز، ومن 2026-11 يُقسَّط بالحضور) ──
create or replace function private.quality_month_compute(p_halaqa uuid, p_year integer, p_month integer, p_meetings integer)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  v_from date := make_date(p_year, p_month, 1);
  v_to date := (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date;
  v_deadline date := private.report_opening_day(p_year, p_month) + 3;
  v_prorate boolean := (p_year, p_month) >= (2026, 11);
  v_visits jsonb;
  v_count integer;
  v_avg numeric;
  v_vpart numeric;
  v_report_id uuid;
  v_report_status text;
  v_report_sent date;
  v_target integer;
  v_rq integer := 0;
  v_rs integer := 0;
  v_month_days integer;
  v_done integer := 0;
  v_short integer := 0;
  v_unrec integer := 0;
  v_unmeas integer := 0;
  s record;
  v_pages integer;
  v_held integer;
  v_att integer;
  v_req integer;
  v_quality numeric;
  v_ach numeric;
begin
  -- الزيارات المنفّذة بالنموذج (لها مجموع) في شهر موعدها
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', v.id, 'date', (v.executed_at at time zone 'Asia/Gaza')::date,
           'score', v.score, 'criteria', to_jsonb(v.criteria_scores)) order by v.executed_at), '[]'::jsonb),
         count(*), avg(v.score)
    into v_visits, v_count, v_avg
    from public.supervision_visits v
   where v.halaqa_id = p_halaqa and v.score is not null and v.executed_at is not null
     and (v.scheduled_at at time zone 'Asia/Gaza')::date between v_from and v_to;
  v_vpart := case when v_count > 0 then round(v_avg * 2, 2) end;

  -- التقارير في وقتها: أُرسلت (أو اعتُمدت) ويومُ إرسالها لا يتجاوز يومَ الفتح + 3
  select r.id, r.status::text, r.submitted_at, r.target_pages_snapshot
    into v_report_id, v_report_status, v_report_sent, v_target
    from public.monthly_reports r
   where r.halaqa_id = p_halaqa and r.report_year = p_year and r.report_month = p_month;
  if v_report_status in ('submitted', 'approved') and v_report_sent is not null and v_report_sent <= v_deadline then
    v_rq := 5;
  end if;
  if exists (select 1 from public.incentive_statements st
              where st.halaqa_id = p_halaqa and st.statement_year = p_year and st.statement_month = p_month
                and st.status::text in ('submitted', 'reviewed') and st.submitted_at is not null and st.submitted_at <= v_deadline) then
    v_rs := 3;
  end if;

  -- إنجازُ الحلقة: لكلّ طالبٍ نشطٍ حكمُ الشهر (لم يُرصد · لا يُقاس · أنجز · مقصّر)
  v_target := coalesce(v_target, (select a.target_memorization_pages from public.app_settings a limit 1));
  select count(*) into v_month_days from public.attendance_days d
   where d.halaqa_id = p_halaqa and d.day between v_from and v_to;
  for s in select st.id, st.enrollment_date from public.students st where st.halaqa_id = p_halaqa and st.status = 'active' loop
    v_pages := null;
    if v_report_id is not null then
      select q.pages_memorized into v_pages from public.quran_records q where q.report_id = v_report_id and q.student_id = s.id;
    end if;
    if v_pages is null then
      v_unrec := v_unrec + 1;
      continue;
    end if;
    if v_target is null then
      v_req := null;
    elsif not v_prorate then
      v_req := v_target;
    else
      select count(*) into v_held from public.attendance_days d
       where d.halaqa_id = p_halaqa and d.day between v_from and v_to
         and (s.enrollment_date is null or d.day >= s.enrollment_date);
      select v_held - count(*) into v_att from public.attendance_absences a
        join public.attendance_days d on d.halaqa_id = a.halaqa_id and d.day = a.day
       where a.student_id = s.id and a.halaqa_id = p_halaqa and a.day between v_from and v_to
         and (s.enrollment_date is null or a.day >= s.enrollment_date);
      if v_held = 0 and v_month_days > 0 then v_req := null;
      elsif v_held = 0 then v_req := v_target;
      elsif v_att <= 0 then v_req := null;
      elsif v_att >= v_held then v_req := v_target;
      else v_req := greatest(1, round(v_target::numeric * v_att / v_held)::integer);
      end if;
    end if;
    if v_req is null then v_unmeas := v_unmeas + 1;
    elsif v_pages >= v_req then v_done := v_done + 1;
    else v_short := v_short + 1;
    end if;
  end loop;

  v_quality := case when v_count > 0 then round((v_vpart + v_rq + v_rs + coalesce(p_meetings, 0)) / 2.0, 2) end;
  v_ach := case when v_done + v_short + v_unrec > 0 then round(50.0 * v_done / (v_done + v_short + v_unrec), 2) end;

  return jsonb_build_object(
    'visits', v_visits, 'visits_count', v_count, 'visits_avg', round(v_avg, 2), 'visits_part', v_vpart,
    'reports_quran', v_rq, 'reports_statement', v_rs, 'reports_deadline', v_deadline,
    'meetings', p_meetings,
    'quality', v_quality,
    'achievement_done', v_done, 'achievement_short', v_short, 'achievement_unrecorded', v_unrec, 'achievement_unmeasured', v_unmeas,
    'achievement', v_ach,
    'final', case when v_quality is not null and v_ach is not null then v_quality + v_ach end,
    'incomplete', v_count = 0
  );
end;
$function$;
revoke all on function private.quality_month_compute(uuid, integer, integer, integer) from public, anon, authenticated;

/** يومُ إتاحة رصد السجلّ: بعد انقضاء مهلة التقارير (يومُ الفتح + 3). */
create or replace function private.quality_month_opens(p_year integer, p_month integer)
 returns date
 language sql
 immutable
 set search_path to ''
as $function$
  select private.report_opening_day(p_year, p_month) + 4;
$function$;
revoke all on function private.quality_month_opens(integer, integer) from public, anon, authenticated;

-- ── المعاينة: الأرقامُ الحيّة قبل الحفظ لمن يرى الحلقة ──
create or replace function public.quality_month_preview(p_halaqa uuid, p_year integer, p_month integer)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
begin
  if not (p_halaqa = any ((select public.visible_halaqa_ids())::uuid[])) then
    raise exception 'الحلقة خارج نطاقك.' using errcode = '42501';
  end if;
  return private.quality_month_compute(p_halaqa, p_year, p_month, null)
    || jsonb_build_object('opens_on', private.quality_month_opens(p_year, p_month));
end;
$function$;
revoke all on function public.quality_month_preview(uuid, integer, integer) from public, anon;
grant execute on function public.quality_month_preview(uuid, integer, integer) to authenticated;

-- ── الحفظ والإقفال (مشرفُ الحلقة) ──
create or replace function public.save_quality_month(p_halaqa uuid, p_year integer, p_month integer, p_meetings integer, p_notes text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_teacher uuid;
  v_halaqa text;
  v_numbers jsonb;
  v_id uuid;
  v_opens date := private.quality_month_opens(p_year, p_month);
begin
  perform private.assert_session_writable();
  select h.teacher_id, h.name into v_teacher, v_halaqa from public.halaqat h
   where h.id = p_halaqa and h.supervisor_id = (select auth.uid());
  if public.current_user_role() is distinct from 'field_supervisor' or v_halaqa is null then
    raise exception 'رصدُ سجلّ الجودة لمشرف الحلقة الميدانيّ وحده.' using errcode = '42501';
  end if;
  if p_meetings is null or p_meetings not between 0 and 8 then
    raise exception 'درجةُ حضور الاجتماعات من 0 إلى 8.' using errcode = '23514';
  end if;
  if private.attendance_today() < v_opens then
    raise exception 'يُرصد سجلُّ الشهر ابتداءً من % (بعد مهلة تسليم التقارير).', to_char(v_opens, 'DD-MM-YYYY') using errcode = '23514';
  end if;
  if exists (select 1 from public.teacher_quality_months q
              where q.halaqa_id = p_halaqa and q.year = p_year and q.month = p_month and q.locked_at is not null) then
    raise exception 'السجلّ مقفل — يفتحه المدير الإداري أو الفنيّ للتعديل.' using errcode = '42501';
  end if;

  v_numbers := private.quality_month_compute(p_halaqa, p_year, p_month, p_meetings);
  insert into public.teacher_quality_months as q
    (halaqa_id, teacher_id, supervisor_id, year, month, meetings_score, supervisor_notes,
     numbers, quality, achievement, final, locked_at, teacher_ack_at)
  values (p_halaqa, v_teacher, (select auth.uid()), p_year, p_month, p_meetings, nullif(btrim(coalesce(p_notes, '')), ''),
          v_numbers, (v_numbers ->> 'quality')::numeric, (v_numbers ->> 'achievement')::numeric, (v_numbers ->> 'final')::numeric,
          now(), null)
  on conflict (halaqa_id, year, month) do update set
    teacher_id = excluded.teacher_id, supervisor_id = excluded.supervisor_id,
    meetings_score = excluded.meetings_score, supervisor_notes = excluded.supervisor_notes,
    numbers = excluded.numbers, quality = excluded.quality, achievement = excluded.achievement, final = excluded.final,
    locked_at = excluded.locked_at, teacher_ack_at = null
  returning q.id into v_id;

  perform private.notify(v_teacher, 'quality_month', 'سجلُّ تقييمك الشهريّ',
    v_halaqa || ' · ' || lpad(p_month::text, 2, '0') || '-' || p_year
      || coalesce(' · النهائي ' || (v_numbers ->> 'final') || ' من 100', ' · ناقص — لم تُنفَّذ زيارة')
      || ' — اطّلع عليه وأقِرّ',
    '/quality?y=' || p_year || '&m=' || p_month, 'teacher_quality_months', v_id);
  return v_id;
end;
$function$;
revoke all on function public.save_quality_month(uuid, integer, integer, integer, text) from public, anon;
grant execute on function public.save_quality_month(uuid, integer, integer, integer, text) to authenticated;

-- ── الفتح (المدير الإداري والفنيّ) ──
create or replace function public.unlock_quality_month(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_sup uuid;
  v_label text;
begin
  perform private.assert_session_writable();
  if coalesce(public.current_user_role()::text, '') not in ('admin_manager', 'technical_manager') then
    raise exception 'فتحُ السجلّ للمدير الإداري والفنيّ وحدهما.' using errcode = '42501';
  end if;
  update public.teacher_quality_months q set locked_at = null, teacher_ack_at = null
   where q.id = p_id and q.locked_at is not null
  returning q.supervisor_id, (select h.name from public.halaqat h where h.id = q.halaqa_id) || ' · '
            || lpad(q.month::text, 2, '0') || '-' || q.year
    into v_sup, v_label;
  if v_label is null then
    raise exception 'السجلّ غير مقفل أو غير موجود.';
  end if;
  perform private.notify(v_sup, 'quality_unlocked', 'فُتح سجلُّ جودةٍ للتعديل', v_label || ' — صحّحه ثم احفظه',
                         '/quality', 'teacher_quality_months', p_id);
end;
$function$;
revoke all on function public.unlock_quality_month(uuid) from public, anon;
grant execute on function public.unlock_quality_month(uuid) to authenticated;

-- ── اطّلاعُ المعلم ──
create or replace function public.acknowledge_quality_month(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  perform private.assert_session_writable();
  update public.teacher_quality_months q set teacher_ack_at = now()
   where q.id = p_id and q.locked_at is not null and q.teacher_ack_at is null and q.teacher_id = (select auth.uid());
  if not found and not exists (
    select 1 from public.teacher_quality_months q
     where q.id = p_id and q.teacher_ack_at is not null and q.teacher_id = (select auth.uid())
  ) then
    raise exception 'لا سجلَّ مقفلاً لك بهذا الرقم.' using errcode = '42501';
  end if;
end;
$function$;
revoke all on function public.acknowledge_quality_month(uuid) from public, anon;
grant execute on function public.acknowledge_quality_month(uuid) to authenticated;

-- ── ملاحظاتُ الإدارة (المدير الفنيّ) ──
create or replace function public.set_quality_admin_notes(p_id uuid, p_notes text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  perform private.assert_session_writable();
  if public.current_user_role() is distinct from 'technical_manager' then
    raise exception 'ملاحظاتُ الإدارة للمدير الفنيّ.' using errcode = '42501';
  end if;
  if p_notes is not null and char_length(p_notes) > 2000 then
    raise exception 'الملاحظات أطول من 2000 حرف.' using errcode = '23514';
  end if;
  update public.teacher_quality_months q
     set admin_notes = nullif(btrim(coalesce(p_notes, '')), ''), admin_notes_by = (select auth.uid()), admin_notes_at = now()
   where q.id = p_id;
  if not found then
    raise exception 'السجلّ غير موجود.';
  end if;
end;
$function$;
revoke all on function public.set_quality_admin_notes(uuid, text) from public, anon;
grant execute on function public.set_quality_admin_notes(uuid, text) to authenticated;

-- ── الإشعاران ──
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'report_submitted', 'report_approved', 'report_returned', 'alert_issued', 'visit_scheduled',
  'exam_nominated', 'exam_graded', 'transport_paid', 'impersonation_started', 'impersonation_write',
  'statement_returned', 'visit_result', 'visit_unlocked', 'visit_rescheduled', 'quality_month', 'quality_unlocked'
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
    'quality_month', 'quality_unlocked'
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

-- ── فحصٌ ذاتيّ ──
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'teacher_quality_months'
              and permissive = 'PERMISSIVE' and cmd <> 'SELECT') then
    raise exception 'سياسةُ كتابةٍ مباشرة على سجلّ الجودة';
  end if;
  if has_function_privilege('authenticated', 'private.quality_month_compute(uuid, integer, integer, integer)', 'execute') then
    raise exception 'دالّةُ الحساب ممنوحةٌ لـauthenticated';
  end if;
  if not has_function_privilege('authenticated', 'public.save_quality_month(uuid, integer, integer, integer, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.quality_month_preview(uuid, integer, integer)', 'execute')
     or not has_function_privilege('authenticated', 'public.unlock_quality_month(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.acknowledge_quality_month(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.set_quality_admin_notes(uuid, text)', 'execute') then
    raise exception 'منحُ الدوالّ ناقص';
  end if;
end $$;
