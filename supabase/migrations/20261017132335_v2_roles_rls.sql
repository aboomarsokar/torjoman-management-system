-- ============================================================================
-- الإصدار الثاني — الأساس: الأدوار السبعة والنطاق وكل السياسات
-- المواصفة: docs/superpowers/specs/2026-10-17-v2-foundation-design.md
-- ذرّية: تُسقط كل سياسات public ودوالّ النوع القديم، تبدّل النوع، ثم تعيد البناء.
-- الاختبار: supabase/tests/v2_rls.sql
-- ============================================================================

-- 0) إسقاط كل سياسات public (تعتمد على user_role) ثم الدوالّ المعتمدة عليه
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
drop function if exists public.current_user_role();
drop function if exists public.is_manager();
drop function if exists public.can_access_halaqa(uuid);
drop function if exists public.is_halaqa_examiner(uuid);

-- 1) تبديل نوع الدور (لا DROP VALUE في Postgres) مع تحويل القائم
create type public.user_role_v2 as enum
  ('project_supervisor', 'admin_manager', 'technical_manager', 'field_supervisor', 'examiner', 'teacher', 'student');
alter table public.profiles alter column role type public.user_role_v2 using (
  case role::text
    when 'manager'    then 'admin_manager'
    when 'quality'    then 'technical_manager'
    when 'supervisor' then 'field_supervisor'
    else role::text
  end
)::public.user_role_v2;
drop type public.user_role;
alter type public.user_role_v2 rename to user_role;

-- 2) النطاق والرقم الوظيفي وحساب الطالب
create type public.section_scope as enum ('all', 'male', 'female');
alter table public.profiles
  add column section public.section_scope not null default 'all',
  add column employee_number text unique check (employee_number ~ '^\d{4}$'),
  drop column quality_supervisor_id;
alter table public.students
  add column user_id uuid unique references auth.users(id) on delete set null;

create sequence public.employee_number_seq start 1001 minvalue 1001 maxvalue 9999;
-- التسلسل للخدمة وحدها كالدالّة (المنح الافتراضية في Supabase تعطيه anon/authenticated)
revoke all on sequence public.employee_number_seq from public, anon, authenticated;
create or replace function public.claim_employee_number()
returns text language sql volatile security definer set search_path = public as $$
  select nextval('public.employee_number_seq')::text;
$$;
revoke all on function public.claim_employee_number() from public, anon, authenticated;
grant execute on function public.claim_employee_number() to service_role;

-- 3) حارس الأعمدة الامتيازية: لا يغيّر أحدٌ دورَه/قسمَه/رقمَه/حالتَه إلا المدير الإداري
create or replace function public.guard_profile_privileged()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if; -- الخدمة والهجرات
  if (new.role, new.section, new.employee_number, new.status)
     is distinct from (old.role, old.section, old.employee_number, old.status)
     and not public.is_admin_manager() then
    raise exception 'لا تملك تعديل الدور أو القسم أو الرقم الوظيفي أو الحالة' using errcode = '42501';
  end if;
  return new;
end $$;

-- 4) دوالّ النطاق
create or replace function public.current_user_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and status = 'active';
$$;
create or replace function public.current_user_section() returns public.section_scope
language sql stable security definer set search_path = public as $$
  select section from public.profiles where id = auth.uid();
$$;
create or replace function public.is_project_supervisor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() = 'project_supervisor', false);
$$;
create or replace function public.is_admin_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() = 'admin_manager', false);
$$;
-- المدير الإداري بقسم «الكل» — للمالية والأخبار والمحاضر والإعدادات (لا جنس لها)
create or replace function public.is_full_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin_manager() and public.current_user_section() = 'all';
$$;
create or replace function public.in_section(g public.gender_type) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.current_user_section() when 'all' then true else g::text = public.current_user_section()::text end;
$$;
create or replace function public.can_view_halaqa(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.halaqat h where h.id = hid and (
         public.is_project_supervisor()
      or (public.current_user_role() in ('admin_manager', 'technical_manager') and public.in_section(h.gender))
      or h.supervisor_id = auth.uid()
      or h.examiner_id = auth.uid()
      or h.teacher_id = auth.uid()
    ));
$$;
create or replace function public.can_manage_halaqa(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.halaqat h where h.id = hid
      and public.current_user_role() in ('admin_manager', 'technical_manager') and public.in_section(h.gender));
