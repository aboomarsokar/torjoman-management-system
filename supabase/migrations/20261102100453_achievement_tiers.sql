-- درجاتُ الإنجاز وتقسيطُ أكتوبر (طلب المستخدم 2026-11-02):
-- · المطلوبُ يُقسَّط بالحضور من أوّل شهرٍ في المشروع (10-2026) لا من 11 — أُزيل الاستثناء.
-- · ثلاثُ درجات: أنجز (≥ 100% من المطلوب) · قريب `near` (≥ 75%) · مقصّر (< 75%).
-- · تخفيضُ الاختبار: من اختُبر في الشهر يُخصم من مطلوبه الكامل قبل التقسيط أثلاثٌ بعدد أجزاء الدورة — 3 أجزاء الثلث،
--   5 الثلثان، 10 كاملاً (أكبرُها، نجح أو لم ينجح)؛ وما خُصم كلُّه لا يرفعه التقسيطُ إلى صفحة. مرآةُ `EXAM_RELIEF_THIRDS`.
-- · إنجازُ المعلم في سجلّ الجودة: أعلى 12 طالباً بأوزان أنجز 1 · قريب ½ · مقصّر ولم يُرصد 0، مقسوماً على 12 دائماً
--   (من 50): مجموعُ الأعلى = least(أنجز, 12) + ½ · least(قريب, 12 − least(أنجز, 12)).

