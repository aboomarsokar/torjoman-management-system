-- درجة التجويد في الاختبار من 7 إلى 10 (قرار المستخدم 2026-10-19) — كانت 0–10.
-- النتيجتان القائمتان كلتاهما ضمن الحدّ (فُحص قبل التطبيق).
alter table public.exam_results drop constraint if exists exam_results_tajweed_score_check;
alter table public.exam_results add constraint exam_results_tajweed_score_check
  check (tajweed_score >= 7 and tajweed_score <= 10);
