-- المديرةُ الإدارية تجدول زياراتٍ إشرافية لحلقات البنات وتزورها بنفسها (طلب المستخدم 2026-10-30)، كما يفعل المديرُ الفنيّ
-- لحلقات البنين. وزياراتُ المديرَين تُحسب في سجلّ تقييم الجودة الشهريّ مع زيارات المشرف الميدانيّ (قرار المستخدم 2026-10-30،
-- يُلغي قرارَ 2026-10-26 «زيارةُ المدير الفنيّ للاطّلاع لا للسجلّ»).

-- ① الإدراجُ والتعديل: المشرفُ لحلقاته، والفنيُّ لحلقات البنين، والمديرةُ لحلقات البنات — والزائرُ صاحبُ الصفّ دائماً
drop policy visits_insert on public.supervision_visits;
create policy visits_insert on public.supervision_visits for insert to authenticated
  with check (
    supervisor_id = (select auth.uid())
    and (public.is_halaqa_supervisor(halaqa_id)
      or (public.current_user_role() = 'technical_manager'
          and exists (select 1 from public.halaqat h where h.id = halaqa_id and h.gender = 'male'))
      or (public.current_user_role() = 'women_admin'
          and exists (select 1 from public.halaqat h where h.id = halaqa_id and h.gender = 'female')))
  );

drop policy visits_update on public.supervision_visits;
create policy visits_update on public.supervision_visits for update to authenticated
  using (supervisor_id = (select auth.uid()))
  with check (
    supervisor_id = (select auth.uid())
    and (public.is_halaqa_supervisor(halaqa_id)
      or (public.current_user_role() = 'technical_manager'
          and exists (select 1 from public.halaqat h where h.id = halaqa_id and h.gender = 'male'))
      or (public.current_user_role() = 'women_admin'
          and exists (select 1 from public.halaqat h where h.id = halaqa_id and h.gender = 'female')))
  );

-- ② حارسُ الزائر: مشرفُ الحلقة الميدانيّ، أو المديرُ الفنيّ في حلقة بنين، أو المديرةُ الإدارية في حلقة بنات
create or replace function public.guard_visit_visitor()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE'
     and new.supervisor_id is not distinct from old.supervisor_id
     and new.halaqa_id is not distinct from old.halaqa_id then
    return new;
  end if;
  if exists (
    select 1 from public.halaqat h
    join public.profiles p on p.id = new.supervisor_id and p.role = 'field_supervisor'
    where h.id = new.halaqa_id and h.supervisor_id = new.supervisor_id
  ) then
    return new;
  end if;
  if exists (
    select 1 from public.halaqat h
    join public.profiles p on p.id = new.supervisor_id and p.status = 'active'
     and ((p.role = 'technical_manager' and h.gender = 'male') or (p.role = 'women_admin' and h.gender = 'female'))
    where h.id = new.halaqa_id
  ) then
    return new;
  end if;
  raise exception 'الزائر مشرفُ هذه الحلقة الميدانيّ، أو المديرُ الفنيّ في حلقات البنين، أو المديرةُ الإدارية في حلقات البنات.' using errcode = '23514';
end;
$function$;

-- ③ فتحُ الزيارة المقفلة للتعديل: والمديرةُ الإدارية في نطاقها (حلقات البنات)
create or replace function public.unlock_visit_result(p_visit uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_sup uuid;
  v_name text;
begin
  perform private.assert_session_writable();
  if coalesce(public.current_user_role()::text, '') not in ('admin_manager', 'technical_manager', 'women_admin') then
    raise exception 'فتحُ الزيارة للتعديل للمدير الإداري والفنيّ والمديرة الإدارية.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.supervision_visits v where v.id = p_visit and public.can_view_halaqa(v.halaqa_id)) then
    raise exception 'الزيارة خارج نطاقك.' using errcode = '42501';
  end if;
  perform set_config('torjoman.visit_unlock', p_visit::text, true);
  update public.supervision_visits v set locked_at = null
   where v.id = p_visit and v.locked_at is not null
  returning v.supervisor_id, (select h.name from public.halaqat h where h.id = v.halaqa_id) into v_sup, v_name;
  perform set_config('torjoman.visit_unlock', '', true);
  if v_sup is null then
    raise exception 'الزيارة غير مقفلة أو غير موجودة.';
  end if;
  perform private.notify(v_sup, 'visit_unlocked', 'فُتحت زيارةٌ للتعديل', coalesce(v_name, 'حلقة') || ' — صحّح النتيجة ثم احفظها',
                         '/visits', 'supervision_visits', p_visit);
end;
$function$;

-- ④ سجلُّ التقييم الشهريّ: زياراتُ المشرف الميدانيّ والمدير الفنيّ والمديرة الإدارية (تعديلُ الشرط وحده في الدالّة القائمة)
do $migration$
declare
  v_def text := pg_get_functiondef('private.quality_month_compute'::regproc);
  v_old text := $q$     -- زيارةُ المدير الفنيّ للاطّلاع لا للسجلّ (قرار المستخدم 2026-10-26)
     and exists (select 1 from public.profiles p where p.id = v.supervisor_id and p.role = 'field_supervisor');$q$;
  v_new text := $q$     -- زياراتُ المشرف الميدانيّ والمدير الفنيّ والمديرة الإدارية تُحسب (قرار المستخدم 2026-10-30)
     and exists (select 1 from public.profiles p where p.id = v.supervisor_id
                  and p.role in ('field_supervisor', 'technical_manager', 'women_admin'));$q$;
begin
  if position(v_old in v_def) = 0 then
    raise exception 'quality_month_compute: لم يُعثر على شرط الزيارات المتوقَّع — تغيّرت الدالّة';
  end if;
  execute replace(v_def, v_old, v_new);
end
$migration$;

do $$
begin
  if position('women_admin' in pg_get_functiondef('private.quality_month_compute'::regproc)) = 0 then
    raise exception 'لم يُحدَّث حسابُ الجودة';
  end if;
  if position('women_admin' in pg_get_functiondef('public.guard_visit_visitor'::regproc)) = 0 then
    raise exception 'لم يُحدَّث حارسُ الزائر';
  end if;
end $$;
