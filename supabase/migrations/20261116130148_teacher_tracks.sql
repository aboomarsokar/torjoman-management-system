-- نظامُ مكافآت المعلمين بالمسارين (قرار المستخدم 2026-11-16) — الجزء الأول: العضويةُ والمساراتُ والحساب.
-- المسارُ الأول: نصابُ 12 طالباً محتسباً وأصلُ 600؛ والثاني: 8 و400. الطالبُ المحتسب من حضر أكثر من نصف أيام دوام
-- حلقته في الشهر بعد طرح غيابه بعذر. ينقص عن النصاب: 30 لكلّ ناقص في أوّل شهر، و50 إن نقص الشهرُ السابق أيضاً.
-- الإنجازُ بنسبةٍ مفتوحة (صفحاتُه ÷ المطلوب منه، بسقف 1) على أفضل «ن» من المحتسبين، ن = الأصغر من عددهم ونصاب المسار؛
-- والمطلوبُ لا يُقسَّط إلا بالغياب بعذر. يسري من 11/2026، وما قبله على حسابه القديم.

-- ═══ 1. سجلُّ عضوية الطالب في الحلقات ═══
create table public.student_halaqa_periods (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  halaqa_id uuid not null references public.halaqat(id) on delete cascade,
  joined_on date not null,
  left_on date,
  created_at timestamptz not null default now(),
  constraint student_halaqa_periods_dates check (left_on is null or left_on >= joined_on)
);
create unique index student_halaqa_periods_one_open on public.student_halaqa_periods (student_id) where left_on is null;
create index student_halaqa_periods_halaqa on public.student_halaqa_periods (halaqa_id, joined_on);
alter table public.student_halaqa_periods enable row level security;
create policy student_halaqa_periods_select on public.student_halaqa_periods for select to authenticated
  using (halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]));
select private.guard_table_for_impersonation('public.student_halaqa_periods');

-- يفتح العضويةَ ويغلقها مع كلّ إسنادٍ أو نقلٍ أو إخراجٍ أو تغيير حالة. يومُ النقل للحلقة الجديدة.
create or replace function private.track_student_halaqa_period()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_today date := private.attendance_today();
begin
  if tg_op = 'UPDATE' and (old.halaqa_id is distinct from new.halaqa_id
                           or (old.status = 'active') is distinct from (new.status = 'active')) then
    -- عضويةٌ فُتحت اليوم وأُغلقت اليوم لا أثر لها
    delete from public.student_halaqa_periods p where p.student_id = new.id and p.left_on is null and p.joined_on >= v_today;
    update public.student_halaqa_periods p set left_on = v_today - 1 where p.student_id = new.id and p.left_on is null;
  end if;
  if new.status = 'active' and new.halaqa_id is not null
     and not exists (select 1 from public.student_halaqa_periods p where p.student_id = new.id and p.left_on is null) then
    insert into public.student_halaqa_periods (student_id, halaqa_id, joined_on)
    values (new.id, new.halaqa_id,
            case when tg_op = 'INSERT' then coalesce(new.enrollment_date, v_today) else v_today end);
  end if;
  return null;
end;
$$;
revoke execute on function private.track_student_halaqa_period() from public, anon, authenticated;
create trigger students_track_halaqa_period after insert or update of halaqa_id, status on public.students
  for each row execute function private.track_student_halaqa_period();

-- تعبئةٌ أولى: المنتظمون من التحاقهم، ومن خرج في 11/2026 حتى يوم تحديث سجلّه (تقريبٌ لا يُعرف غيره)
insert into public.student_halaqa_periods (student_id, halaqa_id, joined_on)
select s.id, s.halaqa_id, least(coalesce(s.enrollment_date, date '2026-10-01'), private.attendance_today())
  from public.students s where s.status = 'active' and s.halaqa_id is not null;
insert into public.student_halaqa_periods (student_id, halaqa_id, joined_on, left_on)
select s.id, s.halaqa_id, j.joined, greatest(j.joined, (s.updated_at at time zone 'Asia/Gaza')::date - 1)
  from public.students s
  cross join lateral (select least(coalesce(s.enrollment_date, date '2026-10-01'), (s.updated_at at time zone 'Asia/Gaza')::date - 1) as joined) j
 where s.status <> 'active' and s.halaqa_id is not null and s.updated_at >= timestamptz '2026-11-01 00:00+02';

-- ═══ 2. المسارات وطلباتها ═══
create table public.halaqa_track_requests (
  id uuid primary key default gen_random_uuid(),
  halaqa_id uuid not null references public.halaqat(id) on delete cascade,
  requested_track smallint not null check (requested_track in (1, 2)),
  note text check (note is null or char_length(note) <= 300),
  requested_by uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  effective_year integer,
  effective_month integer check (effective_month is null or effective_month between 1 and 12),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 300),
  created_at timestamptz not null default now()
);
create unique index halaqa_track_requests_one_pending on public.halaqa_track_requests (halaqa_id) where status = 'pending';
alter table public.halaqa_track_requests enable row level security;
create policy halaqa_track_requests_select on public.halaqa_track_requests for select to authenticated
  using (halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]));
