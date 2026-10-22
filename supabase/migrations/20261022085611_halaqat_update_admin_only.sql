-- تعديلُ الحلقات للمدير الإداري وحده كإنشائها؛ والمدير الفنيّ يطّلع (طلب المستخدم 2026-10-22)
drop policy halaqat_update on public.halaqat;
create policy halaqat_update on public.halaqat for update to authenticated
  using ((select public.is_admin_manager()))
  with check ((select public.is_admin_manager()));