$$;
create or replace function public.can_assign_in_halaqa(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_manage_halaqa(hid)
      or exists (select 1 from public.halaqat h where h.id = hid and h.supervisor_id = auth.uid()
                 and public.current_user_role() = 'field_supervisor');
$$;
create or replace function public.is_halaqa_teacher(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.halaqat h where h.id = hid and h.teacher_id = auth.uid());
$$;
create or replace function public.is_halaqa_examiner(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.halaqat h where h.id = hid and h.examiner_id = auth.uid());
$$;
create or replace function public.my_student_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.students where user_id = auth.uid();
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'current_user_role()', 'current_user_section()', 'is_project_supervisor()', 'is_admin_manager()',
    'is_full_admin()', 'in_section(public.gender_type)', 'can_view_halaqa(uuid)', 'can_manage_halaqa(uuid)',
    'can_assign_in_halaqa(uuid)', 'is_halaqa_teacher(uuid)', 'is_halaqa_examiner(uuid)', 'my_student_id()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

create trigger profiles_guard_privileged before update on public.profiles
  for each row execute function public.guard_profile_privileged();

-- حارس الإسناد: تغيير students.halaqa_id لمن يملك الإسناد في الحلقة الجديدة فقط
create or replace function public.guard_student_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.halaqa_id is distinct from old.halaqa_id
     and new.halaqa_id is not null
     and not public.can_assign_in_halaqa(new.halaqa_id) then
    raise exception 'لا تملك إسناد الطالب لهذه الحلقة' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger students_guard_assignment before update on public.students
  for each row execute function public.guard_student_assignment();

-- 5) السياسات
-- profiles: الأسماء يحتاجها الجميع؛ الكتابة للمدير الإداري + الذات (والحارس يمنع الامتيازي)
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (public.is_admin_manager());
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_admin_manager() or id = auth.uid()) with check (public.is_admin_manager() or id = auth.uid());
create policy profiles_delete on public.profiles for delete to authenticated using (public.is_full_admin());
create policy fin_all on public.profile_financials for all to authenticated
  using (public.is_full_admin() or public.is_project_supervisor()) with check (public.is_full_admin());

-- halaqat
create policy halaqat_select on public.halaqat for select to authenticated
  using (public.can_view_halaqa(id) or id = (select halaqa_id from public.students where user_id = auth.uid()));
create policy halaqat_insert on public.halaqat for insert to authenticated
  with check (public.current_user_role() in ('admin_manager', 'technical_manager') and public.in_section(gender));
create policy halaqat_update on public.halaqat for update to authenticated
  using (public.can_manage_halaqa(id)) with check (public.current_user_role() in ('admin_manager', 'technical_manager') and public.in_section(gender));
create policy halaqat_delete on public.halaqat for delete to authenticated using (public.is_admin_manager() and public.in_section(gender));

-- students: النطاق + الطالب لنفسه + غير المُسنَد لمن يُسند من جنسه
create policy students_select on public.students for select to authenticated using (
     user_id = auth.uid()
  or public.can_view_halaqa(halaqa_id)
  or (halaqa_id is null and (public.is_project_supervisor()
      or (public.current_user_role() in ('admin_manager', 'technical_manager') and public.in_section(gender))
      or (public.current_user_role() = 'field_supervisor'
          and gender = (select p.gender from public.profiles p where p.id = auth.uid())))));
create policy students_insert on public.students for insert to authenticated
  with check (public.is_admin_manager() and public.in_section(gender));
create policy students_update on public.students for update to authenticated using (
     (public.is_admin_manager() and public.in_section(gender))
  or (halaqa_id is not null and (public.can_assign_in_halaqa(halaqa_id) or public.is_halaqa_teacher(halaqa_id)))
  or (halaqa_id is null and (public.current_user_role() in ('technical_manager', 'field_supervisor')))
) with check (public.in_section(gender) or public.current_user_role() = 'field_supervisor' or public.is_halaqa_teacher(halaqa_id));
create policy students_delete on public.students for delete to authenticated using (public.is_admin_manager() and public.in_section(gender));

-- exam_plan و app_settings و news و المالية والمحاضر
create policy plan_select on public.exam_plan for select to authenticated using (true);
create policy plan_write on public.exam_plan for all to authenticated
  using (public.current_user_role() in ('admin_manager', 'technical_manager'))
  with check (public.current_user_role() in ('admin_manager', 'technical_manager'));
