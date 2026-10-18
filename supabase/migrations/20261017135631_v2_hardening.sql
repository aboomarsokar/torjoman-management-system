-- ============================================================================
-- الإصدار الثاني — تحصين الأدوار والسياسات (جولة الإصلاح الأولى لـ Task 2)
-- يسبقها: 20261017132335_v2_roles_rls.sql و20261017135124_v2_women_admin_role.sql
-- الاختبار: supabase/tests/v2_rls.sql
--
-- قرار المستخدم 2026-10-17:
--   • لا عمود section — النطاق في الدور نفسه.
--   • admin_manager وtechnical_manager: القسمان، وشخصٌ واحد نشط لكلٍّ منهما.
--   • women_admin (المديرة الإدارية): قسم البنات (halaqat.gender = 'female') — ترى كل شيء فيه،
--     وتُسند الطالبات وتُخرجهنّ، وتعتمد التقارير الشهرية وكشوف الحوافز؛ لا تنشئ حسابات،
--     ولا تمسّ المالية والرواتب والمحاضر والأخبار والإعدادات، ولا دورَ أحدٍ ولا حالتَه ولا رقمَه.
--
-- معاني دوالّ الحلقة (للمرجع):
--   can_view_halaqa     القراءة: مشرف المشروع، المديران (كل الحلقات)، المديرة (حلقات البنات)،
--                        ومن أُسند إليها مشرفاً أو مختبِراً أو معلّماً وحسابُه نشط.
--   can_manage_halaqa   الإدارة البنيوية (تعديل الحلقة، قوائم الاختبار، النتائج، الزيارات):
--                        admin_manager وtechnical_manager فقط — لا المديرة.
--   can_approve_in_halaqa  اعتماد التقارير وكشوف الحوافز: المديران + المديرة لحلقات البنات.
--   can_assign_in_halaqa   إسناد الطلاب وإخراجهم: نطاق الاعتماد + المشرف الميداني لحلقاته.
-- ============================================================================

-- 0) إسقاط كل سياسات public وسياسات كتابة الوسائط، ثم ما يعتمد على section
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
drop policy if exists "media_auth_insert" on storage.objects;
drop policy if exists "media_auth_update" on storage.objects;
drop policy if exists "media_auth_delete" on storage.objects;

drop function if exists public.is_full_admin();
drop function if exists public.in_section(public.gender_type);
drop function if exists public.current_user_section();
alter table public.profiles drop column section;
drop type public.section_scope;

-- 1) شخصٌ واحد نشط لكلٍّ من المديرَين
-- المدير الفني: فهرس فريد جزئي (لا أحد بهذا الدور اليوم).
create unique index profiles_one_active_technical_manager
  on public.profiles (role) where role = 'technical_manager' and status = 'active';
-- المدير الإداري: في البيانات التجريبية ثلاثةُ مديرين نشطين (من manager القديم)، فالفهرس يفشل
-- (23505 could not create unique index). حتى يُحسم مَن يبقى منهم، يمنع هذا الحارس أيَّ مديرٍ
-- إداريٍّ نشطٍ جديد بالرمز نفسه 23505، بقفلٍ استشاريّ يمنع السباق. يُستبدل بالفهرس بعد الحسم:
--   create unique index profiles_one_active_admin_manager on public.profiles (role)
--     where role = 'admin_manager' and status = 'active';
create or replace function public.guard_single_admin_manager()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'admin_manager' and new.status = 'active'
     and (tg_op = 'INSERT' or new.role is distinct from old.role or new.status is distinct from old.status) then
    perform pg_advisory_xact_lock(hashtext('profiles_one_active_admin_manager'));
    if exists (select 1 from public.profiles p
               where p.role = 'admin_manager' and p.status = 'active' and p.id <> new.id) then
      raise exception 'لا يكون إلا مديرٌ إداريٌّ نشطٌ واحد' using errcode = '23505';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_single_admin_manager before insert or update of role, status on public.profiles
  for each row execute function public.guard_single_admin_manager();

-- 2) دوالّ النطاق
create or replace function public.is_women_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() = 'women_admin', false);
$$;
-- نطاق الإدارة على جنسٍ ما (للطلاب غير المُسنَدين والتنبيهات): المديران كلّه، والمديرة البنات.
create or replace function public.in_admin_scope(g public.gender_type) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
       public.current_user_role() in ('admin_manager', 'technical_manager')
    or (public.current_user_role() = 'women_admin' and g = 'female'), false);
