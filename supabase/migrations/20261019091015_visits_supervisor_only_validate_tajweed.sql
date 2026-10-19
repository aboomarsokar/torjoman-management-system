-- ═══════════════════════════════════════════════════════════════════════════
-- قرارا المستخدم 2026-10-19
-- ───────────────────────────────────────────────────────────────────────────
-- (١) الزيارات: «كل مشرف يجدول زياراته بنفسه، والمدير الفني والإداري يستطيعون المعاينة».
--     الجدولة والتعديل وسجلّ إعادة الجدولة للمشرف الميداني المُسنَد للحلقة، باسمه هو وحده.
--     المديران يقرآن (visits_select عبر can_view_halaqa لم يتغيّر). الحذف يبقى للمدير الإداري
--     (تنظيف خطأ — كحذف الحلقة والطالب) ولصاحب الزيارة.
--     حارس الزائر يضيق تبعاً: الزائر مشرف الحلقة الميداني (لا المديران).
-- (٢) نتيجة التجويد الوحيدة فوق 9 عُدّلت بطلب المستخدم، فيُفحص القيد على القديم أيضاً.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.exam_results validate constraint exam_results_tajweed_score_check;

drop policy if exists visits_insert on public.supervision_visits;
create policy visits_insert on public.supervision_visits for insert to authenticated
  with check (supervisor_id = auth.uid() and public.is_halaqa_supervisor(halaqa_id));

drop policy if exists visits_update on public.supervision_visits;
create policy visits_update on public.supervision_visits for update to authenticated
  using (supervisor_id = auth.uid())
  with check (supervisor_id = auth.uid() and public.is_halaqa_supervisor(halaqa_id));

drop policy if exists visits_delete on public.supervision_visits;
create policy visits_delete on public.supervision_visits for delete to authenticated
  using (supervisor_id = auth.uid() or public.is_admin_manager());

drop policy if exists reschedule_insert on public.visit_reschedule_log;
create policy reschedule_insert on public.visit_reschedule_log for insert to authenticated
  with check (exists (select 1 from public.supervision_visits v
                      where v.id = visit_reschedule_log.visit_id
                        and v.supervisor_id = auth.uid()
                        and public.is_halaqa_supervisor(v.halaqa_id)));

create or replace function public.guard_visit_visitor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.supervisor_id is not distinct from old.supervisor_id
     and new.halaqa_id is not distinct from old.halaqa_id then
    return new;
  end if;
  if exists (
    select 1 from public.halaqat h
    join public.profiles p on p.id = new.supervisor_id and p.role = 'field_supervisor'
    where h.id = new.halaqa_id and h.supervisor_id = new.supervisor_id
  ) then
    return new;
  end if;
  raise exception 'الزائر مشرف هذه الحلقة الميداني — يجدول زياراته بنفسه.' using errcode = '23514';
end;
$$;
