-- المديرةُ الإدارية تُصدر التنبيهاتِ والإنذاراتِ لمعلّمات قسمها (قرار المستخدم 2026-10-22)؛ والمعلّمةُ ترى المُصدِرَ
-- «إدارة المشروع» كسائر التنبيهات. والجنسُ بالدالّة المعرِّفة (لا بقراءة profiles تحت RLS).
drop policy alerts_insert on public.admin_alerts;
create policy alerts_insert on public.admin_alerts for insert to authenticated
  with check (
    issuer_id = (select auth.uid())
    and ((select public.is_admin_manager())
      or (public.current_user_role() = 'technical_manager' and not private.is_female_profile(teacher_id))
      or (public.current_user_role() = 'women_admin' and private.is_female_profile(teacher_id)))
  );
