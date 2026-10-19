-- حذفُ نموذج التقرير الشهري القديم (الأنشطة والنقاط والصفحات الرقمية) — Task 10 من الدفعة الثانية.
-- الشيفرةُ الجديدة (الحضور اليومي + الرصد القرآني quran_records) منشورةٌ ومتحقَّقة، والجداول القديمة فارغة (0 صف)،
-- والإذن صريحٌ من المستخدم. لا CASCADE: فُحص أنّ لا دالّةَ ولا عرضَ ولا مشغِّلَ ولا قيدَ خارجيّاً يشير إليها،
-- وما يسقط معها هو سياساتُها ومشغِّلاتُها وفهارسُها وقيودُها الخاصة فقط.

drop table public.monthly_report_activities, public.monthly_report_students;
drop type public.activity_key;

alter table public.monthly_reports
  drop column actual_days,
  drop column default_days_snapshot,
  drop column default_points_snapshot,
  drop column attendance_rate,
  drop column activities_done,
  drop column activities_total,
  drop column general_notes,
  drop column activities_notes;

alter table public.app_settings
  drop column default_points,
  drop column default_attendance_days;

-- فحصٌ ذاتيّ: يُلغي الهجرةَ كلَّها إن خالف الواقعُ المتوقَّع
do $$
declare
  missing text;
  leftover text;
begin
  if to_regclass('public.monthly_report_students') is not null
     or to_regclass('public.monthly_report_activities') is not null then
    raise exception 'drop_old_report_model: جدولٌ قديم ما زال موجوداً';
  end if;

  if exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
             where n.nspname = 'public' and t.typname = 'activity_key') then
    raise exception 'drop_old_report_model: النوع activity_key ما زال موجوداً';
  end if;

  select string_agg(column_name, ',') into leftover
  from information_schema.columns
  where table_schema = 'public'
    and ((table_name = 'monthly_reports' and column_name in
          ('actual_days','default_days_snapshot','default_points_snapshot','attendance_rate',
           'activities_done','activities_total','general_notes','activities_notes'))
      or (table_name = 'app_settings' and column_name in ('default_points','default_attendance_days')));
  if leftover is not null then
    raise exception 'drop_old_report_model: أعمدةٌ قديمة باقية: %', leftover;
  end if;

  select string_agg(c, ',') into missing
  from unnest(array['id','halaqa_id','report_month','report_year','status','submitted_at','approved_by',
                    'approved_at','return_note','target_pages_snapshot','created_at','updated_at']) c
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'monthly_reports' and column_name = c);
  if missing is not null then
    raise exception 'drop_old_report_model: أعمدةٌ مطلوبة غائبة من monthly_reports: %', missing;
  end if;

  select string_agg(c, ',') into missing
  from unnest(array['target_memorization_pages','pass_mark']) c
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'app_settings' and column_name = c);
  if missing is not null then
    raise exception 'drop_old_report_model: أعمدةٌ مطلوبة غائبة من app_settings: %', missing;
  end if;
end $$;