create policy settings_select on public.app_settings for select to authenticated using (true);
create policy settings_write on public.app_settings for all to authenticated using (public.is_full_admin()) with check (public.is_full_admin());
-- الأخبار: سياستان لا واحدة — anon لا يملك تنفيذ دوالّ النطاق، وPostgres يفحص صلاحية كل دالّة
-- في التعبير عند تهيئته لا عند تقييمه، فـ«published or is_full_admin()» كانت تُسقط قراءة الزائر كلَّها.
create policy news_select_published on public.news for select to anon, authenticated using (published);
create policy news_select_staff on public.news for select to authenticated using (public.is_full_admin() or public.is_project_supervisor());
create policy news_write on public.news for all to authenticated using (public.is_full_admin()) with check (public.is_full_admin());
create policy fintx_all on public.financial_transactions for all to authenticated
  using (public.is_full_admin() or public.is_project_supervisor()) with check (public.is_full_admin());
create policy salaries_all on public.monthly_salaries for all to authenticated
  using (public.is_full_admin() or public.is_project_supervisor()) with check (public.is_full_admin());
create policy minutes_all on public.meeting_minutes for all to authenticated
  using (public.is_full_admin() or public.is_project_supervisor()) with check (public.is_full_admin());

-- exam_lists / items / results
create policy lists_select on public.exam_lists for select to authenticated using (public.can_view_halaqa(halaqa_id));
create policy lists_insert on public.exam_lists for insert to authenticated
  with check (public.current_user_role() = 'teacher' and teacher_id = auth.uid() and public.is_halaqa_teacher(halaqa_id));
create policy lists_update on public.exam_lists for update to authenticated
  using (public.can_manage_halaqa(halaqa_id) or public.is_halaqa_examiner(halaqa_id))
  with check (public.can_manage_halaqa(halaqa_id) or public.is_halaqa_examiner(halaqa_id));
create policy lists_delete on public.exam_lists for delete to authenticated
  using (public.can_manage_halaqa(halaqa_id) or teacher_id = auth.uid());
create policy items_select on public.exam_list_items for select to authenticated
  using (exists (select 1 from public.exam_lists l where l.id = exam_list_id and public.can_view_halaqa(l.halaqa_id)));
create policy items_write on public.exam_list_items for all to authenticated
  using (exists (select 1 from public.exam_lists l where l.id = exam_list_id
                 and (public.is_halaqa_teacher(l.halaqa_id) or public.can_manage_halaqa(l.halaqa_id))))
  with check (exists (select 1 from public.exam_lists l where l.id = exam_list_id
                 and (public.is_halaqa_teacher(l.halaqa_id) or public.can_manage_halaqa(l.halaqa_id))));
create policy results_select on public.exam_results for select to authenticated using (
  student_id = public.my_student_id()
  or exists (select 1 from public.students s where s.id = student_id and public.can_view_halaqa(s.halaqa_id)));
create policy results_insert on public.exam_results for insert to authenticated with check (
  exists (select 1 from public.students s where s.id = student_id and (
       public.can_manage_halaqa(s.halaqa_id)
    or (public.current_user_role() = 'examiner' and examiner_id = auth.uid() and public.is_halaqa_examiner(s.halaqa_id)))));
create policy results_update on public.exam_results for update to authenticated
  using (examiner_id = auth.uid() or exists (select 1 from public.students s where s.id = student_id and public.can_manage_halaqa(s.halaqa_id)))
  with check (examiner_id = auth.uid() or exists (select 1 from public.students s where s.id = student_id and public.can_manage_halaqa(s.halaqa_id)));
create policy results_delete on public.exam_results for delete to authenticated
  using (exists (select 1 from public.students s where s.id = student_id and public.is_admin_manager() and public.in_section(s.gender)));

-- التقارير الشهرية: المعلم يكتب تقرير حلقته، والإدارة تعتمد
create policy reports_select on public.monthly_reports for select to authenticated using (public.can_view_halaqa(halaqa_id));
create policy reports_write on public.monthly_reports for all to authenticated
  using (public.is_halaqa_teacher(halaqa_id) or public.can_manage_halaqa(halaqa_id))
  with check (public.is_halaqa_teacher(halaqa_id) or public.can_manage_halaqa(halaqa_id));
create policy rstudents_select on public.monthly_report_students for select to authenticated using (
  student_id = public.my_student_id()
  or exists (select 1 from public.monthly_reports r where r.id = report_id and public.can_view_halaqa(r.halaqa_id)));
