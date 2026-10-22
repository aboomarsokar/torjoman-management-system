-- إصلاحُ 20261022093323 و20261022090058: فحصُ «المعلّمُ أنثى» داخل سياسةٍ كان يقرأ `profiles` بصلاحية المدير الفنيّ،
-- وهو لا يرى العاملات أصلاً (profiles_select) — فبدت كلُّ معلّمةٍ «ليست أنثى» ومرّ إصدارُ التنبيه لها وقراءتُه.
-- الجنسُ يُقرأ الآن بدالّةٍ معرِّفة (definer) لا تمرّ بالسياسة.
create or replace function private.is_female_profile(p_id uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select exists (select 1 from public.profiles p where p.id = p_id and p.gender = 'female');
$function$;
revoke all on function private.is_female_profile(uuid) from public, anon;
grant execute on function private.is_female_profile(uuid) to authenticated;

drop policy alerts_insert on public.admin_alerts;
create policy alerts_insert on public.admin_alerts for insert to authenticated
  with check (
    issuer_id = (select auth.uid())
    and ((select public.is_admin_manager())
      or (public.current_user_role() = 'technical_manager' and not private.is_female_profile(teacher_id)))
  );

drop policy alerts_select on public.admin_alerts;
create policy alerts_select on public.admin_alerts for select to authenticated
  using (
    issuer_id = (select auth.uid()) or teacher_id = (select auth.uid())
    or public.is_project_supervisor()
    or public.current_user_role() = 'admin_manager'
    or (public.current_user_role() = 'technical_manager' and not private.is_female_profile(teacher_id))
    or (public.is_women_admin() and exists (select 1 from public.halaqat h
          where h.teacher_id = admin_alerts.teacher_id and h.gender = 'female'))
  );
