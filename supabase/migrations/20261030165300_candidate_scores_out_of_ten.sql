-- درجاتُ بنود تحكيم المرشّحين من 0 إلى 10 بدل 5 (طلب المستخدم 2026-10-30). لا تقييماتَ قائمة عند التغيير.
alter table public.candidate_evaluations drop constraint candidate_evaluations_scores_check;
alter table public.candidate_evaluations add constraint candidate_evaluations_scores_check
  check (array_length(scores, 1) = 10 and 0 <= all (scores) and 10 >= all (scores));
