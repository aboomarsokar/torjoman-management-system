-- الدور الثامن: المديرة الإدارية لقسم البنات (قرار المستخدم 2026-10-17 بعد مراجعة Task 2).
-- في هجرةٍ مستقلّة لأن القيمة الجديدة لا تُستعمل في المعاملة التي أضافتها.
alter type public.user_role add value if not exists 'women_admin' after 'technical_manager';
