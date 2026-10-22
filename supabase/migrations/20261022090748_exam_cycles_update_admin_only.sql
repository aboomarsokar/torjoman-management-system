-- خطةُ الاختبارات يعدّلها المدير الإداري وحده (قرار المستخدم 2026-10-22)؛ والبقيّةُ تقرأ.
drop policy exam_cycles_update on public.exam_cycles;
create policy exam_cycles_update on public.exam_cycles for update to authenticated
  using ((select public.is_admin_manager()))
  with check ((select public.is_admin_manager()));
