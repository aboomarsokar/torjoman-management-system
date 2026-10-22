-- رجوعٌ عن جزء التنبيهات في 20261022092711 (قرار المستخدم 2026-10-22: «خلّ المدير الفني يُصدر تنبيهات عادي»):
-- يُصدرها المدير الإداري، والمدير الفنيّ لمعلّمي البنين وحدهم (قسمُه منذ 20261022090058).
-- ⚠️ فحصُ الأنثى هنا يمرّ بـRLS فلا يرى الفنيُّ العاملات — أُصلح في 20261022093347.
drop policy alerts_insert on public.admin_alerts;
create policy alerts_insert on public.admin_alerts for insert to authenticated
  with check (
    issuer_id = (select auth.uid())
    and ((select public.is_admin_manager())
      or (public.current_user_role() = 'technical_manager'
          and not exists (select 1 from public.profiles p where p.id = admin_alerts.teacher_id and p.gender = 'female')))
  );
