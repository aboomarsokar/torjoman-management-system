-- أداءُ RLS قبل الإطلاق: `can_view_halaqa(halaqa_id)` كانت تُستدعى لكلّ صفٍّ في اثنتي عشرة سياسة قراءة (الطلاب والحلقات
-- والحضور والرصد والزيارات والاختبارات والتقارير والحوافز)، وكلُّ استدعاءٍ يبحث في الحلقات ومعه حتى أربعُ قراءاتٍ للدور.
-- محاكاةُ 600 طالبٍ (معاملةٌ ملغاة 2026-10-20): قراءةُ الجداول الاثني عشر 283ms للمعلّم و627ms للمشرف و152ms للمدير.
-- البديل: `visible_halaqa_ids()` بالمنطق نفسه حرفياً تُرجع مصفوفة الحلقات المرئية مرّةً للطلب (initplan)، والسياسةُ
-- `halaqa_id = any (...)` — فصارت 11ms و11ms و8ms، والأعدادُ متطابقةٌ لسبعة أدوار في الجداول الاثني عشر.
-- `can_view_halaqa` تبقى (دوالٌّ أخرى تستعملها). التحويل `::uuid[]` لازم: بدونه يُقرأ any(subquery) صفوفاً لا مصفوفة.

create or replace function public.visible_halaqa_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(h.id), '{}') from public.halaqat h where
         public.is_project_supervisor()
      or public.current_user_role() in ('admin_manager', 'technical_manager')
      or (public.current_user_role() = 'women_admin' and h.gender = 'female')
      or (public.current_user_role() is not null and auth.uid() in (h.supervisor_id, h.examiner_id, h.teacher_id));
$$;

revoke all on function public.visible_halaqa_ids() from public, anon;
grant execute on function public.visible_halaqa_ids() to authenticated;

do $$
declare
  p record;
  q text;
  w text;
  sql text;
  re text := 'can_view_halaqa\(([a-z_.]+)\)';
begin
  for p in
    select n.nspname sch, c.relname tbl, pol.polname, pg_get_expr(pol.polqual, pol.polrelid) q, pg_get_expr(pol.polwithcheck, pol.polrelid) w
    from pg_policy pol join pg_class c on c.oid = pol.polrelid join pg_namespace n on n.oid = c.relnamespace
    where (coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '')) ~ re
  loop
    q := regexp_replace(p.q, re, '(\1 = any ((select public.visible_halaqa_ids())::uuid[]))', 'g');
    w := regexp_replace(p.w, re, '(\1 = any ((select public.visible_halaqa_ids())::uuid[]))', 'g');
    sql := format('alter policy %I on %I.%I', p.polname, p.sch, p.tbl);
    if q is not null then sql := sql || format(' using (%s)', q); end if;
    if w is not null then sql := sql || format(' with check (%s)', w); end if;
    execute sql;
  end loop;
end
$$;
