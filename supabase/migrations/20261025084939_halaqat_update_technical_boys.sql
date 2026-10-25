-- المدير الفنيّ يعدّل حلقات البنين (الاسم والوقت والحالة وإسناد المعلم والمشرف والمختبِر) — طلب المستخدم 2026-10-25،
-- يعدّل قرار 2026-10-22 (التعديل للإداري وحده). الإنشاءُ والحذفُ يبقيان للمدير الإداريّ وحده.
-- `with check` على الجنس: لا ينقل حلقةً إلى البنات، وحارسُ `guard_halaqa_staff` يحكم جنسَ الطاقم.
drop policy halaqat_update on public.halaqat;
create policy halaqat_update on public.halaqat for update to authenticated
  using ((select public.is_admin_manager())
         or ((select public.current_user_role()) = 'technical_manager' and gender = 'male'))
  with check ((select public.is_admin_manager())
         or ((select public.current_user_role()) = 'technical_manager' and gender = 'male'));
