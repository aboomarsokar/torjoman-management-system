-- إنشاءُ الحلقات للمدير الإداري وحده (طلب المستخدم 2026-10-22؛ وتعديلُها كذلك في الهجرة التالية)
drop policy halaqat_insert on public.halaqat;
create policy halaqat_insert on public.halaqat for insert to authenticated
  with check ((select public.is_admin_manager()));
