-- مهلةُ التقارير أوّلُ يومٍ من الشهر التالي وتذكيرُ آخر الشهر (طلب المستخدم 2026-11-03):
-- · «التقارير في وقتها» في سجلّ الجودة (الإنجازُ القرآنيّ 5 · كشفُ الحوافز 3): ما أُرسل حتى نهاية أوّل يومٍ من الشهر التالي
--   (كانت يومَ الفتح + 3)، وسجلُّ الجودة يُفتح للرصد في اليوم الثاني (كان يومَ الفتح + 4)، وموعدُ «متأخّر» في متابعة الرصد مثلُها.
-- · الرسائلُ المجدولة الشهرية تقبل «آخرَ يومٍ في الشهر»: `month_day` حتى 31 ويُقصّ إلى طول الشهر.
create or replace function private.report_deadline(p_year integer, p_month integer)
returns date
language sql immutable
set search_path to ''
as $$
  select (make_date(p_year, p_month, 1) + interval '1 month')::date
$$;
revoke all on function private.report_deadline(integer, integer) from public, anon, authenticated;

create or replace function private.quality_month_opens(p_year integer, p_month integer)
returns date
language sql immutable
set search_path to ''
as $$
  select private.report_deadline(p_year, p_month) + 1
$$;

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
  v_deadline date := private.report_deadline(p_year, p_month);
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
  v_absentee integer := 0;
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

  -- التقارير في وقتها: أُرسلت (أو اعتُمدت) ويومُ إرسالها لا يتجاوز أوّلَ يومٍ من الشهر التالي (2026-11-03)
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
         count(*) filter (where a.state = 'unmeasured'), count(*) filter (where a.state = 'absentee')
    into v_done, v_near, v_short, v_unrec, v_unmeas, v_absentee
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
    'achievement_unrecorded', v_unrec, 'achievement_unmeasured', v_unmeas, 'achievement_absentee', v_absentee,
    'achievement', v_ach,
    'final', case when v_quality is not null and v_ach is not null then v_quality + v_ach end,
    'incomplete', v_count = 0
  );
end;
$function$;
revoke all on function private.quality_month_compute(uuid, integer, integer, integer) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.halaqat_recording_status(p_year integer DEFAULT NULL::integer, p_month integer DEFAULT NULL::integer)
 RETURNS TABLE(halaqa_id uuid, halaqa_name text, gender text, teacher_name text, teacher_phone text, teacher_whatsapp text, today date, recorded_today boolean, expected_days integer, recorded_days integer, missed_days date[], recent jsonb, report_year integer, report_month integer, report_status text, report_deadline date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
         private.report_deadline(extract(year from due.m)::int, extract(month from due.m)::int)
    from h
    cross join due
    left join public.profiles t on t.id = h.teacher_id
   order by h.name;
$function$;

alter table public.scheduled_messages drop constraint scheduled_messages_month_day_check;
alter table public.scheduled_messages add constraint scheduled_messages_month_day_check check (month_day between 1 and 31);

create or replace function private.scheduled_next_run(p_recurrence text, p_run_at timestamptz, p_weekday smallint,
  p_month_day smallint, p_time time, p_after timestamptz)
returns timestamptz
language plpgsql stable
set search_path = ''
as $$
declare
  v_local timestamp := p_after at time zone 'Asia/Gaza';
  v_day date := v_local::date;
  v_month date := date_trunc('month', v_local)::date;
  v_candidate timestamp;
begin
  if p_recurrence = 'once' then
    return case when p_run_at > p_after then p_run_at end;
  elsif p_recurrence = 'daily' then
    v_candidate := v_day + p_time;
    if v_candidate <= v_local then v_candidate := v_candidate + interval '1 day'; end if;
    if extract(dow from v_candidate) = 5 then v_candidate := v_candidate + interval '1 day'; end if;
  elsif p_recurrence = 'weekly' then
    v_candidate := (v_day + ((p_weekday - extract(dow from v_day)::int + 7) % 7)) + p_time;
    if v_candidate <= v_local then v_candidate := v_candidate + interval '7 days'; end if;
  else
    -- يومُ الشهر مقصوصٌ إلى طوله: 31 = آخرُ يومٍ في الشهر
    v_candidate := (v_month + (least(p_month_day, extract(day from (v_month + interval '1 month' - interval '1 day'))::int) - 1)) + p_time;
    if v_candidate <= v_local then
      v_month := (v_month + interval '1 month')::date;
      v_candidate := (v_month + (least(p_month_day, extract(day from (v_month + interval '1 month' - interval '1 day'))::int) - 1)) + p_time;
    end if;
  end if;
  return v_candidate at time zone 'Asia/Gaza';
end;
$$;
revoke all on function private.scheduled_next_run(text, timestamptz, smallint, smallint, time, timestamptz) from public, anon, authenticated;
