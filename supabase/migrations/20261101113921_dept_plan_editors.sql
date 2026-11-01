-- محرّرو خطة القسم (طلب المستخدم 2026-11-01): المدير الفنيّ ومشرف المشروع يضيفان الأهداف والأنشطة ويعدّلانها
-- ويُسندان المسؤولين وينشئان خطة الشهر — بلا حذف هدفٍ أو نشاط، وتقريرُ القسم آخر الشهر للمدير الإداريّ وحده.
create or replace function public.can_edit_dept_plan()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select public.current_user_role()) in ('admin_manager', 'technical_manager', 'project_supervisor'), false)
$$;
revoke all on function public.can_edit_dept_plan() from public, anon;
grant execute on function public.can_edit_dept_plan() to authenticated;

drop policy dept_plans_insert on public.dept_plans;
create policy dept_plans_insert on public.dept_plans for insert to authenticated with check ((select public.can_edit_dept_plan()));

drop policy dept_plan_goals_insert on public.dept_plan_goals;
create policy dept_plan_goals_insert on public.dept_plan_goals for insert to authenticated with check ((select public.can_edit_dept_plan()));
drop policy dept_plan_goals_update on public.dept_plan_goals;
create policy dept_plan_goals_update on public.dept_plan_goals for update to authenticated
  using ((select public.can_edit_dept_plan())) with check ((select public.can_edit_dept_plan()));

drop policy dept_plan_tasks_insert on public.dept_plan_tasks;
create policy dept_plan_tasks_insert on public.dept_plan_tasks for insert to authenticated with check ((select public.can_edit_dept_plan()));
drop policy dept_plan_tasks_update on public.dept_plan_tasks;
create policy dept_plan_tasks_update on public.dept_plan_tasks for update to authenticated
  using ((select public.can_edit_dept_plan())) with check ((select public.can_edit_dept_plan()));

-- تعديلُ مسؤولي النشاط = إزالةُ من رُفع وإضافةُ من أُضيف
drop policy dept_plan_task_owners_insert on public.dept_plan_task_owners;
create policy dept_plan_task_owners_insert on public.dept_plan_task_owners for insert to authenticated with check ((select public.can_edit_dept_plan()));
drop policy dept_plan_task_owners_delete on public.dept_plan_task_owners;
create policy dept_plan_task_owners_delete on public.dept_plan_task_owners for delete to authenticated using ((select public.can_edit_dept_plan()));

-- حالةُ النشاط وملاحظتُه تبقيان للمدير الإداريّ ولمسؤولي النشاط (قرار 2026-10-31) — فتعديلُ المحرّر لا يمسّهما
create or replace function private.dept_task_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  p public.dept_plans%rowtype;
  v_start date;
begin
  select g.plan_id into new.plan_id from public.dept_plan_goals g where g.id = new.goal_id;
  if new.plan_id is null then
    raise exception 'الهدف غير موجود.' using errcode = '23503';
  end if;
  select * into p from public.dept_plans where id = new.plan_id;
  v_start := make_date(p.plan_year, p.plan_month, 1);
  if new.due_on < v_start or new.due_on > (v_start + interval '1 month' + interval '6 days')::date then
    raise exception 'موعد النشاط يكون داخل شهر الخطة.' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    if new.status is distinct from old.status or new.notes is distinct from old.notes then
      if auth.uid() is not null and not (public.is_admin_manager()
          or exists (select 1 from public.dept_plan_task_owners o where o.task_id = new.id and o.profile_id = auth.uid())) then
        raise exception 'حالة النشاط يحدّثها مسؤولوه أو المدير الإداري.' using errcode = '42501';
      end if;
      new.status_updated_by := auth.uid();
      new.status_updated_at := now();
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.dept_task_guard() from public, anon, authenticated;
