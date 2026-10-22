-- المديرةُ الإدارية تدخل بالنيابة على مشرفاتها ومختبِراتها ومعلّماتها (قرار المستخدم 2026-10-22).
-- القائمةُ البيضاء وشرطُ الأنثى في `app/constants/impersonation.ts` يحكم بها الخادمُ قبل فتح الجلسة؛ وهنا القيدُ وحده.
alter table public.impersonation_sessions drop constraint impersonation_sessions_actor_role_check;
alter table public.impersonation_sessions add constraint impersonation_sessions_actor_role_check
  check (actor_role in ('admin_manager', 'technical_manager', 'women_admin'));
