-- إكمالُ 20261020090029: السحبُ من anon/authenticated بالاسم لا يكفي ما دام PUBLIC يملك EXECUTE (منحُ Postgres
-- الافتراضيّ للدوالّ) — فبقيت دوالُّ المشغّلات قابلةً للنداء (لاحظته جلسةُ النيابة 2026-10-20 بـhas_function_privilege).
-- المشغّلُ لا يحتاج EXECUTE عند الإطلاق، فلا يتغيّر سلوكٌ. و`reschedule_visit` يناديها المشرفُ الميداني (authenticated)
-- فتُسحب من الزائر وحده.

revoke execute on function public.bump_parts_on_pass() from public;
revoke execute on function public.guard_alert_update() from public;
revoke execute on function public.guard_profile_privileged() from public;
revoke execute on function public.guard_report_status() from public;
revoke execute on function public.guard_statement_status() from public;
revoke execute on function public.guard_student_assignment() from public;
revoke execute on function public.stamp_halaqa_examiner() from public;
revoke execute on function public.rls_auto_enable() from public;

do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'reschedule_visit'
  loop
    execute format('revoke execute on function %s from public, anon', f);
  end loop;
end $$;