select private.guard_table_for_impersonation('public.halaqa_track_requests');

create table public.halaqa_tracks (
  id uuid primary key default gen_random_uuid(),
  halaqa_id uuid not null references public.halaqat(id) on delete cascade,
  track smallint not null check (track in (1, 2)),
  effective_year integer not null,
  effective_month integer not null check (effective_month between 1 and 12),
  reason text check (reason is null or char_length(reason) <= 300),
  request_id uuid references public.halaqa_track_requests(id) on delete set null,
  assigned_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint halaqa_tracks_from_project_start check (effective_year * 100 + effective_month >= 202611),
  unique (halaqa_id, effective_year, effective_month)
);
alter table public.halaqa_tracks enable row level security;
create policy halaqa_tracks_select on public.halaqa_tracks for select to authenticated
  using (halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]));
select private.guard_table_for_impersonation('public.halaqa_tracks');

-- ═══ 3. ثوابتُ المسار والفصل ═══
create or replace function private.track_quota(p_track smallint) returns integer
language sql immutable set search_path = '' as $$ select case p_track when 2 then 8 else 12 end $$;
create or replace function private.track_amount(p_track smallint) returns integer
language sql immutable set search_path = '' as $$ select case p_track when 2 then 400 else 600 end $$;
-- أوّلُ شهرٍ في الفصل التالي (الفصول: 10–1 · 2–5 · 6–9) بصيغة سنة×100+شهر
create or replace function private.next_term_start(p_year integer, p_month integer) returns integer
language sql immutable set search_path = '' as $$
  select case when p_month between 2 and 5 then p_year * 100 + 6
              when p_month between 6 and 9 then p_year * 100 + 10
              when p_month >= 10 then (p_year + 1) * 100 + 2
              else p_year * 100 + 2 end
$$;

-- مسارُ الحلقة في شهر: آخرُ تعيينٍ سرى حتى الشهر، وإلا الأول
create or replace function private.halaqa_track(p_halaqa uuid, p_year integer, p_month integer) returns smallint
language sql stable security definer set search_path = '' as $$
  select coalesce((select t.track from public.halaqa_tracks t
                    where t.halaqa_id = p_halaqa and t.effective_year * 100 + t.effective_month <= p_year * 100 + p_month
                    order by t.effective_year desc, t.effective_month desc limit 1), 1::smallint)
$$;

