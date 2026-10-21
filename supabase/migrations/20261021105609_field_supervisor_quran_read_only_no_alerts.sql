-- قرارا المستخدم 2026-10-21 للمشرف الميدانيّ:
-- ١) «الإنجاز القرآني» للعرض فقط: لا يُدرج سجلَّ طالبٍ ولا يعدّله ولا يحذفه (ويبقى له اعتمادُ الشهر وإعادتُه —
--    حالةُ monthly_reports لا تُمسّ). سياساتٌ تقييديّة فوق القائمة لا تعديلٌ لها؛ والمعلمُ والمعتمِدون الآخرون كما هم.
-- ٢) لا يُصدر تنبيهاتٍ إدارية: alerts_insert للمديرَين وحدهما. ما أصدره قبلُ يبقى ويراه المعلم.
-- تحقّقٌ ملغى قبل التطبيق بجلسة مشرفٍ حقيقيّة: تحديثُ سجلّات تقريرٍ مسوّدة 1 ← 0، والإدراجُ والتنبيهُ يُرفضان بـ42501.
alter policy alerts_insert on public.admin_alerts with check (
  (public.current_user_role() = any (array['admin_manager', 'technical_manager']::public.user_role[]))
  and (issuer_id = (select auth.uid())));

create policy quran_records_supervisor_read_only_insert on public.quran_records as restrictive for insert to authenticated
  with check ((select public.current_user_role()) is distinct from 'field_supervisor'::public.user_role);
create policy quran_records_supervisor_read_only_update on public.quran_records as restrictive for update to authenticated
  using ((select public.current_user_role()) is distinct from 'field_supervisor'::public.user_role)
  with check ((select public.current_user_role()) is distinct from 'field_supervisor'::public.user_role);
create policy quran_records_supervisor_read_only_delete on public.quran_records as restrictive for delete to authenticated
  using ((select public.current_user_role()) is distinct from 'field_supervisor'::public.user_role);

do $$
begin
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'quran_records'
      and policyname like 'quran_records_supervisor_read_only_%' and permissive = 'RESTRICTIVE') <> 3 then
    raise exception 'سياساتُ قراءة المشرف الثلاث ناقصة';
  end if;
  if (select with_check from pg_policies where schemaname = 'public' and tablename = 'admin_alerts' and policyname = 'alerts_insert') like '%field_supervisor%' then
    raise exception 'alerts_insert ما زال يسمح للمشرف';
  end if;
end $$;