$$;
create or replace function public.can_view_halaqa(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.halaqat h where h.id = hid and (
         public.is_project_supervisor()
      or public.current_user_role() in ('admin_manager', 'technical_manager')
      or (public.current_user_role() = 'women_admin' and h.gender = 'female')
      or (public.current_user_role() is not null  -- الإسناد لا يكفي لحسابٍ غير نشط
          and auth.uid() in (h.supervisor_id, h.examiner_id, h.teacher_id))
    ));
$$;
create or replace function public.can_manage_halaqa(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.halaqat h where h.id = hid)
     and coalesce(public.current_user_role() in ('admin_manager', 'technical_manager'), false);
$$;
create or replace function public.can_approve_in_halaqa(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.halaqat h where h.id = hid and (
         public.current_user_role() in ('admin_manager', 'technical_manager')
      or (public.current_user_role() = 'women_admin' and h.gender = 'female')));
$$;
create or replace function public.can_assign_in_halaqa(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_approve_in_halaqa(hid)
      or exists (select 1 from public.halaqat h where h.id = hid and h.supervisor_id = auth.uid()
                 and public.current_user_role() = 'field_supervisor');
$$;
create or replace function public.is_halaqa_teacher(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_user_role() is not null
     and exists (select 1 from public.halaqat h where h.id = hid and h.teacher_id = auth.uid());
$$;
create or replace function public.is_halaqa_examiner(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_user_role() is not null
     and exists (select 1 from public.halaqat h where h.id = hid and h.examiner_id = auth.uid());
$$;
create or replace function public.is_halaqa_supervisor(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_user_role() = 'field_supervisor'
     and exists (select 1 from public.halaqat h where h.id = hid and h.supervisor_id = auth.uid());
$$;
create or replace function public.my_halaqa_id() returns uuid
language sql stable security definer set search_path = public as $$
  select halaqa_id from public.students where user_id = auth.uid();
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'current_user_role()', 'is_project_supervisor()', 'is_admin_manager()', 'is_women_admin()',
    'in_admin_scope(public.gender_type)', 'can_view_halaqa(uuid)', 'can_manage_halaqa(uuid)',
    'can_approve_in_halaqa(uuid)', 'can_assign_in_halaqa(uuid)', 'is_halaqa_teacher(uuid)',
    'is_halaqa_examiner(uuid)', 'is_halaqa_supervisor(uuid)', 'my_student_id()', 'my_halaqa_id()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- 3) الحرّاس
-- profiles: الدور والحالة والرقم الوظيفي والجنس للمدير الإداري وحده؛ وعلَم تغيير كلمة المرور
-- يُطفئه صاحبه (true→false بعد تغييرها) ولا يرفعه إلا المدير الإداري أو الخدمة.
create or replace function public.guard_profile_privileged()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin_manager() then return new; end if; -- الخدمة والهجرات والمدير
  if (new.role, new.status, new.employee_number, new.gender)
     is distinct from (old.role, old.status, old.employee_number, old.gender) then
    raise exception 'لا تملك تعديل الدور أو الحالة أو الرقم الوظيفي أو الجنس' using errcode = '42501';
  end if;
  if new.must_change_password is distinct from old.must_change_password
     and not (old.must_change_password and not new.must_change_password and new.id = auth.uid()) then
    raise exception 'لا تملك رفع علَم تغيير كلمة المرور' using errcode = '42501';
  end if;
  return new;
end $$;

-- students: الهوية والجنس والحساب ورمز العرض للمدير الإداري وحده؛ الإخراج من حلقةٍ يحتاج إسناداً
-- فيها، والإدخال إلى حلقةٍ يحتاج إسناداً فيها وتطابقَ جنس الطالب وجنس الحلقة.
create or replace function public.guard_student_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_halaqa_gender public.gender_type;
begin
  if auth.uid() is null then return new; end if;
  if (new.user_id, new.gender, new.national_id, new.view_token)
     is distinct from (old.user_id, old.gender, old.national_id, old.view_token)
     and not public.is_admin_manager() then
    raise exception 'لا تملك تعديل هوية الطالب أو جنسه أو حسابه' using errcode = '42501';
  end if;
  if new.halaqa_id is distinct from old.halaqa_id then
    if old.halaqa_id is not null and not public.can_assign_in_halaqa(old.halaqa_id) then
      raise exception 'لا تملك إخراج الطالب من حلقته' using errcode = '42501';
    end if;
    if new.halaqa_id is not null then
      if not public.can_assign_in_halaqa(new.halaqa_id) then
        raise exception 'لا تملك إسناد الطالب لهذه الحلقة' using errcode = '42501';
      end if;
      select h.gender into v_halaqa_gender from public.halaqat h where h.id = new.halaqa_id;
      if v_halaqa_gender is not null and new.gender is not null and v_halaqa_gender <> new.gender then
        raise exception 'جنس الطالب لا يطابق جنس الحلقة' using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end $$;

-- monthly_reports: المعلم ينقل draft→submitted ويعدّل ما دام مسودّة؛ الاعتماد وحقوله لنطاق الاعتماد.
create or replace function public.guard_report_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and not public.can_approve_in_halaqa(old.halaqa_id) then
      raise exception 'لا يُحذف التقرير بعد إرساله إلا بيد الإدارة' using errcode = '42501';
    end if;
    return old;
  end if;
  if public.can_approve_in_halaqa(new.halaqa_id)
     and (tg_op = 'INSERT' or public.can_approve_in_halaqa(old.halaqa_id)) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    raise exception 'لا يُعدَّل التقرير بعد إرساله إلا بيد الإدارة' using errcode = '42501';
  end if;
  if new.status not in ('draft', 'submitted') then
    raise exception 'لا تملك اعتماد التقرير' using errcode = '42501';
  end if;
  if (tg_op = 'INSERT' and (new.approved_by is not null or new.approved_at is not null))
     or (tg_op = 'UPDATE' and (new.approved_by, new.approved_at) is distinct from (old.approved_by, old.approved_at)) then
    raise exception 'لا تملك اعتماد التقرير' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger monthly_reports_guard_status before insert or update or delete on public.monthly_reports
  for each row execute function public.guard_report_status();

-- incentive_statements: مثلها بحالة reviewed وحقلَي reviewed_by/at.
create or replace function public.guard_statement_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and not public.can_approve_in_halaqa(old.halaqa_id) then
      raise exception 'لا يُحذف الكشف بعد إرساله إلا بيد الإدارة' using errcode = '42501';
    end if;
    return old;
  end if;
  if public.can_approve_in_halaqa(new.halaqa_id)
     and (tg_op = 'INSERT' or public.can_approve_in_halaqa(old.halaqa_id)) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    raise exception 'لا يُعدَّل الكشف بعد إرساله إلا بيد الإدارة' using errcode = '42501';
  end if;
  if new.status not in ('draft', 'submitted') then
    raise exception 'لا تملك مراجعة الكشف' using errcode = '42501';
  end if;
  if (tg_op = 'INSERT' and (new.reviewed_by is not null or new.reviewed_at is not null))
     or (tg_op = 'UPDATE' and (new.reviewed_by, new.reviewed_at) is distinct from (old.reviewed_by, old.reviewed_at)) then
    raise exception 'لا تملك مراجعة الكشف' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger incentive_statements_guard_status before insert or update or delete on public.incentive_statements
  for each row execute function public.guard_statement_status();

-- admin_alerts: المعلّم المعنيّ لا يغيّر إلا الحالة ووقت الإقرار؛ المُصدِر والمدير الإداري يغيّران المحتوى.
create or replace function public.guard_alert_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() = old.issuer_id or public.is_admin_manager() then return new; end if;
  if (new.issuer_id, new.teacher_id, new.violation_type, new.severity, new.description, new.alert_date, new.created_at)
     is distinct from (old.issuer_id, old.teacher_id, old.violation_type, old.severity, old.description, old.alert_date, old.created_at) then
    raise exception 'لا تملك إلا الإقرار بالتنبيه' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger admin_alerts_guard_update before update on public.admin_alerts
  for each row execute function public.guard_alert_update();

-- 4) السياسات
-- profiles: العاملون يقرؤون الكل، والطالب صفَّه وحده؛ الكتابة للمدير الإداري + الذات (والحارس يمنع الامتيازي)
create policy profiles_select on public.profiles for select to authenticated
  using (coalesce(public.current_user_role() <> 'student', false) or id = auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated with check (public.is_admin_manager());
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_admin_manager() or id = auth.uid()) with check (public.is_admin_manager() or id = auth.uid());
create policy profiles_delete on public.profiles for delete to authenticated using (public.is_admin_manager());
create policy fin_all on public.profile_financials for all to authenticated
  using (public.is_admin_manager() or public.is_project_supervisor()) with check (public.is_admin_manager());

-- halaqat: الإنشاء والتعديل للمديرَين، والحذف للمدير الإداري — لا للمديرة
create policy halaqat_select on public.halaqat for select to authenticated
  using (public.can_view_halaqa(id) or id = public.my_halaqa_id());
create policy halaqat_insert on public.halaqat for insert to authenticated
  with check (public.current_user_role() in ('admin_manager', 'technical_manager'));
create policy halaqat_update on public.halaqat for update to authenticated
  using (public.can_manage_halaqa(id)) with check (public.current_user_role() in ('admin_manager', 'technical_manager'));
create policy halaqat_delete on public.halaqat for delete to authenticated using (public.is_admin_manager());

-- students
create policy students_select on public.students for select to authenticated using (
     user_id = auth.uid()
  or public.can_view_halaqa(halaqa_id)
  or (halaqa_id is null and (public.is_project_supervisor() or public.in_admin_scope(gender)
      or (public.current_user_role() = 'field_supervisor'
          and gender = (select p.gender from public.profiles p where p.id = auth.uid())))));
create policy students_insert on public.students for insert to authenticated with check (public.is_admin_manager());
create policy students_update on public.students for update to authenticated using (
     public.is_admin_manager()
  or (halaqa_id is not null and (public.can_assign_in_halaqa(halaqa_id) or public.is_halaqa_teacher(halaqa_id)))
  or (halaqa_id is null and (public.in_admin_scope(gender)
      or (public.current_user_role() = 'field_supervisor'
          and gender = (select p.gender from public.profiles p where p.id = auth.uid()))))
) with check (
     public.is_admin_manager()
  or (halaqa_id is not null and (public.can_assign_in_halaqa(halaqa_id) or public.is_halaqa_teacher(halaqa_id)))
  or (halaqa_id is null and (public.in_admin_scope(gender) or public.current_user_role() = 'field_supervisor'))
);
create policy students_delete on public.students for delete to authenticated using (public.is_admin_manager());

-- exam_plan و app_settings و news و المالية والمحاضر
create policy plan_select on public.exam_plan for select to authenticated using (true);
create policy plan_write on public.exam_plan for all to authenticated
  using (public.current_user_role() in ('admin_manager', 'technical_manager'))
  with check (public.current_user_role() in ('admin_manager', 'technical_manager'));
create policy settings_select on public.app_settings for select to authenticated using (true);
create policy settings_write on public.app_settings for all to authenticated
  using (public.is_admin_manager()) with check (public.is_admin_manager());
-- الأخبار سياستان: anon لا يملك تنفيذ دوالّ النطاق، وصلاحية الدالّة تُفحص عند تهيئة التعبير.
create policy news_select_published on public.news for select to anon, authenticated using (published);
create policy news_select_staff on public.news for select to authenticated
  using (public.is_admin_manager() or public.is_project_supervisor());
create policy news_write on public.news for all to authenticated
  using (public.is_admin_manager()) with check (public.is_admin_manager());
create policy fintx_all on public.financial_transactions for all to authenticated
  using (public.is_admin_manager() or public.is_project_supervisor()) with check (public.is_admin_manager());
create policy salaries_all on public.monthly_salaries for all to authenticated
  using (public.is_admin_manager() or public.is_project_supervisor()) with check (public.is_admin_manager());
create policy minutes_all on public.meeting_minutes for all to authenticated
  using (public.is_admin_manager() or public.is_project_supervisor()) with check (public.is_admin_manager());

-- exam_lists / items / results
create policy lists_select on public.exam_lists for select to authenticated using (public.can_view_halaqa(halaqa_id));
create policy lists_insert on public.exam_lists for insert to authenticated
  with check (public.current_user_role() = 'teacher' and teacher_id = auth.uid() and public.is_halaqa_teacher(halaqa_id));
create policy lists_update on public.exam_lists for update to authenticated
  using (public.can_manage_halaqa(halaqa_id) or public.is_halaqa_examiner(halaqa_id))
  with check (public.can_manage_halaqa(halaqa_id) or public.is_halaqa_examiner(halaqa_id));
create policy lists_delete on public.exam_lists for delete to authenticated
  using (public.can_manage_halaqa(halaqa_id) or (teacher_id = auth.uid() and public.is_halaqa_teacher(halaqa_id)));
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
-- التحقّق يعيد فحص النطاق على الطالب الجديد: لا يُحوَّل نتيجةٌ إلى طالبٍ خارج حلقات المختبِر
create policy results_update on public.exam_results for update to authenticated
  using (examiner_id = auth.uid()
         or exists (select 1 from public.students s where s.id = student_id and public.can_manage_halaqa(s.halaqa_id)))
  with check (exists (select 1 from public.students s where s.id = student_id and (
       public.can_manage_halaqa(s.halaqa_id)
    or (public.current_user_role() = 'examiner' and examiner_id = auth.uid() and public.is_halaqa_examiner(s.halaqa_id)))));
create policy results_delete on public.exam_results for delete to authenticated using (public.is_admin_manager());

-- التقارير الشهرية: المعلم يكتب تقرير حلقته (والحارس يقصره على المسودّة)، ونطاق الاعتماد يعتمد
create policy reports_select on public.monthly_reports for select to authenticated using (public.can_view_halaqa(halaqa_id));
create policy reports_write on public.monthly_reports for all to authenticated
  using (public.is_halaqa_teacher(halaqa_id) or public.can_approve_in_halaqa(halaqa_id))
  with check (public.is_halaqa_teacher(halaqa_id) or public.can_approve_in_halaqa(halaqa_id));
create policy rstudents_select on public.monthly_report_students for select to authenticated using (
  student_id = public.my_student_id()
  or exists (select 1 from public.monthly_reports r where r.id = report_id and public.can_view_halaqa(r.halaqa_id)));
create policy rstudents_write on public.monthly_report_students for all to authenticated
  using (exists (select 1 from public.monthly_reports r where r.id = report_id and (
         (public.is_halaqa_teacher(r.halaqa_id) and r.status = 'draft') or public.can_approve_in_halaqa(r.halaqa_id))))
  with check (exists (select 1 from public.monthly_reports r where r.id = report_id and (
         (public.is_halaqa_teacher(r.halaqa_id) and r.status = 'draft') or public.can_approve_in_halaqa(r.halaqa_id))));
create policy ractivities_select on public.monthly_report_activities for select to authenticated
  using (exists (select 1 from public.monthly_reports r where r.id = report_id and public.can_view_halaqa(r.halaqa_id)));
create policy ractivities_write on public.monthly_report_activities for all to authenticated
  using (exists (select 1 from public.monthly_reports r where r.id = report_id and (
         (public.is_halaqa_teacher(r.halaqa_id) and r.status = 'draft') or public.can_approve_in_halaqa(r.halaqa_id))))
  with check (exists (select 1 from public.monthly_reports r where r.id = report_id and (
         (public.is_halaqa_teacher(r.halaqa_id) and r.status = 'draft') or public.can_approve_in_halaqa(r.halaqa_id))));

-- الزيارات: التحقّق يعيد فحص الحلقة الجديدة في نطاق المستدعي
create policy visits_select on public.supervision_visits for select to authenticated using (public.can_view_halaqa(halaqa_id));
create policy visits_insert on public.supervision_visits for insert to authenticated with check (
  public.can_manage_halaqa(halaqa_id)
  or (supervisor_id = auth.uid() and public.is_halaqa_supervisor(halaqa_id)));
create policy visits_update on public.supervision_visits for update to authenticated
  using (supervisor_id = auth.uid() or public.can_manage_halaqa(halaqa_id))
  with check (public.can_manage_halaqa(halaqa_id)
              or (supervisor_id = auth.uid() and public.is_halaqa_supervisor(halaqa_id)));
create policy visits_delete on public.supervision_visits for delete to authenticated using (public.can_manage_halaqa(halaqa_id));
create policy reschedule_select on public.visit_reschedule_log for select to authenticated
  using (exists (select 1 from public.supervision_visits v where v.id = visit_id and public.can_view_halaqa(v.halaqa_id)));
create policy reschedule_insert on public.visit_reschedule_log for insert to authenticated
  with check (exists (select 1 from public.supervision_visits v where v.id = visit_id
              and ((v.supervisor_id = auth.uid() and public.is_halaqa_supervisor(v.halaqa_id))
                   or public.can_manage_halaqa(v.halaqa_id))));

-- الحوافز: التخصيص للمدير الإداري؛ الكشوف يكتبها المعلم مسودّةً ويراجعها نطاق الاعتماد
create policy incentives_select on public.halaqa_incentives for select to authenticated using (public.can_view_halaqa(halaqa_id));
create policy incentives_write on public.halaqa_incentives for all to authenticated
  using (public.is_admin_manager()) with check (public.is_admin_manager());
create policy statements_select on public.incentive_statements for select to authenticated using (public.can_view_halaqa(halaqa_id));
create policy statements_write on public.incentive_statements for all to authenticated
  using (public.is_halaqa_teacher(halaqa_id) or public.can_approve_in_halaqa(halaqa_id))
  with check (public.is_halaqa_teacher(halaqa_id) or public.can_approve_in_halaqa(halaqa_id));
create policy sitems_select on public.incentive_statement_items for select to authenticated
  using (exists (select 1 from public.incentive_statements st where st.id = statement_id and public.can_view_halaqa(st.halaqa_id)));
create policy sitems_write on public.incentive_statement_items for all to authenticated
  using (exists (select 1 from public.incentive_statements st where st.id = statement_id and (
         (public.is_halaqa_teacher(st.halaqa_id) and st.status = 'draft') or public.can_approve_in_halaqa(st.halaqa_id))))
  with check (exists (select 1 from public.incentive_statements st where st.id = statement_id and (
         (public.is_halaqa_teacher(st.halaqa_id) and st.status = 'draft') or public.can_approve_in_halaqa(st.halaqa_id))));

-- التنبيهات الإدارية: المديرة ترى تنبيهات معلّمات حلقات البنات
create policy alerts_select on public.admin_alerts for select to authenticated using (
  issuer_id = auth.uid() or teacher_id = auth.uid() or public.is_project_supervisor()
  or public.current_user_role() in ('admin_manager', 'technical_manager')
  or (public.is_women_admin()
      and exists (select 1 from public.halaqat h where h.teacher_id = admin_alerts.teacher_id and h.gender = 'female')));
create policy alerts_insert on public.admin_alerts for insert to authenticated
  with check (public.current_user_role() in ('admin_manager', 'technical_manager', 'field_supervisor') and issuer_id = auth.uid());
create policy alerts_update on public.admin_alerts for update to authenticated
  using (issuer_id = auth.uid() or teacher_id = auth.uid() or public.is_admin_manager())
  with check (issuer_id = auth.uid() or teacher_id = auth.uid() or public.is_admin_manager());

-- 5) الوسائط: القراءة عامّة كما هي؛ الكتابة للمدير الإداري، ولكلّ مستخدمٍ تحت avatars/<معرّفه>/ فقط.
-- foldername تُرجع مصفوفةً بلا عنصرٍ ثانٍ لاسمٍ في الجذر أو في avatars/ مباشرةً، فالمقارنة NULL،
-- وcoalesce تجعلها رفضاً صريحاً لا قبولاً.
create policy media_write_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'media' and (public.is_admin_manager()
    or coalesce((storage.foldername(name))[1] = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text, false)));
create policy media_write_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and (public.is_admin_manager()
    or coalesce((storage.foldername(name))[1] = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text, false)))
  with check (bucket_id = 'media' and (public.is_admin_manager()
    or coalesce((storage.foldername(name))[1] = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text, false)));
create policy media_write_delete on storage.objects for delete to authenticated using (
  bucket_id = 'media' and (public.is_admin_manager()
    or coalesce((storage.foldername(name))[1] = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text, false)));
