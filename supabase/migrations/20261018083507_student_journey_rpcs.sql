-- ============================================================================
-- رحلة الطالب في /me — دالّتا قراءة لما يخصّه فقط (Task 7، جولة الإصلاح 1، 2026-10-18) — الإصدار المسجَّل في الإنتاج 20261018083507
-- الاختبار: supabase/tests/v2_rls.sql (ر-1 … ر-4)
--
-- الثغرة: مكوّن الرحلة يقرأ نتائج الطالب بتضمين `exam_list_item:exam_list_item_id(exam_plan_id)`
-- وصفحات الحفظ بتضمين `report:report_id(status)`. سياستا `items_select` و`reports_select` تعتمدان
-- `can_view_halaqa()` التي لا يجتازها الطالب، فيصل التضمينان `null`: كل نتيجةٍ بلا `exam_plan_id`
-- فلا تظهر محطّةٌ مجتازة (تبقى «مستحقّة»)، ومجموع صفحات الحفظ المعتمدة صفر (الوتيرة خاطئة).
--
-- العلاج دون فتح الجدولين (في `exam_list_items.teacher_note` ملاحظةٌ خاصّة بالمعلّم، وفي
-- `monthly_reports` أعمدةُ اعتمادٍ وأمورٌ للإدارة): دالّتان SECURITY DEFINER مقصورتان على
-- `my_student_id()` — فمن ليس طالباً لا يرى شيئاً، والطالب لا يرى إلا صفوفه، ولا `teacher_note`.
-- المنحُ صريحٌ لـauthenticated (درس الصحابة: سحب PUBLIC بلا منحٍ يُعمي المستخدمين) ومسحوبٌ من anon.
-- ============================================================================

-- نتائج اختبارات الطالب نفسه مع محطّة الخطّة التي تخصّها
create or replace function public.my_exam_results()
returns table (exam_plan_id integer, passed boolean, total_score integer, exam_date date)
language sql stable security definer set search_path = public as $$
  select i.exam_plan_id, r.passed, r.total_score, r.exam_date
  from public.exam_results r
  left join public.exam_list_items i on i.id = r.exam_list_item_id
  where r.student_id = public.my_student_id()
  order by r.exam_date, r.created_at;
$$;

-- مجموع صفحات الحفظ للطالب نفسه من تقارير الحلقة المعتمدة فقط
create or replace function public.my_approved_pages()
returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(sum(s.memorization_pages), 0)::bigint
  from public.monthly_report_students s
  join public.monthly_reports m on m.id = s.report_id
  where s.student_id = public.my_student_id()
    and m.status = 'approved';
$$;

revoke all on function public.my_exam_results() from public, anon;
revoke all on function public.my_approved_pages() from public, anon;
grant execute on function public.my_exam_results() to authenticated;
grant execute on function public.my_approved_pages() to authenticated;