create or replace function private.halaqa_student_achievement(p_halaqa uuid, p_year integer, p_month integer)
 returns table (student_id uuid, pages integer, required integer, state text)
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  v_from date := make_date(p_year, p_month, 1);
  v_to date := (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date;
  v_report_id uuid;
  v_target integer;
  v_month_days integer;
  v_held integer;
  v_att integer;
  v_relief integer;
  v_base integer;
  s record;
begin
  select r.id, r.target_pages_snapshot into v_report_id, v_target
    from public.monthly_reports r
   where r.halaqa_id = p_halaqa and r.report_year = p_year and r.report_month = p_month;
  v_target := coalesce(v_target, (select a.target_memorization_pages from public.app_settings a limit 1));
  select count(*) into v_month_days from public.attendance_days d
   where d.halaqa_id = p_halaqa and d.day between v_from and v_to;

  for s in select st.id, st.enrollment_date from public.students st where st.halaqa_id = p_halaqa and st.status = 'active' loop
    student_id := s.id;
    pages := null;
    required := null;
    if v_report_id is not null then
      select q.pages_memorized into pages from public.quran_records q where q.report_id = v_report_id and q.student_id = s.id;
    end if;
    if pages is null then
      state := 'unrecorded';
      return next;
      continue;
    end if;
    if v_target is null then
      required := null;
    else
      select coalesce(max(case c.parts_to - c.parts_from + 1 when 3 then 1 when 5 then 2 when 10 then 3 else 0 end), 0)
        into v_relief
        from public.exam_results r
        join public.exam_list_items li on li.id = r.exam_list_item_id
        join public.exam_cycles c on c.id = li.exam_cycle_id
       where r.student_id = s.id and r.exam_date between v_from and v_to;
      v_base := v_target - round(v_target::numeric * v_relief / 3)::integer;
      select count(*) into v_held from public.attendance_days d
       where d.halaqa_id = p_halaqa and d.day between v_from and v_to
         and (s.enrollment_date is null or d.day >= s.enrollment_date);
      select v_held - count(*) into v_att from public.attendance_absences a
        join public.attendance_days d on d.halaqa_id = a.halaqa_id and d.day = a.day
       where a.student_id = s.id and a.halaqa_id = p_halaqa and a.day between v_from and v_to
         and (s.enrollment_date is null or a.day >= s.enrollment_date);
      if v_held = 0 and v_month_days > 0 then required := null;
      elsif v_held = 0 then required := v_base;
      elsif v_att <= 0 then required := null;
      elsif v_att >= v_held or v_base = 0 then required := v_base;
      else required := greatest(1, round(v_base::numeric * v_att / v_held)::integer);
      end if;
    end if;
    state := case when required is null then 'unmeasured' when pages >= required then 'done'
                  when pages * 4 >= required * 3 then 'near' else 'short' end;
    return next;
  end loop;
end;
$function$;
revoke all on function private.halaqa_student_achievement(uuid, integer, integer) from public, anon, authenticated;

drop function public.halaqat_achievement(integer, integer);
create function public.halaqat_achievement(p_year integer, p_month integer)
 returns table (
   halaqa_id uuid, halaqa_name text, gender text,
   teacher_id uuid, teacher_name text, teacher_phone text, teacher_whatsapp text,
   report_status text, students integer, done integer, near integer, short integer, unrecorded integer, unmeasured integer)
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select h.id, h.name, h.gender::text,
         t.id, t.full_name, t.phone, t.whatsapp,
         (select r.status::text from public.monthly_reports r
           where r.halaqa_id = h.id and r.report_year = p_year and r.report_month = p_month),
         count(a.student_id)::integer,
         (count(*) filter (where a.state = 'done'))::integer,
         (count(*) filter (where a.state = 'near'))::integer,
         (count(*) filter (where a.state = 'short'))::integer,
         (count(*) filter (where a.state = 'unrecorded'))::integer,
         (count(*) filter (where a.state = 'unmeasured'))::integer
    from public.halaqat h
    left join public.profiles t on t.id = h.teacher_id
    left join lateral private.halaqa_student_achievement(h.id, p_year, p_month) a on true
   where h.status = 'active'
     and h.id = any ((select public.visible_halaqa_ids())::uuid[])
   group by h.id, h.name, h.gender, t.id, t.full_name, t.phone, t.whatsapp
   order by h.name;
$function$;
revoke all on function public.halaqat_achievement(integer, integer) from public, anon;
grant execute on function public.halaqat_achievement(integer, integer) to authenticated;

create or replace function public.halaqa_achievement_students(p_halaqa uuid, p_year integer, p_month integer)
 returns table (student_id uuid, full_name text, pages integer, required integer, state text)
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
begin
  if not (p_halaqa = any ((select public.visible_halaqa_ids())::uuid[])) then
    raise exception 'الحلقة خارج نطاقك.' using errcode = '42501';
  end if;
  return query
    select a.student_id, s.full_name, a.pages, a.required, a.state
      from private.halaqa_student_achievement(p_halaqa, p_year, p_month) a
      join public.students s on s.id = a.student_id
     order by case a.state when 'short' then 0 when 'near' then 1 when 'unrecorded' then 2 when 'unmeasured' then 3 else 4 end, s.full_name;
end;
$function$;

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
  v_done integer := 0;
  v_near integer := 0;
  v_short integer := 0;
  v_unrec integer := 0;
  v_unmeas integer := 0;
  v_top numeric;
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
     and (v.scheduled_at at time zone 'Asia/Gaza')::date between v_from and v_to
     -- زياراتُ المشرف الميدانيّ والمدير الفنيّ والمديرة الإدارية تُحسب (قرار المستخدم 2026-10-30)
     and exists (select 1 from public.profiles p where p.id = v.supervisor_id
                  and p.role in ('field_supervisor', 'technical_manager', 'women_admin'));
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

  -- إنجازُ الحلقة: حكمُ كلّ طالبٍ نشط من المصدر الواحد `halaqa_student_achievement` (تقسيطٌ ودرجات)
  select count(*) filter (where a.state = 'done'), count(*) filter (where a.state = 'near'),
         count(*) filter (where a.state = 'short'), count(*) filter (where a.state = 'unrecorded'),
         count(*) filter (where a.state = 'unmeasured')
    into v_done, v_near, v_short, v_unrec, v_unmeas
    from private.halaqa_student_achievement(p_halaqa, p_year, p_month) a;

  -- أعلى 12 طالباً: أنجز 1 · قريب ½ · مقصّر ولم يُرصد 0، مقسوماً على 12 دائماً (قرار 2026-11-02)
  v_top := least(v_done, 12) + 0.5 * least(v_near, 12 - least(v_done, 12));
  v_quality := case when v_count > 0 then round((v_vpart + v_rq + v_rs + coalesce(p_meetings, 0)) / 2.0, 2) end;
  v_ach := case when v_done + v_near + v_short + v_unrec > 0 then round(50.0 * v_top / 12, 2) end;

  return jsonb_build_object(
    'visits', v_visits, 'visits_count', v_count, 'visits_avg', round(v_avg, 2), 'visits_part', v_vpart,
    'reports_quran', v_rq, 'reports_statement', v_rs, 'reports_deadline', v_deadline,
    'meetings', p_meetings,
    'quality', v_quality,
    'achievement_done', v_done, 'achievement_near', v_near, 'achievement_short', v_short,
    'achievement_unrecorded', v_unrec, 'achievement_unmeasured', v_unmeas,
    'achievement', v_ach,
    'final', case when v_quality is not null and v_ach is not null then v_quality + v_ach end,
    'incomplete', v_count = 0
  );
end;
$function$;
revoke all on function private.quality_month_compute(uuid, integer, integer, integer) from public, anon, authenticated;
