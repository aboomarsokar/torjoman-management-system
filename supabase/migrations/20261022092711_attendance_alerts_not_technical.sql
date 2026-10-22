-- قرارا المستخدم 2026-10-22: (1) المدير الفنيّ لا يرصد الحضور ولا الغياب — يتابع فقط؛ (2) ولا يُصدر التنبيهات الإدارية — للمدير الإداري وحده.
-- `can_approve_in_halaqa` لا يستعملها إلا الحضورُ و`can_assign_in_halaqa` (إسنادُ الطلاب، وقد سُحب من الفنيّ في 20261022090357)،
-- فإخراجُ الفنيّ منها يمسّ الاثنين وحدهما. وقراءتُه الحضورَ بنطاق الحلقة (`visible_halaqa_ids`) باقية.
create or replace function public.can_approve_in_halaqa(hid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.halaqat h where h.id = hid and (
         public.current_user_role() = 'admin_manager'
      or (public.current_user_role() = 'women_admin' and h.gender = 'female')));
$function$;

drop policy alerts_insert on public.admin_alerts;
create policy alerts_insert on public.admin_alerts for insert to authenticated
  with check ((select public.is_admin_manager()) and issuer_id = (select auth.uid()));