create policy rstudents_write on public.monthly_report_students for all to authenticated
  using (exists (select 1 from public.monthly_reports r where r.id = report_id and (public.is_halaqa_teacher(r.halaqa_id) or public.can_manage_halaqa(r.halaqa_id))))
  with check (exists (select 1 from public.monthly_reports r where r.id = report_id and (public.is_halaqa_teacher(r.halaqa_id) or public.can_manage_halaqa(r.halaqa_id))));
create policy ractivities_select on public.monthly_report_activities for select to authenticated
  using (exists (select 1 from public.monthly_reports r where r.id = report_id and public.can_view_halaqa(r.halaqa_id)));
create policy ractivities_write on public.monthly_report_activities for all to authenticated
  using (exists (select 1 from public.monthly_reports r where r.id = report_id and (public.is_halaqa_teacher(r.halaqa_id) or public.can_manage_halaqa(r.halaqa_id))))
  with check (exists (select 1 from public.monthly_reports r where r.id = report_id and (public.is_halaqa_teacher(r.halaqa_id) or public.can_manage_halaqa(r.halaqa_id))));

-- الزيارات
create policy visits_select on public.supervision_visits for select to authenticated using (public.can_view_halaqa(halaqa_id));
create policy visits_insert on public.supervision_visits for insert to authenticated with check (
  public.can_manage_halaqa(halaqa_id)
  or (public.current_user_role() = 'field_supervisor' and supervisor_id = auth.uid() and public.can_view_halaqa(halaqa_id)));
create policy visits_update on public.supervision_visits for update to authenticated
  using (supervisor_id = auth.uid() or public.can_manage_halaqa(halaqa_id))
  with check (supervisor_id = auth.uid() or public.can_manage_halaqa(halaqa_id));
create policy visits_delete on public.supervision_visits for delete to authenticated using (public.can_manage_halaqa(halaqa_id));
create policy reschedule_select on public.visit_reschedule_log for select to authenticated
  using (exists (select 1 from public.supervision_visits v where v.id = visit_id and public.can_view_halaqa(v.halaqa_id)));
create policy reschedule_insert on public.visit_reschedule_log for insert to authenticated
  with check (exists (select 1 from public.supervision_visits v where v.id = visit_id
              and (v.supervisor_id = auth.uid() or public.can_manage_halaqa(v.halaqa_id))));

-- الحوافز
create policy incentives_select on public.halaqa_incentives for select to authenticated using (public.can_view_halaqa(halaqa_id));
create policy incentives_write on public.halaqa_incentives for all to authenticated
  using (public.is_admin_manager() and public.can_manage_halaqa(halaqa_id))
  with check (public.is_admin_manager() and public.can_manage_halaqa(halaqa_id));
create policy statements_select on public.incentive_statements for select to authenticated using (public.can_view_halaqa(halaqa_id));
create policy statements_write on public.incentive_statements for all to authenticated
  using (public.is_halaqa_teacher(halaqa_id) or public.can_manage_halaqa(halaqa_id))
  with check (public.is_halaqa_teacher(halaqa_id) or public.can_manage_halaqa(halaqa_id));
create policy sitems_select on public.incentive_statement_items for select to authenticated
  using (exists (select 1 from public.incentive_statements st where st.id = statement_id and public.can_view_halaqa(st.halaqa_id)));
create policy sitems_write on public.incentive_statement_items for all to authenticated
  using (exists (select 1 from public.incentive_statements st where st.id = statement_id and (public.is_halaqa_teacher(st.halaqa_id) or public.can_manage_halaqa(st.halaqa_id))))
  with check (exists (select 1 from public.incentive_statements st where st.id = statement_id and (public.is_halaqa_teacher(st.halaqa_id) or public.can_manage_halaqa(st.halaqa_id))));

-- التنبيهات الإدارية
create policy alerts_select on public.admin_alerts for select to authenticated using (
  issuer_id = auth.uid() or teacher_id = auth.uid() or public.is_project_supervisor()
  or (public.current_user_role() in ('admin_manager', 'technical_manager')
      and exists (select 1 from public.profiles t where t.id = teacher_id and public.in_section(t.gender))));
create policy alerts_insert on public.admin_alerts for insert to authenticated
  with check (public.current_user_role() in ('admin_manager', 'technical_manager', 'field_supervisor') and issuer_id = auth.uid());
create policy alerts_update on public.admin_alerts for update to authenticated
  using (issuer_id = auth.uid() or teacher_id = auth.uid() or public.is_admin_manager())
  with check (issuer_id = auth.uid() or teacher_id = auth.uid() or public.is_admin_manager());
