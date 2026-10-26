-- المدير الفني يجدول زياراتٍ إشرافية لحلقات البنين ويزورها بنفسه (طلب المستخدم 2026-10-26): يجدول باسمه وينفّذ
-- ويملأ النموذج (من 42) كالمشرف الميدانيّ. وزيارتُه **للاطّلاع لا تدخل سجلَّ تقييم المعلّم الشهريّ** (قرار المستخدم):
-- السجلُّ يبقى على زيارات المشرف الميدانيّ وحدها.

-- ① الإدراجُ والتعديل: المشرفُ لحلقاته، والفنيُّ لحلقات البنين — والزائرُ صاحبُ الصفّ دائماً
drop policy visits_insert on public.supervision_visits;
create policy visits_insert on public.supervision_visits for insert to authenticated
  with check (
    supervisor_id = (select auth.uid())
    and (public.is_halaqa_supervisor(halaqa_id)
      or (public.current_user_role() = 'technical_manager'
          and exists (select 1 from public.halaqat h where h.id = halaqa_id and h.gender = 'male')))
  );

drop policy visits_update on public.supervision_visits;
create policy visits_update on public.supervision_visits for update to authenticated
  using (supervisor_id = (select auth.uid()))
  with check (
    supervisor_id = (select auth.uid())
    and (public.is_halaqa_supervisor(halaqa_id)
      or (public.current_user_role() = 'technical_manager'
          and exists (select 1 from public.halaqat h where h.id = halaqa_id and h.gender = 'male')))
  );

-- ② حارسُ الزائر: مشرفُ الحلقة الميدانيّ، أو المديرُ الفنيّ في حلقة بنين
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
    join public.profiles p on p.id = new.supervisor_id and p.role = 'technical_manager' and p.status = 'active'
    where h.id = new.halaqa_id and h.gender = 'male'
  ) then
    return new;
  end if;
  raise exception 'الزائر مشرفُ هذه الحلقة الميدانيّ، أو المديرُ الفنيّ في حلقات البنين.' using errcode = '23514';
end;
$function$;

-- ③ سجلُّ التقييم الشهريّ: زياراتُ المشرف الميدانيّ وحدها (تعديلُ شرطٍ واحدٍ في الدالّة القائمة، بلا نسخها)
do $migration$
declare
  v_def text := pg_get_functiondef('private.quality_month_compute'::regproc);
  v_old text := $q$   where v.halaqa_id = p_halaqa and v.score is not null and v.executed_at is not null
     and (v.scheduled_at at time zone 'Asia/Gaza')::date between v_from and v_to;$q$;
  v_new text := $q$   where v.halaqa_id = p_halaqa and v.score is not null and v.executed_at is not null
     and (v.scheduled_at at time zone 'Asia/Gaza')::date between v_from and v_to
     -- زيارةُ المدير الفنيّ للاطّلاع لا للسجلّ (قرار المستخدم 2026-10-26)
     and exists (select 1 from public.profiles p where p.id = v.supervisor_id and p.role = 'field_supervisor');$q$;
begin
  if position(v_old in v_def) = 0 then
    raise exception 'quality_month_compute: لم يُعثر على شرط الزيارات المتوقَّع — تغيّرت الدالّة';
  end if;
  execute replace(v_def, v_old, v_new);
end
$migration$;
