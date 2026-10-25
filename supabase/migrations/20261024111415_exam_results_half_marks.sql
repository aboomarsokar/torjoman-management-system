-- درجاتُ الاختبار بأنصاف (طلب المستخدم 2026-10-24): كشوفُ المختبِرين فيها 9.5 و7.5، والأعمدةُ كانت صحيحة.
-- الخاناتُ التسع والأحكام ← numeric(3,1) بخطوة نصف (قيد)، والمجموعُ المولَّد ← numeric(4,1)، و`passed` يُعاد توليده.
-- الحدودُ كما هي: كلُّ فرعٍ 0–10، والأحكام 7–9، والمجموعُ الأعلى 99.

-- مُشغِّلُ رفع الأجزاء يعتمد على `passed` في شرطه؛ يُحذف ثم يُعاد كما كان بعد إعادة التوليد
drop trigger exam_results_bump_parts_on_update on public.exam_results;
alter table public.exam_results drop column passed, drop column total_score;

alter table public.exam_results
  alter column q1_memorization  type numeric(3,1) using q1_memorization::numeric,
  alter column q1_understanding type numeric(3,1) using q1_understanding::numeric,
  alter column q1_reflection    type numeric(3,1) using q1_reflection::numeric,
  alter column q2_memorization  type numeric(3,1) using q2_memorization::numeric,
  alter column q2_understanding type numeric(3,1) using q2_understanding::numeric,
  alter column q2_reflection    type numeric(3,1) using q2_reflection::numeric,
  alter column q3_memorization  type numeric(3,1) using q3_memorization::numeric,
  alter column q3_understanding type numeric(3,1) using q3_understanding::numeric,
  alter column q3_reflection    type numeric(3,1) using q3_reflection::numeric,
  alter column tajweed_score    type numeric(3,1) using tajweed_score::numeric;

-- خطوةُ النصف وحدها (9.5 نعم، 9.3 لا)
alter table public.exam_results add constraint exam_results_half_steps check (
  (q1_memorization * 2) % 1 = 0 and (q1_understanding * 2) % 1 = 0 and (q1_reflection * 2) % 1 = 0 and
  (q2_memorization * 2) % 1 = 0 and (q2_understanding * 2) % 1 = 0 and (q2_reflection * 2) % 1 = 0 and
  (q3_memorization * 2) % 1 = 0 and (q3_understanding * 2) % 1 = 0 and (q3_reflection * 2) % 1 = 0 and
  (tajweed_score * 2) % 1 = 0
);

alter table public.exam_results
  add column total_score numeric(4,1) generated always as (
    q1_memorization + q1_understanding + q1_reflection
    + q2_memorization + q2_understanding + q2_reflection
    + q3_memorization + q3_understanding + q3_reflection
    + tajweed_score
  ) stored,
  add column passed boolean generated always as (
    (q1_memorization + q1_understanding + q1_reflection
     + q2_memorization + q2_understanding + q2_reflection
     + q3_memorization + q3_understanding + q3_reflection
     + tajweed_score) >= pass_mark_snapshot
  ) stored;

create trigger exam_results_bump_parts_on_update after update on public.exam_results
  for each row when (new.passed and not old.passed) execute function public.bump_parts_on_pass();

-- رحلةُ الطالب: المجموعُ صار عشرياً (تغييرُ نوع الإرجاع يستلزم الحذف والإنشاء)
drop function public.my_exam_cycle_results();
create function public.my_exam_cycle_results()
  returns table(exam_cycle_id smallint, passed boolean, total_score numeric, exam_date date)
  language sql stable security definer
  set search_path to ''
as $function$
  select li.exam_cycle_id, er.passed, er.total_score, er.exam_date
  from public.exam_results er
  join public.exam_list_items li on li.id = er.exam_list_item_id
  where li.exam_cycle_id is not null
    and er.student_id = (select s.id from public.students s where s.user_id = (select auth.uid()))
  order by li.exam_cycle_id, er.exam_date, er.created_at;
$function$;
revoke all on function public.my_exam_cycle_results() from public, anon;
grant execute on function public.my_exam_cycle_results() to authenticated, service_role;

-- إشعارُ الرصد: «المجموع 96.5» و«المجموع 90» (بلا «.0» زائد)
create or replace function private.notify_exam_graded()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_name text;
  v_teacher uuid;
  v_user uuid;
  v_female boolean;
  v_verdict text;
  v_total text := trim(trailing '.' from trim(trailing '0' from new.total_score::text));
begin
  select s.full_name, h.teacher_id, s.user_id, s.gender::text = 'female'
    into v_name, v_teacher, v_user, v_female
  from public.students s left join public.halaqat h on h.id = s.halaqa_id
  where s.id = new.student_id;

  v_verdict := case when new.passed then (case when coalesce(v_female, false) then 'ناجحة' else 'ناجح' end)
                    else (case when coalesce(v_female, false) then 'راسبة' else 'راسب' end) end;

  perform private.notify(v_teacher, 'exam_graded', 'رُصدت نتيجةُ اختبار',
    v_name || ' · ' || v_verdict || ' · المجموع ' || v_total, '/exams', 'exam_results', new.id);
  perform private.notify(v_user, 'exam_graded', 'رُصدت نتيجةُ اختبار',
    'نتيجتُك: ' || v_verdict || ' · المجموع ' || v_total, '/me', 'exam_results', new.id);
  return null;
end;
$function$;
