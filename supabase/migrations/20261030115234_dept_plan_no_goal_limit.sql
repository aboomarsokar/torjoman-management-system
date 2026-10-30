-- لا حدَّ لعدد أهداف خطة القسم (طلب المستخدم 2026-10-30) — يُلغى حارسُ العشرة.
drop trigger if exists dept_plan_goals_limit on public.dept_plan_goals;
drop function if exists private.dept_goal_limit();
