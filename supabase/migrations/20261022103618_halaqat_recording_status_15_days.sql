-- «متابعة الرصد»: شريطُ الأيام آخرُ 15 يومَ دوامٍ بدل 6 (طلب المستخدم 2026-10-22) — والضغطُ على يومٍ يفتح حاله تحت الحلقة.
-- (بقيّةُ الدالّة كما في 20261022101251.)
create or replace function public.halaqat_recording_status()
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
  due as (
    select case when t.d >= private.report_opening_day(extract(year from t.d)::int, extract(month from t.d)::int)
                then date_trunc('month', t.d)::date
                else (date_trunc('month', t.d) - interval '1 month')::date end as m
      from t
  ),
  h as (
    select h.id, h.name, h.gender::text as gender, h.teacher_id,
           greatest(date_trunc('month', t.d)::date, (h.created_at at time zone 'Asia/Gaza')::date) as since, t.d as today
      from public.halaqat h, t
     where h.status = 'active'
       and h.id = any ((select public.visible_halaqa_ids())::uuid[])
  ),
  days as (
    select h.id as hid, g::date as day, (g::date = h.today) as is_today,
           exists (select 1 from public.attendance_days a where a.halaqa_id = h.id and a.day = g::date) as held
      from h, generate_series(h.since, h.today, interval '1 day') g
     where extract(isodow from g) <> 5
  ),
  recent6 as (
    select h.id as hid, g::date as day, (g::date = h.today) as is_today,
           exists (select 1 from public.attendance_days a where a.halaqa_id = h.id and a.day = g::date) as held,
           g::date < (h.created_at_d) as before_start
      from (select h.*, (select (x.created_at at time zone 'Asia/Gaza')::date from public.halaqat x where x.id = h.id) as created_at_d from h) h,
           generate_series(h.today - 24, h.today, interval '1 day') g
     where extract(isodow from g) <> 5
  )
  select h.id, h.name, h.gender, t.full_name, t.phone, t.whatsapp,
         h.today,
         coalesce((select d.held from days d where d.hid = h.id and d.is_today), false),
         (select count(*) from days d where d.hid = h.id and not d.is_today)::integer
           + (case when coalesce((select d.held from days d where d.hid = h.id and d.is_today), false) then 1 else 0 end),
         (select count(*) from days d where d.hid = h.id and d.held)::integer,
         coalesce((select array_agg(d.day order by d.day) from days d where d.hid = h.id and not d.held and not d.is_today), '{}'),
         (select coalesce(jsonb_agg(jsonb_build_object('day', r.day,
                   'state', case when r.before_start then 'before' when r.held then 'held' when r.is_today then 'today' else 'missed' end)
                   order by r.day), '[]'::jsonb)
            from (select * from recent6 x where x.hid = h.id order by x.day desc limit 15) r),
         extract(year from due.m)::integer, extract(month from due.m)::integer,
         (select r.status::text from public.monthly_reports r
           where r.halaqa_id = h.id and r.report_year = extract(year from due.m) and r.report_month = extract(month from due.m)),
         private.report_opening_day(extract(year from due.m)::int, extract(month from due.m)::int) + 3
    from h
    cross join due
    left join public.profiles t on t.id = h.teacher_id
   order by h.name;
$function$;
revoke all on function public.halaqat_recording_status() from public, anon;
grant execute on function public.halaqat_recording_status() to authenticated;
