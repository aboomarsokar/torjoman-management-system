-- «إنجاز الحلقات» للمدير الفنيّ وغيره من الإدارة (طلب المستخدم 2026-10-22): لكلّ حلقةٍ في النطاق عددُ من أنجز
-- خطةَ الشهر من طلابها، وتفصيلُ طلابها، وجوّالُ معلّمها وواتسابه للتواصل. حكمُ الطالب هو نفسُه في سجلّ تقييم
-- المعلم (`private.quality_month_compute`): لم يُرصد · لا يُقاس · أنجز · مقصّر — والفحصُ أسفلُ يضمن التطابق.

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
  v_prorate boolean := (p_year, p_month) >= (2026, 11);
  v_report_id uuid;
  v_target integer;
  v_month_days integer;
  v_held integer;
  v_att integer;
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
    elsif not v_prorate then
      required := v_target;
    else
      select count(*) into v_held from public.attendance_days d
       where d.halaqa_id = p_halaqa and d.day between v_from and v_to
         and (s.enrollment_date is null or d.day >= s.enrollment_date);
      select v_held - count(*) into v_att from public.attendance_absences a
        join public.attendance_days d on d.halaqa_id = a.halaqa_id and d.day = a.day
       where a.student_id = s.id and a.halaqa_id = p_halaqa and a.day between v_from and v_to
         and (s.enrollment_date is null or a.day >= s.enrollment_date);
      if v_held = 0 and v_month_days > 0 then required := null;
      elsif v_held = 0 then required := v_target;
      elsif v_att <= 0 then required := null;
      elsif v_att >= v_held then required := v_target;
      else required := greatest(1, round(v_target::numeric * v_att / v_held)::integer);
      end if;
    end if;
    state := case when required is null then 'unmeasured' when pages >= required then 'done' else 'short' end;
    return next;
  end loop;
end;
$function$;
revoke all on function private.halaqa_student_achievement(uuid, integer, integer) from public, anon, authenticated;

-- ── الملخّص: سطرٌ لكلّ حلقةٍ نشطةٍ في النطاق ──
create or replace function public.halaqat_achievement(p_year integer, p_month integer)
 returns table (
   halaqa_id uuid, halaqa_name text, gender text,
   teacher_id uuid, teacher_name text, teacher_phone text, teacher_whatsapp text,
   report_status text, students integer, done integer, short integer, unrecorded integer, unmeasured integer)
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

-- ── التفصيل: طلابُ حلقةٍ بحكم كلٍّ منهم ──
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
     order by case a.state when 'short' then 0 when 'unrecorded' then 1 when 'unmeasured' then 2 else 3 end, s.full_name;
end;
$function$;
revoke all on function public.halaqa_achievement_students(uuid, integer, integer) from public, anon;
grant execute on function public.halaqa_achievement_students(uuid, integer, integer) to authenticated;

-- ── فحصٌ ذاتيّ: الحكمُ يطابق سجلَّ التقييم لكلّ حلقةٍ في الشهرين الأخيرين ──
do $$
declare h record; m record; q jsonb; d integer; sh integer; u integer; un integer;
begin
  for m in select extract(year from x)::int y, extract(month from x)::int mo
             from (values (date_trunc('month', now()) - interval '1 month'), (date_trunc('month', now()) - interval '2 month')) v(x) loop
    for h in select id from public.halaqat where status = 'active' loop
      q := private.quality_month_compute(h.id, m.y, m.mo, 0);
      select count(*) filter (where state = 'done'), count(*) filter (where state = 'short'),
             count(*) filter (where state = 'unrecorded'), count(*) filter (where state = 'unmeasured')
        into d, sh, u, un from private.halaqa_student_achievement(h.id, m.y, m.mo);
      if d <> (q ->> 'achievement_done')::int or sh <> (q ->> 'achievement_short')::int
         or u <> (q ->> 'achievement_unrecorded')::int or un <> (q ->> 'achievement_unmeasured')::int then
        raise exception 'إنجازُ الحلقة % في %-% يخالف سجلَّ التقييم', h.id, m.mo, m.y;
      end if;
    end loop;
  end loop;
end $$;
