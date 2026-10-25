-- بدايةُ المشروع 10/2026 (قرار المستخدم 2026-10-24): لا تاريخَ عملٍ قبل 2026-10-01 ولا شهرَ قبل 10/2026.
-- الواجهةُ تحدّ المنتقيات بـ PROJECT_START (app/constants/project.ts)؛ هذه القيودُ الحكمُ الأخير.
-- لا يشمل تاريخَ الميلاد (profiles/students.birth_date) ولا تاريخَ التعيين (profiles.hire_date).
-- الوقتُ بتوقيت غزة: 2026-10-01 00:00 = +03.

-- أعمدةُ التاريخ
alter table public.admin_alerts add constraint admin_alerts_from_project_start check (alert_date >= date '2026-10-01');
alter table public.attendance_days add constraint attendance_days_from_project_start check (day >= date '2026-10-01');
alter table public.attendance_absences add constraint attendance_absences_from_project_start check (day >= date '2026-10-01');
alter table public.booklet_deliveries add constraint booklet_deliveries_from_project_start check (delivered_on >= date '2026-10-01');
alter table public.exam_lists add constraint exam_lists_from_project_start check (week_date >= date '2026-10-01');
alter table public.exam_results add constraint exam_results_from_project_start check (exam_date >= date '2026-10-01');
alter table public.financial_transactions add constraint financial_transactions_from_project_start check (transaction_date >= date '2026-10-01');
alter table public.incentive_statement_items add constraint incentive_statement_items_from_project_start check (item_date >= date '2026-10-01');
alter table public.meeting_minutes add constraint meeting_minutes_from_project_start check (meeting_date >= date '2026-10-01');
alter table public.news add constraint news_from_project_start check (news_date >= date '2026-10-01');
alter table public.students add constraint students_enrollment_from_project_start check (enrollment_date is null or enrollment_date >= date '2026-10-01');
alter table public.transport_trips add constraint transport_trips_from_project_start check (trip_date >= date '2026-10-01');
alter table public.supervision_visits add constraint supervision_visits_from_project_start check (
  scheduled_at >= timestamptz '2026-10-01 00:00:00+03'
  and (executed_at is null or executed_at >= timestamptz '2026-10-01 00:00:00+03'));

-- الجداولُ الشهرية
alter table public.monthly_reports add constraint monthly_reports_from_project_start check (report_year * 100 + report_month >= 202610);
alter table public.incentive_statements add constraint incentive_statements_from_project_start check (statement_year * 100 + statement_month >= 202610);
alter table public.halaqa_incentives add constraint halaqa_incentives_from_project_start check (incentive_year * 100 + incentive_month >= 202610);
alter table public.monthly_salaries add constraint monthly_salaries_from_project_start check (salary_year * 100 + salary_month >= 202610);
alter table public.teacher_quality_months add constraint teacher_quality_months_from_project_start check (year * 100 + month >= 202610);