-- ═══ 4. المحتسبون ═══
-- لكلّ من كان عضواً في الحلقة خلال الشهر: أيامُ عضويته المنعقدة، وحضورُه، وغيابُه بعذر، وهل يُحتسب.
-- ما قبل التحاقه وما بعد خروجه غيرُ حضور. حلقةٌ لم تفتح يوماً: يُحتسب من كان عضواً أكثرَ من نصف أيام الشهر.
create or replace function private.halaqa_month_attendance(p_halaqa uuid, p_year integer, p_month integer)
returns table(student_id uuid, member_days integer, attended integer, excused integer, counted boolean)
language sql stable security definer set search_path = '' as $$
  with bounds as (
    select make_date(p_year, p_month, 1) as f, (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date as t
  ), days as (
    select d.day from public.attendance_days d, bounds b where d.halaqa_id = p_halaqa and d.day between b.f and b.t
  ), held as (select count(*)::integer as n from days),
  mem as (
    select p.student_id, p.joined_on, p.left_on
      from public.student_halaqa_periods p, bounds b
     where p.halaqa_id = p_halaqa and p.joined_on <= b.t and (p.left_on is null or p.left_on >= b.f)
  ), per as (
    select m.student_id,
           (select count(*) from days d
             where exists (select 1 from mem x where x.student_id = m.student_id
                              and d.day >= x.joined_on and (x.left_on is null or d.day <= x.left_on)))::integer as member_days,
           (select sum(greatest(0, least(coalesce(x.left_on, b.t), b.t) - greatest(x.joined_on, b.f) + 1))
              from mem x, bounds b where x.student_id = m.student_id) as cal_days
      from (select distinct student_id from mem) m
  ), abs as (
    select a.student_id, count(*)::integer as absent, (count(*) filter (where a.kind = 'excused'))::integer as excused
      from public.attendance_absences a join days d on d.day = a.day
     where a.halaqa_id = p_halaqa
     group by a.student_id
  )
  select per.student_id, per.member_days, greatest(0, per.member_days - coalesce(abs.absent, 0)), coalesce(abs.excused, 0),
         case when (select n from held) = 0
              then per.cal_days * 2 > (select (b.t - b.f + 1) from bounds b)
              else greatest(0, per.member_days - coalesce(abs.absent, 0)) * 2 > (select n from held) - coalesce(abs.excused, 0) end
    from per left join abs on abs.student_id = per.student_id
$$;

-- النقصُ عن النصاب في شهر (بلا سلسلة)
create or replace function private.halaqa_month_missing(p_halaqa uuid, p_year integer, p_month integer) returns integer
language sql stable security definer set search_path = '' as $$
  select greatest(0, private.track_quota(private.halaqa_track(p_halaqa, p_year, p_month))
                     - (select count(*) from private.halaqa_month_attendance(p_halaqa, p_year, p_month) a where a.counted))::integer
$$;

-- أصلُ مكافأة المعلم للشهر: المسار، والنصاب، والمحتسبون، والخصم. النقصُ في الشهر السابق من لقطته المقفلة إن وُجدت.
create or replace function private.halaqa_month_reward(p_halaqa uuid, p_year integer, p_month integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_track smallint := private.halaqa_track(p_halaqa, p_year, p_month);
  v_quota integer := private.track_quota(v_track);
  v_full integer := private.track_amount(v_track);
  v_held integer;
  v_counted integer;
  v_missing integer;
  v_prev date := make_date(p_year, p_month, 1) - interval '1 month';
  v_prev_missing integer := 0;
  v_rate integer;
begin
  if p_year * 100 + p_month < 202611 then
    return null;
  end if;
  select count(*) into v_held from public.attendance_days d
   where d.halaqa_id = p_halaqa and d.day >= make_date(p_year, p_month, 1) and d.day < make_date(p_year, p_month, 1) + interval '1 month';
  select count(*) filter (where a.counted) into v_counted from private.halaqa_month_attendance(p_halaqa, p_year, p_month) a;
  v_missing := greatest(0, v_quota - v_counted);
  if extract(year from v_prev) * 100 + extract(month from v_prev) >= 202611 then
    select coalesce((q.numbers -> 'reward' ->> 'missing')::integer, 0) into v_prev_missing
      from public.teacher_quality_months q
     where q.halaqa_id = p_halaqa and q.year = extract(year from v_prev) and q.month = extract(month from v_prev) and q.locked_at is not null;
    if not found then
      v_prev_missing := private.halaqa_month_missing(p_halaqa, extract(year from v_prev)::integer, extract(month from v_prev)::integer);
    end if;
  end if;
  v_rate := case when v_missing = 0 then 0 when v_prev_missing > 0 then 50 else 30 end;
  return jsonb_build_object(
    'track', v_track, 'quota', v_quota, 'full', v_full, 'held_days', v_held, 'no_attendance', v_held = 0,
    'counted', v_counted, 'missing', v_missing, 'consecutive', v_missing > 0 and v_prev_missing > 0,
    'rate', v_rate, 'deduction', v_rate * v_missing, 'base', greatest(0, v_full - v_rate * v_missing));
end;
$$;

revoke execute on function private.track_quota(smallint), private.track_amount(smallint), private.next_term_start(integer, integer),
  private.halaqa_track(uuid, integer, integer), private.halaqa_month_attendance(uuid, integer, integer),
  private.halaqa_month_missing(uuid, integer, integer), private.halaqa_month_reward(uuid, integer, integer) from public, anon;
-- نظامُ المسارين — الجزء الثاني: الإنجازُ بالنسبة المفتوحة، وسجلُّ الجودة، و«إنجاز الحلقات».

-- حكمُ كلّ طالبٍ نشط. من 11/2026: غيرُ المحتسب `absentee` (خارجَ الحساب)، والمطلوبُ يُقسَّط بالغياب بعذر وحده
-- على أيام دوام الحلقة كلِّها؛ وما قبله على القانون القديم كما هو.
create or replace function private.halaqa_student_achievement(p_halaqa uuid, p_year integer, p_month integer)
returns table(student_id uuid, pages integer, required integer, state text)
language plpgsql stable security definer set search_path = '' as $$
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
  v_exc integer;
  v_counted boolean;
  v_att_map jsonb;
  s record;
begin
  select r.id, r.target_pages_snapshot into v_report_id, v_target
    from public.monthly_reports r
   where r.halaqa_id = p_halaqa and r.report_year = p_year and r.report_month = p_month;
  v_target := coalesce(v_target, (select a.target_memorization_pages from public.app_settings a limit 1));
  select count(*) into v_month_days from public.attendance_days d
   where d.halaqa_id = p_halaqa and d.day between v_from and v_to;
  if p_year * 100 + p_month >= 202611 then
    select coalesce(jsonb_object_agg(a.student_id, jsonb_build_object('c', a.counted, 'e', a.excused)), '{}'::jsonb)
      into v_att_map from private.halaqa_month_attendance(p_halaqa, p_year, p_month) a;
  end if;

  for s in select st.id, st.enrollment_date from public.students st where st.halaqa_id = p_halaqa and st.status = 'active' loop
    student_id := s.id;
    pages := null;
    required := null;
    if v_report_id is not null then
      select q.pages_memorized into pages from public.quran_records q where q.report_id = v_report_id and q.student_id = s.id;
    end if;
    select coalesce(max(case c.parts_to - c.parts_from + 1 when 3 then 1 when 5 then 2 when 10 then 3 else 0 end), 0)
      into v_relief
      from public.exam_results r
      join public.exam_list_items li on li.id = r.exam_list_item_id
      join public.exam_cycles c on c.id = li.exam_cycle_id
     where r.student_id = s.id and r.exam_date between v_from and v_to;

    if p_year * 100 + p_month >= 202611 then
      -- ═ نظامُ المسارين ═
      v_counted := (v_att_map -> s.id::text ->> 'c')::boolean;
      v_exc := (v_att_map -> s.id::text ->> 'e')::integer;
      if not coalesce(v_counted, true) then
        state := 'absentee';
        return next;
        continue;
      end if;
      if pages is null then
        state := 'unrecorded';
        return next;
        continue;
      end if;
      if v_target is not null then
        v_base := v_target - round(v_target::numeric * v_relief / 3)::integer;
        required := case when v_month_days = 0 or v_base = 0 then v_base
                         else greatest(1, round(v_base::numeric * greatest(0, v_month_days - coalesce(v_exc, 0)) / v_month_days)::integer) end;
      end if;
    else
      -- ═ القانونُ القديم (حتى 10/2026) ═
      if pages is null then
        state := 'unrecorded';
        return next;
        continue;
      end if;
      if v_target is not null then
        v_base := v_target - round(v_target::numeric * v_relief / 3)::integer;
        select count(*) into v_held from public.attendance_days d
         where d.halaqa_id = p_halaqa and d.day between v_from and v_to
           and (s.enrollment_date is null or d.day >= s.enrollment_date);
        select v_held - count(*) into v_att from public.attendance_absences a
          join public.attendance_days d on d.halaqa_id = a.halaqa_id and d.day = a.day
         where a.student_id = s.id and a.halaqa_id = p_halaqa and a.day between v_from and v_to
           and (s.enrollment_date is null or a.day >= s.enrollment_date);
        select count(*) into v_exc from public.attendance_absences a
          join public.attendance_days d on d.halaqa_id = a.halaqa_id and d.day = a.day
         where a.student_id = s.id and a.halaqa_id = p_halaqa and a.day between v_from and v_to and a.kind = 'excused'
           and (s.enrollment_date is null or a.day >= s.enrollment_date);
        if v_held > 0 and v_att > 0 and (v_att * 100 < 50 * greatest(0, v_held - v_exc) or v_att * 100 < 25 * v_held) then
          state := 'absentee';
          return next;
          continue;
        end if;
        if v_held = 0 and v_month_days > 0 then required := null;
        elsif v_held = 0 then required := v_base;
        elsif v_att <= 0 then required := null;
        elsif v_att >= v_held or v_base = 0 then required := v_base;
        else required := greatest(1, round(v_base::numeric * v_att / v_held)::integer);
        end if;
      end if;
    end if;
    state := case when required is null then 'unmeasured' when pages >= required then 'done'
                  when pages * 4 >= required * 3 then 'near' else 'short' end;
    return next;
  end loop;
end;
$$;

-- إنجازُ الحلقة من 50 — المصدرُ الواحد لسجلّ الجودة و«إنجاز الحلقات».
-- من 11/2026: نسبةٌ مفتوحة (صفحاتُه ÷ المطلوب، بسقف 1؛ ولم يُرصد 0) لأفضل «ن» من المحتسبين؛ ن = الأصغر من عددهم ونصاب المسار.
-- قبله: أعلى 12 بأوزان أنجز 1 · قريب ½، مقسوماً على 12 دائماً.
create or replace function private.halaqa_achievement_score(p_halaqa uuid, p_year integer, p_month integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_quota integer;
  v_pool integer;
  v_n integer;
  v_top numeric;
  v_done integer;
  v_near integer;
  v_measured integer;
begin
  if p_year * 100 + p_month >= 202611 then
    v_quota := private.track_quota(private.halaqa_track(p_halaqa, p_year, p_month));
    with scored as (
      select case when a.state = 'unrecorded' then 0::numeric
                  when a.required = 0 then 1::numeric
                  else least(1, a.pages::numeric / a.required) end as ratio
        from private.halaqa_student_achievement(p_halaqa, p_year, p_month) a
       where a.state not in ('absentee', 'unmeasured')
    )
    select count(*), (select coalesce(sum(r.ratio), 0) from (select ratio from scored order by ratio desc limit v_quota) r)
      into v_pool, v_top from scored;
    v_n := least(v_pool, v_quota);
  else
    v_quota := 12;
    select count(*) filter (where a.state = 'done'), count(*) filter (where a.state = 'near'),
           count(*) filter (where a.state in ('done', 'near', 'short', 'unrecorded'))
      into v_done, v_near, v_measured
      from private.halaqa_student_achievement(p_halaqa, p_year, p_month) a;
    v_top := least(v_done, 12) + 0.5 * least(v_near, 12 - least(v_done, 12));
    v_pool := v_measured;
    v_n := case when v_measured > 0 then 12 else 0 end;
  end if;
  return jsonb_build_object(
    'quota', v_quota, 'pool', v_pool, 'n', v_n, 'top', round(v_top, 3),
    'achievement', case when v_n > 0 then round(50.0 * v_top / v_n, 2) end,
    'pct', case when v_n > 0 then round(100.0 * v_top / v_n)::integer end);
end;
$$;
revoke execute on function private.halaqa_achievement_score(uuid, integer, integer) from public, anon;

-- سجلُّ الجودة: الإنجازُ من `halaqa_achievement_score`، وأصلُ المكافأة لقطةً في `reward` (من 11/2026)
create or replace function private.quality_month_compute(p_halaqa uuid, p_year integer, p_month integer, p_meetings integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_from date := make_date(p_year, p_month, 1);
  v_to date := (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date;
  v_deadline date := private.report_deadline(p_year, p_month);
  v_visits jsonb;
  v_count integer;
  v_avg numeric;
  v_vpart numeric;
  v_report_status text;
  v_report_sent date;
  v_rq integer := 0;
  v_rs integer := 0;
  v_done integer := 0;
  v_near integer := 0;
  v_short integer := 0;
  v_unrec integer := 0;
  v_unmeas integer := 0;
  v_absentee integer := 0;
  v_score jsonb;
  v_quality numeric;
  v_ach numeric;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', v.id, 'date', (v.executed_at at time zone 'Asia/Gaza')::date,
           'score', v.score, 'criteria', to_jsonb(v.criteria_scores)) order by v.executed_at), '[]'::jsonb),
         count(*), avg(v.score)
    into v_visits, v_count, v_avg
    from public.supervision_visits v
   where v.halaqa_id = p_halaqa and v.score is not null and v.executed_at is not null
     and (v.scheduled_at at time zone 'Asia/Gaza')::date between v_from and v_to
     and exists (select 1 from public.profiles p where p.id = v.supervisor_id
                  and p.role in ('field_supervisor', 'technical_manager', 'women_admin'));
  v_vpart := case when v_count > 0 then round(v_avg * 2, 2) end;

  select r.status::text, r.submitted_at into v_report_status, v_report_sent
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

  select count(*) filter (where a.state = 'done'), count(*) filter (where a.state = 'near'),
         count(*) filter (where a.state = 'short'), count(*) filter (where a.state = 'unrecorded'),
         count(*) filter (where a.state = 'unmeasured'), count(*) filter (where a.state = 'absentee')
    into v_done, v_near, v_short, v_unrec, v_unmeas, v_absentee
    from private.halaqa_student_achievement(p_halaqa, p_year, p_month) a;

  v_score := private.halaqa_achievement_score(p_halaqa, p_year, p_month);
  v_ach := (v_score ->> 'achievement')::numeric;
  v_quality := case when v_count > 0 then round((v_vpart + v_rq + v_rs + coalesce(p_meetings, 0)) / 2.0, 2) end;

  return jsonb_build_object(
    'visits', v_visits, 'visits_count', v_count, 'visits_avg', round(v_avg, 2), 'visits_part', v_vpart,
    'reports_quran', v_rq, 'reports_statement', v_rs, 'reports_deadline', v_deadline,
    'meetings', p_meetings,
    'quality', v_quality,
    'achievement_done', v_done, 'achievement_near', v_near, 'achievement_short', v_short,
    'achievement_unrecorded', v_unrec, 'achievement_unmeasured', v_unmeas, 'achievement_absentee', v_absentee,
    'achievement_n', v_score -> 'n', 'achievement_quota', v_score -> 'quota',
    'achievement', v_ach,
    'final', case when v_quality is not null and v_ach is not null then v_quality + v_ach end,
    'incomplete', v_count = 0,
    'reward', private.halaqa_month_reward(p_halaqa, p_year, p_month)
  );
end;
$$;

-- «إنجاز الحلقات»: تُضاف النسبةُ من القاعدة (لا حسابَ في الواجهة) والنصابُ وعددُ المحتسبين
drop function public.halaqat_achievement(integer, integer);
create function public.halaqat_achievement(p_year integer, p_month integer)
returns table(halaqa_id uuid, halaqa_name text, gender text, teacher_id uuid, teacher_name text, teacher_phone text,
              teacher_whatsapp text, report_status text, students integer, done integer, near integer, short integer,
              absentee integer, unrecorded integer, unmeasured integer, achievement_pct integer, quota integer, top_n integer)
language sql stable security definer set search_path = '' as $$
  select h.id, h.name, h.gender::text,
         t.id, t.full_name, t.phone, t.whatsapp,
         (select r.status::text from public.monthly_reports r
           where r.halaqa_id = h.id and r.report_year = p_year and r.report_month = p_month),
         count(a.student_id)::integer,
         (count(*) filter (where a.state = 'done'))::integer,
         (count(*) filter (where a.state = 'near'))::integer,
         (count(*) filter (where a.state = 'short'))::integer,
         (count(*) filter (where a.state = 'absentee'))::integer,
         (count(*) filter (where a.state = 'unrecorded'))::integer,
         (count(*) filter (where a.state = 'unmeasured'))::integer,
         (sc.s ->> 'pct')::integer, (sc.s ->> 'quota')::integer, (sc.s ->> 'n')::integer
    from public.halaqat h
    left join public.profiles t on t.id = h.teacher_id
    left join lateral private.halaqa_student_achievement(h.id, p_year, p_month) a on true
    cross join lateral (select private.halaqa_achievement_score(h.id, p_year, p_month) as s) sc
   where h.status = 'active'
     and h.id = any ((select public.visible_halaqa_ids())::uuid[])
   group by h.id, h.name, h.gender, t.id, t.full_name, t.phone, t.whatsapp, sc.s
   order by h.name;
$$;
revoke execute on function public.halaqat_achievement(integer, integer) from public, anon;
grant execute on function public.halaqat_achievement(integer, integer) to authenticated;
-- نظامُ المسارين — الجزء الثالث: طلبُ المسار واعتمادُه، وموقفُ الشهر، وتنبيهُ النقص عن النصاب.

-- ═══ أنواعُ الإشعارات الجديدة ═══
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind = any (array[
  'report_submitted', 'report_approved', 'report_returned', 'alert_issued', 'visit_scheduled',
  'exam_nominated', 'exam_graded', 'transport_paid', 'impersonation_started', 'impersonation_write',
  'statement_returned', 'visit_result', 'visit_unlocked', 'visit_rescheduled', 'quality_month', 'quality_unlocked',
  'halaqa_time_changed', 'booklet_delivered', 'booklet_requested', 'announcement',
  'student_requested', 'student_request_closed', 'off_day_reported', 'off_day_rejected',
  'plan_task_assigned', 'plan_task_due', 'plan_task_overdue', 'plan_weekly_update',
  'booklet_ready', 'booklet_request_cancelled', 'booklet_stock_low', 'candidate_registered',
  'track_requested', 'track_decided', 'below_quota'
]::text[]));

create or replace function private.notify(p_recipient uuid, p_kind text, p_title text, p_body text, p_link text, p_source_table text, p_source_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
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
    'track_requested', 'track_decided', 'below_quota'
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
$$;

-- ═══ موقفُ الحلقة في شهر: المسار والمحتسبون والخصم والإنجاز، وقائمةُ الطلاب بحضورهم ═══
create or replace function public.halaqa_track_standing(p_halaqa uuid, p_year integer, p_month integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := private.attendance_today();
begin
  if not (p_halaqa = any ((select public.visible_halaqa_ids())::uuid[])) then
    raise exception 'الحلقة خارج نطاقك.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'reward', private.halaqa_month_reward(p_halaqa, p_year, p_month),
    'achievement', private.halaqa_achievement_score(p_halaqa, p_year, p_month),
    'current_track', private.halaqa_track(p_halaqa, extract(year from v_today)::integer, extract(month from v_today)::integer),
    'next_term', private.next_term_start(extract(year from v_today)::integer, extract(month from v_today)::integer),
    'next_term_track', (select private.halaqa_track(p_halaqa, n / 100, n % 100)
                          from (select private.next_term_start(extract(year from v_today)::integer, extract(month from v_today)::integer) as n) x),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.student_id, 'name', s.full_name, 'member_days', a.member_days,
                                          'attended', a.attended, 'excused', a.excused, 'counted', a.counted)
                       order by a.counted, s.full_name)
        from private.halaqa_month_attendance(p_halaqa, p_year, p_month) a
        join public.students s on s.id = a.student_id), '[]'::jsonb),
    'pending_request', (select jsonb_build_object('id', r.id, 'track', r.requested_track, 'note', r.note, 'created_at', r.created_at)
                          from public.halaqa_track_requests r where r.halaqa_id = p_halaqa and r.status = 'pending')
  );
