-- نظامُ المسارين: من حضر النصفَ تماماً يُحتسب (قرار المستخدم 2026-11-17) — كان يلزم أكثرُ من النصف.
-- المحتسَب: حضورُه × 2 ≥ (أيام الدوام − غيابه بعذر)، ويلزم أن يبقى يومٌ واحدٌ على الأقلّ بعد طرح العذر.
-- والحلقةُ التي لم تفتح يوماً: يُحتسب من كان عضواً نصفَ أيام الشهر فأكثر.
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
              then per.cal_days * 2 >= (select (b.t - b.f + 1) from bounds b)
              else (select n from held) - coalesce(abs.excused, 0) > 0
                   and greatest(0, per.member_days - coalesce(abs.absent, 0)) * 2 >= (select n from held) - coalesce(abs.excused, 0) end
    from per left join abs on abs.student_id = per.student_id
$$;

-- ═══ التحويلُ التلقائيّ وتنبيهُ المسار الثاني (قرار المستخدم 2026-11-17) ═══
-- · حلقةٌ على المسار الأول نقصت عن نصابها شهرين متتاليين (والشهران على الأول) ← تتحوّل إلى الثاني من الشهر التالي
--   تلقائياً عند إقفال سجلّ الشهر الثاني، ويُنبَّه المعلمُ والمديرُ الإداريّ والمديرُ الفنيّ (حلقاتُ البنين).
-- · حلقةٌ على المسار الثاني نقصت عن نصابها (8) شهرين متتاليين (والشهران على الثاني) ← يُنبَّه المديرُ الإداريّ (قد تُسرَّح).
-- التحويلُ صفٌّ في `halaqa_tracks` بعلامة `is_auto`؛ يُعاد حسابه إن فُتح السجلُّ وأُعيد حفظُه، ولا يمسّ تعييناً يدوياً.
alter table public.halaqa_tracks add column is_auto boolean not null default false;

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
  v_label text := lpad(p_month::text, 2, '0') || '-' || p_year;
  v_next date := make_date(p_year, p_month, 1) + interval '1 month';
  v_prev date := make_date(p_year, p_month, 1) - interval '1 month';
  v_track smallint;
  v_prev_track smallint;
  v_chain boolean;
  v_next_label text;
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
    v_halaqa || ' · ' || v_label
      || coalesce(' · النهائي ' || (v_numbers ->> 'final') || ' من 100', ' · ناقص — لم تُنفَّذ زيارة')
      || ' — اطّلع عليه وأقِرّ',
    '/quality?y=' || p_year || '&m=' || p_month, 'teacher_quality_months', v_id);

  if v_numbers -> 'reward' is null or jsonb_typeof(v_numbers -> 'reward') = 'null' then
    return v_id;
  end if;

  v_missing := coalesce((v_numbers -> 'reward' ->> 'missing')::integer, 0);
  v_track := (v_numbers -> 'reward' ->> 'track')::smallint;
  v_prev_track := private.halaqa_track(p_halaqa, extract(year from v_prev)::integer, extract(month from v_prev)::integer);
  -- شهران متتاليان دون النصاب على المسار نفسه
  v_chain := coalesce((v_numbers -> 'reward' ->> 'consecutive')::boolean, false) and v_prev_track = v_track;
  v_next_label := lpad(extract(month from v_next)::text, 2, '0') || '-' || extract(year from v_next);

  if v_missing > 0 then
    v_body := v_halaqa || ' · ' || v_label || ' · المحتسبون '
      || (v_numbers -> 'reward' ->> 'counted') || ' من ' || (v_numbers -> 'reward' ->> 'quota')
      || ' · خصم ' || (v_numbers -> 'reward' ->> 'deduction') || ' شيكل'
      || case when (v_numbers -> 'reward' ->> 'consecutive')::boolean then ' (شهرٌ متتالٍ)' else '' end;
    perform private.notify(v_teacher, 'below_quota', 'حلقتك دون نصاب مسارها', v_body, '/dashboard', 'teacher_quality_months', v_id);
    for v_staff in select p.id from public.profiles p where p.status = 'active'
                     and (p.role = 'admin_manager' or (p.role = 'technical_manager' and v_gender = 'male')) loop
      perform private.notify(v_staff, 'below_quota', 'حلقةٌ دون نصاب مسارها', v_body, '/tracks', 'teacher_quality_months', v_id);
    end loop;
  end if;

  -- التحويلُ التلقائيّ: يُحذف ما سبق لهذا الشهر ثم يُعاد إن تحقّق الشرط (يُعاد حسابه مع كلّ حفظ)
  delete from public.halaqa_tracks t
   where t.halaqa_id = p_halaqa and t.is_auto
     and t.effective_year = extract(year from v_next) and t.effective_month = extract(month from v_next);

  if v_chain and v_track = 1
     and not exists (select 1 from public.halaqa_tracks t where t.halaqa_id = p_halaqa
                      and t.effective_year = extract(year from v_next) and t.effective_month = extract(month from v_next)) then
    insert into public.halaqa_tracks (halaqa_id, track, effective_year, effective_month, reason, assigned_by, is_auto)
    values (p_halaqa, 2, extract(year from v_next)::integer, extract(month from v_next)::integer,
            'تحويلٌ تلقائيّ: دون نصاب المسار الأول شهرين متتاليين (حتى ' || v_label || ')', (select auth.uid()), true);
    v_body := v_halaqa || ' · دون نصاب المسار الأول شهرين متتاليين — تتحوّل إلى المسار الثاني (8 طلاب · 400) من ' || v_next_label;
    perform private.notify(v_teacher, 'track_decided', 'تحوّلت حلقتك إلى المسار الثاني', v_body, '/dashboard', 'teacher_quality_months', v_id);
    for v_staff in select p.id from public.profiles p where p.status = 'active'
                     and (p.role = 'admin_manager' or (p.role = 'technical_manager' and v_gender = 'male')) loop
      perform private.notify(v_staff, 'track_decided', 'تحويلٌ تلقائيّ إلى المسار الثاني', v_body, '/tracks', 'teacher_quality_months', v_id);
    end loop;
  elsif v_chain and v_track = 2 then
    v_body := v_halaqa || ' · دون نصاب المسار الثاني (8) شهرين متتاليين حتى ' || v_label
      || ' · المحتسبون ' || (v_numbers -> 'reward' ->> 'counted') || ' — للنظر في استمرارها';
    for v_staff in select p.id from public.profiles p where p.status = 'active' and p.role = 'admin_manager' loop
      perform private.notify(v_staff, 'below_quota', 'حلقةٌ على المسار الثاني دون نصابها شهرين', v_body, '/tracks', 'teacher_quality_months', v_id);
    end loop;
  end if;
  return v_id;
end;
$$;

-- التعيينُ اليدويّ (اعتمادُ طلبٍ أو تعيينٌ مباشر) فوق تحويلٍ تلقائيّ يزيل علامتَه، فلا يحذفه حفظٌ لاحق.
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
    track = excluded.track, reason = excluded.reason, request_id = excluded.request_id, assigned_by = excluded.assigned_by, is_auto = false, created_at = now();
  update public.halaqa_track_requests x set status = 'approved', decided_by = (select auth.uid()), decided_at = now(),
         decision_note = nullif(btrim(coalesce(p_note, '')), ''), effective_year = v_eff / 100, effective_month = v_eff % 100
   where x.id = r.id;
  perform private.notify(r.requested_by, 'track_decided', 'اعتُمد مسارُك',
    v_name || ' · المسار ' || case r.requested_track when 2 then 'الثاني' else 'الأول' end
      || ' من ' || lpad((v_eff % 100)::text, 2, '0') || '-' || (v_eff / 100),
    '/dashboard', 'halaqa_track_requests', r.id);
end;
$$;

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
    track = excluded.track, reason = excluded.reason, request_id = null, assigned_by = excluded.assigned_by, is_auto = false, created_at = now();
end;
$$;