end;
$$;
revoke execute on function public.halaqa_track_standing(uuid, integer, integer) from public, anon;
grant execute on function public.halaqa_track_standing(uuid, integer, integer) to authenticated;

-- ═══ يطلب المعلمُ مسارَ حلقته ═══
create or replace function public.request_halaqa_track(p_halaqa uuid, p_track smallint, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_id uuid;
  v_admin uuid;
begin
  perform private.assert_session_writable();
  select h.name into v_name from public.halaqat h
   where h.id = p_halaqa and h.teacher_id = (select auth.uid()) and h.status = 'active';
  if v_name is null or public.current_user_role() is distinct from 'teacher' then
    raise exception 'يطلب المسارَ معلمُ الحلقة وحده.' using errcode = '42501';
  end if;
  if p_track is null or p_track not in (1, 2) then
    raise exception 'المسارُ الأول أو الثاني.' using errcode = '23514';
  end if;
  if exists (select 1 from public.halaqa_track_requests r where r.halaqa_id = p_halaqa and r.status = 'pending') then
    raise exception 'لحلقتك طلبٌ قيد الاعتماد — اسحبه أولاً.' using errcode = '23505';
  end if;
  insert into public.halaqa_track_requests (halaqa_id, requested_track, note, requested_by)
  values (p_halaqa, p_track, nullif(btrim(coalesce(p_note, '')), ''), (select auth.uid()))
  returning id into v_id;
  for v_admin in select p.id from public.profiles p where p.role = 'admin_manager' and p.status = 'active' loop
    perform private.notify(v_admin, 'track_requested', 'طلبُ تغيير مسار',
      v_name || ' تطلب المسار ' || case p_track when 2 then 'الثاني (8 طلاب · 400)' else 'الأول (12 طالباً · 600)' end,
      '/tracks', 'halaqa_track_requests', v_id);
  end loop;
  return v_id;
end;
$$;

-- ═══ يسحب المعلمُ طلبَه المعلّق ═══
create or replace function public.cancel_halaqa_track_request(p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_session_writable();
  update public.halaqa_track_requests r set status = 'cancelled', decided_at = now()
   where r.id = p_request and r.status = 'pending' and r.requested_by = (select auth.uid());
  if not found then
    raise exception 'لا طلبَ معلّقاً لك بهذا.' using errcode = '42501';
  end if;
end;
$$;

-- ═══ يعتمد المديرُ الإداريّ الطلبَ أو يرفضه ═══
-- يسري المعتمَد من أول الفصل التالي؛ واستثناءً من الشهر التالي إن طُلب الثاني والحلقةُ نقصت عن نصابها في الشهر السابق.
create or replace function public.decide_halaqa_track_request(p_request uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.halaqa_track_requests;
  v_today date := private.attendance_today();
  v_y integer := extract(year from v_today)::integer;
  v_m integer := extract(month from v_today)::integer;
  v_prev date := date_trunc('month', v_today)::date - interval '1 month';
  v_eff integer;
  v_short boolean := false;
  v_name text;
begin
  perform private.assert_session_writable();
  if public.current_user_role() is distinct from 'admin_manager' then
    raise exception 'اعتمادُ المسار للمدير الإداري وحده.' using errcode = '42501';
  end if;
  select * into r from public.halaqa_track_requests x where x.id = p_request and x.status = 'pending' for update;
  if r.id is null then
    raise exception 'الطلبُ غير موجود أو حُسم.' using errcode = '42501';
  end if;
  select h.name into v_name from public.halaqat h where h.id = r.halaqa_id;
  if not p_approve then
    if btrim(coalesce(p_note, '')) = '' then
      raise exception 'اكتب سببَ الرفض.' using errcode = '23514';
    end if;
    update public.halaqa_track_requests x set status = 'rejected', decided_by = (select auth.uid()), decided_at = now(),
           decision_note = btrim(p_note) where x.id = r.id;
    perform private.notify(r.requested_by, 'track_decided', 'رُفض طلبُ المسار', v_name || ' — ' || btrim(p_note),
      '/dashboard', 'halaqa_track_requests', r.id);
    return;
  end if;

  if r.requested_track = 2 and private.halaqa_track(r.halaqa_id, v_y, v_m) = 1
     and extract(year from v_prev) * 100 + extract(month from v_prev) >= 202611 then
    v_short := private.halaqa_month_missing(r.halaqa_id, extract(year from v_prev)::integer, extract(month from v_prev)::integer) > 0;
  end if;
  v_eff := case when v_short then extract(year from v_today + interval '1 month')::integer * 100 + extract(month from v_today + interval '1 month')::integer
                else private.next_term_start(v_y, v_m) end;

  insert into public.halaqa_tracks (halaqa_id, track, effective_year, effective_month, reason, request_id, assigned_by)
  values (r.halaqa_id, r.requested_track, v_eff / 100, v_eff % 100, nullif(btrim(coalesce(p_note, '')), ''), r.id, (select auth.uid()))
  on conflict (halaqa_id, effective_year, effective_month) do update set
    track = excluded.track, reason = excluded.reason, request_id = excluded.request_id, assigned_by = excluded.assigned_by, created_at = now();
  update public.halaqa_track_requests x set status = 'approved', decided_by = (select auth.uid()), decided_at = now(),
         decision_note = nullif(btrim(coalesce(p_note, '')), ''), effective_year = v_eff / 100, effective_month = v_eff % 100
   where x.id = r.id;
  perform private.notify(r.requested_by, 'track_decided', 'اعتُمد مسارُك',
    v_name || ' · المسار ' || case r.requested_track when 2 then 'الثاني' else 'الأول' end
      || ' من ' || lpad((v_eff % 100)::text, 2, '0') || '-' || (v_eff / 100),
    '/dashboard', 'halaqa_track_requests', r.id);
end;
$$;

-- ═══ تعيينٌ مباشر من المدير الإداري (تصحيح) — بسببٍ إلزاميّ، ولا لشهرٍ مضى أو سجلُّه مقفل ═══
create or replace function public.set_halaqa_track(p_halaqa uuid, p_track smallint, p_year integer, p_month integer, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_today date := private.attendance_today();
begin
  perform private.assert_session_writable();
  if public.current_user_role() is distinct from 'admin_manager' then
    raise exception 'تعيينُ المسار للمدير الإداري وحده.' using errcode = '42501';
  end if;
  if p_track is null or p_track not in (1, 2) or p_month not between 1 and 12 then
    raise exception 'المسارُ الأول أو الثاني بشهرٍ صحيح.' using errcode = '23514';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'اكتب سببَ التعيين.' using errcode = '23514';
  end if;
  if p_year * 100 + p_month < extract(year from v_today) * 100 + extract(month from v_today) then
    raise exception 'لا يُعيَّن المسارُ لشهرٍ مضى.' using errcode = '23514';
  end if;
  if exists (select 1 from public.teacher_quality_months q where q.halaqa_id = p_halaqa and q.locked_at is not null
              and q.year * 100 + q.month >= p_year * 100 + p_month) then
    raise exception 'سجلُّ تقييمٍ مقفلٌ في هذا الشهر أو بعده — افتحه أولاً.' using errcode = '42501';
  end if;
  insert into public.halaqa_tracks (halaqa_id, track, effective_year, effective_month, reason, assigned_by)
  values (p_halaqa, p_track, p_year, p_month, btrim(p_reason), (select auth.uid()))
  on conflict (halaqa_id, effective_year, effective_month) do update set
    track = excluded.track, reason = excluded.reason, request_id = null, assigned_by = excluded.assigned_by, created_at = now();
end;
$$;

revoke execute on function public.request_halaqa_track(uuid, smallint, text), public.cancel_halaqa_track_request(uuid),
  public.decide_halaqa_track_request(uuid, boolean, text), public.set_halaqa_track(uuid, smallint, integer, integer, text) from public, anon;
grant execute on function public.request_halaqa_track(uuid, smallint, text), public.cancel_halaqa_track_request(uuid),
  public.decide_halaqa_track_request(uuid, boolean, text), public.set_halaqa_track(uuid, smallint, integer, integer, text) to authenticated;

-- ═══ حفظُ سجلّ الجودة: ومع النقص عن النصاب تنبيهٌ للمعلم والمدير الإداري، وللمدير الفني في حلقات البنين ═══
create or replace function public.save_quality_month(p_halaqa uuid, p_year integer, p_month integer, p_meetings integer, p_notes text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_teacher uuid;
  v_sup uuid;
  v_halaqa text;
  v_gender text;
  v_numbers jsonb;
  v_id uuid;
  v_opens date := private.quality_month_opens(p_year, p_month);
  v_missing integer;
  v_body text;
  v_staff uuid;
begin
  perform private.assert_session_writable();
  if public.current_user_role() is distinct from 'admin_manager' then
    raise exception 'رصدُ البنود العامة في سجلّ التقييم للمدير الإداري وحده.' using errcode = '42501';
  end if;
  select h.teacher_id, h.supervisor_id, h.name, h.gender::text into v_teacher, v_sup, v_halaqa, v_gender
    from public.halaqat h where h.id = p_halaqa;
  if v_halaqa is null then
    raise exception 'الحلقة غير موجودة.' using errcode = '42501';
  end if;
  if p_meetings is null or p_meetings not between 0 and 8 then
    raise exception 'درجةُ حضور الاجتماعات من 0 إلى 8.' using errcode = '23514';
  end if;
  if private.attendance_today() < v_opens then
    raise exception 'يُرصد سجلُّ الشهر ابتداءً من % (بعد مهلة تسليم التقارير).', to_char(v_opens, 'DD-MM-YYYY') using errcode = '23514';
  end if;
  if exists (select 1 from public.teacher_quality_months q
              where q.halaqa_id = p_halaqa and q.year = p_year and q.month = p_month and q.locked_at is not null) then
    raise exception 'السجلّ مقفل — افتحه للتعديل أولاً.' using errcode = '42501';
  end if;

  v_numbers := private.quality_month_compute(p_halaqa, p_year, p_month, p_meetings);
  insert into public.teacher_quality_months as q
    (halaqa_id, teacher_id, supervisor_id, year, month, meetings_score, supervisor_notes,
     numbers, quality, achievement, final, locked_at, teacher_ack_at)
  values (p_halaqa, v_teacher, v_sup, p_year, p_month, p_meetings, nullif(btrim(coalesce(p_notes, '')), ''),
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

  v_missing := coalesce((v_numbers -> 'reward' ->> 'missing')::integer, 0);
  if v_missing > 0 then
    v_body := v_halaqa || ' · ' || lpad(p_month::text, 2, '0') || '-' || p_year || ' · المحتسبون '
      || (v_numbers -> 'reward' ->> 'counted') || ' من ' || (v_numbers -> 'reward' ->> 'quota')
      || ' · خصم ' || (v_numbers -> 'reward' ->> 'deduction') || ' شيكل'
      || case when (v_numbers -> 'reward' ->> 'consecutive')::boolean then ' (شهرٌ متتالٍ)' else '' end;
    perform private.notify(v_teacher, 'below_quota', 'حلقتك دون نصاب مسارها', v_body, '/dashboard', 'teacher_quality_months', v_id);
    for v_staff in select p.id from public.profiles p where p.status = 'active'
                     and (p.role = 'admin_manager' or (p.role = 'technical_manager' and v_gender = 'male')) loop
      perform private.notify(v_staff, 'below_quota', 'حلقةٌ دون نصاب مسارها', v_body, '/tracks', 'teacher_quality_months', v_id);
    end loop;
  end if;
  return v_id;
end;
$$;
